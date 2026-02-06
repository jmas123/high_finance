import yfinance as yf
import math
from typing import List, Dict, Any, Optional

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
    stock = yf.Ticker(ticker)

    # Determine interval based on period or date range
    use_date_range = start is not None and end is not None

    if use_date_range:
        # For date ranges, always use daily interval
        interval = "1d"
    elif period == "1d":
        interval = "15m"
    elif period == "5d":
        interval = "1h"
    else:
        interval = "1d"

    # Fetch history using either date range or period
    if use_date_range:
        hist = stock.history(start=start, end=end, interval=interval)
    else:
        hist = stock.history(period=period, interval=interval)
    
    if hist.empty:
        return []
    
    prices = []
    for date, row in hist.iterrows():
        # Skip rows with NaN or Infinity values
        open_val = row["Open"]
        high_val = row["High"]
        low_val = row["Low"]
        close_val = row["Close"]
        volume_val = row["Volume"]
        
        # Check for invalid values
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