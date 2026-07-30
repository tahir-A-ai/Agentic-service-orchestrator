from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class ServiceType(Base):
    """Registry of all service categories offered on the platform."""

    __tablename__ = "service_types"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    key          = Column(String(50), nullable=False, unique=True, index=True)   # e.g. "electrician"
    label        = Column(String(100), nullable=False)                            # e.g. "Electrician"
    label_urdu   = Column(String(100), nullable=False)                            # e.g. "BIJLI WALA"
    theme_color  = Column(String(20), nullable=False, default="#3B82F6")          # CSS hex color
    description  = Column(Text, nullable=False)                                   # Roman Urdu description
    aliases      = Column(Text, nullable=True)                                    # Comma-separated Roman Urdu keywords
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

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)
    name = Column(String(100), nullable=False)
    service_type_id = Column(Integer, ForeignKey("service_types.id"), nullable=False, index=True)
    location = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    rating = Column(Float, nullable=False, default=5.0)
    rating_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="Active")
    is_available = Column(Boolean, nullable=False, default=True)
    experience_years = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    user = relationship("User", back_populates="provider_profile", foreign_keys=[user_id])
    service_type_obj = relationship("ServiceType", backref="providers", foreign_keys=[service_type_id])

    @property
    def get_service_type_label(self) -> str:
        """Helper property so provider.get_service_type_label returns label string seamlessly."""
        return self.service_type_obj.label if self.service_type_obj else "Unknown"

    def __repr__(self) -> str:
        return f"<Provider(id={self.id}, name='{self.name}', service_type_id={self.service_type_id})>"


class User(Base):
    """A registered user — either a customer or a provider."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(150), nullable=True)
    email = Column(String(200), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, index=True)  # "customer" | "provider"
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=True)

    provider_profile = relationship("Provider", back_populates="user", uselist=False,
                                    foreign_keys="[Provider.user_id]")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"


class LocationCache(Base):
    """
    Cache of geocoded locations to avoid redundant Nominatim API calls.

    When a user's location text (e.g. "G-13, Islamabad") is geocoded for
    the first time, the result is saved here. Future requests for the same
    text skip the API and read directly from this table.
    """

    __tablename__ = "location_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(Text, nullable=False, unique=True, index=True)
    latitude = Column(Float, nullable=False)
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

    id = Column(String(36), primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    candidates = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    confirmed_provider_id = Column(Integer, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    exact_address = Column(String(255), nullable=True)
    customer_notes = Column(Text, nullable=True)
    customer_rating = Column(Integer, nullable=True)
    customer_confirmed_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<BookingSession(id='{self.id}', status='{self.status}')>"


class SessionDecline(Base):
    """
    Junction table recording provider job declines for scalable relational analytics.
    """
    __tablename__ = "session_declines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("booking_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    session = relationship("BookingSession", backref="declines", foreign_keys=[session_id])
    provider = relationship("Provider", backref="declines", foreign_keys=[provider_id])

    def __repr__(self) -> str:
        return f"<SessionDecline(session_id='{self.session_id}', provider_id={self.provider_id})>"
