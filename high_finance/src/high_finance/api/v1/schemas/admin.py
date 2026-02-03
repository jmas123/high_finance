"""
Admin API Schemas
=================
Pydantic models for admin endpoints.
"""

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class JobInfo(BaseModel):
    """Information about a registered job."""

    name: str
    description: str
    schedule: Optional[str] = None
    timeout_seconds: int
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None


class JobTriggerResponse(BaseModel):
    """Response from job trigger endpoint."""

    job_id: str
    job_name: str
    status: str
    queued_at: datetime


class JobExecutionResponse(BaseModel):
    """Job execution record for API responses."""

    id: int
    job_id: str
    job_name: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    result_summary: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class JobHistoryResponse(BaseModel):
    """Response for job history endpoint."""

    job_name: str
    executions: list[JobExecutionResponse]
    total_count: int


class JobStatusResponse(BaseModel):
    """Current status of all jobs."""

    registered_jobs: list[JobInfo]
    running_jobs: list[JobExecutionResponse]


class SchedulerHealthResponse(BaseModel):
    """Scheduler health check response."""

    status: str
    redis_connected: bool
    registered_jobs_count: int
    running_jobs_count: int
