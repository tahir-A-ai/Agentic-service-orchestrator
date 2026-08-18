"""Booking and session coordination routes."""
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
    CancelBookingRequest,
)
from app.services.database import get_db_session
from app.services.orchestrator import confirm_booking, find_providers
from app.services.react_loop import clear_session_checkpoint
from app.services.websockets import manager, provider_manager
from app.services.auth import get_current_user_from_credentials, decode_access_token
from app.services.confirmation import confirm_completion

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
    customer_id = current_user.get("user_id") if isinstance(current_user, dict) else None
    result = await find_providers(request.user_prompt, request.session_id, request.excluded_provider_ids, customer_id=customer_id)

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

    response = ConfirmBookingResponse(
        session_id=result["session_id"],
        message=result["message"],
        booked=[ProviderDetail(**p) for p in result["booked"]],
        failed=result.get("failed", []),
        audit_log_path=result.get("audit_log_path"),
    )

    # Push fresh stats to each newly assigned provider's dashboard
    for p in result["booked"]:
        pid = p.get("id")
        if pid:
            with get_db_session() as db:
                from app.services.stats import get_provider_stats
                stats = get_provider_stats(db, pid)
            await provider_manager.push_stats(pid, stats)

    return response

@router.post(
    "/confirm-completion",
    response_model=CustomerConfirmResponse,
    summary="Customer confirms the job is done and submits a rating",
)
async def confirm_completion_route(
    request: CustomerConfirmRequest,
    current_user: dict = Depends(get_current_user_from_credentials)
):
    with get_db_session() as db:
        result = confirm_completion(db, request.session_id, request.rating)

    await manager.broadcast_to_job(request.session_id, {
        "type": "status_update",
        "status": "Completed",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return CustomerConfirmResponse(**result)

@router.post(
    "/cancel-booking",
    summary="Customer cancels the booking request",
)
async def cancel_booking_route(
    request: CancelBookingRequest,
    current_user: dict = Depends(get_current_user_from_credentials)
):
    confirmed_provider_id = None
    with get_db_session() as db:
        from app.models import BookingSession
        session = db.query(BookingSession).filter(BookingSession.id == request.session_id).first()
        if not session:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Booking not found")
        
        session.status = "Cancelled"
        session.cancelled_by = "customer"
        confirmed_provider_id = session.confirmed_provider_id
        db.commit()

    # Clear the LangGraph checkpoint so the next request starts cleanly
    await clear_session_checkpoint(request.session_id)

    # Notify the customer WebSocket (ConfirmedPage) about the cancellation
    await manager.broadcast_to_job(request.session_id, {
        "type": "status_update",
        "status": "Cancelled",
        "cancelled_by": "customer",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    # Notify the provider dashboard via their persistent WS stream
    # This triggers the cancellation modal on the provider's screen immediately
    if confirmed_provider_id:
        await provider_manager.push_event(confirmed_provider_id, {
            "type": "job_cancelled",
            "cancelled_by": "customer",
            "session_id": request.session_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        # Also push updated stats so active badge decrements
        with get_db_session() as db:
            from app.services.stats import get_provider_stats
            stats = get_provider_stats(db, confirmed_provider_id)
        await provider_manager.push_stats(confirmed_provider_id, stats)

    return {"message": "Booking cancelled successfully"}

@router.websocket("/stream/booking/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    token = websocket.cookies.get("access_token") or websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        decode_access_token(token)
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, job_id)
    
    # Send current state to sync client on reconnect/reload
    with get_db_session() as db:
        from app.models import BookingSession, Provider
        session = db.query(BookingSession).filter(BookingSession.id == job_id).first()
        if session:
            provider_name = None
            service_type = None
            if session.confirmed_provider_id:
                provider = db.query(Provider).filter(Provider.id == session.confirmed_provider_id).first()
                if provider:
                    provider_name = provider.name
                    service_type = provider.get_service_type_label
                    
            await websocket.send_json({
                "type": "status_update",
                "status": session.status,
                "provider_name": provider_name,
                "service_type": service_type
            })

    try:
        while True:
            # Keep connection alive and detect disconnects
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
