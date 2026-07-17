from fastapi import APIRouter
from app.schemas import SignupRequest, LoginRequest, AuthResponse
from app.services.database import get_db_session
from app.services.auth import signup_user, login_user

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post(
    "/signup",
    status_code=201,
    summary="Register a new user (customer or provider)",
)
async def signup(request: SignupRequest):
    """
    Sign up a user. If role is provider, creates a linked provider entry.
    """
    with get_db_session() as db:
        user = signup_user(db, request.model_dump())
        return {"message": "User successfully registered.", "username": user.username}


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login and get JWT token",
)
async def login(request: LoginRequest) -> AuthResponse:
    """
    Login using username/password. Returns access token, role, and provider_id (if provider).
    """
    with get_db_session() as db:
        res = login_user(db, request.model_dump())
        return AuthResponse(**res)
