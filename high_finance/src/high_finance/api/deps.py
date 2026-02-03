"""
API Dependencies
================
Common dependencies for FastAPI routes.
"""

from typing import Generator, Optional

from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.core.security import (
    get_current_user,
    get_current_user_optional,
    User,
)


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


__all__ = [
    "get_db",
    "get_current_user",
    "get_current_user_optional",
    "User",
]
