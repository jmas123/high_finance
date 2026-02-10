"""
Base Task Utilities
===================
Common utilities, patterns, and types for RQ tasks.
"""

import functools
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Generator, Literal, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal

logger = logging.getLogger(__name__)


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


def tracked_job(job_name: str, *, alert_on_failure: bool = True):
    """
    Decorator that automatically tracks job completion/failure in the DB.

    Uses rq.get_current_job() to find the job_id, then calls
    record_job_complete or record_job_failure when the wrapped
    function finishes.

    Works for both admin-triggered jobs (which already have a DB record
    from record_job_start) and scheduler-triggered jobs (record_job_complete
    will create a record if one doesn't exist).

    Args:
        job_name: Identifier for this job type.
        alert_on_failure: If True (default), send a Slack alert on failure.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            from rq import get_current_job
            from high_finance.services.job_tracker import (
                record_job_complete,
                record_job_failure,
            )

            rq_job = get_current_job()
            job_id = rq_job.id if rq_job else None

            try:
                result = func(*args, **kwargs)

                if job_id:
                    db = SessionLocal()
                    try:
                        record_job_complete(db, job_id, {
                            "job_name": job_name,
                            **(result if isinstance(result, dict) else {}),
                        })
                    except Exception:
                        logger.exception(f"Failed to record job completion for {job_id}")
                    finally:
                        db.close()

                return result

            except Exception as e:
                if job_id:
                    db = SessionLocal()
                    try:
                        record_job_failure(db, job_id, str(e), job_name=job_name)
                    except Exception:
                        logger.exception(f"Failed to record job failure for {job_id}")
                    finally:
                        db.close()

                # Best-effort Slack alert — never let notification failure mask the real error
                if alert_on_failure:
                    try:
                        from high_finance.utils.alerts import send_job_failure_alert
                        send_job_failure_alert(job_name, job_id or "unknown", str(e))
                    except Exception:
                        logger.warning(f"Failed to send Slack alert for {job_name}")

                raise

        return wrapper
    return decorator
