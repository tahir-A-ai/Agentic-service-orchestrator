from typing import Literal
from pydantic import BaseModel, Field, EmailStr

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


class ProviderStatsResponse(BaseModel):
    active_jobs: int
    completed_jobs: int
    declined_jobs: int = 0
    rating: float
    service_type: str | None = None


class ProviderJob(BaseModel):
    """Represents a job assigned to a provider."""
    session_id: str
    status: str
    created_at: str
    service_type: str
    exact_address: str | None = None
    customer_notes: str | None = None
    cancelled_by: str | None = None


class ProviderJobsResponse(BaseModel):
    jobs: list[ProviderJob]


class UpdateJobStatusRequest(BaseModel):
    status: Literal["In_Progress", "Completed", "Pending_Completion", "Cancelled"]


class UpdateAvailabilityRequest(BaseModel):
    is_available: bool


class ProviderAvailabilityResponse(BaseModel):
    is_available: bool
    status: str
    message: str


class UpdateProviderProfileRequest(BaseModel):
    full_name: str | None = Field(None, max_length=150)
    email: EmailStr | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    location: str | None = Field(None, max_length=200)
    bio: str | None = None


class UpdateProviderProfileResponse(BaseModel):
    message: str
    full_name: str | None
    email: str | None
    phone: str | None
    location: str | None
    bio: str | None
    photo_url: str | None
