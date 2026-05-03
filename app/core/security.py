from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings

#  PASSWORD HASHING

# bcrypt is the industry-standard password hashing algorithm.
# deprecated='auto' means passlib will auto-upgrade to newer schemes in future.
# IMPORTANT: Never change this scheme after users have registered —
#            it would invalidate all stored passwords.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Takes a plain-text password string.
    Returns a bcrypt hash string starting with '$2b$12$'.
    This is a one-way operation — there is no reverse function.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Returns True if plain_password matches the stored bcrypt hash.
    Returns False otherwise.
    Used ONLY in the login endpoint.
    """
    return pwd_context.verify(plain_password, hashed_password)


#  JWT TOKEN CREATION

def create_access_token(
    user_id: int,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a SHORT-LIVED access token (default: 30 minutes).

    The payload (claims) we include:
      sub   : user ID (standard JWT 'subject' claim)
      role  : 'patient' or 'doctor'
      type  : 'access' — prevents refresh tokens being used as access tokens
      exp   : expiry timestamp (jose adds this automatically)
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),    # must be string per JWT spec
        "role": role,
        "type": "access",      # critical: marks this as an access token
        "exp": expire,
        "iat": now,             # issued-at timestamp
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int, role: str) -> str:
    """
    Create a LONG-LIVED refresh token (7 days).

    The refresh token is used ONLY to obtain a new access token.
    It must NEVER be accepted by protected endpoints — the 'type': 'refresh'
    claim in the payload, checked in decode_token(), enforces this.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "refresh",     # marks this as a refresh token only
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


#  JWT TOKEN DECODING

def decode_token(
    token: str,
    expected_type: Literal["access", "refresh"] = "access"
) -> dict:
    """
    Decode and validate a JWT token.

    Raises HTTP 401 if:
      - Token signature is invalid (tampered)
      - Token has expired
      - Token type doesn't match expected_type
      - Required claims (sub, role) are missing

    This prevents refresh tokens from being used as access tokens
    and vice versa.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        # Validate required claims exist
        user_id_str: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        token_type: Optional[str] = payload.get("type")

        if not user_id_str or not role:
            raise credentials_exception

        # Validate token type matches what we expect
        if token_type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Expected {expected_type} token, got {token_type}",
            )

        return {
            "user_id": int(user_id_str),
            "role": role,
            "token_type": token_type,
        }

    except JWTError:
        raise credentials_exception