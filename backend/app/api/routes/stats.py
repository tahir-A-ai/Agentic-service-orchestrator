from fastapi import APIRouter
from app.schemas import PublicStatsResponse, ProviderStatsResponse, ActiveServicesResponse, ServiceTypesResponse
from app.services.database import get_db_session
from app.services.stats import get_public_stats, get_provider_stats, get_active_services, get_all_service_types

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
async def provider_stats(provider_id: int) -> ProviderStatsResponse:
    """
    Get live stats for a specific provider (active/completed jobs, rating).
    """
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
