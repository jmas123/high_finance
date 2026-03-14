"""
Shared yfinance Info Cache
==========================
7+ services independently call yf.Ticker(ticker).info (1-3s each).
This module caches the info dict in Redis so the first caller pays the
network cost and all others get it in <50ms via the SETNX distributed
lock in get_or_compute().

Usage:
    from high_finance.services.yf_cache import get_yf_info
    info = await get_yf_info("AAPL")  # dict
"""

import asyncio
import logging
import time
from typing import Optional

import yfinance as yf

from high_finance.core.cache import get_or_compute, fundamentals_ttl

logger = logging.getLogger(__name__)


def _fetch_yf_info_sync(ticker: str, max_retries: int = 2) -> Optional[dict]:
    """Blocking yfinance call — runs in thread pool. Returns raw info dict.

    Retries on transient Yahoo 401 errors with a short back-off.
    On persistent failure, returns None so the result is NOT cached
    (get_or_compute skips caching falsy values).
    """
    for attempt in range(max_retries + 1):
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            # yfinance returns {} or None on some failures — treat as miss
            if not info:
                logger.warning("yfinance returned empty info for %s (attempt %d)", ticker, attempt + 1)
                if attempt < max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                return None
            # Reject partial responses missing price data — Yahoo rate-limiting
            # returns a truthy dict without price fields. Returning None here
            # prevents get_or_compute() from caching the bad data.
            has_price = info.get("currentPrice") or info.get("regularMarketPrice")
            if not has_price:
                logger.warning(
                    "yfinance returned info without price for %s (attempt %d, keys: %s)",
                    ticker, attempt + 1, list(info.keys())[:10],
                )
                if attempt < max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                return None
            return info
        except Exception as exc:
            if attempt < max_retries:
                wait = 1.5 * (attempt + 1)
                logger.warning(
                    "yfinance error for %s (attempt %d/%d): %s — retrying in %.1fs",
                    ticker, attempt + 1, max_retries + 1, exc, wait,
                )
                time.sleep(wait)
                continue
            logger.error(
                "yfinance permanently failed for %s after %d attempts: %s",
                ticker, max_retries + 1, exc,
            )
            return None


async def get_yf_info(ticker: str) -> Optional[dict]:
    """
    Get yfinance .info dict for a ticker, cached in Redis.

    TTL = fundamentals_ttl() (15 min). The SETNX lock in get_or_compute()
    ensures only one worker fetches from Yahoo at a time; others wait and
    get the cached result.

    Returns None on failure — callers should handle None gracefully.
    None is NOT cached, so the next request retries immediately.
    """
    cache_key = f"hf:yf_info:{ticker}"

    async def _compute():
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_fetch_yf_info_sync, ticker),
                timeout=15,
            )
        except asyncio.TimeoutError:
            logger.error("yfinance timed out for %s", ticker)
            return None
        except Exception as exc:
            logger.error("yfinance failed for %s: %s", ticker, exc)
            return None

    try:
        return await get_or_compute(cache_key, fundamentals_ttl(), _compute)
    except Exception as exc:
        logger.error("get_or_compute failed for yf_info:%s: %s", ticker, exc)
        return None
