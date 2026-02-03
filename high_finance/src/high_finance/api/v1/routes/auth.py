"""
Authentication – API Routes
===========================
Endpoints:
    POST /api/v1/auth/register - Create a new account
    POST /api/v1/auth/login    - Login and get JWT token
    GET  /api/v1/auth/me       - Get current authenticated user
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services import auth as auth_svc
from high_finance.core.security import create_access_token, get_current_user, User
from high_finance.core.rate_limit import limiter
from high_finance.api.v1.schemas.auth import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    """
    Create a new user account.

    Returns JWT token and user info on success.
    """
    # Check if email already exists
    existing = await auth_svc.get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
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
