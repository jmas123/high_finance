"""
Authentication – API Routes
===========================
Endpoints:
    POST /api/v1/auth/register        - Create a new account
    POST /api/v1/auth/login           - Login and get JWT token
    GET  /api/v1/auth/me              - Get current authenticated user
    POST /api/v1/auth/password-reset         - Request password reset email
    POST /api/v1/auth/password-reset/confirm - Reset password with token
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services import auth as auth_svc
from high_finance.services.email import send_password_reset_email
from high_finance.core.config import settings
from high_finance.core.security import create_access_token, get_current_user, User
from high_finance.core.rate_limit import limiter
from high_finance.api.v1.schemas.auth import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
    PasswordResetRequest,
    PasswordResetConfirm,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    """
    Create a new user account.

    Returns JWT token and user info on success.
    """
    # Check if email already exists (generic error prevents user enumeration)
    existing = await auth_svc.get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed. Please try again or contact support.",
        )

    # Create user
    user = await auth_svc.create_user(db, data.email, data.password)

    # Generate token
    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token,
        user=UserOut(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    """
    user = await auth_svc.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate token
    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token,
        user=UserOut(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current authenticated user's info.

    Requires valid JWT token in Authorization header.
    """
    # Fetch full user from database
    user = await auth_svc.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserOut(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
    )


# ── Password Reset ─────────────────────────────────────────────────────────

RESET_GENERIC_MESSAGE = {
    "message": "If an account with that email exists, we've sent a password reset link."
}


@router.post("/password-reset")
@limiter.limit("3/minute")
async def request_password_reset(
    request: Request,
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password reset email.

    Always returns the same generic message regardless of whether the
    email exists — this prevents user enumeration.
    """
    raw_token = await auth_svc.request_password_reset(db, data.email)

    if raw_token:
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        send_password_reset_email(data.email, reset_link)

    return RESET_GENERIC_MESSAGE


@router.post("/password-reset/confirm")
@limiter.limit("5/minute")
async def confirm_password_reset(
    request: Request,
    data: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """
    Reset password using a valid token from the reset email.
    """
    success = await auth_svc.confirm_password_reset(db, data.token, data.new_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new one.",
        )

    return {"message": "Password updated successfully."}
