from fastapi import APIRouter, HTTPException, Query

from high_finance.services.prices import get_price_history

router = APIRouter()

@router.get("/{ticker}")
async def read_prices(
    ticker: str, 
    period: str = Query(default="1y", regex="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$")
):
    prices = await get_price_history(ticker, period)
    if not prices:
        raise HTTPException(status_code=404, detail="Price data not found")
    return prices