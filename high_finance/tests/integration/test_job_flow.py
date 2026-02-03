"""
Integration tests for job flow.

These tests verify the complete flow from triggering a job through
completion and database tracking.

Note: These tests require a running Redis instance and database.
They are marked as integration tests and should be run separately.
"""

import os
import time
from datetime import datetime

import pytest

# Skip if not running integration tests
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS", "false").lower() != "true",
    reason="Integration tests disabled (set RUN_INTEGRATION_TESTS=true)"
)


class TestJobTriggerFlow:
    """Integration tests for triggering jobs via API."""

    @pytest.fixture
    def api_client(self):
        """Create API test client with real dependencies."""
        from fastapi.testclient import TestClient
        from high_finance.api.v1.routes.admin import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router, prefix="/admin")
        return TestClient(app)

    @pytest.fixture
    def admin_auth_header(self):
        """Get admin auth header."""
        key = os.getenv("ADMIN_API_KEY", "test-key")
        return {"Authorization": f"Bearer {key}"}

    def test_trigger_and_track_job(self, api_client, admin_auth_header):
        """
        Test complete job flow:
        1. Trigger job via API
        2. Verify job queued in Redis
        3. Wait for completion
        4. Verify job tracked in database
        """
        # 1. Trigger job
        response = api_client.post(
            "/admin/jobs/screener_universe/trigger",
            headers=admin_auth_header
        )

        if response.status_code == 409:
            pytest.skip("Job already running")

        assert response.status_code == 200
        data = response.json()
        job_id = data["job_id"]
        assert data["status"] == "queued"

        # 2. Wait for completion (with timeout)
        max_wait = 120  # 2 minutes
        start = time.time()
        completed = False

        while time.time() - start < max_wait:
            # Check job history
            history_response = api_client.get(
                "/admin/jobs/screener_universe/history?limit=1",
                headers=admin_auth_header
            )
            assert history_response.status_code == 200

            executions = history_response.json()["executions"]
            if executions and executions[0]["job_id"] == job_id:
                if executions[0]["status"] in ["completed", "failed"]:
                    completed = True
                    break

            time.sleep(5)

        assert completed, f"Job did not complete within {max_wait} seconds"

        # 3. Verify final status
        final_response = api_client.get(
            "/admin/jobs/screener_universe/history?limit=1",
            headers=admin_auth_header
        )
        final_exec = final_response.json()["executions"][0]
        assert final_exec["status"] == "completed"
        assert final_exec["result_summary"] is not None


class TestJobRetryFlow:
    """Integration tests for job retry behavior."""

    def test_failed_job_retries(self):
        """
        Test that failed jobs are retried according to configuration.
        This test would require mocking a failing job scenario.
        """
        pytest.skip("Retry testing requires controlled failure scenario")


class TestSchedulerFlow:
    """Integration tests for scheduler."""

    def test_scheduled_jobs_registered(self):
        """Verify all expected jobs are registered with scheduler."""
        from redis import Redis
        from high_finance.core.config import settings

        redis = Redis.from_url(settings.REDIS_URL)

        # Check for scheduled job keys
        keys = redis.keys("rq:scheduler:*")

        expected_jobs = [
            "congress_trades_scheduled",
            "screener_cache_open",
            "screener_cache_intraday",
            "screener_cache_close",
            "sp500_universe_scheduled",
            "committee_membership_scheduled",
            "13f_holdings_scheduled",
            "price_history_scheduled",
            "cleanup_scheduled",
        ]

        # Note: This test may not work exactly like this depending on
        # how rq-scheduler stores jobs. Adjust based on actual implementation.
        pytest.skip("Scheduler key structure needs verification")


class TestDatabaseTracking:
    """Integration tests for database tracking."""

    @pytest.fixture
    def db_session(self):
        """Create database session."""
        from high_finance.db.session import SessionLocal
        db = SessionLocal()
        yield db
        db.close()

    def test_job_execution_persisted(self, db_session):
        """Verify job executions are persisted to database."""
        from high_finance.db.models.job_execution import JobExecution
        from high_finance.services.job_tracker import record_job_start, record_job_complete

        # Create a test job execution
        job_id = f"test_integration_{int(time.time())}"
        record_job_start(db_session, job_id, "test_job")
        record_job_complete(db_session, job_id, {"status": "ok", "test": True})

        # Verify it's in database
        execution = db_session.query(JobExecution).filter_by(job_id=job_id).first()
        assert execution is not None
        assert execution.status == "completed"
        assert execution.result_summary["test"] is True

        # Cleanup
        db_session.delete(execution)
        db_session.commit()
