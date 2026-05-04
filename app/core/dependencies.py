"""
Core FastAPI dependencies — JWT auth and role guards.

All queries use SQLAlchemy 2.0 select() syntax with selectinload
to prevent N+1 on roles.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import decode_token
from app.models.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_user_role(user: User) -> str:
    """Read role from the user_roles relation (eagerly loaded)."""
    if user.roles:
        return user.roles[0].role_name
    return ""


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validates the Bearer JWT and returns the authenticated User."""
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == int(user_id))
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_doctor(current_user: User = Depends(get_current_user)) -> User:
    """Raises 403 if the user is not a doctor."""
    if get_user_role(current_user) != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor role required")
    return current_user


def get_current_patient(current_user: User = Depends(get_current_user)) -> User:
    """Raises 403 if the user is not a patient."""
    if get_user_role(current_user) != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient role required")
    return current_user


def get_current_patient_or_doctor(current_user: User = Depends(get_current_user)) -> User:
    """Allows both patients and doctors — used for shared endpoints."""
    role = get_user_role(current_user)
    if role not in ("patient", "doctor"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Valid role required")
    return current_user