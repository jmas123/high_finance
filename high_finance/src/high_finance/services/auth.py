"""
Authentication Service
======================
User registration and authentication logic.
"""

from typing import Optional

from sqlalchemy.orm import Session

from high_finance.core.security import get_password_hash, verify_password
from high_finance.db.models.user import User


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


async def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Verify user credentials.

    Args:
        db: Database session
        email: User's email address
        password: Plain text password to verify

    Returns:
        User object if credentials are valid, None otherwise
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
