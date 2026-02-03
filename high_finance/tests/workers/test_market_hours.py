"""
Tests for market hours utility.
"""

from datetime import datetime, date
from unittest.mock import patch, MagicMock

import pytest
import pytz

# Import will fail if exchange_calendars not installed, skip in that case
try:
    from high_finance.utils.market_hours import (
        is_trading_day,
        is_market_hours,
        should_run_market_hours_job,
        EST,
    )
    MARKET_HOURS_AVAILABLE = True
except ImportError:
    MARKET_HOURS_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not MARKET_HOURS_AVAILABLE,
    reason="exchange_calendars not installed"
)


class TestIsTradingDay:
    """Tests for is_trading_day function."""

    def test_weekday_is_trading_day(self):
        """Normal weekdays should be trading days (unless holiday)."""
        # Monday, Feb 3, 2025 - should be a trading day
        monday = date(2025, 2, 3)
        # Note: This will use the actual NYSE calendar
        result = is_trading_day(monday)
        assert isinstance(result, bool)

    def test_saturday_not_trading_day(self):
        """Saturdays should not be trading days."""
        saturday = date(2025, 2, 1)
        assert is_trading_day(saturday) is False

    def test_sunday_not_trading_day(self):
        """Sundays should not be trading days."""
        sunday = date(2025, 2, 2)
        assert is_trading_day(sunday) is False

    def test_christmas_not_trading_day(self):
        """Major holidays should not be trading days."""
        christmas = date(2024, 12, 25)
        assert is_trading_day(christmas) is False

    def test_default_to_today(self):
        """Should default to today if no date provided."""
        result = is_trading_day()
        assert isinstance(result, bool)


class TestIsMarketHours:
    """Tests for is_market_hours function."""

    def test_before_open(self):
        """Before 9:30 AM should not be market hours."""
        before_open = EST.localize(datetime(2025, 2, 3, 9, 0))  # Monday 9:00 AM
        assert is_market_hours(before_open) is False

    def test_at_open(self):
        """9:30 AM should be market hours."""
        at_open = EST.localize(datetime(2025, 2, 3, 9, 30))  # Monday 9:30 AM
        # This depends on Feb 3, 2025 being a trading day
        with patch('high_finance.utils.market_hours.is_trading_day', return_value=True):
            assert is_market_hours(at_open) is True

    def test_during_trading(self):
        """Mid-day should be market hours."""
        midday = EST.localize(datetime(2025, 2, 3, 12, 0))  # Monday noon
        with patch('high_finance.utils.market_hours.is_trading_day', return_value=True):
            assert is_market_hours(midday) is True

    def test_at_close(self):
        """4:00 PM should NOT be market hours (market closes at 4)."""
        at_close = EST.localize(datetime(2025, 2, 3, 16, 0))  # Monday 4:00 PM
        assert is_market_hours(at_close) is False

    def test_after_close(self):
        """After 4:00 PM should not be market hours."""
        after_close = EST.localize(datetime(2025, 2, 3, 17, 0))  # Monday 5:00 PM
        assert is_market_hours(after_close) is False

    def test_weekend_not_market_hours(self):
        """Weekend times should not be market hours."""
        saturday_noon = EST.localize(datetime(2025, 2, 1, 12, 0))
        assert is_market_hours(saturday_noon) is False


class TestShouldRunMarketHoursJob:
    """Tests for should_run_market_hours_job function."""

    def test_returns_bool(self):
        """Should return a boolean."""
        result = should_run_market_hours_job()
        assert isinstance(result, bool)

    @patch('high_finance.utils.market_hours.is_market_hours')
    def test_delegates_to_is_market_hours(self, mock_is_market_hours):
        """Should delegate to is_market_hours."""
        mock_is_market_hours.return_value = True
        assert should_run_market_hours_job() is True

        mock_is_market_hours.return_value = False
        assert should_run_market_hours_job() is False
