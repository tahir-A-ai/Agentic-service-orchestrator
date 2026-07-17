"""
app/models.py
=============
SQLAlchemy ORM models — single source of truth for all database tables.

Each class here maps 1:1 to a table in providers.db. SQLAlchemy creates
the tables automatically on startup via Base.metadata.create_all().

Schema v2 changes:
  - User.provider_id removed; Provider now holds user_id FK (correct direction)
  - User gains full_name, phone, updated_at
  - Provider gains user_id (FK -> users.id), experience_years, bio
  - BookingSession gains customer_id (FK -> users.id), declined_provider_ids
  - ServiceType is a new table — drives dynamic service rendering system-wide

For request/response validation, see app/schemas.py.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class ServiceType(Base):
    """
    Registry of all service categories offered on the platform.

    This table is the single source of truth for service types.
    It drives:
      - Landing page service cards (theme_color, label, description)
      - Provider registration service selector
      - ReAct agent system prompt (valid service type list)
      - Agent tool validation (query_providers, search_nearby_providers)

    Adding a new row here automatically propagates the service type
    across the entire system without any code changes.
    """

    __tablename__ = "service_types"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    key          = Column(String(50), nullable=False, unique=True, index=True)   # e.g. "electrician"
    label        = Column(String(100), nullable=False)                            # e.g. "Electrician"
    label_urdu   = Column(String(100), nullable=False)                            # e.g. "BIJLI WALA"
    theme_color  = Column(String(20), nullable=False, default="#3B82F6")          # CSS hex color
    description  = Column(Text, nullable=False)                                   # Roman Urdu description
    sort_order   = Column(Integer, nullable=False, default=0)                     # display order
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<ServiceType(key='{self.key}', label='{self.label}')>"


class Provider(Base):
    """
    A local service provider (e.g. plumber, electrician).

    Linked to a User record via user_id. The latitude/longitude columns
    allow distance-based sorting when matching a provider to a user's
    geocoded location.
    """

    __tablename__ = "providers"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)
    name             = Column(String(100), nullable=False)
    service_type     = Column(String(50), nullable=False, index=True)   # must match ServiceType.label
    location         = Column(String(200), nullable=False)
    latitude         = Column(Float, nullable=False)
    longitude        = Column(Float, nullable=False)
    rating           = Column(Float, nullable=False, default=5.0)
    rating_count     = Column(Integer, nullable=False, default=0)
    status           = Column(String(20), nullable=False, default="Active")
    is_available     = Column(Boolean, nullable=False, default=True)
    experience_years = Column(Integer, nullable=True)
    bio              = Column(Text, nullable=True)

    user = relationship("User", back_populates="provider_profile", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<Provider(id={self.id}, name='{self.name}', service_type='{self.service_type}')>"


class User(Base):
    """
    A registered user — either a customer or a provider.

    Providers are linked via Provider.user_id (the provider record owns
    the FK, not the user record).

    Passwords are stored as bcrypt hashes — never plain text.
    Authentication is handled via JWT tokens.
    """

    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    full_name     = Column(String(150), nullable=True)
    username      = Column(String(100), nullable=False, unique=True, index=True)
    email         = Column(String(200), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    phone         = Column(String(20), nullable=True)
    role          = Column(String(20), nullable=False, index=True)  # "customer" | "provider"
    created_at    = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at    = Column(DateTime, nullable=True)

    provider_profile = relationship("Provider", back_populates="user", uselist=False,
                                    foreign_keys="[Provider.user_id]")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class LocationCache(Base):
    """
    Cache of geocoded locations to avoid redundant Nominatim API calls.

    When a user's location text (e.g. "G-13, Islamabad") is geocoded for
    the first time, the result is saved here. Future requests for the same
    text skip the API and read directly from this table.
    """

    __tablename__ = "location_cache"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    query     = Column(Text, nullable=False, unique=True, index=True)
    latitude  = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    def __repr__(self) -> str:
        return f"<LocationCache(query='{self.query}', lat={self.latitude}, lon={self.longitude})>"


class BookingSession(Base):
    """
    Persistent state between Phase 1 (find providers) and Phase 2 (confirm booking).

    Status lifecycle:
        pending             -> Phase 1 complete, waiting for user confirmation.
        Pending_Acceptance  -> Phase 2 complete, waiting for provider to accept.
        In_Progress         -> Provider accepted the job.
        Pending_Completion  -> Provider marked complete, awaiting customer confirmation.
        Completed           -> Customer confirmed and rated.
        Cancelled           -> Job cancelled by provider or customer.
        expired             -> TTL exceeded without confirmation.
    """

    __tablename__ = "booking_sessions"

    id                    = Column(String(36), primary_key=True)       # UUID4 = session_id
    customer_id           = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    candidates            = Column(Text, nullable=False)                # JSON blob of ranked candidates
    created_at            = Column(DateTime, nullable=False)
    status                = Column(String(20), nullable=False, default="pending", index=True)
    confirmed_provider_id = Column(Integer, nullable=True)             # which provider was booked
    confirmed_at          = Column(DateTime, nullable=True)            # when Phase 2 completed
    exact_address         = Column(String(255), nullable=True)         # Customer's full address
    customer_notes        = Column(Text, nullable=True)                # Any additional notes
    customer_rating       = Column(Integer, nullable=True)             # 1-5 star rating
    customer_confirmed_at = Column(DateTime, nullable=True)            # When customer confirmed
    declined_provider_ids = Column(Text, nullable=True, default="[]") # JSON list of declined provider IDs

    def __repr__(self) -> str:
        return f"<BookingSession(id='{self.id}', status='{self.status}')>"
