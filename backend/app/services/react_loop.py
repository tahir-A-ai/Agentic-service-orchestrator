"""LangGraph ReAct agent and Phase 1/Phase 2 execution runners."""

import json
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from typing import NotRequired
from langchain.agents import create_agent
from langchain.agents.middleware.types import AgentState
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, RemoveMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.core.config import settings
from app.system_prompt.prompt import build_system_prompt
from app.core.logger import write_audit_log
from app.services.tools import BOOKING_TOOLS, set_session_context, refresh_valid_service_types
from app.services.database import commit_booking, get_db_session
from app.models import BookingSession, Provider, ServiceType


# ── DB-aware checkpointer factory ─────────────────────────────────────────────────────

from contextlib import asynccontextmanager

@asynccontextmanager
async def _get_checkpointer():
    """
    Yield the appropriate LangGraph checkpointer based on DATABASE_URL:
      - SQLite  → AsyncSqliteSaver  (local dev, zero extra deps)
      - Postgres → AsyncPostgresSaver (production, scales horizontally)

    Both implement the identical LangGraph checkpointer protocol so all
    agent logic (aget_state, aupdate_state, ainvoke, adelete_thread) is
    completely unaffected by the switch.
    """
    db_url = settings.resolved_database_url
    if db_url.startswith("postgresql"):
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        import psycopg
        # Use a single async connection per request (pool is managed at app level)
        conn_str = db_url.replace("postgresql+psycopg2", "postgresql").replace("postgresql+psycopg", "postgresql")
        async with await psycopg.AsyncConnection.connect(conn_str) as conn:
            checkpointer = AsyncPostgresSaver(conn)
            yield checkpointer
    else:
        async with AsyncSqliteSaver.from_conn_string(str(settings.DB_PATH)) as checkpointer:
            yield checkpointer

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


def _compact_dialogue_history(messages: list, keep_turns: int = 6) -> list:
    """
    Production-grade dialogue compaction.

    Strategy
    --------
    • Split the full message list into "turns": each turn starts at a HumanMessage
      and ends just before the next HumanMessage (or at the end of the list).
    • For all turns EXCEPT the most recent one, strip every ToolMessage and every
      AIMessage that contains only tool_calls (i.e. the LLM's internal reasoning
      steps).  Retain only the human prompt and the assistant's final text reply.
    • The most recent (active) turn is kept verbatim so the agent sees the full
      tool scratchpad for the current invocation.
    • Only the last `keep_turns` cleaned turns are returned, preventing unbounded
      growth across long multi-turn sessions.

    Effect
    ------
    Reduces prompt-token count by ~60–80 % on follow-up turns compared with the
    naive trim, eliminating Groq queue delays caused by 11 k-token payloads.
    """
    if not messages:
        return messages

    # ── 1. Segment into turns (boundary = HumanMessage) ──────────────────────
    turns: list[list] = []
    current_turn: list = []
    for msg in messages:
        if getattr(msg, "type", None) == "human" and current_turn:
            turns.append(current_turn)
            current_turn = [msg]
        else:
            current_turn.append(msg)
    if current_turn:
        turns.append(current_turn)

    # ── 2. Compact all turns except the current (last) one ───────────────────
    def _compact_turn(turn_msgs: list) -> list:
        """Keep only human and final-text AI messages from a completed turn."""
        compacted = []
        for msg in turn_msgs:
            msg_type = getattr(msg, "type", None)
            if msg_type == "human":
                compacted.append(msg)
            elif msg_type in {"ai", "assistant"}:
                # Discard intermediate reasoning messages that only carry tool_calls
                has_text = bool(getattr(msg, "content", ""))
                has_tool_calls = bool(getattr(msg, "tool_calls", None))
                if has_text and not has_tool_calls:
                    compacted.append(msg)
            # ToolMessages are silently dropped for completed turns
        return compacted

    compacted_turns: list[list] = []
    for i, turn in enumerate(turns):
        if i < len(turns) - 1:
            # Completed prior turn → compact
            compacted_turns.append(_compact_turn(turn))
        else:
            # Current (active) turn → keep verbatim
            compacted_turns.append(turn)

    # ── 3. Keep only the last `keep_turns` turns ─────────────────────────────
    compacted_turns = compacted_turns[-keep_turns:]

    # ── 4. Flatten back to a linear message list ──────────────────────────────
    result: list = []
    for turn in compacted_turns:
        result.extend(turn)
    return result

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

def _extract_service_from_text(text: str, service_entries: list[dict]) -> str | None:
    """
    Pre-invoke alias matcher: scan user text for known service aliases/labels.
    Returns the canonical service label on the first match, or None.
    Allows locking `current_service` even before tools have run (e.g. when the
    agent asks for location clarification instead of calling query_providers).
    """
    lower = text.lower()
    for entry in service_entries:
        label = entry.get("label", "")
        aliases_raw = entry.get("aliases", "")
        candidates = [label.lower()]
        if aliases_raw:
            candidates += [a.strip().lower() for a in aliases_raw.split(",")]
        for alias in candidates:
            if alias and alias in lower:
                return label
    return None


def _fuse_location(previous: str | None, current_input: str) -> str:
    """
    Location fusion: if the user previously mentioned a general area (e.g. "DHA")
    and now supplies a sub-area/phase (e.g. "phase 4"), combine them into a
    single geocoding query ("DHA phase 4") to prevent amnesia loops.

    Heuristic: the new input is considered a sub-area if:
      • it doesn't contain a known top-level area keyword already, AND
      • it matches patterns like "phase N", "sector X", "block Y".
    """
    if not previous:
        return current_input
    sub_patterns = re.compile(
        r'^(phase|sector|block|town|extension|\d+)\b',
        re.IGNORECASE,
    )
    if sub_patterns.match(current_input.strip()):
        return f"{previous} {current_input.strip()}"
    return current_input


async def _update_intent_state(agent, config, messages, service_entries: list[dict] | None = None):
    """
    Post-invoke: scan completed tool responses and update intent slots in state.

    Enhancements over the original:
    • Alias matching — locks current_service even when the agent only clarified
      (i.e. query_providers was never called) by scanning HumanMessage text.
    • Location fusion — combines a previous general area with a new sub-area so
      geocode_location receives "DHA phase 4" instead of just "phase 4".
    """
    state = await agent.aget_state(config)
    current_service = state.values.get("current_service")
    current_location = state.values.get("current_location")
    current_coords = state.values.get("current_coords")

    # ── 1. Build tool-response lookup ─────────────────────────────────────────
    tool_responses: dict = {}
    for msg in messages:
        if getattr(msg, "type", None) == "tool":
            try:
                content = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                tool_responses[msg.tool_call_id] = content
            except Exception:
                pass

    # ── 2. Update from successful tool calls ──────────────────────────────────
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                name = tc.get("name")
                args = tc.get("args") or {}
                tc_id = tc.get("id")
                response = tool_responses.get(tc_id)
                if response and "error" not in str(response):
                    if name == "geocode_location":
                        raw_loc = args.get("location_text", "")
                        fused = _fuse_location(current_location, raw_loc)
                        current_location = fused
                        current_coords = {"lat": response.get("lat"), "lon": response.get("lon")}
                    elif name in {"query_providers", "search_nearby_providers"}:
                        current_service = args.get("service_type")

    # ── 3. Alias-based pre-fill (if service still unknown after tool scan) ────
    if not current_service and service_entries:
        for msg in messages:
            if getattr(msg, "type", None) == "human":
                detected = _extract_service_from_text(
                    getattr(msg, "content", ""), service_entries
                )
                if detected:
                    current_service = detected
                    break

    await agent.aupdate_state(config, {
        "current_service": current_service,
        "current_location": current_location,
        "current_coords": current_coords,
    })


async def clear_session_checkpoint(session_id: str) -> None:
    """
    Delete the LangGraph thread checkpoint for a cancelled session.

    When a customer cancels a booking, their old session’s LangGraph state
    must be wiped from the checkpointer. Otherwise, the next fresh
    request (which sends session_id=None and gets a new UUID) may cause
    a lock conflict because the old checkpointer state is still open.
    """
    try:
        async with _get_checkpointer() as checkpointer:
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
    set_session_context(session_id, excluded_provider_ids)

    with get_db_session() as _db:
        service_entries = [
            {"label": r.label, "aliases": r.aliases}
            for r in (
                _db.query(ServiceType.label, ServiceType.aliases)
                .join(Provider, Provider.service_type_id == ServiceType.id)
                .filter(
                    ServiceType.is_active == True,
                    Provider.status == "Active",
                    Provider.is_available == True,
                )
                .distinct()
                .order_by(ServiceType.sort_order)
                .all()
            )
        ]
    # No hardcoded fallback — the database is the sole authority.
    # If no providers exist yet, the agent truthfully says "no services available".
    if not service_entries:
        write_audit_log(
            session_id,
            "[WARNING]",
            "No active services with available providers found. "
            "Agent will inform user of unavailability.",
        )
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

    async with _get_checkpointer() as checkpointer:
        agent = _get_agent(checkpointer, system_prompt)
        state = await agent.aget_state(config)
        messages = state.values.get("messages", [])
        # Strip the injected locked-context sentinel before compacting,
        # then re-inject it as the first message so the agent always sees it.
        history_msgs = [m for m in messages if getattr(m, "id", None) != "locked_context"]
        compacted_msgs = _compact_dialogue_history(history_msgs, keep_turns=6)
        locked_msg = _get_locked_context_message(state.values)
        if locked_msg:
            compacted_msgs.insert(0, locked_msg)

        compacted_ids = {m.id for m in compacted_msgs if getattr(m, "id", None)}
        removals = [
            RemoveMessage(id=m.id)
            for m in messages
            if getattr(m, "id", None) and m.id not in compacted_ids
        ]

        # Only write to checkpointer when there are messages to actually purge.
        # Skipping when removals is empty avoids a redundant DB write before every invoke.
        if removals:
            await agent.aupdate_state(config, {"messages": removals})

        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=user_prompt)]},
            config=config,
        )
        await _update_intent_state(agent, config, result["messages"], service_entries)
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

        # ── Safety net: if LLM claims providers exist but candidates is empty,
        # it is hallucinating. Override with a truthful "no providers" message.
        if not candidates and final_message and (
            "nazdeeki providers available hain" in final_message
            or "providers available hain" in final_message
        ):
            final_message = "Is waqt koi aur provider available nahi hai, thodi der baad try karein."
            write_audit_log(
                session_id,
                "[DECISION]",
                "SAFETY NET: LLM claimed providers existed but candidates dict is empty. "
                "Overriding hallucinated message with honest 'no providers' response.",
            )

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
    Phase 2: Commit bookings for the user's approved providers.

    Loads the BookingSession created in Phase 1, validates TTL, then
    assigns the booking to the first approved provider in Pending_Acceptance state.
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
                
                if provider.user and provider.user.phone:
                    provider_info["phone"] = provider.user.phone
                provider_info["latitude"] = provider.latitude
                provider_info["longitude"] = provider.longitude
                provider_info["location"] = provider.location
                provider_info["exact_address"] = exact_address
                provider_info["customer_notes"] = customer_notes

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
