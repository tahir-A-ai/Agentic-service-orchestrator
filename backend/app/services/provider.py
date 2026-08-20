"""Business logic for the Provider Dashboard APIs."""

import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import Provider, BookingSession, SessionDecline

def get_provider_jobs(db: Session, provider_id: int) -> list[dict]:
    """
    Retrieve a provider's booking sessions across active, completed, and cancelled workflow states.
    
    Parameters:
        provider_id (int): Identifier of the provider whose sessions are retrieved.
    
    Returns:
        list[dict]: Newest-first job records containing session status, creation time,
            service type, address, customer notes, and cancellation information.
    """
    sessions = (
        db.query(BookingSession)
        .filter(BookingSession.confirmed_provider_id == provider_id)
        .filter(BookingSession.status.in_(["Pending_Acceptance", "In_Progress", "Pending_Completion", "Completed", "Cancelled"]))
        .order_by(BookingSession.created_at.desc())
        .all()
    )
    
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    service_type = provider.get_service_type_label if provider else "Unknown"

    jobs = []
    for s in sessions:
        jobs.append({
            "session_id": s.id,
            "status": s.status,
            "created_at": s.created_at.isoformat() + "Z",
            "service_type": service_type,
            "exact_address": s.exact_address,
            "customer_notes": s.customer_notes,
            "cancelled_by": s.cancelled_by,
        })
    return jobs


def update_job_status(db: Session, provider_id: int, session_id: str, status: str) -> dict:
    """
    Update a provider's booking status and related provider state.
    
    Parameters:
        provider_id (int): Identifier of the provider assigned to the booking.
        session_id (str): Identifier of the booking session.
        status (str): Requested status for the booking.
    
    Raises:
        HTTPException: If the booking does not belong to the provider or cannot be found.
    
    Returns:
        dict: Updated status, provider name, and service type.
    """
    session = (
        db.query(BookingSession)
        .filter(BookingSession.id == session_id, BookingSession.confirmed_provider_id == provider_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Job not found.")
    actual_status = status
    if status == "Completed":
        actual_status = "Pending_Completion"
    session.status = actual_status
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if status == "In_Progress" and provider:
        provider.status = "Busy"
    elif actual_status == "Cancelled" and provider:
        existing_decline = (
            db.query(SessionDecline)
            .filter(SessionDecline.session_id == session_id, SessionDecline.provider_id == provider_id)
            .first()
        )
        if not existing_decline:
            db.add(SessionDecline(session_id=session_id, provider_id=provider_id))
        in_progress_count = (
            db.query(BookingSession)
            .filter(BookingSession.confirmed_provider_id == provider_id, BookingSession.status == "In_Progress", BookingSession.id != session_id)
            .count()
        )
        if in_progress_count == 0:
            provider.status = "Active"
        session.cancelled_by = "provider"
    db.commit()
    return {
        "message": "Job status updated.",
        "actual_status": actual_status,
        "provider_name": provider.name if provider else "Unknown",
        "service_type": provider.get_service_type_label if provider else "Unknown",
    }

def update_provider_availability(db: Session, provider_id: int, is_available: bool) -> dict:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")
        
    provider.is_available = is_available
    db.commit()
    return {"is_available": is_available, "status": provider.status, "message": "Availability updated."}

def update_provider_profile(db: Session, provider_id: int, request_data: dict) -> dict:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")
        
    user = provider.user
    if not user:
        raise HTTPException(status_code=404, detail="Associated user not found.")
        
    if "full_name" in request_data and request_data["full_name"] is not None:
        user.full_name = request_data["full_name"]
        provider.name = request_data["full_name"]
    if "email" in request_data and request_data["email"] is not None:
        user.email = request_data["email"]
    if "phone" in request_data and request_data["phone"] is not None:
        user.phone = request_data["phone"]
    if "location" in request_data and request_data["location"] is not None:
        provider.location = request_data["location"]
    if "bio" in request_data and request_data["bio"] is not None:
        provider.bio = request_data["bio"]
    if "photo_url" in request_data and request_data["photo_url"] is not None:
        user.photo_url = request_data["photo_url"]
        
    db.commit()
    
    return {
        "message": "Profile updated successfully.",
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "location": provider.location,
        "bio": provider.bio,
        "photo_url": user.photo_url
    }
