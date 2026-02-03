"""
Base Task Utilities
===================
Common utilities, patterns, and types for RQ tasks.
"""

from contextlib import contextmanager
from datetime import datetime
from typing import Generator, Literal, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal


class JobResult(BaseModel):
    """Typed job result for validation and consistency."""

    status: Literal["ok", "error"]
    updated: int = 0
    total: int = 0
    failed: list[str] = []
    skipped: int = 0
    error_message: Optional[str] = None
    completed_at: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields for job-specific data

    def model_post_init(self, __context) -> None:
        """Set completed_at timestamp if not provided."""
        if self.completed_at is None:
            object.__setattr__(self, 'completed_at', datetime.utcnow().isoformat())


@contextmanager
def db_session() -> Generator[Session, None, None]:
    """
    Context manager for proper session handling in RQ tasks.

    Usage:
        with db_session() as db:
            # Do database work
            db.commit()

    The session is automatically closed when the context exits,
    even if an exception occurs.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_job_result(
    *,
    status: Literal["ok", "error"] = "ok",
    updated: int = 0,
    total: int = 0,
    failed: Optional[list[str]] = None,
    skipped: int = 0,
    error_message: Optional[str] = None,
    **extra_fields,
) -> dict:
    """
    Create a standardized job result dictionary.

    Args:
        status: "ok" or "error"
        updated: Number of records updated
        total: Total records processed
        failed: List of failed item identifiers
        skipped: Number of items skipped
        error_message: Error message if status is "error"
        **extra_fields: Additional job-specific fields

    Returns:
        Dict with standardized result structure.
    """
    result = JobResult(
        status=status,
        updated=updated,
        total=total,
        failed=failed or [],
        skipped=skipped,
        error_message=error_message,
    )

    # Add extra fields
    result_dict = result.model_dump()
    result_dict.update(extra_fields)

    return result_dict
