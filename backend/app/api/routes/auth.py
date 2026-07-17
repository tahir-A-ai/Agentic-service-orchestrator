from fastapi import APIRouter, Response
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
async def login(request: LoginRequest, response: Response) -> AuthResponse:
    """
    Login using username/password. Sets access token in an HttpOnly cookie. Returns user info.
    """
    with get_db_session() as db:
        res = login_user(db, request.model_dump())
        
        response.set_cookie(
            key="access_token",
            value=res["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=86400  # 1 day
        )
        return AuthResponse(**res)

@router.post("/logout", summary="Logout user")
async def logout(response: Response):
    """
    Clears the HttpOnly access token cookie.
    """
    response.delete_cookie("access_token", samesite="lax")
    return {"message": "Logged out successfully"}
