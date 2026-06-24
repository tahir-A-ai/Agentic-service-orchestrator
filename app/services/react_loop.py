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

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
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
# AGENT BUILDER
# ─────────────────────────────────────────────

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

    return create_react_agent(
        model=llm,
        tools=BOOKING_TOOLS,
        checkpointer=checkpointer,
        prompt=REACT_SYSTEM_PROMPT,
    )

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

        result = await agent.ainvoke(
            {"messages": [HumanMessage(content=user_prompt)]},
            config=config,
        )

    # ── Extract results from the conversation ─────────────────────
    messages = result["messages"]
    final_message = messages[-1].content if messages else ""

    # Parse tool call results to extract candidates
    candidates: dict[str, list[dict]] = {}
    clarification_question: str | None = None
    iteration_count = 0

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
