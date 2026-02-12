"""
Calendar Event Aggregation Service
==================================
Gathers events from multiple sources for the calendar popup:
- Earnings dates (from yfinance via earnings service)
- Ex-dividend dates (from yfinance)
- Project catalysts (from database, authenticated users only)
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import yfinance as yf

logger = logging.getLogger(__name__)
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from high_finance.api.v1.schemas.calendar import (
    CalendarEvent,
    CalendarEventsRequest,
    CalendarEventsResponse,
    EventType,
)
from high_finance.core.cache import get_or_compute, trades_ttl
from high_finance.services.yf_cache import get_yf_info
from high_finance.db.models.project import Project, ProjectCatalyst


def _safe_float(x) -> Optional[float]:
    """Safely convert to float, returning None if invalid."""
    if pd.isna(x) or x is None:
        return None
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def _to_naive_date(ts) -> Optional[date]:
    """Convert timestamp to date."""
    if ts is None:
        return None
    if isinstance(ts, pd.Timestamp):
        return ts.to_pydatetime().date()
    if isinstance(ts, datetime):
        return ts.date()
    if isinstance(ts, date):
        return ts
    return None


def _fetch_earnings_dates_sync(ticker: str) -> List[dict]:
    """Blocking yfinance call for earnings dates — runs in thread pool."""
    stock = yf.Ticker(ticker)
    df = stock.earnings_dates
    if df is None or df.empty:
        return []
    rows = []
    for dt, row in df.iterrows():
        rows.append({
            "dt": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
            "hour": getattr(dt, "hour", 0) if hasattr(dt, "tz") else (dt.hour if hasattr(dt, "hour") else 0),
            "eps_estimate": float(row["EPS Estimate"]) if "EPS Estimate" in row and pd.notna(row.get("EPS Estimate")) else None,
        })
    return rows


async def _get_earnings_dates_cached(ticker: str) -> List[dict]:
    """Get earnings dates for a ticker, cached in Redis (1 hr TTL)."""
    cache_key = f"hf:earnings_dates:{ticker}"

    async def _compute():
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_earnings_dates_sync, ticker),
            timeout=15,
        )

    return await get_or_compute(cache_key, trades_ttl(), _compute)


async def get_earnings_events(
    tickers: List[str],
    start_date: date,
    end_date: date,
) -> List[CalendarEvent]:
    """Get upcoming earnings dates for tickers."""
    events: List[CalendarEvent] = []

    for ticker in tickers:
        try:
            earnings_rows = await _get_earnings_dates_cached(ticker)

            if not earnings_rows:
                continue

            info = await get_yf_info(ticker)
            company_name = info.get("shortName") or info.get("longName") or ticker

            for row in earnings_rows:
                try:
                    event_date = datetime.fromisoformat(row["dt"]).date()
                except (ValueError, TypeError):
                    continue

                # Filter by date range
                if event_date < start_date or event_date > end_date:
                    continue

                # Determine time (BMO/AMC/TBD)
                hour = row.get("hour", 0)
                time_label = "TBD" if hour == 0 else ("BMO" if hour < 12 else "AMC")

                eps_estimate = row.get("eps_estimate")

                events.append(CalendarEvent(
                    id=f"earnings_{ticker}_{event_date.isoformat()}",
                    event_type="earnings",
                    ticker=ticker.upper(),
                    company_name=company_name,
                    date=event_date,
                    time=time_label,
                    title=f"{ticker.upper()} Earnings",
                    description=f"EPS estimate: ${eps_estimate:.2f}" if eps_estimate else None,
                    metadata={"eps_estimate": eps_estimate} if eps_estimate else None,
                ))
        except Exception:
            logger.exception("Error fetching earnings for %s", ticker)
            continue

    return events


async def get_dividend_events(
    tickers: List[str],
    start_date: date,
    end_date: date,
) -> List[CalendarEvent]:
    """Get ex-dividend dates for tickers."""
    events: List[CalendarEvent] = []

    for ticker in tickers:
        try:
            info = await get_yf_info(ticker)

            ex_div_date = info.get("exDividendDate")
            if ex_div_date is None:
                continue

            # Convert timestamp (seconds since epoch) to date
            if isinstance(ex_div_date, (int, float)):
                event_date = datetime.fromtimestamp(ex_div_date).date()
            else:
                event_date = _to_naive_date(ex_div_date)

            if event_date is None:
                continue

            # Filter by date range
            if event_date < start_date or event_date > end_date:
                continue

            company_name = info.get("shortName") or info.get("longName") or ticker
            dividend_rate = info.get("dividendRate")

            events.append(CalendarEvent(
                id=f"dividend_{ticker}_{event_date.isoformat()}",
                event_type="ex_dividend",
                ticker=ticker.upper(),
                company_name=company_name,
                date=event_date,
                title=f"{ticker.upper()} Ex-Dividend",
                description=f"${dividend_rate:.2f}/share" if dividend_rate else None,
                metadata={"dividend_rate": dividend_rate} if dividend_rate else None,
            ))
        except Exception:
            logger.exception("Error fetching dividend for %s", ticker)
            continue

    return events


async def get_catalyst_events(
    tickers: List[str],
    start_date: date,
    end_date: date,
    owner_id: Optional[str],
    db: Session,
) -> List[CalendarEvent]:
    """Get project catalysts for authenticated user's projects."""
    if owner_id is None:
        return []

    events: List[CalendarEvent] = []

    try:
        # Query projects owned by user with matching tickers
        stmt = (
            select(ProjectCatalyst)
            .join(Project)
            .where(
                and_(
                    Project.owner_id == owner_id,
                    Project.ticker.in_([t.upper() for t in tickers]),
                    ProjectCatalyst.expected_date.isnot(None),
                    ProjectCatalyst.expected_date >= datetime.combine(start_date, datetime.min.time()),
                    ProjectCatalyst.expected_date <= datetime.combine(end_date, datetime.max.time()),
                )
            )
        )

        result = db.execute(stmt)
        catalysts = result.scalars().all()

        for cat in catalysts:
            event_date = cat.expected_date.date() if cat.expected_date else None
            if event_date is None:
                continue

            events.append(CalendarEvent(
                id=f"catalyst_{cat.id}",
                event_type="catalyst",
                ticker=cat.project.ticker.upper(),
                company_name=cat.project.title,
                date=event_date,
                title=cat.title,
                description=cat.description,
                metadata={
                    "status": cat.status,
                    "project_id": cat.project_id,
                },
            ))
    except Exception:
        logger.exception("Error fetching catalysts")

    return events


async def get_calendar_events(
    request: CalendarEventsRequest,
    owner_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> CalendarEventsResponse:
    """
    Aggregate calendar events from all sources.

    Args:
        request: Request with tickers, date range, and optional filters
        owner_id: User ID for catalyst access (optional)
        db: Database session for catalyst queries (optional)

    Returns:
        CalendarEventsResponse with events and by_date grouping
    """
    all_events: List[CalendarEvent] = []
    event_types = request.event_types or ["earnings", "ex_dividend", "catalyst"]

    # Normalize tickers
    tickers = [t.upper() for t in request.tickers]

    if not tickers:
        return CalendarEventsResponse(events=[], by_date={})

    # Fetch from each source based on requested types
    if "earnings" in event_types:
        earnings = await get_earnings_events(tickers, request.start_date, request.end_date)
        all_events.extend(earnings)

    if "ex_dividend" in event_types:
        dividends = await get_dividend_events(tickers, request.start_date, request.end_date)
        all_events.extend(dividends)

    if "catalyst" in event_types and db is not None:
        catalysts = await get_catalyst_events(
            tickers, request.start_date, request.end_date, owner_id, db
        )
        all_events.extend(catalysts)

    # Sort by date
    all_events.sort(key=lambda e: e.date)

    # Group by date
    by_date: Dict[str, List[CalendarEvent]] = {}
    for event in all_events:
        date_key = event.date.isoformat()
        if date_key not in by_date:
            by_date[date_key] = []
        by_date[date_key].append(event)

    return CalendarEventsResponse(events=all_events, by_date=by_date)
