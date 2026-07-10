"""
app/schemas.py
==============
Pydantic models for request/response validation.

These are NOT database models — they define the shape of data flowing
in and out of the API. For database table definitions, see app/models.py.

The API follows a two-phase booking flow:
    Phase 1 (book-service): User sends prompt → gets candidates back.
    Phase 2 (confirm-booking): User approves providers → bookings committed.
"""

from typing import Literal

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# SHARED SCHEMAS
# ─────────────────────────────────────────────

class ProviderDetail(BaseModel):
    """Serialisable snapshot of a provider."""

    id: int
    name: str
    service_type: str
    location: str
    rating: float
    status: str
    distance_km: float = Field(
        ...,
        description="Distance in kilometres between the user and the provider.",
    )


# ─────────────────────────────────────────────
# PHASE 1 — FIND PROVIDERS
# ─────────────────────────────────────────────

class ServiceRequest(BaseModel):
    """Incoming booking request payload (Phase 1)."""

    user_prompt: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="The user's service request in Roman Urdu or English.",
        examples=["G-13 mein AC wala bhej do, ghar ka AC theek nahi ho raha"],
    )
    session_id: str | None = Field(
        None,
        description="Optional session ID to continue an existing conversation.",
    )


class FindProvidersResponse(BaseModel):
    """Phase 1 response — candidates for user review, NOT a committed booking."""

    session_id: str = Field(
        ...,
        description="Unique session ID. Pass this to confirm-booking to complete the booking.",
    )
    status: Literal["pending_confirmation", "needs_clarification"] = Field(
        ...,
        description=(
            "pending_confirmation: candidates found, waiting for user approval. "
            "needs_clarification: agent needs more information from the user."
        ),
    )
    message: str = Field(
        ...,
        description="Agent's response message in Roman Urdu.",
    )
    candidates: dict[str, list[ProviderDetail]] = Field(
        default_factory=dict,
        description="Providers grouped by service_type. Empty if status is needs_clarification.",
    )
    clarification_question: str | None = Field(
        default=None,
        description="Follow-up question from the agent (only when status is needs_clarification).",
    )
    audit_log_path: str | None = None


# ─────────────────────────────────────────────
# PHASE 2 — CONFIRM BOOKING
# ─────────────────────────────────────────────

class ConfirmBookingRequest(BaseModel):
    """Phase 2 request — user approves specific providers from the candidates list."""

    session_id: str = Field(
        ...,
        description="The session_id from the Phase 1 response.",
    )
    approved_provider_ids: list[int] = Field(
        ...,
        min_length=1,
        description="List of provider IDs the user has approved for booking.",
    )
    exact_address: str = Field(
        ...,
        description="The customer's exact address (house/street).",
    )
    customer_notes: str | None = Field(
        None,
        description="Optional notes from the customer about the issue.",
    )


class ConfirmBookingResponse(BaseModel):
    """Phase 2 response — confirmation of committed bookings."""

    session_id: str
    message: str = Field(
        ...,
        description="Confirmation message in Roman Urdu.",
    )
    booked: list[ProviderDetail] = Field(
        ...,
        description="Providers successfully booked.",
    )
    failed: list[dict] = Field(
        default_factory=list,
        description=(
            "Providers that could not be booked (e.g., taken by another user "
            "between Phase 1 and Phase 2). Each dict has provider_id, name, reason."
        ),
    )
    audit_log_path: str | None = None


# ─────────────────────────────────────────────
# AUTH SCHEMAS
# ─────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=4, max_length=50)
    role: Literal["customer", "provider"]
    
    # Provider-specific fields (optional for signup request, required if role is provider)
    name: str | None = None
    service_type: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    provider_id: int | None = None
    service_type: str | None = None
    location: str | None = None


# ─────────────────────────────────────────────
# STATS SCHEMAS
# ─────────────────────────────────────────────

class PublicStatsResponse(BaseModel):
    providers_registered: int
    bookings_completed: int
    average_rating: float


class ProviderStatsResponse(BaseModel):
    active_jobs: int
    completed_jobs: int
    rating: float
    service_type: str | None = None

# ─────────────────────────────────────────────
# PROVIDER DASHBOARD
# ─────────────────────────────────────────────

class ProviderJob(BaseModel):
    """Represents a job assigned to a provider."""
    session_id: str
    status: str
    created_at: str
    service_type: str
    exact_address: str | None = None
    customer_notes: str | None = None

class ProviderJobsResponse(BaseModel):
    jobs: list[ProviderJob]

class UpdateJobStatusRequest(BaseModel):
    status: Literal["In_Progress", "Completed", "Pending_Completion", "Cancelled"]

class UpdateAvailabilityRequest(BaseModel):
    is_available: bool

class ProviderAvailabilityResponse(BaseModel):
    is_available: bool



class ActiveServicesResponse(BaseModel):
    active_services: list[str]

class CustomerConfirmRequest(BaseModel):
    session_id: str = Field(...)
    rating: int = Field(..., ge=1, le=5)

class CustomerConfirmResponse(BaseModel):
    message: str
    new_average_rating: float
