from fastapi import APIRouter
from app.api.routes import auth, booking, stats, provider

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(booking.router)
api_router.include_router(stats.router)
api_router.include_router(provider.router)
