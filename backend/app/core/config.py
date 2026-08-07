"""Centralised, validated application configuration."""

from pathlib import Path
from typing import Final

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Silently ignore unknown env vars
    )


    # BASE_DIR is resolved at class-definition time (not from env)
    BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent.parent

    @computed_field  # type: ignore[misc]
    @property
    def DB_PATH(self) -> Path:
        return self.BASE_DIR / "providers.db"

    @computed_field  # type: ignore[misc]
    @property
    def AUDIT_LOG_PATH(self) -> Path:
        return self.BASE_DIR / "trace_logs.txt"


    DATABASE_URL: str = Field(
        default="",
        description="Full database URL. Falls back to local SQLite if empty.",
    )

    @computed_field  # type: ignore[misc]
    @property
    def resolved_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"sqlite:///{self.DB_PATH.resolve().as_posix()}"


    API_TITLE: str = "Service Orchestrator API"
    API_DESCRIPTION: str = (
        "An agentic backend that parses Roman Urdu service requests, "
        "reasons over a local provider database, and executes simulated bookings "
        "with full traceable audit logs."
    )
    API_VERSION: str = "1.0.0"


    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")


    CORS_ALLOW_ORIGINS: str = Field(
        default="*",
        description="Comma-separated list of allowed CORS origins.",
    )

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]


    VALID_STEP_TYPES: frozenset[str] = frozenset(
        {"[PLANNING]", "[TOOL USAGE]", "[DECISION]", "[ACTION]"}
    )


    JWT_SECRET: str = Field(
        ...,
        description="Secret key for signing JWT tokens. MUST be set in .env.",
    )

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "JWT_SECRET environment variable is missing! Refusing to start."
            )
        return v


    GROQ_API_KEY: str | None = Field(default=None)
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")


    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_USER_AGENT: str = "service-orchestrator/1.0 (local-marketplace)"


    SERVICE_UNKNOWN: str = "SERVICE_UNKNOWN"
    LOCATION_UNKNOWN: str = "LOCATION_UNKNOWN"
    BOOKING_SESSION_TTL_MINUTES: int = 10
    REACT_MAX_ITERATIONS: int = 10
    PROVIDER_SEARCH_RADIUS_KM: float = 10.0


# Singleton — import `settings` everywhere, never instantiate Settings directly
settings = Settings()
