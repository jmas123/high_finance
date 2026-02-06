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

import yfinance as yf

from high_finance.core.cache import get_or_compute, fundamentals_ttl


def _fetch_yf_info_sync(ticker: str) -> dict:
    """Blocking yfinance call — runs in thread pool. Returns raw info dict."""
    stock = yf.Ticker(ticker)
    return stock.info or {}


async def get_yf_info(ticker: str) -> dict:
    """
    Get yfinance .info dict for a ticker, cached in Redis.

    TTL = fundamentals_ttl() (15 min). The SETNX lock in get_or_compute()
    ensures only one worker fetches from Yahoo at a time; others wait and
    get the cached result.
    """
    cache_key = f"hf:yf_info:{ticker}"

    async def _compute():
        return await asyncio.to_thread(_fetch_yf_info_sync, ticker)

    return await get_or_compute(cache_key, fundamentals_ttl(), _compute)
