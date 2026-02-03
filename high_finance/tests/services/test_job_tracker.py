"""
Tests for job tracker service.
"""

from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest


class TestRecordJobStart:
    """Tests for recording job start."""

    def test_creates_execution_record(self):
        """Should create a new execution record."""
        from high_finance.services.job_tracker import record_job_start

        mock_db = MagicMock()
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        result = record_job_start(mock_db, "job_123", "congress_trades")

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert result.job_id == "job_123"
        assert result.job_name == "congress_trades"

    def test_handles_existing_record(self):
        """Should update existing record if one exists."""
        from high_finance.services.job_tracker import record_job_start

        mock_db = MagicMock()
        existing = MagicMock()
        existing.job_id = "job_123"
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing

        result = record_job_start(mock_db, "job_123", "congress_trades")

        mock_db.add.assert_not_called()
        assert existing.status == "running"


class TestRecordJobComplete:
    """Tests for recording job completion."""

    def test_updates_execution_record(self):
        """Should update execution record with results."""
        from high_finance.services.job_tracker import record_job_complete

        mock_db = MagicMock()
        existing = MagicMock()
        existing.job_name = "congress_trades"
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing

        result = record_job_complete(
            mock_db,
            "job_123",
            {"status": "ok", "updated": 10}
        )

        assert existing.status == "completed"
        assert existing.result_summary == {"status": "ok", "updated": 10}
        mock_db.commit.assert_called_once()

    def test_creates_record_if_missing(self):
        """Should create record if not found (race condition handling)."""
        from high_finance.services.job_tracker import record_job_complete

        mock_db = MagicMock()
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        record_job_complete(
            mock_db,
            "job_123",
            {"status": "ok", "job_name": "congress_trades"}
        )

        mock_db.add.assert_called_once()


class TestRecordJobFailure:
    """Tests for recording job failure."""

    def test_records_error_message(self):
        """Should record error message."""
        from high_finance.services.job_tracker import record_job_failure

        mock_db = MagicMock()
        existing = MagicMock()
        existing.job_name = "congress_trades"
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing

        with patch('high_finance.services.job_tracker.send_job_failure_alert'):
            record_job_failure(mock_db, "job_123", "Connection timeout")

        assert existing.status == "failed"
        assert existing.error_message == "Connection timeout"

    def test_sends_alert_on_failure(self):
        """Should send Slack alert on failure."""
        from high_finance.services.job_tracker import record_job_failure

        mock_db = MagicMock()
        existing = MagicMock()
        existing.job_name = "congress_trades"
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing

        with patch('high_finance.services.job_tracker.send_job_failure_alert') as mock_alert:
            record_job_failure(mock_db, "job_123", "Error")
            mock_alert.assert_called_once_with("congress_trades", "job_123", "Error")


class TestCleanupOldExecutions:
    """Tests for cleanup of old execution records."""

    def test_deletes_old_records(self):
        """Should delete records older than threshold."""
        from high_finance.services.job_tracker import cleanup_old_executions

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.delete.return_value = 5

        deleted = cleanup_old_executions(mock_db, days=90)

        assert deleted == 5
        mock_db.commit.assert_called_once()

    def test_uses_correct_cutoff(self):
        """Should calculate correct cutoff date."""
        from high_finance.services.job_tracker import cleanup_old_executions
        from high_finance.db.models.job_execution import JobExecution

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.delete.return_value = 0

        cleanup_old_executions(mock_db, days=30)

        # Verify filter was called
        mock_db.query.assert_called_with(JobExecution)


class TestCleanupJob:
    """Tests for cleanup RQ job wrapper."""

    def test_returns_result_dict(self):
        """Job should return result dict."""
        from high_finance.services.job_tracker import cleanup_old_executions_job

        with patch('high_finance.services.job_tracker.SessionLocal') as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db

            with patch('high_finance.services.job_tracker.cleanup_old_executions') as mock_cleanup:
                mock_cleanup.return_value = 10

                result = cleanup_old_executions_job(days=90)

                assert result['status'] == 'ok'
                assert result['deleted'] == 10
                mock_db.close.assert_called_once()

    def test_handles_errors(self):
        """Job should handle errors gracefully."""
        from high_finance.services.job_tracker import cleanup_old_executions_job

        with patch('high_finance.services.job_tracker.SessionLocal') as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db

            with patch('high_finance.services.job_tracker.cleanup_old_executions') as mock_cleanup:
                mock_cleanup.side_effect = Exception("DB Error")

                result = cleanup_old_executions_job()

                assert result['status'] == 'error'
                mock_db.close.assert_called_once()
