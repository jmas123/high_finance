from fastapi import APIRouter, HTTPException

from high_finance.services.insider_trades import get_insider_trades, get_insider_summary

router = APIRouter()


@router.get("/{ticker}")
async def read_insider_trades(ticker: str, limit: int = 50):
    """Get insider trading activity for a ticker."""
    trades = await get_insider_trades(ticker.upper())
    return trades[:limit]


@router.get("/{ticker}/summary")
async def read_insider_summary(ticker: str):
    """Get summary of insider trading activity."""
    summary = await get_insider_summary(ticker.upper())
    return summary