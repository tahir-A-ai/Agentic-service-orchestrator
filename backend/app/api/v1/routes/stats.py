"""Platform statistics routes."""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from app.schemas import PublicStatsResponse, ProviderStatsResponse, ActiveServicesResponse, ServiceTypesResponse
from app.services.database import get_db_session
from app.services.stats import get_public_stats, get_provider_stats, get_active_services, get_all_service_types
from app.services.auth import get_current_user_from_credentials, decode_access_token
from app.services.websockets import provider_manager

router = APIRouter(tags=["Stats"])

@router.get(
    "/stats/public",
    response_model=PublicStatsResponse,
    summary="Get landing page public statistics",
)
async def public_stats() -> PublicStatsResponse:
    """
    Get live aggregates of registered providers, completed bookings, and average rating.
    """
    with get_db_session() as db:
        res = get_public_stats(db)
        return PublicStatsResponse(**res)


@router.get(
    "/stats/provider/{provider_id}",
    response_model=ProviderStatsResponse,
    summary="Get live metrics for a specific provider dashboard",
)
async def provider_stats(
    provider_id: int,
    current_user: dict = Depends(get_current_user_from_credentials)
) -> ProviderStatsResponse:
    """
    Get live stats for a specific provider (active/completed jobs, rating).
    """
    if current_user.get("role") != "provider" or current_user.get("provider_id") != provider_id:
        raise HTTPException(
            status_code=403,
            detail={"error_code": "FORBIDDEN", "message": "Aap is provider stats ko access nai kr sakty."}
        )

    with get_db_session() as db:
        res = get_provider_stats(db, provider_id)
        return ProviderStatsResponse(**res)


@router.get(
    "/stats/services",
    response_model=ActiveServicesResponse,
    summary="Get a list of active service types (legacy)",
)
async def active_services() -> ActiveServicesResponse:
    """
    Get a list of all service types that currently have active providers.
    """
    with get_db_session() as db:
        services = get_active_services(db)
        return ActiveServicesResponse(active_services=services)


@router.get(
    "/service-types",
    response_model=ServiceTypesResponse,
    summary="Get all active service types with UI metadata",
)
async def fetch_service_types() -> ServiceTypesResponse:
    """
    Get the full registry of service types (colors, descriptions, labels).
    """
    with get_db_session() as db:
        services = get_all_service_types(db)
        return ServiceTypesResponse(service_types=services)


@router.websocket("/stream/provider/{provider_id}")
async def provider_stream(websocket: WebSocket, provider_id: int):
    """
    Persistent per-provider WebSocket for real-time dashboard stat pushes.

    The frontend connects once on login and receives a 'stats_update' message
    whenever a booking event changes the provider's metrics. No polling needed.
    """
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = decode_access_token(token)
        if payload.get("role") != "provider" or payload.get("provider_id") != provider_id:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    await provider_manager.connect(websocket, provider_id)

    # 1. Read state and release DB session before network I/O
    initial_stats = None
    with get_db_session() as db:
        initial_stats = get_provider_stats(db, provider_id)

    # 2. Send initial state and maintain connection inside protected lifecycle
    try:
        if initial_stats:
            await websocket.send_json({"type": "stats_update", **initial_stats})
        while True:
            # Keep connection alive; real updates come via push_stats() calls
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        provider_manager.disconnect(websocket, provider_id)
