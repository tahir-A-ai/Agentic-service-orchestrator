"""Business logic for the Provider Dashboard APIs."""

import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import Provider, BookingSession, SessionDecline

def get_provider_jobs(db: Session, provider_id: int) -> list[dict]:
    sessions = (
        db.query(BookingSession)
        .filter(BookingSession.confirmed_provider_id == provider_id)
        .filter(BookingSession.status.in_(["Pending_Acceptance", "In_Progress", "Pending_Completion", "Completed", "Cancelled"]))
        .order_by(BookingSession.created_at.desc())
        .all()
    )
    
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    service_type = provider.get_service_type_label if provider else "Unknown"
    provider_lat = provider.latitude if provider else None
    provider_lon = provider.longitude if provider else None
    provider_location = provider.location if provider else None
    provider_phone = provider.user.phone if provider and provider.user else None

    jobs = []
    for s in sessions:
        cust_name = "Customer"
        cust_phone = None
        if s.customer:
            cust_name = s.customer.full_name or s.customer.email or "Customer"
            cust_phone = s.customer.phone

        jobs.append({
            "session_id": s.id,
            "status": s.status,
            "created_at": s.created_at.isoformat() + "Z",
            "service_type": service_type,
            "exact_address": s.exact_address,
            "customer_notes": s.customer_notes,
            "cancelled_by": s.cancelled_by,
            "customer_name": cust_name,
            "customer_phone": cust_phone,
            "provider_lat": provider_lat,
            "provider_lon": provider_lon,
            "provider_location": provider_location,
            "provider_phone": provider_phone,
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

    cust_name = "Customer"
    cust_phone = None
    if session.customer:
        cust_name = session.customer.full_name or session.customer.email or "Customer"
        cust_phone = session.customer.phone

    return {
        "message": "Job status updated.",
        "actual_status": actual_status,
        "provider_name": provider.name if provider else "Unknown",
        "service_type": provider.get_service_type_label if provider else "Unknown",
        "provider_phone": provider.user.phone if provider and provider.user else None,
        "provider_lat": provider.latitude if provider else None,
        "provider_lon": provider.longitude if provider else None,
        "provider_location": provider.location if provider else None,
        "customer_name": cust_name,
        "customer_phone": cust_phone,
        "exact_address": session.exact_address,
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
