import logging

from fastapi import APIRouter, HTTPException, Request

from high_finance.services.institutional_flow import (
    get_institutional_holders,
    get_mutual_fund_holders,
    get_institutional_flow,
)
from high_finance.core.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
@limiter.limit("30/minute")
async def read_institutional_holders(request: Request, ticker: str):
    """Get institutional holders for a ticker."""
    try:
        return await get_institutional_holders(ticker.upper())
    except Exception as e:
        logger.exception("Institutional holders failed for %s", ticker)
        raise HTTPException(500, "Unable to load institutional data")


@router.get("/{ticker}/mutual-funds")
@limiter.limit("30/minute")
async def read_mutual_fund_holders(request: Request, ticker: str):
    """Get mutual fund holders for a ticker."""
    try:
        return await get_mutual_fund_holders(ticker.upper())
    except Exception as e:
        logger.exception("Mutual fund holders failed for %s", ticker)
        raise HTTPException(500, "Unable to load mutual fund data")


@router.get("/{ticker}/flow")
@limiter.limit("30/minute")
async def read_institutional_flow(request: Request, ticker: str):
    """Get comprehensive institutional flow data (smart money analysis)."""
    try:
        return await get_institutional_flow(ticker.upper())
    except Exception as e:
        logger.exception("Institutional flow failed for %s", ticker)
        raise HTTPException(500, "Unable to load institutional flow")