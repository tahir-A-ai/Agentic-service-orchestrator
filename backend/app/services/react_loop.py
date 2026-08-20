"""LangGraph ReAct agent and Phase 1/Phase 2 execution runners."""

import json
import uuid
from datetime import datetime, timezone

from typing import TypedDict, NotRequired
from langchain.agents import create_agent
from langchain.agents.middleware.types import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, RemoveMessage, ToolMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.core.config import settings
from app.system_prompt.prompt import build_system_prompt
from app.core.logger import write_audit_log
from app.services.tools import BOOKING_TOOLS, set_session_context, refresh_valid_service_types
from app.services.database import commit_booking, get_db_session
from app.models import BookingSession, Provider, ServiceType


class CustomAgentState(AgentState):
    current_service: NotRequired[str | None]
    current_location: NotRequired[str | None]
    current_coords: NotRequired[dict | None]


def _get_agent(checkpointer, system_prompt: str):
    """
    Build the LangGraph ReAct agent.

    The system_prompt is passed in from the caller (built dynamically from
    the ServiceType DB table so new service types propagate automatically).
    The checkpointer is passed in from an async context manager to ensure
    it is properly initialized and closed per request.
    """
    if not settings.GROQ_API_KEY or not settings.GROQ_API_KEY.startswith("gsk_"):
        raise RuntimeError(
            "Invalid GROQ_API_KEY. "
            "Please set a valid Groq key (starts with 'gsk_') in your .env file."
        )
    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0,
    )
    return create_agent(
        model=llm,
        tools=BOOKING_TOOLS,
        checkpointer=checkpointer,
        system_prompt=system_prompt,
        state_schema=CustomAgentState,
    )


def _truncate_old_tool_messages(messages: list, keep_recent_count: int = 2) -> list:
    """
    Truncate heavy provider JSON lists in older ToolMessages to save context window.
    Only keeps full detail for the last `keep_recent_count` tool messages.
    """
    tool_indices = [i for i, msg in enumerate(messages) if getattr(msg, "type", None) == "tool"]
    
    if len(tool_indices) > keep_recent_count:
        truncate_indices = tool_indices[:-keep_recent_count]
        for idx in truncate_indices:
            msg = messages[idx]
            try:
                content = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                if isinstance(content, dict) and "providers" in content:
                    providers = content.get("providers", [])
                    service_type = content.get("service_type", "Unknown")
                    count = len(providers)
                    summary = {
                        "message": f"Found {count} active {service_type} providers in this search.",
                        "count": count,
                        "service_type": service_type,
                        "providers": [{"id": p["id"], "name": p["name"], "rating": p["rating"]} for p in providers[:1]]
                    }
                    messages[idx] = ToolMessage(
                        id=msg.id,
                        content=json.dumps(summary),
                        tool_call_id=msg.tool_call_id,
                        status=msg.status
                    )
            except Exception:
                pass
    return messages

def _pair_safe_trim(messages: list) -> list:
    """
    Trim conversation to keep the last 12 messages.
    Ensures we don't sever the link between AIMessage and ToolMessage.
    """
    messages = _truncate_old_tool_messages(list(messages), keep_recent_count=2)
    
    if len(messages) <= 12:
        return messages
        
    cut_idx = len(messages) - 12
    trimmed = list(messages[cut_idx:])
    
    while len(trimmed) > 0 and getattr(trimmed[0], "type", None) == "tool":
        cut_idx -= 1
        if cut_idx >= 0:
            trimmed.insert(0, messages[cut_idx])
        else:
            break
            
    return trimmed

def _get_locked_context_message(state_values: dict) -> SystemMessage | None:
    """
    Construct a SystemMessage with the locked intent coordinates and service type.
    """
    svc = state_values.get("current_service")
    loc = state_values.get("current_location")
    coords = state_values.get("current_coords")
    
    locked_context = []
    if svc:
        locked_context.append(f"current_service: {svc}")
    if loc:
        locked_context.append(f"current_location: {loc}")
    if coords:
        locked_context.append(f"current_coords: {coords}")
        
    if locked_context:
        content = (
            "[LOCKED CONTEXT]\n"
            "The following parameters are locked for the current request. "
            "Prioritize these parameters for all provider queries and reasoning. "
            "Do not change or lose these unless the user explicitly requests a different service or location:\n"
            + "\n".join(locked_context)
        )
        return SystemMessage(content=content, id="locked_context")
    return None

async def _update_intent_state(agent, config, messages):
    """
    Scan conversation messages for successful tool runs and update intent slots in state.
    """
    state = await agent.aget_state(config)
    current_service = state.values.get("current_service")
    current_location = state.values.get("current_location")
    current_coords = state.values.get("current_coords")
    
    tool_responses = {}
    for msg in messages:
        if getattr(msg, "type", None) == "tool":
            try:
                content = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                tool_responses[msg.tool_call_id] = content
            except Exception:
                pass
                
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                name = tc.get("name")
                args = tc.get("args") or {}
                tc_id = tc.get("id")

                response = tool_responses.get(tc_id)
                if response and "error" not in response:
                    if name == "geocode_location":
                        current_location = args.get("location_text")
                        current_coords = {"lat": response.get("lat"), "lon": response.get("lon")}
                    elif name == "query_providers" or name == "search_nearby_providers":
                        current_service = args.get("service_type")
                        
    await agent.aupdate_state(config, {
        "current_service": current_service,
        "current_location": current_location,
        "current_coords": current_coords
    })


async def clear_session_checkpoint(session_id: str) -> None:
    """
    Delete the LangGraph checkpoint associated with a cancelled session.
    
    Failures are recorded in the audit log without being raised.
    """
    try:
        async with AsyncSqliteSaver.from_conn_string(str(settings.DB_PATH)) as checkpointer:
            await checkpointer.adelete_thread(session_id)
        write_audit_log(
            session_id,
            "[ACTION]",
            f"LangGraph checkpoint cleared for cancelled session {session_id}.",
        )
    except Exception as e:
        write_audit_log(
            session_id,
            "[ACTION]",
            f"Warning: Could not clear LangGraph checkpoint for session {session_id}: {e}",
        )



async def run_find_providers(
    user_prompt: str,
    session_id: str | None = None,
    excluded_provider_ids: list[int] | None = None,
    customer_id: int | None = None,
) -> dict:
    """
    Discover service-provider candidates from the user's request without creating a booking.
    
    Parameters:
        user_prompt (str): User's service and location request.
        session_id (str | None): Existing session identifier to resume, or None to create one.
        excluded_provider_ids (list[int] | None): Provider IDs to exclude from the search.
        customer_id (int | None): Customer ID associated with the booking session.
    
    Returns:
        dict: Session ID, status, agent message, provider candidates grouped by service type,
            clarification question, and ReAct tool-call count.
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
    set_session_context(session_id, excluded_provider_ids)

    with get_db_session() as _db:
        service_entries = [
            {"label": r.label, "aliases": r.aliases}
            for r in _db.query(ServiceType.label, ServiceType.aliases).filter(
                ServiceType.is_active == True
            ).order_by(ServiceType.sort_order).all()
        ]
    if not service_entries:
        service_entries = [
            {"label": "Electrician", "aliases": "bijli wala, electrician, bijli"},
            {"label": "Plumber", "aliases": "nalqe wala, plumber, pani"}
        ]
    system_prompt = build_system_prompt(service_entries)

    write_audit_log(
        session_id,
        "[PLANNING]",
        (
            f'User prompt received: "{user_prompt}". '
            "Starting LangGraph ReAct loop. "
            "Agent will geocode location, query providers, and present candidates. "
            "No booking will be committed in this phase."
        ),
    )

    config = {
        "configurable": {"thread_id": session_id},
        "recursion_limit": settings.REACT_MAX_ITERATIONS * 2, 
    }

    async with AsyncSqliteSaver.from_conn_string(str(settings.DB_PATH)) as checkpointer:
        agent = _get_agent(checkpointer, system_prompt)
        state = await agent.aget_state(config)
        messages = state.values.get("messages", [])
        history_msgs = [m for m in messages if getattr(m, "id", None) != "locked_context"]
        trimmed_msgs = _pair_safe_trim(history_msgs)
        locked_msg = _get_locked_context_message(state.values)
        if locked_msg:
            trimmed_msgs.insert(0, locked_msg)
            
        trimmed_ids = {m.id for m in trimmed_msgs if getattr(m, "id", None)}
        removals = [RemoveMessage(id=m.id) for m in messages if getattr(m, "id", None) and m.id not in trimmed_ids]
        
        if removals or trimmed_msgs:
            await agent.aupdate_state(config, {"messages": removals + trimmed_msgs})

        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=user_prompt)]},
            config=config,
        )
        await _update_intent_state(agent, config, result["messages"])
    messages = result["messages"]
    final_message = ""
    candidates: dict[str, list[dict]] = {}
    clarification_question: str | None = None
    iteration_count = 0
    for msg in reversed(messages):
        if getattr(msg, "type", None) in {"ai", "assistant"}:
            final_message = getattr(msg, "content", "")
            break

    for msg in messages:
        if msg.type == "human":
            candidates.clear()
            clarification_question = None
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            iteration_count += 1
        if msg.type == "tool":
            try:
                tool_result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                if isinstance(tool_result, dict) and tool_result.get("clarification_requested"):
                    clarification_question = tool_result.get("question", "")
                if isinstance(tool_result, dict) and "providers" in tool_result:
                    providers = tool_result["providers"]
                    if providers:
                        svc_type = providers[0].get("service_type", "Unknown")
                        candidates[svc_type] = providers

            except (json.JSONDecodeError, TypeError, KeyError):
                continue
    if clarification_question:
        status = "needs_clarification"
        write_audit_log(
            session_id,
            "[DECISION]",
            f"Agent requested clarification: '{clarification_question}'. "
            "Returning to user for more information.",
        )
    else:
        status = "pending_confirmation"
        write_audit_log(
            session_id,
            "[DECISION]",
            (
                f"ReAct loop complete after {iteration_count} tool call(s). "
                f"Found candidates for: {list(candidates.keys())}. "
                f"Total providers: {sum(len(v) for v in candidates.values())}. "
                "Waiting for user confirmation."
            ),
        )

    if status == "pending_confirmation" and candidates:
        with get_db_session() as session:
            existing = session.query(BookingSession).filter(BookingSession.id == session_id).first()
            if existing:
                existing.candidates = json.dumps(candidates)
                existing.status = "pending"
                existing.created_at = datetime.now(tz=timezone.utc)
                if customer_id is not None:
                    existing.customer_id = customer_id
            else:
                booking_session = BookingSession(
                    id=session_id,
                    customer_id=customer_id,
                    candidates=json.dumps(candidates),
                    created_at=datetime.now(tz=timezone.utc),
                    status="pending",
                )
                session.add(booking_session)
            session.commit()

        write_audit_log(
            session_id,
            "[ACTION]",
            f"BookingSession '{session_id}' saved to DB (status=pending). "
            f"TTL: {settings.BOOKING_SESSION_TTL_MINUTES} minutes.",
        )

    return {
        "session_id": session_id,
        "status": status,
        "message": final_message,
        "candidates": candidates,
        "clarification_question": clarification_question,
        "react_iterations": iteration_count,
    }




async def run_confirm_booking(
    session_id: str, 
    approved_provider_ids: list[int],
    exact_address: str,
    customer_notes: str | None
) -> dict:
    """
    Confirm a selected provider for a pending booking session.
    
    Parameters:
        session_id (str): Identifier of the pending booking session.
        approved_provider_ids (list[int]): Provider IDs approved by the customer; only the first is considered.
        exact_address (str): Address where the service will be provided.
        customer_notes (str | None): Optional instructions or details for the provider.
    
    Returns:
        dict: Booking result containing the session ID, user-facing message, booked providers, and failed providers.
    """
    set_session_context(session_id)

    write_audit_log(
        session_id,
        "[PLANNING]",
        (
            f"Phase 2 started. Session '{session_id}'. "
            f"User approved provider IDs: {approved_provider_ids}. Address: {exact_address}"
        ),
    )

    with get_db_session() as session:
        booking_session = (
            session.query(BookingSession)
            .filter(BookingSession.id == session_id)
            .first()
        )

        if not booking_session:
            return {
                "error": "SESSION_NOT_FOUND",
                "message": "Session expired ya exist nahi karta. Naya booking start karein.",
            }

        if booking_session.status != "pending":
            return {
                "error": "SESSION_ALREADY_PROCESSED",
                "message": "Yeh session pehle se process ho chuka hai.",
            }

        # Check TTL
        now = datetime.now(tz=timezone.utc)
        created = booking_session.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_minutes = (now - created).total_seconds() / 60

        if age_minutes > settings.BOOKING_SESSION_TTL_MINUTES:
            booking_session.status = "expired"
            session.commit()
            return {
                "error": "SESSION_EXPIRED",
                "message": f"Session expire ho gaya ({settings.BOOKING_SESSION_TTL_MINUTES} minute limit). Naya booking start karein.",
            }

        candidates_json = booking_session.candidates

    candidates: dict[str, list[dict]] = json.loads(candidates_json)
    all_candidates: dict[int, dict] = {}
    for svc_providers in candidates.values():
        for p in svc_providers:
            all_candidates[p["id"]] = p

    booked: list[dict] = []
    failed: list[dict] = []
    provider_id = approved_provider_ids[0] if approved_provider_ids else None
    
    if provider_id and provider_id in all_candidates:
        provider_info = all_candidates[provider_id]
        
        with get_db_session() as session:
            provider = session.query(Provider).filter(Provider.id == provider_id).first()
            if provider and provider.status == "Active" and (provider.is_available or provider.is_available is None):
                booking_session = session.query(BookingSession).filter(BookingSession.id == session_id).first()
                booking_session.status = "Pending_Acceptance"
                booking_session.confirmed_provider_id = provider_id
                booking_session.confirmed_at = datetime.now(tz=timezone.utc)
                booking_session.exact_address = exact_address
                booking_session.customer_notes = customer_notes
                session.commit()
                
                booked.append(provider_info)
            else:
                failed.append({
                    "provider_id": provider_id,
                    "name": provider_info["name"],
                    "service_type": provider_info["service_type"],
                    "reason": "Provider is currently busy or offline.",
                })
    else:
        if provider_id:
            failed.append({
                "provider_id": provider_id,
                "reason": "Provider is not in the candidate list for this session.",
            })
    if booked:
        booked_names = ", ".join(f"'{p['name']}'" for p in booked)
        message = f"Booking request bhej di gayi hai! {booked_names} accept karne ke baad aapko notify kiya jayega."
    else:
        message = "Maaf kijiye, selected provider available nahi hai. Naya booking start karein."

    return {
        "session_id": session_id,
        "message": message,
        "booked": booked,
        "failed": failed,
    }
