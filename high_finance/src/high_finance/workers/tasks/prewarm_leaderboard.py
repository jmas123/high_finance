"""
Pre-warm Leaderboard Cache
===========================
Computes and caches the leaderboard for the most common parameter combos
so users never hit a cold cache (which takes 60-90s on prod).

Designed to run after refresh_prices in the seed sequence, or manually
via the admin API.
"""

import asyncio
import logging
from datetime import datetime, timezone

from high_finance.workers.tasks.base import db_session, create_job_result, tracked_job
from redis import Redis


logger = logging.getLogger(__name__)


def _build_prewarm_combos() -> list[dict]:
    """Build prewarm combos dynamically so year filters stay current."""
    current_year = datetime.now(timezone.utc).year
    return [
        # Default: all-time, 30-day hold
        {"delay_days": 3, "hold_days": 30, "since_year": None},
        # Current year and previous two years
        {"delay_days": 3, "hold_days": 30, "since_year": current_year},
        {"delay_days": 3, "hold_days": 30, "since_year": current_year - 1},
        {"delay_days": 3, "hold_days": 30, "since_year": current_year - 2},
        # 60-day hold is the second most common alternative
        {"delay_days": 3, "hold_days": 60, "since_year": None},
        {"delay_days": 3, "hold_days": 60, "since_year": current_year},
    ]


def _cache_key(delay: int, hold: int, min_trades: int = 3, year=None) -> str:
    """Build the same cache key format as the API route.

    Note: chamber/party are no longer in the cache key — filtering is client-side.
    """
    return f"hf:backtest:leaderboard:{delay}:{hold}:{min_trades}:{year or ''}"


def _compute_and_cache_sync(combo: dict) -> dict:
    from high_finance.services.politician_backtest import backtest_all_politicians_sync
    from high_finance.core.config import settings
    import orjson
    from redis import Redis

    delay = combo["delay_days"]
    hold = combo["hold_days"]
    year = combo.get("since_year")
    key = _cache_key(delay, hold, year=year)

    with db_session() as db:
        entries = backtest_all_politicians_sync(
            db, delay, hold, min_trades=3,
            chamber=None, party=None, since_year=year,
        )

    result = {
        "delay_days": delay,
        "hold_days": hold,
        "entries": entries,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }

    # Sync Redis write — no asyncio needed in RQ worker
    r = Redis.from_url(settings.REDIS_URL)
    raw = orjson.dumps(result)
    r.set(key, raw, ex=3600)
    logger.info("Cached %s (%d entries)", key, len(entries))
    return {"key": key, "entries": len(entries)}

def _clear_stale_leaderboard_cache() -> int:
    """Delete all leaderboard cache keys so prewarm writes fresh data.

    Pattern: hf:backtest:leaderboard:* — matches leaderboard keys only,
    NOT individual politician backtest keys (hf:backtest:{int}:...).
    """
    from redis import Redis
    from high_finance.core.config import settings

    r = Redis.from_url(settings.REDIS_URL)
    pattern = "hf:backtest:leaderboard:*"
    deleted = 0
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor, match=pattern, count=100)
        if keys:
            deleted += r.delete(*keys)
        if cursor == 0:
            break
    # Also delete any lingering locks for leaderboard keys
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor, match="lock:hf:backtest:leaderboard:*", count=100)
        if keys:
            deleted += r.delete(*keys)
        if cursor == 0:
            break
    logger.info("Cleared %d stale leaderboard cache keys", deleted)
    return deleted


@tracked_job("prewarm_leaderboard")
def prewarm_leaderboard_job() -> dict:
    """RQ job: pre-warm leaderboard cache for common parameter combos."""
    # Clear stale cache first — ensures prewarm writes fresh data
    # (important after data corrections like trade→company linking)
    _clear_stale_leaderboard_cache()

    combos = _build_prewarm_combos()
    results = []
    failed = []

    for combo in combos:
        label = f"delay={combo['delay_days']},hold={combo['hold_days']},year={combo.get('since_year', 'all')}"
        try:
            info = _compute_and_cache_sync(combo)
            results.append(info)
        except Exception as e:
            logger.exception("Failed to prewarm combo %s: %s", label, e)
            failed.append(label)

    return create_job_result(
        status="ok" if not failed else "error",
        updated=len(results),
        total=len(combos),
        failed=failed,
        combos=results,
    )
