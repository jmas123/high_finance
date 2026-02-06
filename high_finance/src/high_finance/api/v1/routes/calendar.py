"""
Calendar Events API Route
=========================
POST /api/v1/calendar/events - Get calendar events for watchlist tickers
"""

from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.core.security import get_current_user_optional, User
from high_finance.api.v1.schemas.calendar import (
    CalendarEventsRequest,
    CalendarEventsResponse,
)
from high_finance.services.calendar import get_calendar_events

router = APIRouter()


@router.post("/events", response_model=CalendarEventsResponse)
async def read_calendar_events(
    body: CalendarEventsRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get calendar events for specified tickers within date range.

    Event types include:
    - earnings: Upcoming earnings announcements
    - ex_dividend: Ex-dividend dates
    - catalyst: User-defined project catalysts (authenticated only)

    Anonymous users: earnings + dividends only
    Authenticated users: also includes catalysts from their projects
    """
    owner_id = user.id if user else None
    return await get_calendar_events(body, owner_id=owner_id, db=db)
