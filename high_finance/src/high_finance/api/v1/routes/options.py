from fastapi import APIRouter, HTTPException

from high_finance.services.options_flow import get_options_overview, get_options_chain

router = APIRouter()


@router.get("/{ticker}")
async def read_options_overview(ticker: str):
    """Get options overview with unusual activity detection."""
    data = await get_options_overview(ticker.upper())
    return data


@router.get("/{ticker}/chain/{expiry}")
async def read_options_chain(ticker: str, expiry: str):
    """Get full options chain for a specific expiration."""
    data = await get_options_chain(ticker.upper(), expiry)
    return data