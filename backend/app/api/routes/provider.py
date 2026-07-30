from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from app.schemas import ProviderJobsResponse, UpdateJobStatusRequest, UpdateAvailabilityRequest, ProviderAvailabilityResponse
from app.services.database import get_db_session
from app.services.provider import get_provider_jobs, update_job_status, update_provider_availability
from app.services.auth import get_current_user_from_credentials
from app.services.websockets import manager

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
    await manager.broadcast_to_job(session_id, {
        "type": "status_update",
        "status": actual,
        "provider_id": provider_id,
        "provider_name": res.get("provider_name", "Unknown"),
        "service_type": res.get("service_type", "Unknown"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
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
        return ProviderAvailabilityResponse(**res)
