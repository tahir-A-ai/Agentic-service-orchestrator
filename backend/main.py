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

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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
    SignupRequest,
    LoginRequest,
    AuthResponse,
    PublicStatsResponse,
    ProviderStatsResponse,
    ActiveServicesResponse,
    ProviderJobsResponse,
    UpdateJobStatusRequest,
    UpdateAvailabilityRequest,
    ProviderAvailabilityResponse,
)
from app.services.database import init_db, get_db_session
from app.services.orchestrator import confirm_booking, find_providers
from app.services.auth import signup_user, login_user, get_current_user_from_credentials
from app.services.stats import get_public_stats, get_provider_stats, get_active_services


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
    "/api/v1/auth/signup",
    status_code=201,
    summary="Register a new user (customer or provider)",
    tags=["Auth"],
)
async def signup(request: SignupRequest):
    """
    Sign up a user. If role is provider, creates a linked provider entry.
    """
    with get_db_session() as db:
        user = signup_user(db, request.model_dump())
        return {"message": "User successfully registered.", "username": user.username}


@app.post(
    "/api/v1/auth/login",
    response_model=AuthResponse,
    summary="Login and get JWT token",
    tags=["Auth"],
)
async def login(request: LoginRequest) -> AuthResponse:
    """
    Login using username/password. Returns access token, role, and provider_id (if provider).
    """
    with get_db_session() as db:
        res = login_user(db, request.model_dump())
        return AuthResponse(**res)


# ─────────────────────────────────────────────
# STATS ROUTES
# ─────────────────────────────────────────────

@app.get(
    "/api/v1/stats/public",
    response_model=PublicStatsResponse,
    summary="Get landing page public statistics",
    tags=["Stats"],
)
async def public_stats() -> PublicStatsResponse:
    """
    Get live aggregates of registered providers, completed bookings, and average rating.
    """
    with get_db_session() as db:
        res = get_public_stats(db)
        return PublicStatsResponse(**res)


@app.get(
    "/api/v1/stats/provider/{provider_id}",
    response_model=ProviderStatsResponse,
    summary="Get live metrics for a specific provider dashboard",
    tags=["Stats"],
)
async def provider_stats(provider_id: int) -> ProviderStatsResponse:
    """
    Get live stats for a specific provider (active/completed jobs, rating).
    """
    with get_db_session() as db:
        res = get_provider_stats(db, provider_id)
        return ProviderStatsResponse(**res)


@app.get(
    "/api/v1/stats/services",
    response_model=ActiveServicesResponse,
    summary="Get a list of active service types",
    tags=["Stats"],
)
async def active_services() -> ActiveServicesResponse:
    """
    Get a list of all service types that currently have active providers.
    """
    with get_db_session() as db:
        services = get_active_services(db)
        return ActiveServicesResponse(active_services=services)


# ─────────────────────────────────────────────
# PROVIDER DASHBOARD ROUTES
# ─────────────────────────────────────────────

from app.services.provider import get_provider_jobs, update_job_status, update_provider_availability

@app.get(
    "/api/v1/providers/{provider_id}/jobs",
    response_model=ProviderJobsResponse,
    summary="Get jobs assigned to a provider",
    tags=["Provider"],
)
async def fetch_provider_jobs(provider_id: int) -> ProviderJobsResponse:
    with get_db_session() as db:
        jobs = get_provider_jobs(db, provider_id)
        return ProviderJobsResponse(jobs=jobs)

@app.put(
    "/api/v1/providers/{provider_id}/jobs/{session_id}/status",
    summary="Update the status of a job (In_Progress, Completed, Cancelled)",
    tags=["Provider"],
)
async def change_job_status(provider_id: int, session_id: str, request: UpdateJobStatusRequest):
    with get_db_session() as db:
        res = update_job_status(db, provider_id, session_id, request.status)
        return res

@app.put(
    "/api/v1/providers/{provider_id}/availability",
    response_model=ProviderAvailabilityResponse,
    summary="Toggle provider availability",
    tags=["Provider"],
)
async def toggle_availability(provider_id: int, request: UpdateAvailabilityRequest) -> ProviderAvailabilityResponse:
    with get_db_session() as db:
        res = update_provider_availability(db, provider_id, request.is_available)
        return ProviderAvailabilityResponse(**res)


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
async def book_service(request: ServiceRequest, current_user: dict = Depends(get_current_user_from_credentials)) -> FindProvidersResponse:
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
async def confirm_booking_route(request: ConfirmBookingRequest, current_user: dict = Depends(get_current_user_from_credentials)) -> ConfirmBookingResponse:
    """
    Phase 2 — Commits bookings for user-approved providers.
    """
    result = await confirm_booking(
        request.session_id, 
        request.approved_provider_ids,
        request.exact_address,
        request.customer_notes
    )

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
