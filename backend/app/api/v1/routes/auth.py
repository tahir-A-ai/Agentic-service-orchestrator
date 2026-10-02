from fastapi import APIRouter, Response, Request, Depends, HTTPException
from app.schemas import SignupRequest, LoginRequest, AuthResponse, UserMeResponse
from app.services.database import get_db_session
from app.services.auth import (
    signup_user,
    login_user,
    decode_refresh_token,
    create_access_token,
    get_current_user_from_credentials,
    get_current_user_profile,
)
from app.models import User, Provider
from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])

def _is_cookie_secure(request: Request) -> bool:
    """
    Determine if cookies should be marked with the `Secure` flag.
    Browsers strictly reject/drop cookies with `Secure` if accessed over plain HTTP (e.g. EC2 public IP).
    Returns True only if:
    1. settings.COOKIE_SECURE is explicitly True, OR
    2. The request was received over HTTPS (via X-Forwarded-Proto header or scheme).
    """
    if settings.COOKIE_SECURE:
        return True
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).lower()
    return proto == "https"

_ACCESS_MAX_AGE  = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60        # seconds
_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400      # seconds


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
    summary="Login and receive JWT tokens",
)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, response: Response) -> AuthResponse:
    """
    Authenticate with email/password.

    Sets two HttpOnly cookies:
    - ``access_token``  — short-lived (15 min), sent with every API call.
    - ``refresh_token`` — long-lived (7 days), path-restricted to ``/api/v1/auth/refresh``
                         so the browser never sends it on regular API calls.
    """
    with get_db_session() as db:
        res = login_user(db, payload.model_dump())

    cookie_secure = _is_cookie_secure(request)
    response.set_cookie(
        key="access_token",
        value=res["access_token"],
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        max_age=_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=res["refresh_token"],
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        max_age=_REFRESH_MAX_AGE,
        path="/api/v1/auth/refresh",   # browser only sends this to the refresh endpoint
    )
    return AuthResponse(**res)


@router.post(
    "/refresh",
    summary="Silently refresh an expired access token",
)
async def refresh_token_route(request: Request, response: Response):
    """
    Accepts the ``refresh_token`` HttpOnly cookie and issues a fresh
    ``access_token`` cookie — no re-login required.

    Returns ``{ expires_in }`` so the frontend can update its local
    ``expiresAt`` timestamp.
    """
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "MISSING_REFRESH_TOKEN", "message": "Session expire ho gaya. Dobara login karein."},
        )

    payload = decode_refresh_token(token)

    user_id = payload.get("user_id")
    role = payload.get("role")
    provider_id = payload.get("provider_id")

    # Robust fallback: if role or provider_id is missing from token, populate from DB
    if user_id and (not role or (role == "provider" and not provider_id)):
        with get_db_session() as db:
            u = db.query(User).filter(User.id == user_id).first()
            if u:
                role = u.role
                if role == "provider":
                    p = db.query(Provider).filter(Provider.user_id == u.id).first()
                    if p:
                        provider_id = p.id

    new_access = create_access_token({
        "sub":         payload["sub"],
        "user_id":     user_id,
        "role":        role,
        "provider_id": provider_id,
    })

    cookie_secure = _is_cookie_secure(request)
    response.set_cookie(
        key="access_token",
        value=new_access,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        max_age=_ACCESS_MAX_AGE,
        path="/",
    )
    return {"expires_in": _ACCESS_MAX_AGE}


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current logged in user details",
)
async def get_me(current_user: dict = Depends(get_current_user_from_credentials)) -> UserMeResponse:
    """Validate token and fetch current user profile."""
    with get_db_session() as db:
        res = get_current_user_profile(db, current_user)
        return UserMeResponse(**res)


@router.post("/logout", summary="Logout user")
async def logout(response: Response):
    """Clears both the access_token and refresh_token HttpOnly cookies."""
    response.delete_cookie("access_token",  path="/",                    samesite="lax")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh", samesite="lax")
    return {"message": "Logged out successfully"}
