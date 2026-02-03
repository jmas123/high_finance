"""
Job Execution Model
===================
Tracks execution history of scheduled and manual jobs.
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB

from high_finance.db.base import Base


class JobExecution(Base):
    """
    Records job execution history for monitoring and debugging.

    Attributes:
        id: Primary key
        job_id: Unique job identifier (from RQ)
        job_name: Human-readable job name (e.g., "congress_trades")
        status: pending, running, completed, failed
        started_at: When the job started (UTC)
        completed_at: When the job finished (UTC)
        result_summary: JSONB with job-specific results
        error_message: Error details if failed
    """

    __tablename__ = "job_executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(255), unique=True, index=True, nullable=False)
    job_name = Column(String(100), index=True, nullable=False)
    status = Column(String(20), index=True, nullable=False, default="pending")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result_summary = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<JobExecution(id={self.id}, job_id={self.job_id}, status={self.status})>"

    @property
    def duration_seconds(self) -> float | None:
        """Calculate job duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
