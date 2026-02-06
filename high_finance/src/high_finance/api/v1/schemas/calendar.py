"""
Calendar Event Schemas
======================
Pydantic models for the mini calendar popup feature.
"""

from datetime import date
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel


EventType = Literal["earnings", "sec_filing", "ex_dividend", "catalyst"]


class CalendarEvent(BaseModel):
    """A single calendar event."""
    id: str
    event_type: EventType
    ticker: str
    company_name: Optional[str] = None
    date: date
    time: Optional[str] = None  # BMO/AMC/TBD for earnings
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class CalendarEventsRequest(BaseModel):
    """Request body for calendar events."""
    tickers: List[str]
    start_date: date
    end_date: date
    event_types: Optional[List[EventType]] = None  # Filter by type, None = all


class CalendarEventsResponse(BaseModel):
    """Response with calendar events grouped by date."""
    events: List[CalendarEvent]
    by_date: Dict[str, List[CalendarEvent]]  # ISO date string -> events
