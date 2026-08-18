"""Provider-specific routes and WebSocket handling."""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from datetime import datetime, timezone
from app.schemas import ProviderJobsResponse, UpdateJobStatusRequest, UpdateAvailabilityRequest, ProviderAvailabilityResponse, UpdateProviderProfileRequest, UpdateProviderProfileResponse, ProviderReview, ProviderReviewsResponse
from app.services.database import get_db_session
from app.services.provider import get_provider_jobs, update_job_status, update_provider_availability, update_provider_profile
from app.services.auth import get_current_user_from_credentials
from app.services.websockets import manager, provider_manager

router = APIRouter(prefix="/providers", tags=["Provider"])

def _verify_provider_access(current_user: dict, provider_id: int):
    if current_user.get("role") != "provider" or current_user.get("provider_id") != provider_id:
        raise HTTPException(
            status_code=403,
            detail={"error_code": "FORBIDDEN", "message": "Aap is provider record ko access nai kr sakty."}
        )

@router.get(
    "/{provider_id}/jobs",
    response_model=ProviderJobsResponse,
    summary="Get jobs assigned to a provider",
)
async def fetch_provider_jobs(
    provider_id: int,
    current_user: dict = Depends(get_current_user_from_credentials)
) -> ProviderJobsResponse:
    _verify_provider_access(current_user, provider_id)
    with get_db_session() as db:
        jobs = get_provider_jobs(db, provider_id)
        return ProviderJobsResponse(jobs=jobs)


@router.put(
    "/{provider_id}/jobs/{session_id}/status",
    summary="Update the status of a job (In_Progress, Completed, Cancelled)",
)
async def change_job_status(
    provider_id: int,
    session_id: str,
    request: UpdateJobStatusRequest,
    current_user: dict = Depends(get_current_user_from_credentials)
):
    _verify_provider_access(current_user, provider_id)
    with get_db_session() as db:
        res = update_job_status(db, provider_id, session_id, request.status)

    # Broadcast status change to the customer via WebSocket
    actual = res.get("actual_status", request.status)
    payload = {
        "type": "status_update",
        "status": actual,
        "provider_id": provider_id,
        "provider_name": res.get("provider_name", "Unknown"),
        "service_type": res.get("service_type", "Unknown"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if actual == "Cancelled":
        payload["cancelled_by"] = "provider"
        
    await manager.broadcast_to_job(session_id, payload)

    # Push fresh stats to the provider's dashboard (event-driven, no polling)
    with get_db_session() as db:
        from app.services.stats import get_provider_stats
        stats = get_provider_stats(db, provider_id)
    await provider_manager.push_stats(provider_id, stats)

    return {"message": res["message"]}


@router.put(
    "/{provider_id}/availability",
    response_model=ProviderAvailabilityResponse,
    summary="Toggle provider availability",
)
async def toggle_availability(
    provider_id: int,
    request: UpdateAvailabilityRequest,
    current_user: dict = Depends(get_current_user_from_credentials)
) -> ProviderAvailabilityResponse:
    _verify_provider_access(current_user, provider_id)
    with get_db_session() as db:
        res = update_provider_availability(db, provider_id, request.is_available)
        
    # Push updated stats via WebSocket so all connected tabs/devices update immediately
    with get_db_session() as db:
        from app.services.stats import get_provider_stats
        stats = get_provider_stats(db, provider_id)
    await provider_manager.push_stats(provider_id, stats)

    return ProviderAvailabilityResponse(**res)


@router.put(
    "/{provider_id}/profile",
    response_model=UpdateProviderProfileResponse,
    summary="Update provider profile",
)
async def update_profile(
    provider_id: int,
    request: UpdateProviderProfileRequest,
    current_user: dict = Depends(get_current_user_from_credentials)
) -> UpdateProviderProfileResponse:
    _verify_provider_access(current_user, provider_id)
    with get_db_session() as db:
        res = update_provider_profile(db, provider_id, request.dict(exclude_unset=True))
        return UpdateProviderProfileResponse(**res)

@router.post(
    "/{provider_id}/photo",
    summary="Upload provider profile photo",
)
async def upload_photo(
    provider_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_from_credentials)
):
    _verify_provider_access(current_user, provider_id)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join("uploads", "avatars", "providers", filename)
    
    # Save file
    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())
        
    photo_url = f"http://localhost:8000/uploads/avatars/providers/{filename}"
    
    with get_db_session() as db:
        res = update_provider_profile(db, provider_id, {"photo_url": photo_url})
        return {"photo_url": photo_url, "message": "Photo uploaded successfully."}


@router.get(
    "/{provider_id}/reviews",
    response_model=ProviderReviewsResponse,
    summary="Get paginated reviews for a provider (public)",
)
async def get_provider_reviews(
    provider_id: int,
    page: int = 1,
    limit: int = 10,
):
    """Returns paginated customer reviews for a provider. No auth required — customers can read before booking."""
    from app.models import BookingSession, User
    from sqlalchemy import func

    page = max(1, page)
    limit = max(1, min(limit, 20))
    offset = (page - 1) * limit

    with get_db_session() as db:
        # Total count of completed, rated sessions for this provider
        total_count = (
            db.query(func.count(BookingSession.id))
            .filter(
                BookingSession.confirmed_provider_id == provider_id,
                BookingSession.status == "Completed",
                BookingSession.customer_rating.isnot(None),
            )
            .scalar() or 0
        )

        # Paginated sessions with customer info (outer join users so reviews with null customer_id are included)
        rows = (
            db.query(BookingSession, User)
            .outerjoin(User, BookingSession.customer_id == User.id)
            .filter(
                BookingSession.confirmed_provider_id == provider_id,
                BookingSession.status == "Completed",
                BookingSession.customer_rating.isnot(None),
            )
            .order_by(BookingSession.customer_confirmed_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        reviews = [
            ProviderReview(
                rating=session.customer_rating,
                review_text=session.customer_review,
                customer_name=user.full_name.split()[0] if (user and user.full_name) else "Customer",  # first name only
                created_at=session.customer_confirmed_at.isoformat() if session.customer_confirmed_at else "",
            )
            for session, user in rows
        ]

    has_more = (offset + len(reviews)) < total_count

    return ProviderReviewsResponse(
        reviews=reviews,
        total_count=total_count,
        has_more=has_more,
    )
