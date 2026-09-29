"""Health check route."""
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Ops"])


@router.get("/health", summary="Health check")
async def health() -> dict:
    """
    Lightweight liveness probe for load balancers and uptime monitors.
    Intentionally returns minimal info — internal paths are not exposed.
    """
    return {
        "status": "healthy",
        "version": settings.API_VERSION,
    }
