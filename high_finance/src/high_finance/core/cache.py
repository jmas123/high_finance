"""
Redis Caching Layer
===================
Async Redis client for response caching (separate from RQ's sync client).
Features:
- orjson for fast serialization
- Distributed SETNX lock to prevent cache stampedes
- Redis failure fallback (graceful degradation)
- Market-hours-aware TTL for price data
- Cache invalidation helper
"""

import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional

import math

import orjson
import redis.asyncio as aioredis

from high_finance.core.config import settings
from high_finance.utils.market_hours import is_market_hours

logger = logging.getLogger(__name__)

# ── Async Redis client (lazy-initialized) ──────────────────────────────────
_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get or create the async Redis client."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=False,  # We handle bytes via orjson
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _redis


async def close_redis() -> None:
    """Close the async Redis connection (call on shutdown)."""
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None


# ── Core cache operations ──────────────────────────────────────────────────


async def get_cached(key: str) -> Optional[Any]:
    """Get a value from cache. Returns None on miss or Redis error."""
    try:
        r = await get_redis()
        raw = await r.get(key)
        if raw is None:
            return None
        return orjson.loads(raw)
    except Exception:
        logger.warning("Redis read failed for key=%s, skipping cache", key)
        return None


def _sanitize_for_json(obj: Any) -> Any:
    """Recursively convert numpy/pandas types to native Python for orjson."""
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    # numpy / pandas scalar types — check BEFORE falling through
    try:
        # numpy numeric types (float64, int64, bool_, etc.)
        import numpy as np
        if isinstance(obj, (np.floating, np.complexfloating)):
            v = float(obj)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return [_sanitize_for_json(v) for v in obj.tolist()]
    except (ImportError, TypeError):
        pass
    # pandas types
    try:
        import pandas as pd
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat() if not pd.isna(obj) else None
        if pd.isna(obj):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    # Fallback: try converting to native type, then str
    try:
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    except (TypeError, ValueError):
        pass
    try:
        return str(obj)
    except Exception:
        return None


async def set_cached(key: str, value: Any, ttl: int) -> None:
    """Set a value in cache with TTL. Silently fails on Redis error."""
    try:
        r = await get_redis()
        clean = _sanitize_for_json(value)
        raw = orjson.dumps(clean, option=orjson.OPT_SERIALIZE_NUMPY | orjson.OPT_NON_STR_KEYS)
        await r.set(key, raw, ex=ttl)
    except Exception as exc:
        logger.warning("Redis write failed for key=%s: %s", key, exc)


async def get_or_compute(
    key: str,
    ttl: int,
    compute_fn: Callable[[], Awaitable[Any]],
) -> Any:
    """
    Cache-aside with distributed SETNX lock to prevent stampedes.

    1. Check cache → return if hit.
    2. Try to acquire a distributed lock (SETNX).
    3. If acquired: compute, cache, release lock.
    4. If not acquired: poll cache until result appears or timeout.
    5. On any Redis error: fall through to compute directly.
    """
    # 1. Cache hit
    cached = await get_cached(key)
    if cached is not None:
        return cached

    # 2. Try distributed lock
    lock_key = f"lock:{key}"
    try:
        r = await get_redis()
        acquired = await r.set(lock_key, b"1", nx=True, ex=30)
    except Exception:
        # Redis down — compute directly
        return await compute_fn()

    if not acquired:
        # 4. Another worker is computing — poll for result (15s max)
        for _ in range(30):
            await asyncio.sleep(0.5)
            cached = await get_cached(key)
            if cached is not None:
                return cached
        # Timeout — compute anyway as stale protection
        return await compute_fn()

    # 3. We hold the lock — compute and cache
    try:
        result = await compute_fn()
        await set_cached(key, result, ttl)
        return result
    finally:
        try:
            r = await get_redis()
            await r.delete(lock_key)
        except Exception:
            pass  # Lock will expire via TTL


# ── TTL helpers ────────────────────────────────────────────────────────────


def price_ttl() -> int:
    """5 min during market hours, 1 hr when closed."""
    return 300 if is_market_hours() else 3600


def fundamentals_ttl() -> int:
    """15 min."""
    return 900


def risk_ttl() -> int:
    """10 min."""
    return 600


def valuation_ttl() -> int:
    """10 min."""
    return 600


def macro_ttl() -> int:
    """5 min."""
    return 300


def news_ttl() -> int:
    """1 hr."""
    return 3600


def options_ttl() -> int:
    """5 min during market hours, 1 hr when closed."""
    return 300 if is_market_hours() else 3600


def trades_ttl() -> int:
    """1 hr."""
    return 3600


# ── Cache invalidation ────────────────────────────────────────────────────


async def invalidate_cache(prefix: str, ticker: str) -> None:
    """Delete all cache keys matching hf:{prefix}:{ticker}*."""
    try:
        r = await get_redis()
        pattern = f"hf:{prefix}:{ticker}*"
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        logger.warning("Cache invalidation failed for %s:%s", prefix, ticker)
