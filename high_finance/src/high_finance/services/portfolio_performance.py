"""
Portfolio Performance Service
============================
Calculate portfolio returns vs benchmarks across multiple time periods.
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import yfinance as yf
import numpy as np

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)

# Cache configuration
CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_PREFIX = "portfolio_benchmark:"


def _get_redis_client() -> Optional["redis.Redis"]:
    """Get Redis client if available."""
    if not REDIS_AVAILABLE:
        return None
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = redis.from_url(redis_url)
        client.ping()  # Test connection
        return client
    except Exception as e:
        logger.warning(f"Redis not available for caching: {e}")
        return None


def _get_cached_ticker_data(ticker: str, redis_client: Optional["redis.Redis"]) -> Optional[Dict[str, Any]]:
    """Get ticker data from cache if available."""
    if not redis_client:
        return None
    try:
        cache_key = f"{CACHE_PREFIX}{ticker}"
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.debug(f"Cache read error for {ticker}: {e}")
    return None


def _set_cached_ticker_data(ticker: str, data: Dict[str, Any], redis_client: Optional["redis.Redis"]) -> None:
    """Store ticker data in cache."""
    if not redis_client:
        return
    try:
        cache_key = f"{CACHE_PREFIX}{ticker}"
        # Store a simplified version without the full price list to save space
        cache_data = {
            "current": data.get("current"),
            "history": data.get("history"),
            "dates": data.get("dates"),
            "prices": data.get("prices"),
        }
        redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(cache_data))
    except Exception as e:
        logger.debug(f"Cache write error for {ticker}: {e}")

# Default benchmarks with human-readable names
BENCHMARK_NAMES = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq 100",
    "IWM": "Russell 2000",
    "GLD": "Gold",
    "SLV": "Silver",
    "BTC-USD": "Bitcoin",
    "^VIX": "VIX",
    "TLT": "20+ Year Treasury",
    "DIA": "Dow Jones",
    "EFA": "Intl Developed",
    "EEM": "Emerging Markets",
}

PERIODS = ["1d", "1w", "1mo", "3mo", "ytd", "1y"]


def get_period_start(period: str) -> datetime:
    """Get the start date for a given period."""
    now = datetime.now()
    if period == "1d":
        return now - timedelta(days=1)
    elif period == "1w":
        return now - timedelta(weeks=1)
    elif period == "1mo":
        return now - timedelta(days=30)
    elif period == "3mo":
        return now - timedelta(days=90)
    elif period == "ytd":
        return datetime(now.year, 1, 1)
    elif period == "1y":
        return now - timedelta(days=365)
    else:
        return now - timedelta(days=30)


def calculate_return(start_price: float, end_price: float) -> Optional[float]:
    """Calculate percentage return between two prices."""
    if start_price is None or end_price is None:
        return None
    if start_price <= 0:
        return None
    return ((end_price - start_price) / start_price) * 100


MAX_SPARKLINE_POINTS = 20


def normalize_sparkline(prices: List[float], max_points: int = MAX_SPARKLINE_POINTS) -> List[float]:
    """
    Normalize price series to start at 100 and downsample to max_points.

    This reduces response payload size while maintaining visual fidelity.
    """
    if not prices or len(prices) == 0:
        return []
    # Filter out None/NaN values
    valid_prices = [p for p in prices if p is not None and not np.isnan(p)]
    if not valid_prices or valid_prices[0] <= 0:
        return []

    # Downsample if needed
    if len(valid_prices) > max_points:
        step = len(valid_prices) / max_points
        downsampled = [valid_prices[int(i * step)] for i in range(max_points)]
        # Always include the last point for accuracy
        downsampled[-1] = valid_prices[-1]
        valid_prices = downsampled

    base = valid_prices[0]
    return [round((p / base) * 100, 2) for p in valid_prices]


async def get_ticker_price_history(
    ticker: str,
    days: int = 365,
    redis_client: Optional["redis.Redis"] = None
) -> Dict[str, Any]:
    """
    Fetch price history for a ticker.
    Returns dict with 'prices' (list) and 'current' (float).
    Uses Redis cache if available to avoid yfinance rate limiting.
    """
    # Check cache first
    cached = _get_cached_ticker_data(ticker, redis_client)
    if cached and cached.get("current") is not None:
        logger.debug(f"Cache hit for {ticker}")
        return cached

    try:
        yf_ticker = yf.Ticker(ticker)
        # Fetch enough history for all periods
        hist = yf_ticker.history(period=f"{days}d")

        if hist.empty:
            logger.warning(f"No price history for {ticker}")
            return {"prices": [], "current": None, "history": {}}

        # Get closing prices
        closes = hist["Close"].tolist()
        dates = hist.index.tolist()

        # Build date->price mapping
        history = {}
        for i, date in enumerate(dates):
            date_str = date.strftime("%Y-%m-%d")
            history[date_str] = closes[i]

        current = closes[-1] if closes else None

        result = {
            "prices": closes,
            "current": current,
            "history": history,
            "dates": [d.strftime("%Y-%m-%d") for d in dates],
        }

        # Cache the result
        _set_cached_ticker_data(ticker, result, redis_client)

        return result
    except Exception as e:
        logger.error(f"Error fetching price history for {ticker}: {e}")
        return {"prices": [], "current": None, "history": {}}


def calculate_daily_returns(prices: List[float]) -> List[float]:
    """Calculate daily percentage returns from price series."""
    if len(prices) < 2:
        return []
    returns = []
    for i in range(1, len(prices)):
        if prices[i - 1] > 0:
            ret = (prices[i] - prices[i - 1]) / prices[i - 1]
            returns.append(ret)
    return returns


def calculate_beta(
    portfolio_returns: List[float],
    benchmark_returns: List[float]
) -> Optional[float]:
    """
    Calculate portfolio beta vs benchmark.

    Beta = Cov(portfolio, benchmark) / Var(benchmark)
    """
    if len(portfolio_returns) < 10 or len(benchmark_returns) < 10:
        return None

    # Align lengths (use minimum)
    min_len = min(len(portfolio_returns), len(benchmark_returns))
    p_ret = portfolio_returns[-min_len:]
    b_ret = benchmark_returns[-min_len:]

    try:
        cov_matrix = np.cov(p_ret, b_ret)
        if cov_matrix.shape != (2, 2):
            return None
        cov = cov_matrix[0, 1]
        var = cov_matrix[1, 1]
        if var <= 0:
            return None
        return round(cov / var, 2)
    except Exception:
        return None


def calculate_sharpe(
    returns: List[float],
    risk_free_rate: float = 0.04
) -> Optional[float]:
    """
    Calculate Sharpe ratio.

    Sharpe = (mean excess return) / std dev, annualized
    Assumes daily returns and 252 trading days.
    """
    if len(returns) < 10:
        return None

    try:
        daily_rfr = risk_free_rate / 252
        excess_returns = [r - daily_rfr for r in returns]
        mean_excess = np.mean(excess_returns)
        std = np.std(excess_returns, ddof=1)

        if std <= 0:
            return None

        # Annualize
        sharpe = (mean_excess / std) * np.sqrt(252)
        return round(sharpe, 2)
    except Exception:
        return None


def get_price_at_date(history: Dict[str, float], target_date: datetime) -> Optional[float]:
    """Get the price closest to but not after the target date."""
    target_str = target_date.strftime("%Y-%m-%d")

    # Try exact match first
    if target_str in history:
        return history[target_str]

    # Find closest date before target
    sorted_dates = sorted(history.keys())
    closest_date = None
    for date_str in sorted_dates:
        if date_str <= target_str:
            closest_date = date_str
        else:
            break

    if closest_date:
        return history[closest_date]

    # If no date before, use first available
    if sorted_dates:
        return history[sorted_dates[0]]

    return None


async def get_benchmark_returns(
    benchmarks: List[str],
    periods: List[str] = PERIODS,
    redis_client: Optional["redis.Redis"] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Get returns for each benchmark across all periods.

    Returns:
        {
            "SPY": {
                "name": "S&P 500",
                "returns": {"1d": 0.5, "1w": 1.2, ...},
                "sparkline": [100, 101.2, 99.8, ...]
            },
            ...
        }
    """
    results = {}

    for ticker in benchmarks:
        try:
            data = await get_ticker_price_history(ticker, days=400, redis_client=redis_client)

            if not data["history"] or data["current"] is None:
                logger.warning(f"Skipping benchmark {ticker} - no data")
                continue

            # Calculate returns for each period
            returns = {}
            for period in periods:
                start_date = get_period_start(period)
                start_price = get_price_at_date(data["history"], start_date)
                end_price = data["current"]
                returns[period] = calculate_return(start_price, end_price)

            # Get last 30 days for sparkline
            sparkline_prices = data["prices"][-30:] if len(data["prices"]) >= 30 else data["prices"]
            sparkline = normalize_sparkline(sparkline_prices)

            # Calculate daily returns for risk metrics
            daily_returns = calculate_daily_returns(data["prices"])

            results[ticker] = {
                "name": BENCHMARK_NAMES.get(ticker, ticker),
                "returns": returns,
                "sparkline": sparkline,
                "daily_returns": daily_returns,
            }

        except Exception as e:
            logger.error(f"Error processing benchmark {ticker}: {e}")
            continue

    return results


async def calculate_portfolio_returns(
    positions: List[Dict[str, Any]],
    periods: List[str] = PERIODS,
    redis_client: Optional["redis.Redis"] = None,
) -> Dict[str, Any]:
    """
    Calculate portfolio returns for each period.

    Args:
        positions: List of {"ticker": str, "shares": float, "avg_cost": float}
        periods: List of period strings
        redis_client: Optional Redis client for caching

    Returns:
        {
            "returns": {"1d": 0.8, "1w": 2.1, ...},
            "sparkline": [100, 101.5, ...]
        }
    """
    if not positions:
        return {"returns": {p: None for p in periods}, "sparkline": []}

    # Fetch price history for all tickers
    ticker_data = {}
    for pos in positions:
        ticker = pos["ticker"]
        data = await get_ticker_price_history(ticker, days=400, redis_client=redis_client)
        if data["current"] is not None:
            ticker_data[ticker] = data

    if not ticker_data:
        return {"returns": {p: None for p in periods}, "sparkline": []}

    # Calculate current weights
    total_value = 0
    position_values = {}
    for pos in positions:
        ticker = pos["ticker"]
        if ticker in ticker_data and ticker_data[ticker]["current"] is not None:
            current_price = ticker_data[ticker]["current"]
            value = pos["shares"] * current_price
            position_values[ticker] = value
            total_value += value

    if total_value <= 0:
        return {"returns": {p: None for p in periods}, "sparkline": []}

    weights = {ticker: value / total_value for ticker, value in position_values.items()}

    # Calculate weighted returns for each period
    returns = {}
    for period in periods:
        start_date = get_period_start(period)
        weighted_return = 0.0
        valid_positions = 0

        for pos in positions:
            ticker = pos["ticker"]
            if ticker not in ticker_data:
                continue

            data = ticker_data[ticker]
            start_price = get_price_at_date(data["history"], start_date)
            end_price = data["current"]

            stock_return = calculate_return(start_price, end_price)
            if stock_return is not None and ticker in weights:
                weighted_return += weights[ticker] * stock_return
                valid_positions += 1

        returns[period] = round(weighted_return, 2) if valid_positions > 0 else None

    # Calculate portfolio sparkline (last 30 days)
    # Build daily portfolio values
    all_dates = set()
    for data in ticker_data.values():
        all_dates.update(data["dates"][-30:])

    sorted_dates = sorted(all_dates)[-30:]

    portfolio_values = []
    for date_str in sorted_dates:
        day_value = 0
        valid = True
        for pos in positions:
            ticker = pos["ticker"]
            if ticker not in ticker_data:
                continue
            price = ticker_data[ticker]["history"].get(date_str)
            if price is None:
                # Try to find closest price
                price = get_price_at_date(
                    ticker_data[ticker]["history"],
                    datetime.strptime(date_str, "%Y-%m-%d")
                )
            if price is not None:
                day_value += pos["shares"] * price
        if day_value > 0:
            portfolio_values.append(day_value)

    sparkline = normalize_sparkline(portfolio_values)

    # Calculate daily returns for risk metrics
    daily_returns = calculate_daily_returns(portfolio_values)

    return {
        "returns": returns,
        "sparkline": sparkline,
        "daily_returns": daily_returns,
    }


async def get_portfolio_performance(
    positions: List[Dict[str, Any]],
    benchmarks: List[str],
) -> Dict[str, Any]:
    """
    Main function to get portfolio performance comparison.

    Args:
        positions: List of {"ticker": str, "shares": float, "avg_cost": float}
        benchmarks: List of benchmark tickers

    Returns:
        {
            "portfolio": {"returns": {...}, "sparkline": [...]},
            "benchmarks": {"SPY": {"name": "S&P 500", "returns": {...}, "sparkline": [...]}, ...},
            "periods": ["1d", "1w", "1mo", "3mo", "ytd", "1y"],
            "outperformance": {"vs_SPY": 5.2, ...}  # YTD outperformance
        }
    """
    # Get Redis client for caching (optional - degrades gracefully)
    redis_client = _get_redis_client()

    # Calculate portfolio returns
    portfolio = await calculate_portfolio_returns(positions, redis_client=redis_client)

    # Get benchmark returns
    benchmark_data = await get_benchmark_returns(benchmarks, redis_client=redis_client)

    # Calculate outperformance vs each benchmark (YTD)
    outperformance = {}
    portfolio_ytd = portfolio["returns"].get("ytd")
    if portfolio_ytd is not None:
        for ticker, data in benchmark_data.items():
            benchmark_ytd = data["returns"].get("ytd")
            if benchmark_ytd is not None:
                outperformance[f"vs_{ticker}"] = round(portfolio_ytd - benchmark_ytd, 2)

    # Calculate risk metrics (Beta vs SPY, Sharpe ratio)
    risk_metrics: Dict[str, Optional[float]] = {
        "beta": None,
        "sharpe": None,
    }

    portfolio_daily_returns = portfolio.get("daily_returns", [])

    # Calculate Sharpe ratio for portfolio
    if portfolio_daily_returns:
        risk_metrics["sharpe"] = calculate_sharpe(portfolio_daily_returns)

    # Calculate Beta vs SPY (if SPY is in benchmarks or we can use it)
    spy_data = benchmark_data.get("SPY")
    if spy_data and portfolio_daily_returns:
        spy_daily_returns = spy_data.get("daily_returns", [])
        if spy_daily_returns:
            risk_metrics["beta"] = calculate_beta(portfolio_daily_returns, spy_daily_returns)

    # Remove daily_returns from response to keep payload small
    portfolio_response = {
        "returns": portfolio["returns"],
        "sparkline": portfolio["sparkline"],
    }

    # Remove daily_returns from benchmark responses
    benchmarks_response = {}
    for ticker, data in benchmark_data.items():
        benchmarks_response[ticker] = {
            "name": data["name"],
            "returns": data["returns"],
            "sparkline": data["sparkline"],
        }

    return {
        "portfolio": portfolio_response,
        "benchmarks": benchmarks_response,
        "periods": PERIODS,
        "outperformance": outperformance,
        "risk_metrics": risk_metrics,
    }
