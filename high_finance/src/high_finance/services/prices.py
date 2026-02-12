import asyncio

import yfinance as yf
import math
from typing import List, Dict, Any, Optional

from high_finance.core.cache import get_or_compute, price_ttl


def _fetch_price_history_sync(
    ticker: str,
    period: str = "1y",
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    use_date_range = start is not None and end is not None

    if use_date_range:
        interval = "1d"
    elif period == "1d":
        interval = "15m"
    elif period == "5d":
        interval = "1h"
    else:
        interval = "1d"

    if use_date_range:
        hist = stock.history(start=start, end=end, interval=interval)
    else:
        hist = stock.history(period=period, interval=interval)

    if hist.empty:
        return []

    prices = []
    for date, row in hist.iterrows():
        open_val = row["Open"]
        high_val = row["High"]
        low_val = row["Low"]
        close_val = row["Close"]
        volume_val = row["Volume"]

        if any(math.isnan(v) or math.isinf(v) for v in [open_val, high_val, low_val, close_val]):
            continue

        prices.append({
            "date": date.strftime("%Y-%m-%d") if interval == "1d" else date.strftime("%Y-%m-%dT%H:%M:%S"),
            "timestamp": int(date.timestamp()),
            "open": round(float(open_val), 2),
            "high": round(float(high_val), 2),
            "low": round(float(low_val), 2),
            "close": round(float(close_val), 2),
            "volume": int(volume_val) if not math.isnan(volume_val) else 0,
        })

    return prices


async def get_price_history(
    ticker: str,
    period: str = "1y",
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch price history for a ticker.

    Args:
        ticker: Stock ticker symbol
        period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        start: Start date in YYYY-MM-DD format (overrides period if both start/end provided)
        end: End date in YYYY-MM-DD format (overrides period if both start/end provided)
    """
    cache_key = f"hf:prices:{ticker}:{period}:{start}:{end}"

    async def _compute():
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_price_history_sync, ticker, period, start, end),
            timeout=15,
        )

    return await get_or_compute(cache_key, price_ttl(), _compute)