from fastapi import APIRouter
from datetime import datetime, timezone
from app.schemas import ProviderJobsResponse, UpdateJobStatusRequest, UpdateAvailabilityRequest, ProviderAvailabilityResponse
from app.services.database import get_db_session
from app.services.provider import get_provider_jobs, update_job_status, update_provider_availability
from app.services.websockets import manager

router = APIRouter(prefix="/providers", tags=["Provider"])

@router.get(
    "/{provider_id}/jobs",
    response_model=ProviderJobsResponse,
    summary="Get jobs assigned to a provider",
)
async def fetch_provider_jobs(provider_id: int) -> ProviderJobsResponse:
    with get_db_session() as db:
        jobs = get_provider_jobs(db, provider_id)
        return ProviderJobsResponse(jobs=jobs)


@router.put(
    "/{provider_id}/jobs/{session_id}/status",
    summary="Update the status of a job (In_Progress, Completed, Cancelled)",
)
async def change_job_status(provider_id: int, session_id: str, request: UpdateJobStatusRequest):
    with get_db_session() as db:
        res = update_job_status(db, provider_id, session_id, request.status)
        
    # Broadcast status change to the customer via WebSocket
    actual = res.get("actual_status", request.status)
    await manager.broadcast_to_job(session_id, {
        "type": "status_update",
        "status": actual,
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
async def toggle_availability(provider_id: int, request: UpdateAvailabilityRequest) -> ProviderAvailabilityResponse:
    with get_db_session() as db:
        res = update_provider_availability(db, provider_id, request.is_available)
        return ProviderAvailabilityResponse(**res)
