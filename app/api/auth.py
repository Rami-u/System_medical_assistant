from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.auth_schemas import (
    UserRegister, RegisterResponse, UserResponse,
    TokenResponse, RefreshRequest, UserLogin
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (patient or doctor)",
)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Registration flow:
    1. Validate input (Pydantic does this before we even enter this function)
    2. Delegate business logic to AuthService
    3. Return safe user info
    """
    new_user = AuthService.register_user(data, db)
    return RegisterResponse(
        message=f"Account created successfully. Welcome, {new_user.full_name}!",
        user=UserResponse.model_validate(new_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive access + refresh tokens",
)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """
    Login flow:
    1. Delegate to AuthService for checking credentials
    2. Return generated tokens
    """
    tokens = AuthService.login_user(data, db)
    return TokenResponse(**tokens)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange refresh token for a new access token",
)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    """
    Refresh flow:
    1. Delegate to AuthService to validate old token and issue new
    2. Return new tokens
    """
    tokens = AuthService.refresh_token(data, db)
    return TokenResponse(**tokens)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout (client-side token deletion)",
)
def logout():
    """
    For stateless JWT auth, 'logout' means instructing the client
    to delete its stored tokens. The server has no session to destroy.
    """
    return {"message": "Logged out. Please delete your tokens from client storage."}