from fastapi import APIRouter, HTTPException

from high_finance.services.institutional_flow import (
    get_institutional_holders,
    get_mutual_fund_holders,
    get_institutional_flow,
)

router = APIRouter()


@router.get("/{ticker}")
async def read_institutional_holders(ticker: str):
    """Get institutional holders for a ticker."""
    holders = await get_institutional_holders(ticker.upper())
    return holders


@router.get("/{ticker}/mutual-funds")
async def read_mutual_fund_holders(ticker: str):
    """Get mutual fund holders for a ticker."""
    holders = await get_mutual_fund_holders(ticker.upper())
    return holders


@router.get("/{ticker}/flow")
async def read_institutional_flow(ticker: str):
    """Get comprehensive institutional flow data (smart money analysis)."""
    flow = await get_institutional_flow(ticker.upper())
    return flow