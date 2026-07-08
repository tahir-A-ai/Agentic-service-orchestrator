"""
app/services/stats.py
=====================
Aggregation queries for public landing page stats and provider dashboard stats.
Reads from the providers and booking_sessions tables.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Provider, BookingSession


def get_public_stats(db: Session) -> dict:
    """
    Returns landing-page metrics:
      - providers_registered: total active providers
      - bookings_completed: total confirmed booking sessions
      - average_rating: mean provider rating (rounded to 1 decimal)
    """
    providers_registered = db.query(func.count(Provider.id)).filter(
        Provider.status == "Active"
    ).scalar() or 0

    bookings_completed = db.query(func.count(BookingSession.id)).filter(
        BookingSession.status == "confirmed"
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
      - active_jobs: count of pending or in-progress booking sessions for this provider
      - completed_jobs: count of completed booking sessions for this provider
      - rating: the provider's current rating
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return {"active_jobs": 0, "completed_jobs": 0, "rating": 0.0}

    completed_jobs = db.query(func.count(BookingSession.id)).filter(
        BookingSession.confirmed_provider_id == provider_id,
        BookingSession.status == "Completed"
    ).scalar() or 0

    active_jobs = db.query(func.count(BookingSession.id)).filter(
        BookingSession.confirmed_provider_id == provider_id,
        BookingSession.status.in_(["Pending_Acceptance", "In_Progress"])
    ).scalar() or 0

    return {
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "rating": float(provider.rating),
    }


def get_active_services(db: Session) -> list[str]:
    """
    Returns a list of unique service types available in the platform, regardless of provider status.
    """
    services = db.query(Provider.service_type).distinct().all()
    
    return [s[0] for s in services]
