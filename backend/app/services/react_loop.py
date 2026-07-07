"""
app/services/react_loop.py
==========================
LangGraph ReAct agent and Phase 1/Phase 2 execution runners.

This module is the heart of the new architecture. It replaces the old
hardcoded pipeline with a true ReAct loop where the LLM decides which
tools to call, in what order, and when it has enough information to stop.

Architecture
------------
* The agent is built using LangGraph's `create_react_agent` — a pre-built
  graph that implements the ReAct (Reasoning + Acting) pattern.
* LLM: Groq (llama-3.3-70b-versatile) via langchain-groq's ChatGroq.
* State persistence: LangGraph's SqliteSaver writes checkpoints to the
  same providers.db used by the rest of the application.
* Phase 1 (run_find_providers): runs the agent until it finishes reasoning,
  then extracts the candidates from tool call history.
* Phase 2 (run_confirm_booking): loads the session, commits approved
  providers via the atomic CAS in database.py.
"""

import json
import uuid
from datetime import datetime, timezone

from typing import TypedDict, NotRequired
from langchain.agents import create_agent
from langchain.agents.middleware.types import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, RemoveMessage, ToolMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.config import (
    DB_PATH,
    GROQ_API_KEY,
    GROQ_MODEL,
    REACT_MAX_ITERATIONS,
    REACT_SYSTEM_PROMPT,
    BOOKING_SESSION_TTL_MINUTES,
)
from app.core.logger import write_audit_log
from app.services.tools import BOOKING_TOOLS, set_session_id
from app.services.database import commit_booking, get_db_session
from app.models import BookingSession# ─────────────────────────────────────────────
# AGENT STATE & BUILDER
# ─────────────────────────────────────────────

class CustomAgentState(AgentState):
    current_service: NotRequired[str | None]
    current_location: NotRequired[str | None]
    current_coords: NotRequired[dict | None]


def _trim_messages(state):
    """
    Keep the system prompt plus the last 6 messages so the agent can
    answer follow-up questions using recent conversation context.
    """
    messages = state.get("messages", [])
    trimmed = messages[-6:] if len(messages) > 6 else messages
    return [SystemMessage(content=REACT_SYSTEM_PROMPT)] + trimmed


def _get_agent(checkpointer):
    """
    Build the LangGraph ReAct agent.
    
    The checkpointer is passed in from an async context manager
    to ensure it is properly initialized and closed per request.
    """
    if not GROQ_API_KEY or not GROQ_API_KEY.startswith("gsk_"):
        raise RuntimeError(
            "Invalid GROQ_API_KEY. "
            "Please set a valid Groq key (starts with 'gsk_') in your .env file."
        )

    llm = ChatGroq(
        model=GROQ_MODEL,
        api_key=GROQ_API_KEY,
        temperature=0,
    )

    return create_agent(
        model=llm,
        tools=BOOKING_TOOLS,
        checkpointer=checkpointer,
        system_prompt=REACT_SYSTEM_PROMPT,
        state_schema=CustomAgentState,
    )

# ─────────────────────────────────────────────
# MEMORY AND INTENT HELPERS
# ─────────────────────────────────────────────

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
                    # Replace with a compact summary, preserving ID for replacement
                    summary = {
                        "message": f"Found {count} active {service_type} providers in this search.",
                        "count": count,
                        "service_type": service_type,
                        # Keep only a minimal skeleton list
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
    # 1. Truncate heavy JSON in older tool messages
    messages = _truncate_old_tool_messages(list(messages), keep_recent_count=2)
    
    if len(messages) <= 12:
        return messages
        
    cut_idx = len(messages) - 12
    trimmed = list(messages[cut_idx:])
    
    # Boundary check: If trimmed[0] is a ToolMessage, we must include its parent AIMessage
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
    
    # Map tool_call_id to content
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
                
                # Check response
                response = tool_responses.get(tc_id)
                if response and "error" not in response:
                    if name == "geocode_location":
                        current_location = args.get("location_text")
                        current_coords = {"lat": response.get("lat"), "lon": response.get("lon")}
                    elif name == "query_providers" or name == "search_nearby_providers":
                        current_service = args.get("service_type")
                        
    # Update the state back to SQLite
    await agent.aupdate_state(config, {
        "current_service": current_service,
        "current_location": current_location,
        "current_coords": current_coords
    })

# ─────────────────────────────────────────────
# PHASE 1 — FIND PROVIDERS
# ─────────────────────────────────────────────

async def run_find_providers(user_prompt: str, session_id: str | None = None) -> dict:
    """
    Phase 1: Run the ReAct agent to discover provider candidates.

    The agent reasons through the user's Roman Urdu request, geocodes the
    location, and queries the database for available providers. It never
    commits a booking — that happens in Phase 2.

    Returns a dict with:
        session_id: str
        status: "pending_confirmation" | "needs_clarification"
        message: str (agent's Roman Urdu response)
        candidates: dict[str, list[dict]] (service_type -> ranked providers)
        clarification_question: str | None
    """
    if session_id is None:
        session_id = str(uuid.uuid4())

    # Set the session ID so tools can write audit logs
    set_session_id(session_id)

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

    # ── Run the ReAct loop ────────────────────────────────────────
    config = {
        "configurable": {"thread_id": session_id},
        "recursion_limit": REACT_MAX_ITERATIONS * 2,  # each iteration = 2 graph steps
    }

    async with AsyncSqliteSaver.from_conn_string(str(DB_PATH)) as checkpointer:
        agent = _get_agent(checkpointer)

        # ── Apply Pair-Safe Trimmer and Locked Context System Message ──
        state = await agent.aget_state(config)
        messages = state.values.get("messages", [])
        
        # Filter out previous locked_context message from history
        history_msgs = [m for m in messages if getattr(m, "id", None) != "locked_context"]
        
        # Trim history to keep last 12 messages safely
        trimmed_msgs = _pair_safe_trim(history_msgs)
        
        # Generate new locked context system message based on current state slots
        locked_msg = _get_locked_context_message(state.values)
        if locked_msg:
            trimmed_msgs.insert(0, locked_msg)
            
        # Clean up database checkpoint by sending RemoveMessages for trimmed/truncated logs
        trimmed_ids = {m.id for m in trimmed_msgs if getattr(m, "id", None)}
        removals = [RemoveMessage(id=m.id) for m in messages if getattr(m, "id", None) and m.id not in trimmed_ids]
        
        if removals or trimmed_msgs:
            await agent.aupdate_state(config, {"messages": removals + trimmed_msgs}, as_node="model")

        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=user_prompt)]},
            config=config,
        )

        # ── Update intent slots based on current turn tool results ──
        await _update_intent_state(agent, config, result["messages"])

    # ── Extract results from the conversation ─────────────────────
    messages = result["messages"]
    final_message = ""
    candidates: dict[str, list[dict]] = {}
    clarification_question: str | None = None
    iteration_count = 0

    # Prefer the final LLM response as the human-facing message.
    for msg in reversed(messages):
        if getattr(msg, "type", None) in {"ai", "assistant"}:
            final_message = getattr(msg, "content", "")
            break

    for msg in messages:
        # Count LLM reasoning steps
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            iteration_count += 1

        # Extract tool results from ToolMessages
        if msg.type == "tool":
            try:
                tool_result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content

                # Check for clarification
                if isinstance(tool_result, dict) and tool_result.get("clarification_requested"):
                    clarification_question = tool_result.get("question", "")

                # Check for provider results
                if isinstance(tool_result, dict) and "providers" in tool_result:
                    providers = tool_result["providers"]
                    if providers:
                        # Group by service_type
                        svc_type = providers[0].get("service_type", "Unknown")
                        candidates[svc_type] = providers

            except (json.JSONDecodeError, TypeError, KeyError):
                continue


    # ── Determine response status ─────────────────────────────────
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

    # ── Save session for Phase 2 ──────────────────────────────────
    if status == "pending_confirmation" and candidates:
        with get_db_session() as session:
            existing = session.query(BookingSession).filter(BookingSession.id == session_id).first()
            if existing:
                existing.candidates = json.dumps(candidates)
                existing.status = "pending"
            else:
                booking_session = BookingSession(
                    id=session_id,
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
            f"TTL: {BOOKING_SESSION_TTL_MINUTES} minutes.",
        )

    return {
        "session_id": session_id,
        "status": status,
        "message": final_message,
        "candidates": candidates,
        "clarification_question": clarification_question,
        "react_iterations": iteration_count,
    }


# ─────────────────────────────────────────────
# PHASE 2 — CONFIRM BOOKING
# ─────────────────────────────────────────────

async def run_confirm_booking(session_id: str, approved_provider_ids: list[int]) -> dict:
    """
    Phase 2: Commit bookings for the user's approved providers.

    Loads the BookingSession created in Phase 1, validates TTL, then
    attempts to atomically claim each approved provider via commit_booking().

    Handles race conditions: if a provider was taken by a concurrent
    request between Phase 1 and Phase 2, it appears in the 'failed' list
    and the system suggests the next best alternative.

    Returns a dict with:
        session_id: str
        message: str
        booked: list[dict]
        failed: list[dict]
    """
    set_session_id(session_id)

    write_audit_log(
        session_id,
        "[PLANNING]",
        (
            f"Phase 2 started. Session '{session_id}'. "
            f"User approved provider IDs: {approved_provider_ids}."
        ),
    )

    # ── Load and validate session ─────────────────────────────────
    with get_db_session() as session:
        booking_session = (
            session.query(BookingSession)
            .filter(BookingSession.id == session_id)
            .first()
        )

        if not booking_session:
            write_audit_log(
                session_id,
                "[DECISION]",
                f"Session '{session_id}' not found in DB. Returning 404.",
            )
            return {
                "error": "SESSION_NOT_FOUND",
                "message": "Session expired ya exist nahi karta. Naya booking start karein.",
            }

        if booking_session.status != "pending":
            write_audit_log(
                session_id,
                "[DECISION]",
                f"Session '{session_id}' status is '{booking_session.status}', not 'pending'. Cannot confirm.",
            )
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

        if age_minutes > BOOKING_SESSION_TTL_MINUTES:
            booking_session.status = "expired"
            session.commit()
            write_audit_log(
                session_id,
                "[DECISION]",
                f"Session '{session_id}' expired ({age_minutes:.1f} min > {BOOKING_SESSION_TTL_MINUTES} min TTL).",
            )
            return {
                "error": "SESSION_EXPIRED",
                "message": f"Session expire ho gaya ({BOOKING_SESSION_TTL_MINUTES} minute limit). Naya booking start karein.",
            }

        candidates_json = booking_session.candidates

    candidates: dict[str, list[dict]] = json.loads(candidates_json)

    # ── Build lookup of all candidate providers by ID ─────────────
    all_candidates: dict[int, dict] = {}
    for svc_providers in candidates.values():
        for p in svc_providers:
            all_candidates[p["id"]] = p

    # ── Attempt atomic booking for each approved provider ─────────
    booked: list[dict] = []
    failed: list[dict] = []

    for provider_id in approved_provider_ids:
        if provider_id not in all_candidates:
            write_audit_log(
                session_id,
                "[DECISION]",
                f"Provider ID {provider_id} not found in session candidates. Skipping.",
            )
            failed.append({
                "provider_id": provider_id,
                "reason": "Provider is not in the candidate list for this session.",
            })
            continue

        provider_info = all_candidates[provider_id]
        claimed = commit_booking(provider_id)

        if claimed:
            provider_info["status"] = "Busy"
            booked.append(provider_info)
            write_audit_log(
                session_id,
                "[ACTION]",
                (
                    f"BOOKING COMMITTED: Provider '{provider_info['name']}' "
                    f"(Id={provider_id}) status updated to 'Busy'."
                ),
            )
        else:
            failed.append({
                "provider_id": provider_id,
                "name": provider_info["name"],
                "service_type": provider_info["service_type"],
                "reason": "Provider was already booked by another user.",
            })
            write_audit_log(
                session_id,
                "[DECISION]",
                (
                    f"Atomic claim FAILED for '{provider_info['name']}' "
                    f"(Id={provider_id}) — already taken by a concurrent request."
                ),
            )

    # ── Update session status ─────────────────────────────────────
    with get_db_session() as session:
        booking_session = (
            session.query(BookingSession)
            .filter(BookingSession.id == session_id)
            .first()
        )
        if booking_session:
            booking_session.status = "confirmed"
            if booked:
                booking_session.confirmed_provider_id = booked[0]["id"]
            booking_session.confirmed_at = datetime.now(tz=timezone.utc)
            session.commit()

    # ── Build confirmation message ────────────────────────────────
    if booked and not failed:
        booked_names = ", ".join(f"'{p['name']}'" for p in booked)
        message = f"Booking confirm ho gayi! {booked_names} aapke kaam ke liye aa rahe hain."
    elif booked and failed:
        booked_names = ", ".join(f"'{p['name']}'" for p in booked)
        failed_names = ", ".join(f.get("name", f"ID {f['provider_id']}") for f in failed)
        message = (
            f"Kuch bookings confirm hain: {booked_names}. "
            f"Lekin {failed_names} already busy hain — naya provider try karein."
        )
    else:
        message = "Maaf kijiye, koi bhi provider available nahi raha. Naya booking start karein."

    write_audit_log(
        session_id,
        "[ACTION]",
        (
            f"Phase 2 complete. Booked: {len(booked)}, Failed: {len(failed)}. "
            f"Session '{session_id}' marked as 'confirmed'."
        ),
    )

    return {
        "session_id": session_id,
        "message": message,
        "booked": booked,
        "failed": failed,
    }
