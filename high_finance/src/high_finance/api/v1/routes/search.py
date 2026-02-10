import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

from high_finance.services.search import search_tickers

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def search(q: str = Query("", max_length=100)):
    """Search for tickers by company name or symbol."""
    try:
        return await search_tickers(q)
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("Search upstream unavailable: %s", e)
        raise HTTPException(503, "Search is temporarily unavailable")
    except Exception as e:
        logger.exception("Search failed for q=%s", q)
        raise HTTPException(500, "Search failed unexpectedly")
