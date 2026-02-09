"""
Admin API Routes
================
Endpoints for job management and monitoring.
Requires admin authentication.
"""

import secrets
import time
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from high_finance.core.config import settings
from redis import Redis
from rq import Queue, Retry
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from high_finance.core.config import settings
from high_finance.db.session import get_db
from high_finance.db.models.job_execution import JobExecution
from high_finance.services.job_tracker import (
    get_job_history,
    get_running_jobs,
    record_job_start,
)
from high_finance.api.v1.schemas.admin import (
    JobInfo,
    JobTriggerResponse,
    JobExecutionResponse,
    JobHistoryResponse,
    JobStatusResponse,
    SchedulerHealthResponse,
)

# Import job functions directly for type safety
from high_finance.workers.tasks.refresh_congress_trades import refresh_congress_trades_job
from high_finance.workers.tasks.refresh_screener_cache import (
    refresh_screener_cache_job,
    refresh_screener_cache_market_job,
)
from high_finance.workers.tasks.refresh_screener_universe import refresh_screener_universe_job
from high_finance.workers.tasks.refresh_comittees import refresh_committees_job
from high_finance.workers.tasks.refresh_13f import refresh_13f_job
from high_finance.workers.tasks.refresh_prices import refresh_prices_job
from high_finance.services.job_tracker import cleanup_old_executions_job

router = APIRouter()

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Job registry - maps job names to their functions and metadata
JOBS = {
    "congress_trades": {
        "func": refresh_congress_trades_job,
        "description": "Refresh congressional trading data from Quiver API",
        "timeout": 3600,
        "schedule": "Every 4 hours",
    },
    "screener_cache": {
        "func": refresh_screener_cache_job,
        "description": "Update screener cache with live market data",
        "timeout": 1800,
        "schedule": "Every 15 min during market hours",
    },
    "screener_cache_market": {
        "func": refresh_screener_cache_market_job,
        "description": "Update screener cache (market hours only)",
        "timeout": 1800,
        "schedule": "Every 15 min during market hours",
    },
    "screener_universe": {
        "func": refresh_screener_universe_job,
        "description": "Refresh S&P 500 universe from Wikipedia",
        "timeout": 1800,
        "schedule": "Monday 6 AM",
    },
    "committees": {
        "func": refresh_committees_job,
        "description": "Sync committee membership data",
        "timeout": 3600,
        "schedule": "1st of month 3 AM",
    },
    "13f_holdings": {
        "func": refresh_13f_job,
        "description": "Refresh 13F institutional holdings from SEC EDGAR",
        "timeout": 7200,
        "schedule": "Quarterly (20th of Feb/May/Aug/Nov)",
    },
    "price_history": {
        "func": refresh_prices_job,
        "description": "Update historical price data",
        "timeout": 3600,
        "schedule": "Daily 5 PM weekdays",
    },
    "cleanup": {
        "func": cleanup_old_executions_job,
        "description": "Clean up old job execution records",
        "timeout": 900,
        "schedule": "Sunday 2 AM",
    },
}


def verify_admin(authorization: Annotated[str | None, Header()] = None) -> bool:
    """
    Verify admin authentication via Bearer token.

    Expects header: Authorization: Bearer <ADMIN_API_KEY>
    """
    admin_key = settings.ADMIN_API_KEY

    if not admin_key:
        raise HTTPException(
            status_code=503,
            detail="Admin API not configured (ADMIN_API_KEY not set)",
        )

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header format (expected 'Bearer <token>')",
        )

    token = authorization.replace("Bearer ", "")
    if not secrets.compare_digest(token, admin_key):
        raise HTTPException(
            status_code=403,
            detail="Invalid admin API key",
        )

    return True


def get_redis() -> Redis:
    """Get Redis connection."""
    return Redis.from_url(settings.REDIS_URL)


def get_queue(redis: Redis | None = None) -> Queue:
    """Get RQ queue."""
    if redis is None:
        redis = get_redis()
    return Queue("default", connection=redis)


@router.get("/health", response_model=SchedulerHealthResponse)
async def scheduler_health():
    """
    Check scheduler health (no auth required).
    """
    try:
        redis = get_redis()
        redis.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return SchedulerHealthResponse(
        status="healthy" if redis_ok else "degraded",
        redis_connected=redis_ok,
        registered_jobs_count=len(JOBS),
        running_jobs_count=0,  # Would need to query RQ for actual count
    )


@router.get("/jobs", response_model=JobStatusResponse)
async def list_jobs(
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    List all registered jobs and their status.
    """
    job_infos = []
    for name, config in JOBS.items():
        # Get last execution
        history = get_job_history(db, name, limit=1)
        last_run = history[0].started_at if history else None

        job_infos.append(
            JobInfo(
                name=name,
                description=config["description"],
                schedule=config.get("schedule"),
                timeout_seconds=config["timeout"],
                last_run=last_run,
            )
        )

    running = get_running_jobs(db)
    running_responses = [
        JobExecutionResponse(
            id=j.id,
            job_id=j.job_id,
            job_name=j.job_name,
            status=j.status,
            started_at=j.started_at,
            completed_at=j.completed_at,
            duration_seconds=j.duration_seconds,
            result_summary=j.result_summary,
            error_message=j.error_message,
        )
        for j in running
    ]

    return JobStatusResponse(
        registered_jobs=job_infos,
        running_jobs=running_responses,
    )


@router.post("/jobs/{job_name}/trigger", response_model=JobTriggerResponse)
@limiter.limit("10/minute")
async def trigger_job(
    request: Request,
    job_name: str,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Manually trigger a job.

    Rate limited to 10 requests per minute.
    """
    if job_name not in JOBS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown job: {job_name}. Available jobs: {list(JOBS.keys())}",
        )

    config = JOBS[job_name]
    queue = get_queue()

    # Check for duplicate running jobs
    scheduled_id = f"{job_name}_scheduled"
    existing = queue.fetch_job(scheduled_id)
    if existing and existing.get_status() == "started":
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_name} is already running (scheduled instance)",
        )

    # Also check manual jobs in the last 5 minutes to prevent spam
    recent_manual = (
        db.query(JobExecution)
        .filter(
            JobExecution.job_name == job_name,
            JobExecution.status == "running",
        )
        .first()
    )
    if recent_manual:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_name} is already running",
        )

    # Generate deterministic job ID
    job_id = f"{job_name}_manual_{int(time.time())}"

    # Record job start
    record_job_start(db, job_id, job_name)

    # Enqueue with retry configuration
    job = queue.enqueue(
        config["func"],
        job_id=job_id,
        job_timeout=config["timeout"],
        retry=Retry(max=3, interval=[60, 300, 900]),
    )

    return JobTriggerResponse(
        job_id=job.id,
        job_name=job_name,
        status="queued",
        queued_at=datetime.utcnow(),
    )


@router.get("/jobs/{job_name}/history", response_model=JobHistoryResponse)
async def get_job_execution_history(
    job_name: str,
    limit: int = 10,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Get execution history for a specific job.
    """
    if job_name not in JOBS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown job: {job_name}",
        )

    executions = get_job_history(db, job_name, limit=limit)

    return JobHistoryResponse(
        job_name=job_name,
        executions=[
            JobExecutionResponse(
                id=e.id,
                job_id=e.job_id,
                job_name=e.job_name,
                status=e.status,
                started_at=e.started_at,
                completed_at=e.completed_at,
                duration_seconds=e.duration_seconds,
                result_summary=e.result_summary,
                error_message=e.error_message,
            )
            for e in executions
        ],
        total_count=len(executions),
    )


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    admin: bool = Depends(verify_admin),
):
    """
    Cancel a queued or running job.
    """
    queue = get_queue()
    job = queue.fetch_job(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )

    status = job.get_status()
    if status == "finished":
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel a finished job",
        )

    job.cancel()
    return {"status": "cancelled", "job_id": job_id}
