"""
Tests for admin API endpoints.
"""

from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient


# Test fixtures
@pytest.fixture
def mock_admin_key():
    """Set up mock admin API key."""
    with patch.dict('os.environ', {'ADMIN_API_KEY': 'test-secret-key'}):
        yield 'test-secret-key'


@pytest.fixture
def client(mock_admin_key):
    """Create test client with mocked dependencies."""
    with patch('high_finance.api.v1.routes.admin.get_redis') as mock_redis:
        with patch('high_finance.api.v1.routes.admin.get_queue') as mock_queue:
            mock_redis.return_value = MagicMock()
            mock_queue.return_value = MagicMock()

            from high_finance.api.v1.routes.admin import router
            from fastapi import FastAPI

            app = FastAPI()
            app.include_router(router, prefix="/admin")

            yield TestClient(app)


class TestAdminAuth:
    """Tests for admin authentication."""

    def test_missing_auth_header_returns_401(self, client):
        """Missing Authorization header should return 401."""
        response = client.get("/admin/jobs")
        assert response.status_code == 401
        assert "Missing Authorization" in response.json()["detail"]

    def test_invalid_auth_format_returns_401(self, client):
        """Non-Bearer auth should return 401."""
        response = client.get(
            "/admin/jobs",
            headers={"Authorization": "Basic test123"}
        )
        assert response.status_code == 401

    def test_invalid_token_returns_403(self, client, mock_admin_key):
        """Invalid Bearer token should return 403."""
        response = client.get(
            "/admin/jobs",
            headers={"Authorization": "Bearer wrong-key"}
        )
        assert response.status_code == 403

    def test_valid_token_allows_access(self, client, mock_admin_key):
        """Valid Bearer token should allow access."""
        with patch('high_finance.api.v1.routes.admin.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])

            with patch('high_finance.api.v1.routes.admin.get_job_history') as mock_history:
                mock_history.return_value = []
                with patch('high_finance.api.v1.routes.admin.get_running_jobs') as mock_running:
                    mock_running.return_value = []

                    response = client.get(
                        "/admin/jobs",
                        headers={"Authorization": f"Bearer {mock_admin_key}"}
                    )
                    assert response.status_code == 200


class TestHealthEndpoint:
    """Tests for health endpoint (no auth required)."""

    def test_health_returns_200(self, client):
        """Health endpoint should return 200 without auth."""
        with patch('high_finance.api.v1.routes.admin.get_redis') as mock_redis:
            mock_redis.return_value.ping.return_value = True

            response = client.get("/admin/health")
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"

    def test_health_shows_degraded_on_redis_failure(self, client):
        """Health should show degraded if Redis fails."""
        with patch('high_finance.api.v1.routes.admin.get_redis') as mock_redis:
            mock_redis.return_value.ping.side_effect = Exception("Connection refused")

            response = client.get("/admin/health")
            assert response.status_code == 200
            assert response.json()["status"] == "degraded"
            assert response.json()["redis_connected"] is False


class TestTriggerJob:
    """Tests for job trigger endpoint."""

    def test_unknown_job_returns_404(self, client, mock_admin_key):
        """Triggering unknown job should return 404."""
        response = client.post(
            "/admin/jobs/nonexistent_job/trigger",
            headers={"Authorization": f"Bearer {mock_admin_key}"}
        )
        assert response.status_code == 404

    def test_already_running_returns_409(self, client, mock_admin_key):
        """Triggering already running job should return 409."""
        with patch('high_finance.api.v1.routes.admin.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])

            with patch('high_finance.api.v1.routes.admin.get_queue') as mock_get_queue:
                mock_queue = MagicMock()
                mock_get_queue.return_value = mock_queue

                # Simulate running job
                mock_job = MagicMock()
                mock_job.get_status.return_value = "started"
                mock_queue.fetch_job.return_value = mock_job

                response = client.post(
                    "/admin/jobs/congress_trades/trigger",
                    headers={"Authorization": f"Bearer {mock_admin_key}"}
                )
                assert response.status_code == 409


class TestJobHistory:
    """Tests for job history endpoint."""

    def test_returns_execution_history(self, client, mock_admin_key):
        """Should return job execution history."""
        with patch('high_finance.api.v1.routes.admin.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])

            with patch('high_finance.api.v1.routes.admin.get_job_history') as mock_history:
                mock_execution = MagicMock()
                mock_execution.id = 1
                mock_execution.job_id = "test_123"
                mock_execution.job_name = "congress_trades"
                mock_execution.status = "completed"
                mock_execution.started_at = datetime.utcnow()
                mock_execution.completed_at = datetime.utcnow()
                mock_execution.duration_seconds = 60.0
                mock_execution.result_summary = {"updated": 10}
                mock_execution.error_message = None

                mock_history.return_value = [mock_execution]

                response = client.get(
                    "/admin/jobs/congress_trades/history",
                    headers={"Authorization": f"Bearer {mock_admin_key}"}
                )
                assert response.status_code == 200
                data = response.json()
                assert data["job_name"] == "congress_trades"
                assert len(data["executions"]) == 1
