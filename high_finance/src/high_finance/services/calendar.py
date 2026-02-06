"""
Calendar Event Aggregation Service
==================================
Gathers events from multiple sources for the calendar popup:
- Earnings dates (from yfinance via earnings service)
- Ex-dividend dates (from yfinance)
- Project catalysts (from database, authenticated users only)
"""

from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import yfinance as yf
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from high_finance.api.v1.schemas.calendar import (
    CalendarEvent,
    CalendarEventsRequest,
    CalendarEventsResponse,
    EventType,
)
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


async def get_earnings_events(
    tickers: List[str],
    start_date: date,
    end_date: date,
) -> List[CalendarEvent]:
    """Get upcoming earnings dates for tickers."""
    events: List[CalendarEvent] = []

    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            earnings_dates = stock.earnings_dates

            if earnings_dates is None or earnings_dates.empty:
                continue

            info = stock.info or {}
            company_name = info.get("shortName") or info.get("longName") or ticker

            for dt, row in earnings_dates.iterrows():
                event_date = _to_naive_date(dt)
                if event_date is None:
                    continue

                # Filter by date range
                if event_date < start_date or event_date > end_date:
                    continue

                # Determine time (BMO/AMC/TBD)
                if isinstance(dt, pd.Timestamp):
                    hour = dt.hour if dt.tz is None else dt.tz_convert(None).hour
                    time_label = "TBD" if hour == 0 else ("BMO" if hour < 12 else "AMC")
                else:
                    time_label = "TBD"

                eps_estimate = _safe_float(row.get("EPS Estimate"))

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
        except Exception as e:
            print(f"Error fetching earnings for {ticker}: {e}")
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
            stock = yf.Ticker(ticker)
            info = stock.info or {}

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
        except Exception as e:
            print(f"Error fetching dividend for {ticker}: {e}")
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
    except Exception as e:
        print(f"Error fetching catalysts: {e}")

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
