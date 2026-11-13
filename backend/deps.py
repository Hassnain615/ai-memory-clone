"""FastAPI dependencies: current user and rate limiting."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_conn, row_to_dict
from security import decode_access_token, rate_limiter

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not creds or creds.scheme.lower() != "bearer":
        raise unauthorized
    payload = decode_access_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise unauthorized
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise unauthorized
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, name, token_version, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    user = row_to_dict(row)
    # token_version is bumped on password change / logout-all, invalidating old tokens
    if not user or user["token_version"] != payload.get("tv"):
        raise unauthorized
    return user


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str, limit: int) -> None:
    allowed, retry_after = rate_limiter.check(key, limit)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
