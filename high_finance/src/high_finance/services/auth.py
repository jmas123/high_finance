"""
Authentication Service
======================
User registration and authentication logic.
Includes account lockout after repeated failed login attempts
and password reset token management.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from high_finance.core.security import get_password_hash, verify_password
from high_finance.db.models.user import User

logger = logging.getLogger(__name__)

# Lock account after this many consecutive failed attempts
MAX_FAILED_ATTEMPTS = 5
# Lock duration (15 minutes)
LOCKOUT_DURATION = timedelta(minutes=15)


async def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Look up a user by email address."""
    return db.query(User).filter(User.email == email).first()


async def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Look up a user by ID."""
    return db.query(User).filter(User.id == user_id).first()


async def create_user(db: Session, email: str, password: str) -> User:
    """
    Create a new user with hashed password.

    Args:
        db: Database session
        email: User's email address
        password: Plain text password (will be hashed)

    Returns:
        The created User object
    """
    password_hash = get_password_hash(password)
    user = User(email=email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _is_account_locked(user: User) -> bool:
    """Check if a user account is currently locked."""
    if user.locked_until is None:
        return False
    return datetime.now(timezone.utc) < user.locked_until


def _record_failed_attempt(db: Session, user: User) -> None:
    """Increment failed login counter; lock account after MAX_FAILED_ATTEMPTS."""
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + LOCKOUT_DURATION
    db.commit()


def _reset_failed_attempts(db: Session, user: User) -> None:
    """Reset failed login counter on successful authentication."""
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()


async def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Verify user credentials with account lockout protection.

    Returns None for:
    - Unknown email (prevents enumeration — same response as wrong password)
    - Wrong password
    - Locked account (same response as wrong password — prevents enumeration)

    On success, resets failed attempt counter.
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None

    # Check if account is locked
    if _is_account_locked(user):
        return None

    if not verify_password(password, user.password_hash):
        _record_failed_attempt(db, user)
        return None

    # Success — reset lockout state
    _reset_failed_attempts(db, user)
    return user


# ── Password Reset ─────────────────────────────────────────────────────────

RESET_TOKEN_EXPIRY = timedelta(minutes=30)


def _hash_token(raw_token: str) -> str:
    """SHA-256 hash a raw token for storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def request_password_reset(db: Session, email: str) -> Optional[str]:
    """
    Generate a password reset token for the given email.

    Returns the raw token (for inclusion in the email link), or None
    if no user exists with that email. The caller should always return
    a generic "check your email" response regardless.
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None

    raw_token = secrets.token_urlsafe(32)
    user.password_reset_token = _hash_token(raw_token)
    user.password_reset_expires = datetime.now(timezone.utc) + RESET_TOKEN_EXPIRY
    db.commit()

    return raw_token


async def confirm_password_reset(db: Session, raw_token: str, new_password: str) -> bool:
    """
    Validate a password reset token and update the user's password.

    Returns True on success, False if the token is invalid or expired.
    """
    token_hash = _hash_token(raw_token)
    user = db.query(User).filter(User.password_reset_token == token_hash).first()

    if not user:
        return False

    # Check expiry
    if user.password_reset_expires is None or datetime.now(timezone.utc) > user.password_reset_expires:
        # Expired — clear token fields
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()
        return False

    # Update password
    user.password_hash = get_password_hash(new_password)

    # Clear reset fields (single-use)
    user.password_reset_token = None
    user.password_reset_expires = None

    # Reset lockout state so user can log in immediately
    user.failed_login_attempts = 0
    user.locked_until = None

    db.commit()
    return True
