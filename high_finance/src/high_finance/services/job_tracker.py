"""
Job Tracker Service
===================
Tracks job execution history in the database.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from high_finance.db.models.job_execution import JobExecution
from high_finance.db.session import SessionLocal
from high_finance.utils.alerts import send_job_failure_alert

logger = logging.getLogger(__name__)


def record_job_start(
    db: Session,
    job_id: str,
    job_name: str,
) -> JobExecution:
    """
    Record that a job has started.

    Args:
        db: Database session
        job_id: Unique job identifier
        job_name: Human-readable job name

    Returns:
        The created JobExecution record.
    """
    # Check if record already exists (shouldn't happen, but handle gracefully)
    existing = db.query(JobExecution).filter_by(job_id=job_id).first()
    if existing:
        logger.warning(f"Job execution record already exists for job_id={job_id}")
        existing.status = "running"
        existing.started_at = datetime.utcnow()
        db.commit()
        return existing

    execution = JobExecution(
        job_id=job_id,
        job_name=job_name,
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(execution)
    db.commit()
    logger.info(f"Job started: {job_name} (id={job_id})")
    return execution


def record_job_complete(
    db: Session,
    job_id: str,
    result: dict,
) -> Optional[JobExecution]:
    """
    Record that a job has completed successfully.

    Args:
        db: Database session
        job_id: Unique job identifier
        result: Job result summary dict

    Returns:
        The updated JobExecution record, or None if not found.
    """
    execution = db.query(JobExecution).filter_by(job_id=job_id).first()

    if not execution:
        # Handle race condition - create record if missing
        logger.warning(f"Job execution not found for job_id={job_id}, creating record")
        execution = JobExecution(
            job_id=job_id,
            job_name=result.get("job_name", "unknown"),
            status="completed",
            completed_at=datetime.utcnow(),
            result_summary=result,
        )
        db.add(execution)
    else:
        execution.status = "completed"
        execution.completed_at = datetime.utcnow()
        execution.result_summary = result

    db.commit()
    logger.info(f"Job completed: {execution.job_name} (id={job_id})")
    return execution


def record_job_failure(
    db: Session,
    job_id: str,
    error: str,
    job_name: Optional[str] = None,
) -> Optional[JobExecution]:
    """
    Record that a job has failed.

    Args:
        db: Database session
        job_id: Unique job identifier
        error: Error message
        job_name: Optional job name if not already recorded

    Returns:
        The updated JobExecution record, or None if not found.
    """
    execution = db.query(JobExecution).filter_by(job_id=job_id).first()

    if not execution:
        # Handle race condition - create record if missing
        logger.warning(f"Job execution not found for job_id={job_id}, creating record")
        execution = JobExecution(
            job_id=job_id,
            job_name=job_name or "unknown",
            status="failed",
            completed_at=datetime.utcnow(),
            error_message=error,
        )
        db.add(execution)
    else:
        execution.status = "failed"
        execution.completed_at = datetime.utcnow()
        execution.error_message = error

    db.commit()

    # Send alert on failure
    actual_job_name = execution.job_name or job_name or "unknown"
    logger.error(f"Job failed: {actual_job_name} (id={job_id}): {error}")
    send_job_failure_alert(actual_job_name, job_id, error)

    return execution


def get_job_history(
    db: Session,
    job_name: str,
    limit: int = 10,
) -> list[JobExecution]:
    """
    Get recent execution history for a job.

    Args:
        db: Database session
        job_name: Name of the job
        limit: Maximum records to return

    Returns:
        List of JobExecution records, most recent first.
    """
    return (
        db.query(JobExecution)
        .filter(JobExecution.job_name == job_name)
        .order_by(JobExecution.started_at.desc())
        .limit(limit)
        .all()
    )


def get_running_jobs(db: Session) -> list[JobExecution]:
    """Get all currently running jobs."""
    return (
        db.query(JobExecution)
        .filter(JobExecution.status == "running")
        .all()
    )


def cleanup_old_executions(db: Session, days: int = 90) -> int:
    """
    Remove job execution records older than N days.

    Args:
        db: Database session
        days: Age threshold in days

    Returns:
        Number of records deleted.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = (
        db.query(JobExecution)
        .filter(JobExecution.started_at < cutoff)
        .delete()
    )
    db.commit()
    logger.info(f"Cleaned up {deleted} old job execution records")
    return deleted


def cleanup_old_executions_job(days: int = 90) -> dict:
    """
    RQ job wrapper for cleanup.

    Args:
        days: Age threshold in days.
    """
    db: Session = SessionLocal()
    try:
        deleted = cleanup_old_executions(db, days=days)
        return {
            "status": "ok",
            "deleted": deleted,
            "threshold_days": days,
        }
    except Exception as e:
        logger.exception(f"Cleanup job failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
