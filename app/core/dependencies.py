from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token

# tokenUrl points to the login endpoint.
# FastAPI uses this to render the "Authorize" button in Swagger /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Core auth dependency — used by EVERY protected endpoint.

    Flow:
    1. FastAPI extracts Bearer token from Authorization header
    2. decode_token() validates signature + expiry + type
    3. We look up the user in the database (critical security step)
    4. If user was deleted after token was issued — they're rejected
    5. Return the User ORM object to the route function

    The database lookup (step 3/4) is what the GitHub repo was missing.
    Without it, a deleted user's valid token would still grant access.
    """
    # Decode and validate the access token
    token_data = decode_token(token, expected_type="access")

    # Import inside function to prevent circular imports
    # (models import Base from database, dependencies imports from models)
    from app.models.users import User

    # Verify the user still exists in the database
    user = db.query(User).filter(User.id == token_data["user_id"]).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_doctor(
    current_user = Depends(get_current_user)
):
    """
    Dependency for doctor-only endpoints.
    Builds on get_current_user — first validates token, then checks role.

    Usage: doctor = Depends(get_current_doctor)
    Effect: Raises HTTP 403 if user.role != 'doctor'

    Example endpoints that need this:
    - POST /clinical-notes/
    - GET /clinical-notes/{patient_id}
    - GET /patients/ (list of assigned patients)
    """
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires doctor role",
        )
    return current_user


def get_current_patient(
    current_user = Depends(get_current_user)
):
    """
    Dependency for patient-only endpoints.
    Builds on get_current_user — first validates token, then checks role.

    Usage: patient = Depends(get_current_patient)
    Effect: Raises HTTP 403 if user.role != 'patient'

    Example endpoints that need this:
    - POST /glucose-readings/
    - POST /meal-logs/
    - GET /alerts/my
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires patient role",
        )
    return current_user