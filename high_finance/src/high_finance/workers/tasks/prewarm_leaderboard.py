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

logger = logging.getLogger(__name__)

# Most-used parameter combos based on frontend defaults
PREWARM_COMBOS = [
    {"delay_days": 3, "hold_days": 30, "since_year": None},
    {"delay_days": 3, "hold_days": 30, "since_year": 2023},
    {"delay_days": 3, "hold_days": 30, "since_year": 2024},
]


def _cache_key(delay: int, hold: int, min_trades: int = 3,
               chamber: str = "", party: str = "", year=None) -> str:
    """Build the same cache key format as the API route."""
    return f"hf:backtest:leaderboard:{delay}:{hold}:{min_trades}:{chamber}:{party}:{year or ''}"


def _compute_and_cache_sync(combo: dict) -> dict:
    """Compute one leaderboard combo and write to Redis cache."""
    from high_finance.services.politician_backtest import backtest_all_politicians_sync
    from high_finance.core.cache import set_cached

    delay = combo["delay_days"]
    hold = combo["hold_days"]
    year = combo.get("since_year")

    key = _cache_key(delay, hold, year=year)
    logger.info("Pre-warming leaderboard: %s", key)

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

    # Write to cache with 1-hour TTL (matches the route's get_or_compute TTL)
    asyncio.get_event_loop().run_until_complete(set_cached(key, result, 3600))
    logger.info("Cached %s (%d entries)", key, len(entries))

    return {"key": key, "entries": len(entries)}


@tracked_job("prewarm_leaderboard")
def prewarm_leaderboard_job() -> dict:
    """RQ job: pre-warm leaderboard cache for common parameter combos."""
    results = []
    failed = []

    for combo in PREWARM_COMBOS:
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
        total=len(PREWARM_COMBOS),
        failed=failed,
        combos=results,
    )
