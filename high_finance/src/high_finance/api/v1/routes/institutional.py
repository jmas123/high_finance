import logging

from fastapi import APIRouter, HTTPException

from high_finance.services.institutional_flow import (
    get_institutional_holders,
    get_mutual_fund_holders,
    get_institutional_flow,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def read_institutional_holders(ticker: str):
    """Get institutional holders for a ticker."""
    try:
        return await get_institutional_holders(ticker.upper())
    except Exception as e:
        logger.exception("Institutional holders failed for %s", ticker)
        raise HTTPException(500, "Unable to load institutional data")


@router.get("/{ticker}/mutual-funds")
async def read_mutual_fund_holders(ticker: str):
    """Get mutual fund holders for a ticker."""
    try:
        return await get_mutual_fund_holders(ticker.upper())
    except Exception as e:
        logger.exception("Mutual fund holders failed for %s", ticker)
        raise HTTPException(500, "Unable to load mutual fund data")


@router.get("/{ticker}/flow")
async def read_institutional_flow(ticker: str):
    """Get comprehensive institutional flow data (smart money analysis)."""
    try:
        return await get_institutional_flow(ticker.upper())
    except Exception as e:
        logger.exception("Institutional flow failed for %s", ticker)
        raise HTTPException(500, "Unable to load institutional flow")