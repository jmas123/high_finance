from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.sql import func

from ..base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Account lockout fields
    failed_login_attempts = Column(Integer, default=0, server_default="0", nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Password reset fields
    password_reset_token = Column(String, nullable=True)       # SHA-256 hash of raw token
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
