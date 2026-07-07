"""
app/models.py
=============
SQLAlchemy ORM models — single source of truth for all database tables.

Each class here maps 1:1 to a table in providers.db. SQLAlchemy creates
the tables automatically on startup via Base.metadata.create_all().

For request/response validation, see app/schemas.py.
"""

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class Provider(Base):
    """
    A local service provider (e.g. plumber, electrician, AC technician).

    The latitude/longitude columns allow distance-based sorting when
    matching a provider to a user's geocoded location.
    """

    __tablename__ = "providers"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(100), nullable=False)
    service_type = Column(String(50), nullable=False, index=True)
    location     = Column(String(200), nullable=False)
    latitude     = Column(Float, nullable=False)
    longitude    = Column(Float, nullable=False)
    rating       = Column(Float, nullable=False, default=0.0)
    status       = Column(String(20), nullable=False, default="Active")

    def __repr__(self) -> str:
        return f"<Provider(id={self.id}, name='{self.name}', service_type='{self.service_type}')>"


class User(Base):
    """
    A registered user — either a customer or a provider.

    Providers link to the providers table via provider_id.
    Customers have provider_id = NULL.

    Passwords are stored as plain text for MVP simplicity.
    Authentication is handled via JWT tokens.
    """

    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    username    = Column(String(100), nullable=False, unique=True, index=True)
    email       = Column(String(200), nullable=False, unique=True, index=True)
    password    = Column(String(255), nullable=False)
    role        = Column(String(20), nullable=False, index=True)  # "customer" | "provider"
    provider_id = Column(Integer, nullable=True)  # links to providers.id for role="provider"
    created_at  = Column(DateTime, nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class LocationCache(Base):
    """
    Cache of geocoded locations to avoid redundant Nominatim API calls.

    When a user's location text (e.g. "G-13, Islamabad") is geocoded for
    the first time, the result is saved here. Future requests for the same
    text skip the API and read directly from this table.

    The query column stores the normalised (lowercased, stripped) text so
    that "G-13, Islamabad" and "g-13, islamabad" both hit the same row.
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

    When the ReAct agent completes provider discovery (Phase 1), the session_id
    and candidate JSON are stored here. The user reviews the candidates, selects
    which providers to approve, and calls the confirm-booking endpoint with the
    session_id. This table bridges that gap.

    The status lifecycle is:
        pending   → Phase 1 complete, waiting for user confirmation.
        confirmed → Phase 2 complete, booking(s) committed.
        expired   → TTL exceeded without confirmation (cleaned up at query time).
    """

    __tablename__ = "booking_sessions"

    id                    = Column(String(36), primary_key=True)  # UUID4 = session_id
    candidates            = Column(Text, nullable=False)           # JSON blob of ranked candidates
    created_at            = Column(DateTime, nullable=False)
    status                = Column(String(20), nullable=False, default="pending", index=True)
    confirmed_provider_id = Column(Integer, nullable=True)         # which provider was booked
    confirmed_at          = Column(DateTime, nullable=True)        # when Phase 2 completed

    def __repr__(self) -> str:
        return f"<BookingSession(id='{self.id}', status='{self.status}')>"

