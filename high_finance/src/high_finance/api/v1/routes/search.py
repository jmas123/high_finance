import logging

from fastapi import APIRouter, HTTPException
from high_finance.services.search import search_tickers

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def search(q: str = ""):
    """Search for tickers by company name or symbol."""
    try:
        return await search_tickers(q)
    except Exception as e:
        logger.exception("Search failed for q=%s", q)
        raise HTTPException(500, "Search is temporarily unavailable")