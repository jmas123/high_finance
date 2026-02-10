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

import yfinance as yf

from high_finance.core.cache import get_or_compute, fundamentals_ttl

logger = logging.getLogger(__name__)


def _fetch_yf_info_sync(ticker: str, max_retries: int = 2) -> dict:
    """Blocking yfinance call — runs in thread pool. Returns raw info dict.

    Retries on transient Yahoo 401 errors with a short back-off.
    """
    for attempt in range(max_retries + 1):
        try:
            stock = yf.Ticker(ticker)
            return stock.info or {}
        except Exception as exc:
            if attempt < max_retries:
                wait = 1.5 * (attempt + 1)
                logger.warning(
                    "yfinance error for %s (attempt %d/%d): %s — retrying in %.1fs",
                    ticker, attempt + 1, max_retries + 1, exc, wait,
                )
                time.sleep(wait)
                continue
            raise


async def get_yf_info(ticker: str) -> dict:
    """
    Get yfinance .info dict for a ticker, cached in Redis.

    TTL = fundamentals_ttl() (15 min). The SETNX lock in get_or_compute()
    ensures only one worker fetches from Yahoo at a time; others wait and
    get the cached result.
    """
    cache_key = f"hf:yf_info:{ticker}"

    async def _compute():
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_yf_info_sync, ticker),
            timeout=15,
        )

    return await get_or_compute(cache_key, fundamentals_ttl(), _compute)
