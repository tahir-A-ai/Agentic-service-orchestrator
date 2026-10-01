"""Singleton SlowAPI rate-limiter instance shared across the application."""
from fastapi import Request
from slowapi import Limiter
import jwt

from app.core.config import settings


def get_client_identifier(request: Request) -> str:
    """Client identifier for rate-limiting.

    Priority:
    1. Authenticated User: If the request carries an access token
       (via HttpOnly cookie or Authorization header), rate limit by user ID.
       This prevents users sharing the same carrier NAT IP (e.g. mobile networks
       in Pakistan like Jazz/Zong/Nayatel) from throttling each other.

    2. Real Client IP behind Proxies: If unauthenticated, inspect trusted proxy
       headers (CF-Connecting-IP, X-Forwarded-For) so AWS ALB / CloudFront / Nginx
       proxies don't make all global users appear as the same internal IP.

    3. Direct Connection IP: request.client.host fallback.
    """
    # ── 1. Check for authenticated user token ────────────────────────────────
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if token:
        try:
            # Fast claims decode without database hit
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
            user_id = payload.get("user_id") or payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass

    # ── 2. Check trusted proxy headers for public IP ─────────────────────────
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # The leftmost IP is the original client IP before downstream proxies
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    # ── 3. Direct socket fallback ─────────────────────────────────────────────
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


# If REDIS_URL is provided, rate limits are stored centrally in Redis across
# all Uvicorn worker processes and EC2 instances. If empty, uses in-memory storage.
storage_uri = settings.REDIS_URL if settings.REDIS_URL else "memory://"

limiter = Limiter(
    key_func=get_client_identifier,
    storage_uri=storage_uri,
)
