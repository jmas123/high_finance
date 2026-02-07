import logging

from fastapi import APIRouter, HTTPException

from high_finance.services.insider_trades import get_insider_trades, get_insider_summary

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def read_insider_trades(ticker: str, limit: int = 50):
    """Get insider trading activity for a ticker."""
    try:
        trades = await get_insider_trades(ticker.upper())
        return trades[:limit]
    except Exception as e:
        logger.exception("Insider trades failed for %s", ticker)
        raise HTTPException(500, "Unable to load insider trades")


@router.get("/{ticker}/summary")
async def read_insider_summary(ticker: str):
    """Get summary of insider trading activity."""
    try:
        return await get_insider_summary(ticker.upper())
    except Exception as e:
        logger.exception("Insider summary failed for %s", ticker)
        raise HTTPException(500, "Unable to load insider summary")