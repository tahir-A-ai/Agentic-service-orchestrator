"""
main.py
=======
FastAPI application entry-point.

Responsibilities of this file (and ONLY this file):
    1. Instantiate the FastAPI application with metadata.
    2. Register CORS middleware.
    3. Declare the routes:
       - POST /api/v1/book-service     (Phase 1 — find providers)
       - POST /api/v1/confirm-booking  (Phase 2 — commit bookings)
       - GET  /health                  (liveness probe)
    4. Delegate ALL business logic to app.services.orchestrator.

No database calls, no SQL, no audit-log writes, and no intent-parsing logic
belong here. If you are adding any of that here you are in the wrong file.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.services.websockets import manager
from app.config import (
    API_DESCRIPTION,
    API_TITLE,
    API_VERSION,
    CORS_ALLOW_ORIGINS,
    DB_PATH,
)
from app.api import api_router
from app.services.database import init_db, get_db_session
from app.models import ServiceType
from app.services.tools import refresh_valid_service_types

# ─────────────────────────────────────────────
# LIFESPAN — startup / shutdown hooks
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once on startup (before any request is served).
    Creates all database tables via SQLAlchemy if they do not exist.
    """
    init_db()

    # Seed initial service types if table is empty
    with get_db_session() as db:
        if db.query(ServiceType).count() == 0:
            db.add_all([
                ServiceType(key="electrician", label="Electrician", label_urdu="BIJLI WALA", theme_color="#3B82F6", description="Ghar ki wiring, UPS, aur bijli ke har tarah ke masle.", sort_order=1),
                ServiceType(key="plumber", label="Plumber", label_urdu="NALQE WALA", theme_color="#22C55E", description="Pipes, motor, aur paani ki har tarah ki repair.", sort_order=2)
            ])
            db.commit()
            refresh_valid_service_types()

    yield


# ─────────────────────────────────────────────
# APPLICATION FACTORY
# ─────────────────────────────────────────────

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    contact={"name": "Karigar.pk — Islamabad Local Services Marketplace"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", summary="Health check", tags=["Ops"])
async def health() -> dict:
    """
    Lightweight liveness probe.
    """
    db_ok = DB_PATH.exists()
    return {
        "status":   "healthy" if db_ok else "degraded",
        "database": str(DB_PATH),
        "db_found": db_ok,
        "version":  API_VERSION,
    }


# ─────────────────────────────────────────────
# ENTRYPOINT (python main.py for local dev)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
