"""
app/services/auth.py
====================
Service for JWT-based authentication.
Generates access tokens and handles validation.
"""

from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.services.database import get_db_session
from app.models import User, Provider

JWT_SECRET = "karigar_secret_key_12345"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

security_scheme = HTTPBearer()

def create_access_token(data: dict) -> str:
    """
    Create a JWT token with the provided data and an expiration timestamp.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises HTTPException 401 if invalid/expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
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
    """
    Dependency to validate the authorization header and return the user payload.
    """
    return decode_access_token(credentials.credentials)

def signup_user(db: Session, payload: dict) -> User:
    """
    Register a user. If provider, create the provider entry first and link it.
    """
    # Check if username or email already exists
    existing_user = db.query(User).filter((User.username == payload["username"]) | (User.email == payload["email"])).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "USER_ALREADY_EXISTS", "message": "Username ya Email pehle se registered hai."}
        )
    
    provider_id = None
    if payload["role"] == "provider":
        # Validate provider info
        if not all([payload.get("name"), payload.get("service_type"), payload.get("location"), payload.get("latitude") is not None, payload.get("longitude") is not None]):
            raise HTTPException(
                status_code=400,
                detail={"error_code": "MISSING_PROVIDER_INFO", "message": "Provider registration ke liye saari details zaroori hain."}
            )
        # Create Provider record
        provider = Provider(
            name=payload["name"],
            service_type=payload["service_type"],
            location=payload["location"],
            latitude=payload["latitude"],
            longitude=payload["longitude"],
            rating=5.0,  # Default starter rating
            status="Active"
        )
        db.add(provider)
        db.flush()
        provider_id = provider.id

    # Create User record
    new_user = User(
        username=payload["username"],
        email=payload["email"],
        password=payload["password"],  # Plain text password as requested
        role=payload["role"],
        provider_id=provider_id,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def login_user(db: Session, payload: dict) -> dict:
    """
    Authenticate user by username and password. Returns dict with user fields and access token.
    """
    user = db.query(User).filter(
        (User.username == payload["username"]) | (User.email == payload["username"])
    ).first()
    if not user or user.password != payload["password"]:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_CREDENTIALS", "message": "Ghalat username ya password."}
        )
    
    token_data = {
        "sub": user.username,
        "role": user.role,
        "user_id": user.id,
        "provider_id": user.provider_id
    }
    token = create_access_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "provider_id": user.provider_id
    }
