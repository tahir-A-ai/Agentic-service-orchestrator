"""
app/services/provider.py
========================
Business logic for the Provider Dashboard APIs.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import Provider, BookingSession

def get_provider_jobs(db: Session, provider_id: int) -> list[dict]:
    # Fetch jobs that are assigned to this provider
    # Include Pending_Acceptance, In_Progress, Completed
    sessions = (
        db.query(BookingSession)
        .filter(BookingSession.confirmed_provider_id == provider_id)
        .filter(BookingSession.status.in_(["Pending_Acceptance", "In_Progress", "Completed"]))
        .order_by(BookingSession.created_at.desc())
        .all()
    )
    
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    service_type = provider.service_type if provider else "Unknown"

    jobs = []
    for s in sessions:
        jobs.append({
            "session_id": s.id,
            "status": s.status,
            "created_at": s.created_at.isoformat() + "Z",
            "service_type": service_type,
            "exact_address": s.exact_address,
            "customer_notes": s.customer_notes
        })
    return jobs

def update_job_status(db: Session, provider_id: int, session_id: str, status: str) -> dict:
    session = (
        db.query(BookingSession)
        .filter(BookingSession.id == session_id, BookingSession.confirmed_provider_id == provider_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    session.status = status
    
    # If the provider accepted the job, mark them as Busy
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if status == "In_Progress" and provider:
        provider.status = "Busy"
    elif status in ["Completed", "Cancelled"] and provider:
        # Check if they have other In_Progress jobs?
        # For simplicity, if they complete a job, they might become Active again
        # Let's count if they have any other In_Progress
        in_progress_count = (
            db.query(BookingSession)
            .filter(BookingSession.confirmed_provider_id == provider_id, BookingSession.status == "In_Progress", BookingSession.id != session_id)
            .count()
        )
        if in_progress_count == 0:
            provider.status = "Active"
            
    db.commit()
    return {
        "message": "Job status updated.",
        "provider_name": provider.name if provider else "Unknown",
        "service_type": provider.service_type if provider else "Unknown",
    }

def update_provider_availability(db: Session, provider_id: int, is_available: bool) -> dict:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")
        
    provider.is_available = is_available
    db.commit()
    return {"is_available": is_available}
