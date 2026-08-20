"""Service for JWT-based authentication and token validation."""

from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Request, HTTPException
import bcrypt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.services.database import get_db_session
from app.models import User, Provider, ServiceType

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day


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
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises HTTPException 401 if invalid/expired.
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
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



def get_current_user_from_credentials(request: Request) -> dict:
    """Dependency to validate the HttpOnly cookie and return the user payload."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "MISSING_TOKEN", "message": "Login zaroori hai."}
        )
    return decode_access_token(token)


def signup_user(db: Session, payload: dict) -> User:
    """Register a user. If role is provider, create the provider entry and link via user_id FK."""
    existing_user = db.query(User).filter(
        User.email == payload["email"]
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "USER_ALREADY_EXISTS", "message": "Email pehle se registered hai."}
        )
    new_user = User(
        full_name=payload.get("full_name"),
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
        raw_st = payload["service_type"].strip()
        st_obj = db.query(ServiceType).filter(
            (ServiceType.label.ilike(raw_st)) | (ServiceType.key.ilike(raw_st.lower()))
        ).first()
        if not st_obj:
            raise HTTPException(
                status_code=400,
                detail={"error_code": "INVALID_SERVICE_TYPE", "message": f"Service type '{raw_st}' system mein maujood nahi hai."}
            )
        provider = Provider(
            user_id=new_user.id,
            name=payload["name"],
            service_type_id=st_obj.id,
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
    Authenticate a user and provide an access token with profile details.
    
    Parameters:
    	db (Session): Database session used to retrieve the user and provider profile.
    	payload (dict): Credentials containing the user's email and password.
    
    Returns:
    	dict: Access token, expiration duration, user details, and optional provider profile information.
    
    Raises:
    	HTTPException: If the email or password is invalid.
    """
    user = db.query(User).filter(
        User.email == payload["email"]
    ).first()

    if not user or not verify_password(payload["password"], user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"error_code": "INVALID_CREDENTIALS", "message": "Ghalat email ya password."}
        )

    provider = db.query(Provider).filter(Provider.user_id == user.id).first()
    provider_id = provider.id if provider else None
    service_type = provider.get_service_type_label if provider else None
    location = provider.location if provider else None

    token_data = {
        "sub": user.email,
        "role": user.role,
        "user_id": user.id,
        "provider_id": provider_id,
    }
    token = create_access_token(token_data)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name,
        "provider_id": provider_id,
        "service_type": service_type,
        "location": location,
        "phone": user.phone,
        "bio": provider.bio if provider else None,
        "photo_url": user.photo_url,
    }


def get_current_user_profile(db: Session, user_payload: dict) -> dict:
    """
    Retrieve the authenticated user's profile and associated provider details.
    
    Parameters:
        db (Session): Database session used to retrieve the user and provider records.
        user_payload (dict): Validated token payload containing the user's identifier.
    
    Returns:
        dict: Combined user profile and provider information.
    
    Raises:
        HTTPException: If the user associated with the token cannot be found.
    """
    user_id = user_payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "USER_NOT_FOUND", "message": "User mojood nahi hai."}
        )

    provider = db.query(Provider).filter(Provider.user_id == user.id).first()
    provider_id = provider.id if provider else None
    service_type = provider.get_service_type_label if provider else None
    location = provider.location if provider else None

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "phone": user.phone,
        "provider_id": provider_id,
        "service_type": service_type,
        "location": location,
        "bio": provider.bio if provider else None,
        "photo_url": user.photo_url,
    }
