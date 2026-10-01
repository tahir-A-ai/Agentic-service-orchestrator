"""FastAPI application entry-point."""

from dotenv import load_dotenv
load_dotenv()  # MUST BE AT LINE 1 BEFORE ANY OTHER IMPORTS

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.services.websockets import manager, redis_bridge
from app.core.config import settings
from app.api import api_router
from app.core.setup import run_startup_tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks and initialize background services before serving requests."""
    await run_startup_tasks()
    await redis_bridge.start()
    yield
    await redis_bridge.stop()


app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    contact={"name": "Karigar.pk — Islamabad Local Services Marketplace"},
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
