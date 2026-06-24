"""
app/services/orchestrator.py
============================
Thin coordination layer between the FastAPI routes and the ReAct agent.

This file used to contain the entire 487-line hardcoded pipeline. It has
been rewritten to delegate all reasoning to the LangGraph ReAct loop in
react_loop.py. This module now has two public functions:

    1. find_providers()   — Phase 1: runs the agent, returns candidates.
    2. confirm_booking()  — Phase 2: commits user-approved providers.

No tool calls, no intent parsing, and no geocoding logic belong here.
"""

from fastapi import HTTPException

from app.config import AUDIT_LOG_PATH
from app.services.react_loop import run_confirm_booking, run_find_providers


# ─────────────────────────────────────────────
# PHASE 1 — FIND PROVIDERS
# ─────────────────────────────────────────────

async def find_providers(user_prompt: str, session_id: str | None = None) -> dict:
    """
    Run the ReAct agent to discover provider candidates for the user's request.

    The agent reasons through the Roman Urdu prompt, geocodes the location,
    queries the database, and returns candidates for user approval.
    No booking is committed in this phase.

    Returns:
        A dict matching the FindProvidersResponse schema.

    Raises:
        HTTPException(500): If the agent loop fails unexpectedly.
    """
    try:
        result = await run_find_providers(user_prompt, session_id)
    except RuntimeError as e:
        # GROQ_API_KEY not configured
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "AGENT_ERROR",
                "message": (
                    "Agent mein masla aa gaya. Thodi der baad try karein. "
                    f"Error: {type(e).__name__}"
                ),
            },
        )

    return {
        "session_id": result["session_id"],
        "status": result["status"],
        "message": result["message"],
        "candidates": result["candidates"],
        "clarification_question": result.get("clarification_question"),
        "audit_log_path": str(AUDIT_LOG_PATH),
    }


# ─────────────────────────────────────────────
# PHASE 2 — CONFIRM BOOKING
# ─────────────────────────────────────────────

async def confirm_booking(session_id: str, approved_provider_ids: list[int]) -> dict:
    """
    Commit bookings for the user's approved providers.

    Loads the session from Phase 1, validates the TTL, and attempts to
    atomically claim each approved provider. Handles race conditions by
    returning partial success when some providers were taken concurrently.

    Returns:
        A dict matching the ConfirmBookingResponse schema.

    Raises:
        HTTPException(404): If session not found or expired.
        HTTPException(409): If session was already processed.
    """
    result = await run_confirm_booking(session_id, approved_provider_ids)

    # Map error codes to HTTP exceptions
    if "error" in result:
        error_code = result["error"]
        message = result["message"]

        if error_code == "SESSION_NOT_FOUND":
            raise HTTPException(status_code=404, detail={"error_code": error_code, "message": message})
        elif error_code == "SESSION_EXPIRED":
            raise HTTPException(status_code=410, detail={"error_code": error_code, "message": message})
        elif error_code == "SESSION_ALREADY_PROCESSED":
            raise HTTPException(status_code=409, detail={"error_code": error_code, "message": message})
        else:
            raise HTTPException(status_code=500, detail={"error_code": error_code, "message": message})

    return {
        "session_id": result["session_id"],
        "message": result["message"],
        "booked": result["booked"],
        "failed": result["failed"],
        "audit_log_path": str(AUDIT_LOG_PATH),
    }
