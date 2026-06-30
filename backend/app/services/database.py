"""
app/services/database.py
========================
All database interaction is centralised here using SQLAlchemy ORM.

Design decisions
----------------
* SQLAlchemy's sessionmaker provides safe, scoped database sessions.
* Every query uses ORM filters — no raw SQL string interpolation.
* Public functions return plain Python dicts so callers are ORM-agnostic.
"""

import math
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import DATABASE_URL
from app.models import Base, LocationCache, Provider

# ─────────────────────────────────────────────
# ENGINE & SESSION FACTORY
# ─────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db() -> None:
    """
    Create all tables defined in app/models.py if they do not exist.
    Called once during the FastAPI lifespan startup event.
    """
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy session and guarantee it is closed afterwards.
    Rolls back on exception, commits on success if the caller
    has already made changes.
    """
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ─────────────────────────────────────────────
# READ — ACTIVE PROVIDERS (with distance sort)
# ─────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance (in km) between two points
    on the Earth using the Haversine formula.
    """
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def query_active_providers(
    service_type: str,
    user_lat: float,
    user_lon: float,
) -> list[dict]:
    """
    Return all Active providers matching service_type, sorted by
    distance (nearest first), then by rating (highest first).

    Each returned dict includes a 'distance_km' field.
    """
    with get_db_session() as session:
        providers = (
            session.query(Provider)
            .filter(Provider.service_type == service_type)
            .filter(Provider.status == "Active")
            .all()
        )

        results = []
        for p in providers:
            dist = _haversine(user_lat, user_lon, float(p.latitude), float(p.longitude))  # type: ignore[arg-type]
            results.append({
                "id":           p.id,
                "name":         p.name,
                "service_type": p.service_type,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
                "distance_km":  round(dist, 2),
            })

        # Sort: nearest first, then highest rated
        results.sort(key=lambda x: (x["distance_km"], -x["rating"]))

    return results


def query_all_active_providers(service_type: str) -> list[dict]:
    """
    Return ALL active providers matching service_type across the entire city,
    sorted by rating (highest first). No location filtering.

    Used as a fallback when no providers are found in the user's requested sector.
    """
    with get_db_session() as session:
        providers = (
            session.query(Provider)
            .filter(Provider.service_type == service_type)
            .filter(Provider.status == "Active")
            .all()
        )

        results = []
        for p in providers:
            results.append({
                "id":           p.id,
                "name":         p.name,
                "service_type": p.service_type,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
            })

        # Sort: highest rated first
        results.sort(key=lambda x: -x["rating"])

    return results


def query_busy_providers(
    service_type: str,
    user_lat: float,
    user_lon: float,
) -> list[dict]:
    """
    Return Busy providers matching service_type near the user location.
    Used so the agent can distinguish "no active providers" from "providers exist but are busy".
    """
    with get_db_session() as session:
        providers = (
            session.query(Provider)
            .filter(Provider.service_type == service_type)
            .filter(Provider.status == "Busy")
            .all()
        )

        results = []
        for p in providers:
            dist = _haversine(user_lat, user_lon, float(p.latitude), float(p.longitude))
            results.append({
                "id":           p.id,
                "name":         p.name,
                "service_type": p.service_type,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
                "distance_km":  round(dist, 2),
            })

        results.sort(key=lambda x: (x["distance_km"], -x["rating"]))

    return results


# ─────────────────────────────────────────────
# WRITE — COMMIT BOOKING
# ─────────────────────────────────────────────

def commit_booking(provider_id: int) -> bool:
    """
    Atomically mark a provider as 'Busy' ONLY if they are still 'Active'.

    Uses a single conditional UPDATE instead of a read-then-write pattern.
    This is the only safe approach under SQLite's concurrency model — two
    simultaneous requests cannot both succeed for the same provider_id.

    Returns:
        True  — booking claimed successfully (rowcount == 1).
        False — provider was already taken by a concurrent request (rowcount == 0).
    """
    with get_db_session() as session:
        rows_affected = (
            session.query(Provider)
            .filter(Provider.id == provider_id, Provider.status == "Active")
            .update({"status": "Busy"}, synchronize_session=False)
        )
        session.commit()
        return rows_affected > 0


# ─────────────────────────────────────────────
# LOCATION CACHE — READ / WRITE
# ─────────────────────────────────────────────

def get_cached_location(query_text: str) -> tuple[float, float] | None:
    """
    Look up a previously geocoded location by its normalised query text.
    Returns (latitude, longitude) or None if not cached.
    """
    normalised = query_text.strip().lower()
    with get_db_session() as session:
        cached = (
            session.query(LocationCache)
            .filter(LocationCache.query == normalised)
            .first()
        )
        if cached:
            return (float(cached.latitude), float(cached.longitude))  # type: ignore[arg-type]
    return None


def save_location_cache(query_text: str, latitude: float, longitude: float) -> None:
    """
    Save a geocoded location to the cache for future lookups.
    Silently skips if the query already exists (UNIQUE constraint).
    """
    normalised = query_text.strip().lower()
    with get_db_session() as session:
        existing = (
            session.query(LocationCache)
            .filter(LocationCache.query == normalised)
            .first()
        )
        if not existing:
            entry = LocationCache(
                query=normalised,
                latitude=latitude,
                longitude=longitude,
            )
            session.add(entry)
            session.commit()
