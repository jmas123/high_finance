"""
Tests for the job scheduler.
"""

from unittest.mock import patch, MagicMock

import pytest


class TestSchedulerConfiguration:
    """Tests for scheduler configuration and job registration."""

    def test_scheduler_creates_with_redis(self):
        """Scheduler should create with Redis connection."""
        with patch('high_finance.workers.scheduler.Redis') as mock_redis:
            with patch('high_finance.workers.scheduler.Scheduler') as mock_scheduler:
                from high_finance.workers.scheduler import create_scheduler

                mock_redis.from_url.return_value = MagicMock()
                scheduler = create_scheduler()

                mock_redis.from_url.assert_called_once()
                mock_scheduler.assert_called_once()

    def test_jobs_registered_with_timeouts(self):
        """All jobs should have timeouts configured."""
        from high_finance.workers.scheduler import register_jobs

        mock_scheduler = MagicMock()

        with patch('high_finance.workers.scheduler.logger'):
            register_jobs(mock_scheduler)

        # Verify cron was called with timeout
        for call in mock_scheduler.cron.call_args_list:
            _, kwargs = call
            assert 'timeout' in kwargs
            assert kwargs['timeout'] > 0

    def test_jobs_have_retry_configuration(self):
        """All jobs should have retry configuration."""
        from high_finance.workers.scheduler import register_jobs

        mock_scheduler = MagicMock()

        with patch('high_finance.workers.scheduler.logger'):
            register_jobs(mock_scheduler)

        # Verify cron was called with retry
        for call in mock_scheduler.cron.call_args_list:
            _, kwargs = call
            assert 'retry' in kwargs

    def test_screener_cron_starts_at_930(self):
        """Screener cache should start at 9:30 AM, not 9:00 AM."""
        from high_finance.workers.scheduler import register_jobs

        mock_scheduler = MagicMock()

        with patch('high_finance.workers.scheduler.logger'):
            register_jobs(mock_scheduler)

        # Find the screener_cache_open job
        screener_open_call = None
        for call in mock_scheduler.cron.call_args_list:
            args, kwargs = call
            if kwargs.get('id') == 'screener_cache_open':
                screener_open_call = call
                break

        assert screener_open_call is not None
        cron_expr = screener_open_call[0][0]
        # Should be "30 9 * * 1-5" (9:30 AM weekdays)
        assert cron_expr.startswith("30 9")


class TestSchedulerMainEntryPoint:
    """Tests for scheduler main entry point."""

    def test_exits_when_disabled(self):
        """Should exit cleanly when SCHEDULER_ENABLED=false."""
        with patch.dict('os.environ', {'SCHEDULER_ENABLED': 'false'}):
            with patch('sys.exit') as mock_exit:
                with patch('high_finance.workers.scheduler.logger'):
                    from high_finance.workers import scheduler
                    # Reimport to pick up env var
                    import importlib
                    importlib.reload(scheduler)

                    scheduler.main()
                    mock_exit.assert_called_with(0)
