import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from high_finance.services.earnings import (
    get_earnings_calendar,
    get_earnings_history_with_moves,
    get_upcoming_earnings,
)

logger = logging.getLogger(__name__)
router = APIRouter()

class UpcomingEarningsRequest(BaseModel):
    tickers: List[str]

@router.get("/{ticker}")
async def read_earnings(ticker: str):
    """Get earnings calendar and estimates for a ticker."""
    try:
        return await get_earnings_calendar(ticker.upper())
    except Exception as e:
        logger.exception("Earnings calendar failed for %s", ticker)
        raise HTTPException(500, "Unable to load earnings data")


@router.get("/{ticker}/history")
async def read_earnings_history(ticker: str):
    """Get earnings history with surprise % and post-earnings moves."""
    try:
        return await get_earnings_history_with_moves(ticker.upper())
    except Exception as e:
        logger.exception("Earnings history failed for %s", ticker)
        raise HTTPException(500, "Unable to load earnings history")


@router.post("/upcoming")
async def read_upcoming_earnings(
    body: UpcomingEarningsRequest,
    days_ahead: int = Query(default=14, ge=1, le=90),
):
    try:
        return await get_upcoming_earnings([t.upper() for t in body.tickers], days_ahead)
    except Exception as e:
        logger.exception("Upcoming earnings failed")
        raise HTTPException(500, "Unable to load upcoming earnings")
