from typing import Literal
from pydantic import BaseModel, Field
from .provider import ProviderDetail

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
    excluded_provider_ids: list[int] | None = Field(
        default_factory=list,
        description="List of provider IDs to exclude from this search (e.g. they previously declined).",
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


class CustomerConfirmRequest(BaseModel):
    session_id: str = Field(...)
    rating: int = Field(..., ge=1, le=5)
    review_text: str | None = Field(None, max_length=1000, description="Optional written review from the customer.")

class CustomerConfirmResponse(BaseModel):
    message: str
    new_average_rating: float

class CancelBookingRequest(BaseModel):
    session_id: str
