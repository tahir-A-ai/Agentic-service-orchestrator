"""
app/api/v1/__init__.py
=======================
Assembles all v1 API routers into a single versioned router.
"""

from fastapi import APIRouter
from app.api.v1.routes import auth, booking, stats, provider, health, chat

v1_router = APIRouter()

v1_router.include_router(auth.router)
v1_router.include_router(booking.router)
v1_router.include_router(stats.router)
v1_router.include_router(provider.router)
v1_router.include_router(health.router)
v1_router.include_router(chat.router)
