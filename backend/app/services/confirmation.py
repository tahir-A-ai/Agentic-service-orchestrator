"""
app/services/confirmation.py
=============================
Business logic for customer-side job completion confirmation and rating.
"""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import BookingSession, Provider


def confirm_completion(db: Session, session_id: str, rating: int) -> dict:
    """
    Customer confirms the job is done and submits a star rating.

    1. Validates the session exists and is in Pending_Completion.
    2. Sets session.status = "Completed" and records the rating.
    3. Computes a rolling average for the provider.
    4. Marks the provider as Active if they have no other In_Progress/Pending_Completion jobs.
    """
    session = db.query(BookingSession).filter(BookingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Booking session not found.")

    if session.status != "Pending_Completion":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm completion from status: {session.status}",
        )

    provider = db.query(Provider).filter(Provider.id == session.confirmed_provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found for this booking.")

    # 1. Update Session
    session.status = "Completed"
    session.customer_rating = rating
    session.customer_confirmed_at = datetime.now(timezone.utc)

    # 2. Update Provider Rating (Rolling Average)
    old_total = provider.rating * provider.rating_count
    provider.rating_count += 1
    provider.rating = (old_total + rating) / provider.rating_count

    # 3. Release Provider (make them Active again) if they have no other active jobs
    active_jobs = (
        db.query(BookingSession)
        .filter(BookingSession.confirmed_provider_id == provider.id)
        .filter(BookingSession.status.in_(["In_Progress", "Pending_Completion"]))
        .filter(BookingSession.id != session_id)
        .count()
    )
    if active_jobs == 0:
        provider.status = "Active"

    db.commit()

    return {
        "message": "Job successfully completed and rated.",
        "new_average_rating": round(provider.rating, 1)
    }
