from typing import Literal
from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    full_name: str | None = Field(None, max_length=150)
    email: EmailStr = Field(..., max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    phone: str | None = Field(None, max_length=20)
    role: Literal["customer", "provider"]

    # Provider-specific fields (required when role is provider)
    name: str | None = None
    service_type: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    experience_years: int | None = None
    bio: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    full_name: str | None = None
    provider_id: int | None = None
    service_type: str | None = None
    location: str | None = None
    phone: str | None = None
    bio: str | None = None
    photo_url: str | None = None
