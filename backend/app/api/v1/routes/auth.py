from fastapi import APIRouter, Response, Request, Depends
from app.schemas import SignupRequest, LoginRequest, AuthResponse, UserMeResponse
from app.services.database import get_db_session
from app.services.auth import signup_user, login_user, get_current_user_from_credentials, get_current_user_profile
from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post(
    "/signup",
    status_code=201,
    summary="Register a new user (customer or provider)",
)
@limiter.limit("5/minute")
async def signup(request: Request, payload: SignupRequest):
    """Sign up a user and create a linked provider profile if applicable."""
    with get_db_session() as db:
        user = signup_user(db, payload.model_dump())
        return {"message": "User successfully registered.", "email": user.email}


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login and get JWT token",
)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, response: Response) -> AuthResponse:
    """
    Authenticate a user with email and password and establish an access-token cookie.
    
    Parameters:
        payload (LoginRequest): The user's login credentials.
    
    Returns:
        AuthResponse: The authentication response containing the access token.
    """
    with get_db_session() as db:
        res = login_user(db, payload.model_dump())

        response.set_cookie(
            key="access_token",
            value=res["access_token"],
            httponly=True,
            secure=(settings.ENVIRONMENT == "production"),
            samesite="lax",
            max_age=86400  # 1 day
        )
        return AuthResponse(**res)

@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current logged in user details",
)
async def get_me(current_user: dict = Depends(get_current_user_from_credentials)) -> UserMeResponse:
    """Retrieve the authenticated user's profile.
    
    Parameters:
    	current_user (dict): Authenticated user information derived from the request credentials.
    
    Returns:
    	UserMeResponse: The authenticated user's profile.
    """
    with get_db_session() as db:
        res = get_current_user_profile(db, current_user)
        return UserMeResponse(**res)

@router.post("/logout", summary="Logout user")
async def logout(response: Response):
    """
    End the current session by removing the access token cookie.
    
    Returns:
        dict: A confirmation message indicating successful logout.
    """
    response.delete_cookie("access_token", samesite="lax")
    return {"message": "Logged out successfully"}
