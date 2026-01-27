from fastapi import APIRouter, HTTPException, Query
from typing import List
from pydantic import BaseModel


from high_finance.services.earnings import (
    get_earnings_calendar,
    get_earnings_history_with_moves,
    get_upcoming_earnings,
)

router = APIRouter()

class UpcomingEarningsRequest(BaseModel):
    tickers: List[str]

@router.get("/{ticker}")
async def read_earnings(ticker: str):
    """Get earnings calendar and estimates for a ticker."""
    data = await get_earnings_calendar(ticker.upper())
    return data


@router.get("/{ticker}/history")
async def read_earnings_history(ticker: str):
    """Get earnings history with surprise % and post-earnings moves."""
    data = await get_earnings_history_with_moves(ticker.upper())
    return data


@router.post("/upcoming")
async def read_upcoming_earnings(
    body: UpcomingEarningsRequest,
    days_ahead: int = Query(default=14, ge=1, le=90),
):
    data = await get_upcoming_earnings([t.upper() for t in body.tickers], days_ahead)
    return data
