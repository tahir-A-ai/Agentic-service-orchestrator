from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
from app.schemas import (
    ConfirmBookingRequest,
    ConfirmBookingResponse,
    FindProvidersResponse,
    ProviderDetail,
    ServiceRequest,
    CustomerConfirmRequest,
    CustomerConfirmResponse,
)
from app.services.database import get_db_session
from app.services.orchestrator import confirm_booking, find_providers
from app.services.auth import get_current_user_from_credentials
from app.services.confirmation import confirm_completion
from app.services.websockets import manager

router = APIRouter(tags=["Booking"])

@router.post(
    "/book-service",
    response_model=FindProvidersResponse,
    summary="Find available service providers (Phase 1)",
    description=(
        "Accepts a Roman Urdu natural-language request, runs the ReAct "
        "agent to discover available providers, and returns candidates "
        "for the user to review and approve. No booking is committed."
    ),
)
async def book_service(request: ServiceRequest, current_user: dict = Depends(get_current_user_from_credentials)) -> FindProvidersResponse:
    result = await find_providers(request.user_prompt, request.session_id, request.excluded_provider_ids)

    # Convert raw provider dicts to ProviderDetail models
    candidates: dict[str, list[ProviderDetail]] = {}
    for svc_type, providers in result.get("candidates", {}).items():
        candidates[svc_type] = [ProviderDetail(**p) for p in providers]

    return FindProvidersResponse(
        session_id=result["session_id"],
        status=result["status"],
        message=result["message"],
        candidates=candidates,
        clarification_question=result.get("clarification_question"),
        audit_log_path=result.get("audit_log_path"),
    )


@router.post(
    "/confirm-booking",
    response_model=ConfirmBookingResponse,
    summary="Confirm and commit a booking (Phase 2)",
    description=(
        "After reviewing the candidates from Phase 1, the user approves "
        "specific providers by their IDs. This endpoint atomically commits "
        "each booking. Handles race conditions where providers may have been "
        "booked by another user during the review period."
    ),
)
async def confirm_booking_route(request: ConfirmBookingRequest, current_user: dict = Depends(get_current_user_from_credentials)) -> ConfirmBookingResponse:
    result = await confirm_booking(
        request.session_id, 
        request.approved_provider_ids,
        request.exact_address,
        request.customer_notes
    )

    return ConfirmBookingResponse(
        session_id=result["session_id"],
        message=result["message"],
        booked=[ProviderDetail(**p) for p in result["booked"]],
        failed=result.get("failed", []),
        audit_log_path=result.get("audit_log_path"),
    )

@router.post(
    "/confirm-completion",
    response_model=CustomerConfirmResponse,
    summary="Customer confirms the job is done and submits a rating",
)
async def confirm_completion_route(request: CustomerConfirmRequest):
    with get_db_session() as db:
        result = confirm_completion(db, request.session_id, request.rating)
        
    await manager.broadcast_to_job(request.session_id, {
        "type": "status_update",
        "status": "Completed",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return CustomerConfirmResponse(**result)

@router.websocket("/stream/booking/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    try:
        while True:
            # We don't expect messages from the client in this flow,
            # but we need to await receive to keep connection alive and detect disconnects.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
