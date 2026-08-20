"""
All database interactions are centralised here using SQLAlchemy ORM.
"""

import math
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings
from app.models import Base, LocationCache, Provider, ServiceType


connect_args = {"check_same_thread": False} if settings.resolved_database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.resolved_database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db() -> None:
    """
    Create missing database tables and mark providers with undefined availability as available.
    """
    Base.metadata.create_all(bind=engine)
    with get_db_session() as session:
        session.query(Provider).filter(Provider.is_available.is_(None)).update(
            {"is_available": True}, synchronize_session=False
        )
        session.commit()


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
    radius_km: float | None = None,
    excluded_ids: list[int] | None = None,
) -> tuple[list[dict], int]:
    """
    Find active and available providers for a service within a search radius.
    
    Parameters:
        service_type (str): Service type used to match providers.
        user_lat (float): User's latitude.
        user_lon (float): User's longitude.
        radius_km (float | None): Search radius in kilometers. Uses the configured
            default when omitted.
        excluded_ids (list[int] | None): Provider IDs to exclude from the results.
    
    Returns:
        tuple[list[dict], int]: Provider records sorted by distance and rating, and
        the number of matching providers excluded.
    """
    if radius_km is None:
        radius_km = settings.PROVIDER_SEARCH_RADIUS_KM

    with get_db_session() as session:
        providers = (
            session.query(Provider)
            .join(ServiceType, Provider.service_type_id == ServiceType.id)
            .filter(ServiceType.label == service_type)
            .filter(Provider.status == "Active")
            .filter(or_(Provider.is_available == True, Provider.is_available.is_(None)))
            .all()
        )

        results = []
        for p in providers:
            dist = _haversine(user_lat, user_lon, float(p.latitude), float(p.longitude))  # type: ignore[arg-type]
            if dist > radius_km:
                continue  # outside the search radius
            results.append({
                "id":           p.id,
                "name":         p.name,
                "service_type": service_type,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
                "distance_km":  round(dist, 2),
            })

        # Sort: nearest first, then highest rated
        results.sort(key=lambda x: (x["distance_km"], -x["rating"]))
        
        excluded_count = 0
        if excluded_ids:
            filtered_results = [r for r in results if r["id"] not in excluded_ids]
            excluded_count = len(results) - len(filtered_results)
            results = filtered_results

    return results, excluded_count


def query_all_active_providers(
    service_type: str,
    user_lat: float | None = None,
    user_lon: float | None = None,
    excluded_ids: list[int] | None = None,
) -> tuple[list[dict], int]:
    """
    Retrieve all available providers for a service type without applying a radius filter.
    
    Parameters:
        user_lat (float | None): Latitude used as the distance calculation origin.
        user_lon (float | None): Longitude used as the distance calculation origin.
        excluded_ids (list[int] | None): Provider IDs to omit from the results.
    
    Returns:
        tuple[list[dict], int]: The sorted provider records and the number of excluded providers.
    """
    with get_db_session() as session:
        providers = (
            session.query(Provider)
            .join(ServiceType, Provider.service_type_id == ServiceType.id)
            .filter(ServiceType.label == service_type)
            .filter(Provider.status == "Active")
            .filter(or_(Provider.is_available == True, Provider.is_available.is_(None)))
            .all()
        )

        results = []
        for p in providers:
            entry = {
                "id":           p.id,
                "name":         p.name,
                "service_type": service_type,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
            }
            if user_lat is not None and user_lon is not None:
                dist = _haversine(user_lat, user_lon, float(p.latitude), float(p.longitude))
                entry["distance_km"] = round(dist, 2)
            results.append(entry)

        # Sort: distance first (if available), then highest rated
        if user_lat is not None and user_lon is not None:
            results.sort(key=lambda x: (x["distance_km"], -x["rating"]))
        else:
            results.sort(key=lambda x: -x["rating"])
            
        excluded_count = 0
        if excluded_ids:
            filtered_results = [r for r in results if r["id"] not in excluded_ids]
            excluded_count = len(results) - len(filtered_results)
            results = filtered_results

    return results, excluded_count


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
            .join(ServiceType, Provider.service_type_id == ServiceType.id)
            .filter(ServiceType.label == service_type)
            .filter(Provider.status == "Busy")
            .all()
        )

        results = []
        for p in providers:
            dist = _haversine(user_lat, user_lon, float(p.latitude), float(p.longitude))
            results.append({
                "id":           p.id,
                "name":         p.name,
                "service_type": p.get_service_type_label,
                "location":     p.location,
                "latitude":     p.latitude,
                "longitude":    p.longitude,
                "rating":       p.rating,
                "status":       p.status,
                "distance_km":  round(dist, 2),
            })

        results.sort(key=lambda x: (x["distance_km"], -x["rating"]))

    return results


def commit_booking(provider_id: int) -> bool:
    """
    Claims an active, available provider for a booking.
    
    Returns:
        bool: `True` if the provider was claimed, `False` if the provider is unavailable or not active.
    """
    with get_db_session() as session:
        rows_affected = (
            session.query(Provider)
            .filter(
                Provider.id == provider_id,
                Provider.status == "Active",
                or_(Provider.is_available == True, Provider.is_available.is_(None)),
            )
            .update({"status": "Busy"}, synchronize_session=False)
        )
        session.commit()
        return rows_affected > 0


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
            return (float(cached.latitude), float(cached.longitude))


def save_location_cache(query_text: str, latitude: float, longitude: float) -> None:
    """
    Save a geocoded location to the cache for future lookups.
    Silently skips if the query already exists.
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
