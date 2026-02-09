from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


def _validate_password(v: str) -> str:
    """Shared password validation logic."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v) > 128:
        raise ValueError("Password must be less than 128 characters")
    if v.isdigit():
        raise ValueError("Password cannot be all numbers")
    if v.isalpha():
        raise ValueError("Password must contain at least one number or symbol")
    return v


class UserRegister(BaseModel):
    """Request body for user registration."""
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password(v)


class UserLogin(BaseModel):
    """Request body for user login."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """User data returned in responses."""
    id: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Response containing JWT token and user info."""
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordResetRequest(BaseModel):
    """Request body for initiating password reset."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Request body for confirming password reset with new password."""
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password(v)
