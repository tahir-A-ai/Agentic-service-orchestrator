"""
app/services/stats.py
=====================
Aggregation queries for public landing page stats and provider dashboard stats.
"""

import json
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Provider, BookingSession, ServiceType


def get_public_stats(db: Session) -> dict:
    """
    Returns landing-page metrics:
      - providers_registered: total active providers
      - bookings_completed: total completed booking sessions
      - average_rating: mean provider rating (rounded to 1 decimal)
    """
    providers_registered = db.query(func.count(Provider.id)).filter(
        Provider.status == "Active"
    ).scalar() or 0

    bookings_completed = db.query(func.count(BookingSession.id)).filter(
        BookingSession.status == "Completed"
    ).scalar() or 0

    avg_rating_raw = db.query(func.avg(Provider.rating)).filter(
        Provider.status == "Active"
    ).scalar()
    average_rating = round(float(avg_rating_raw), 1) if avg_rating_raw else 0.0

    return {
        "providers_registered": providers_registered,
        "bookings_completed": bookings_completed,
        "average_rating": average_rating,
    }


def get_provider_stats(db: Session, provider_id: int) -> dict:
    """
    Returns dashboard metrics for a specific provider:
      - active_jobs:    pending or in-progress booking sessions
      - completed_jobs: completed booking sessions
      - declined_jobs:  sessions where this provider previously declined
      - rating:         current provider rating
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return {"active_jobs": 0, "completed_jobs": 0, "declined_jobs": 0, "rating": 0.0}

    completed_jobs = db.query(func.count(BookingSession.id)).filter(
        BookingSession.confirmed_provider_id == provider_id,
        BookingSession.status == "Completed"
    ).scalar() or 0

    active_jobs = db.query(func.count(BookingSession.id)).filter(
        BookingSession.confirmed_provider_id == provider_id,
        BookingSession.status.in_(["Pending_Acceptance", "In_Progress"])
    ).scalar() or 0

    # Count sessions where this provider declined (their ID appears in declined_provider_ids JSON list)
    # ponytail: O(n) scan on declined_provider_ids — acceptable for MVP; upgrade to a junction table
    # if declined counts grow large enough to hurt query time.
    all_sessions_with_declines = db.query(BookingSession.declined_provider_ids).filter(
        BookingSession.declined_provider_ids.isnot(None),
        BookingSession.declined_provider_ids != "[]",
    ).all()

    declined_jobs = 0
    for (raw,) in all_sessions_with_declines:
        try:
            ids = json.loads(raw) if raw else []
            if provider_id in ids:
                declined_jobs += 1
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "declined_jobs": declined_jobs,
        "rating": round(float(provider.rating), 1),
        "service_type": provider.service_type,
    }


def get_active_services(db: Session) -> list[str]:
    """
    Legacy: returns a simple list of service type labels that have active providers.
    Used by the /api/v1/stats/services endpoint for backward compatibility.
    """
    rows = (
        db.query(Provider.service_type)
        .filter(Provider.status == "Active")
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def get_all_service_types(db: Session) -> list[dict]:
    """
    Returns all active ServiceType records ordered by sort_order.
    Used by the /api/v1/service-types endpoint.
    """
    rows = (
        db.query(ServiceType)
        .filter(ServiceType.is_active == True)  # noqa: E712
        .order_by(ServiceType.sort_order, ServiceType.id)
        .all()
    )
    return [
        {
            "id": r.id,
            "key": r.key,
            "label": r.label,
            "label_urdu": r.label_urdu,
            "theme_color": r.theme_color,
            "description": r.description,
            "sort_order": r.sort_order,
        }
        for r in rows
    ]
