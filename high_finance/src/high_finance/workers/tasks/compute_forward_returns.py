"""
Compute Forward Returns Job
============================
RQ job that syncs events from source tables and computes forward returns.

Schedule: Daily at 5:30 PM weekdays (after refresh_prices at 5 PM).
First run backfills all ~50K politician trades; subsequent runs process new/incomplete only.
"""

import logging

from high_finance.workers.tasks.base import (
    create_job_result,
    db_session,
    tracked_job,
)

logger = logging.getLogger(__name__)


@tracked_job("forward_returns")
def compute_forward_returns_job(event_date_type: str = "disclosure_date") -> dict:
    """Sync events and compute forward returns."""
    import asyncio
    from high_finance.services.forward_returns import ForwardReturnsEngine

    with db_session() as db:
        engine = ForwardReturnsEngine(db)
        result = engine.run(event_date_type=event_date_type)

    # Invalidate cached summary/stats so new data is reflected
    try:
        from high_finance.core.cache import invalidate_cache

        async def _invalidate():
            await invalidate_cache("events:summary", "")
            await invalidate_cache("events:stats", "")
            await invalidate_cache("events:fwd", "")

        asyncio.run(_invalidate())
        logger.info("Invalidated events cache after forward returns compute")
    except Exception:
        logger.warning("Failed to invalidate events cache", exc_info=True)

    sync = result.get("sync", {})
    compute = result.get("compute", {})

    return create_job_result(
        status="ok",
        total=compute.get("events_scanned", 0),
        updated=compute.get("returns_upserted", 0),
        skipped=compute.get("events_skipped_no_company", 0)
        + compute.get("events_skipped_no_prices", 0),
        events_synced=sync.get("synced", 0),
        events_processed=compute.get("events_processed", 0),
    )
