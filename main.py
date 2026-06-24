"""
main.py
=======
FastAPI application entry-point.

Responsibilities of this file (and ONLY this file):
    1. Instantiate the FastAPI application with metadata.
    2. Register CORS middleware.
    3. Declare the routes:
       - POST /api/v1/book-service     (Phase 1 — find providers)
       - POST /api/v1/confirm-booking  (Phase 2 — commit bookings)
       - GET  /health                  (liveness probe)
    4. Delegate ALL business logic to app.services.orchestrator.

No database calls, no SQL, no audit-log writes, and no intent-parsing logic
belong here. If you are adding any of that here you are in the wrong file.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    API_DESCRIPTION,
    API_TITLE,
    API_VERSION,
    CORS_ALLOW_ORIGINS,
    DB_PATH,
)
from app.schemas import (
    ConfirmBookingRequest,
    ConfirmBookingResponse,
    FindProvidersResponse,
    ProviderDetail,
    ServiceRequest,
)
from app.services.database import init_db
from app.services.orchestrator import confirm_booking, find_providers


# ─────────────────────────────────────────────
# LIFESPAN — startup / shutdown hooks
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once on startup (before any request is served).
    Creates all database tables via SQLAlchemy if they do not exist.
    """
    init_db()
    yield


# ─────────────────────────────────────────────
# APPLICATION FACTORY
# ─────────────────────────────────────────────

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    contact={"name": "Karigar.pk — Islamabad Local Services Marketplace"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.post(
    "/api/v1/book-service",
    response_model=FindProvidersResponse,
    summary="Find available service providers (Phase 1)",
    description=(
        "Accepts a Roman Urdu natural-language request, runs the ReAct "
        "agent to discover available providers, and returns candidates "
        "for the user to review and approve. No booking is committed."
    ),
    tags=["Booking"],
)
async def book_service(request: ServiceRequest) -> FindProvidersResponse:
    """
    Phase 1 — Agent discovers providers, returns candidates for approval.
    """
    result = await find_providers(request.user_prompt, request.session_id)

    # Convert raw provider dicts to ProviderDetail models
    candidates: dict[str, list[ProviderDetail]] = {}
    for svc_type, providers in result.get("candidates", {}).items():
        candidates[svc_type] = [ProviderDetail(**p) for p in providers]

    return FindProvidersResponse(
        session_id=result["session_id"],
        status=result["status"],
        message=result["message"],
        candidates=candidates,
        clarification_question=result.get("clarification_question"),
        audit_log_path=result.get("audit_log_path"),
    )


@app.post(
    "/api/v1/confirm-booking",
    response_model=ConfirmBookingResponse,
    summary="Confirm and commit a booking (Phase 2)",
    description=(
        "After reviewing the candidates from Phase 1, the user approves "
        "specific providers by their IDs. This endpoint atomically commits "
        "each booking. Handles race conditions where providers may have been "
        "booked by another user during the review period."
    ),
    tags=["Booking"],
)
async def confirm_booking_route(request: ConfirmBookingRequest) -> ConfirmBookingResponse:
    """
    Phase 2 — Commits bookings for user-approved providers.
    """
    result = await confirm_booking(request.session_id, request.approved_provider_ids)

    return ConfirmBookingResponse(
        session_id=result["session_id"],
        message=result["message"],
        booked=[ProviderDetail(**p) for p in result["booked"]],
        failed=result.get("failed", []),
        audit_log_path=result.get("audit_log_path"),
    )


@app.get("/health", summary="Health check", tags=["Ops"])
async def health() -> dict:
    """
    Lightweight liveness probe.
    """
    db_ok = DB_PATH.exists()
    return {
        "status":   "healthy" if db_ok else "degraded",
        "database": str(DB_PATH),
        "db_found": db_ok,
        "version":  API_VERSION,
    }


# ─────────────────────────────────────────────
# ENTRYPOINT (python main.py for local dev)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
