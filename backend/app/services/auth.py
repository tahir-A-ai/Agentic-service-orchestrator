"""
app/services/auth.py
====================
Service for JWT-based authentication.
Generates access tokens and handles validation.

Security:
  - Passwords are hashed with bcrypt via passlib.
  - JWT secret is loaded from .env (JWT_SECRET).
  - Provider link is via Provider.user_id FK (not User.provider_id).
"""

from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from sqlalchemy.orm import Session
from app.config import JWT_SECRET
from app.services.database import get_db_session
from app.models import User, Provider

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

security_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict) -> str:
    """Create a JWT token with the provided data and an expiration timestamp."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises HTTPException 401 if invalid/expired.
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "TOKEN_EXPIRED", "message": "Token expire ho chuka hai. Dobara login karein."}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_TOKEN", "message": "Ghair-mauzoon token."}
        )


def get_current_user_from_credentials(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> dict:
    """Dependency to validate the authorization header and return the user payload."""
    return decode_access_token(credentials.credentials)


def signup_user(db: Session, payload: dict) -> User:
    """
    Register a user. If role is provider, create the provider entry and link via user_id FK.
    Passwords are bcrypt-hashed before storage.
    """
    existing_user = db.query(User).filter(
        (User.username == payload["username"]) | (User.email == payload["email"])
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "USER_ALREADY_EXISTS", "message": "Username ya Email pehle se registered hai."}
        )

    # Create User record first (Provider will reference it via user_id)
    new_user = User(
        full_name=payload.get("full_name"),
        username=payload["username"],
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        phone=payload.get("phone"),
        role=payload["role"],
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    db.flush()  # get new_user.id without committing

    if payload["role"] == "provider":
        required = ["name", "service_type", "location"]
        if not all(payload.get(f) for f in required) or payload.get("latitude") is None:
            raise HTTPException(
                status_code=400,
                detail={"error_code": "MISSING_PROVIDER_INFO", "message": "Provider registration ke liye saari details zaroori hain."}
            )
        provider = Provider(
            user_id=new_user.id,
            name=payload["name"],
            service_type=payload["service_type"],
            location=payload["location"],
            latitude=payload["latitude"],
            longitude=payload["longitude"],
            experience_years=payload.get("experience_years"),
            bio=payload.get("bio"),
            rating=5.0,
            status="Active",
        )
        db.add(provider)

    db.commit()
    db.refresh(new_user)
    return new_user


def login_user(db: Session, payload: dict) -> dict:
    """
    Authenticate user by username/email and password.
    Returns dict with user fields and JWT access token.
    """
    user = db.query(User).filter(
        (User.username == payload["username"]) | (User.email == payload["username"])
    ).first()

    if not user or not verify_password(payload["password"], user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_CREDENTIALS", "message": "Ghalat username ya password."}
        )

    # Look up provider via Provider.user_id (correct FK direction)
    provider = db.query(Provider).filter(Provider.user_id == user.id).first()
    provider_id = provider.id if provider else None
    service_type = provider.service_type if provider else None
    location = provider.location if provider else None

    token_data = {
        "sub": user.username,
        "role": user.role,
        "user_id": user.id,
        "provider_id": provider_id,
    }
    token = create_access_token(token_data)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "full_name": user.full_name,
        "provider_id": provider_id,
        "service_type": service_type,
        "location": location,
    }
