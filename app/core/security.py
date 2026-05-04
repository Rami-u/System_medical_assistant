"""
Diacheck — Password hashing and JWT token utilities.

Uses bcrypt directly (passlib is unmaintained and incompatible with bcrypt>=4.1).
JWT tokens embed role_id (integer) — not role name — to prevent privilege escalation.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ──────────────────────────────────────────────
# Password hashing (direct bcrypt)
# ──────────────────────────────────────────────
def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt (12 rounds)."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ──────────────────────────────────────────────
# JWT token creation — uses role_id (int), not role name
# ──────────────────────────────────────────────
def create_access_token(user_id: int, role_id: int) -> str:
    """Create a short-lived access token (15 min default)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role_id": role_id,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int, role_id: int) -> str:
    """Create a long-lived refresh token (7 day default)."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "role_id": role_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ──────────────────────────────────────────────
# JWT token decoding
# ──────────────────────────────────────────────
def decode_token(token: str) -> Optional[dict]:
    """Returns payload dict on success, or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError:
        return None


# ──────────────────────────────────────────────
# Convenience: expiry in seconds (for TokenResponse)
# ──────────────────────────────────────────────
def access_token_expire_seconds() -> int:
    return settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60