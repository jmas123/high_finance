import yfinance as yf
import math
from typing import List, Dict, Any

async def get_price_history(ticker: str, period: str = "1y") -> List[Dict[str, Any]]:
    """
    Fetch price history for a ticker.
    
    Periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    """
    stock = yf.Ticker(ticker)
    
    # Use smaller intervals for short periods
    if period == "1d":
        interval = "15m"
    elif period == "5d":
        interval = "1h"
    else:
        interval = "1d"
    
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