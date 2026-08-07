from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Ops"])


@router.get("/health", summary="Health check")
async def health() -> dict:
    """
    Lightweight liveness probe.
    """
    db_ok = settings.DB_PATH.exists()
    return {
        "status":   "healthy" if db_ok else "degraded",
        "database": str(settings.DB_PATH),
        "db_found": db_ok,
        "version":  settings.API_VERSION,
    }
