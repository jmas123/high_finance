"""
Market Hours Utility
====================
Utilities for checking market hours and trading days using NYSE calendar.
"""

from datetime import datetime, date
from typing import Optional

import exchange_calendars as xcals
import pandas as pd
import pytz

EST = pytz.timezone("America/New_York")

# Initialize NYSE calendar (lazy loaded)
_nyse_calendar: Optional[xcals.ExchangeCalendar] = None


def _get_nyse() -> xcals.ExchangeCalendar:
    """Get or create NYSE calendar (cached)."""
    global _nyse_calendar
    if _nyse_calendar is None:
        _nyse_calendar = xcals.get_calendar("NYSE")
    return _nyse_calendar


def is_trading_day(check_date: Optional[date] = None) -> bool:
    """
    Check if a date is an NYSE trading day (excludes weekends and holidays).

    Args:
        check_date: Date to check. Defaults to today in Eastern Time.

    Returns:
        True if the date is a trading day, False otherwise.
    """
    if check_date is None:
        check_date = datetime.now(EST).date()

    try:
        nyse = _get_nyse()
        return nyse.is_session(pd.Timestamp(check_date))
    except Exception:
        # Fallback to basic weekday check if calendar fails
        return check_date.weekday() < 5


def is_market_hours(check_time: Optional[datetime] = None) -> bool:
    """
    Check if the current time is within NYSE regular trading hours.

    Regular trading hours: 9:30 AM - 4:00 PM Eastern Time

    Args:
        check_time: Datetime to check. Defaults to now.

    Returns:
        True if within market hours, False otherwise.
    """
    if check_time is None:
        now = datetime.now(EST)
    else:
        # Convert to Eastern Time if timezone-aware, otherwise assume EST
        if check_time.tzinfo is not None:
            now = check_time.astimezone(EST)
        else:
            now = EST.localize(check_time)

    # Check if it's a trading day
    if not is_trading_day(now.date()):
        return False

    # Check time: 9:30 AM to 4:00 PM
    hour = now.hour
    minute = now.minute

    # Before 9:30 AM
    if hour < 9 or (hour == 9 and minute < 30):
        return False

    # After 4:00 PM
    if hour >= 16:
        return False

    return True


def get_next_market_open() -> datetime:
    """
    Get the next market open time.

    Returns:
        Datetime of next market open in Eastern Time.
    """
    nyse = _get_nyse()
    now = datetime.now(EST)
    current_date = now.date()

    # If market is currently open, return now
    if is_market_hours(now):
        return now

    # Find next trading day
    check_date = current_date
    for _ in range(10):  # Safety limit
        if is_trading_day(check_date):
            open_time = EST.localize(
                datetime.combine(check_date, datetime.min.time().replace(hour=9, minute=30))
            )
            if open_time > now:
                return open_time
        check_date = check_date + pd.Timedelta(days=1)

    # Fallback: next weekday at 9:30 AM
    while check_date.weekday() >= 5:
        check_date = check_date + pd.Timedelta(days=1)

    return EST.localize(
        datetime.combine(check_date, datetime.min.time().replace(hour=9, minute=30))
    )


def should_run_market_hours_job() -> bool:
    """
    Check if a market-hours-only job should run right now.

    Returns True if:
    - It's a trading day AND
    - Current time is between 9:30 AM and 4:00 PM EST

    Use this in scheduled jobs that should only run during market hours.
    """
    return is_market_hours()
