from typing import Dict, Optional, List

from fastapi import APIRouter, HTTPException, Query, Request

from high_finance.services.prices import get_price_history
from high_finance.core.rate_limit import limiter

router = APIRouter()


@router.get("/returns")
@limiter.limit("30/minute")
async def get_returns(
    request: Request,
    tickers: str = Query(..., description="Comma-separated tickers, e.g. AAPL,MSFT"),
    days: int = Query(30, ge=1, le=365),
) -> Dict[str, Optional[float]]:
    symbols: List[str] = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not symbols:
        return {}

    out: Dict[str, Optional[float]] = {}

    # SAFER mapping (avoids relying on "30d" support)
    if days <= 7:
        period = "5d"
    elif days <= 31:
        period = "1mo"
    elif days <= 93:
        period = "3mo"
    elif days <= 186:
        period = "6mo"
    else:
        period = "1y"

    for sym in symbols:
        try:
            prices = await get_price_history(sym, period)

            rows = prices
            if isinstance(prices, dict):
                rows = prices.get("prices") or prices.get("data") or prices.get("items") or []

            closes: List[float] = []
            for r in rows or []:
                if isinstance(r, dict):
                    c = r.get("close") or r.get("adj_close") or r.get("adjClose")
                    if c is not None:
                        closes.append(float(c))

            if len(closes) < 2:
                out[sym] = None
                continue

            # Use the earliest & latest close from the returned window
            start = closes[0]
            end = closes[-1]
            if start <= 0:
                out[sym] = None
                continue

            out[sym] = (end / start) - 1.0  # decimal return
        except Exception:
            out[sym] = None

    return out


@router.get("/{ticker}")
@limiter.limit("30/minute")
async def read_prices(
    request: Request,
    ticker: str,
    period: str = Query(
        default="1y",
        pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$",
    ),
    start: Optional[str] = Query(
        default=None,
        description="Start date in YYYY-MM-DD format. If provided with end, overrides period.",
    ),
    end: Optional[str] = Query(
        default=None,
        description="End date in YYYY-MM-DD format. If provided with start, overrides period.",
    ),
):
    """
    Fetch price history for a ticker.

    If both start and end are provided, fetches data for that date range.
    Otherwise, uses the period parameter.
    """
    prices = await get_price_history(ticker, period, start=start, end=end)
    if not prices:
        raise HTTPException(status_code=404, detail="Price data not found")
    return prices
