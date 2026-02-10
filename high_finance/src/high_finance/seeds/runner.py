"""
Seed Runner
===========
Central orchestrator for auto-populating a fresh database on deploy.

Two entry points:
  - run_fast_seeds()    → called from API lifespan hook (sync, ~12s)
  - enqueue_slow_seeds() → called from worker container startup (enqueues RQ jobs)

Idempotency:
  Redis flags (seed:v1:fast_complete, seed:v1:slow_enqueued) prevent re-running
  on subsequent deploys. 30-day TTL auto-expires so a fresh Redis triggers
  re-seeding. Bump version to v2 when adding new seed steps.
"""

import logging
import os
import time

from redis import Redis
from rq import Queue

from high_finance.core.config import settings
from high_finance.db.session import SessionLocal

logger = logging.getLogger(__name__)

SEED_VERSION = "v1"
FAST_COMPLETE_KEY = f"seed:{SEED_VERSION}:fast_complete"
SLOW_ENQUEUED_KEY = f"seed:{SEED_VERSION}:slow_enqueued"
FLAG_TTL = 30 * 24 * 3600  # 30 days
LOCK_TTL = 300  # 5 minutes (fast seeds should finish well within this)


def _get_redis() -> Redis:
    return Redis.from_url(settings.REDIS_URL)


def run_fast_seeds() -> dict:
    """
    Run fast seed operations synchronously (screener universe + private companies).
    Safe to call from multiple gunicorn workers — Redis SETNX ensures only one runs.

    Returns:
        {"status": "ok"|"skipped"|"error", ...}
    """
    try:
        redis = _get_redis()
    except Exception as e:
        logger.warning(f"Redis unavailable, skipping fast seeds: {e}")
        return {"status": "skipped", "reason": "redis_unavailable"}

    # Check if already done
    if redis.get(FAST_COMPLETE_KEY):
        logger.info("Fast seeds already complete (Redis flag set), skipping")
        return {"status": "skipped", "reason": "already_complete"}

    # SETNX lock — only one worker runs seeds
    lock_key = f"seed:{SEED_VERSION}:fast_lock"
    acquired = redis.set(lock_key, "1", nx=True, ex=LOCK_TTL)
    if not acquired:
        logger.info("Another worker is running fast seeds, skipping")
        return {"status": "skipped", "reason": "another_worker"}

    db = SessionLocal()
    results = {}
    try:
        # 1. Screener universe (~10s)
        logger.info("Seeding screener universe (S&P 500 from Wikipedia)...")
        from high_finance.workers.tasks.refresh_screener_universe import refresh_screener_universe_logic
        results["screener_universe"] = refresh_screener_universe_logic(db)
        logger.info(f"Screener universe: {results['screener_universe']}")

        # 2. Private companies (~2s)
        logger.info("Seeding private companies...")
        from high_finance.seeds.private_companies import seed_private_companies
        results["private_companies"] = seed_private_companies(db)
        logger.info(f"Private companies: {results['private_companies']}")

        # Mark as complete (30-day TTL)
        redis.set(FAST_COMPLETE_KEY, "1", ex=FLAG_TTL)
        logger.info("Fast seeds complete, Redis flag set")

        return {"status": "ok", **results}

    except Exception as e:
        db.rollback()
        logger.exception(f"Fast seeds failed: {e}")
        return {"status": "error", "message": str(e), **results}

    finally:
        db.close()
        # Release lock
        try:
            redis.delete(lock_key)
        except Exception:
            pass


def enqueue_slow_seeds() -> dict:
    """
    Enqueue slow seed jobs via RQ (congress trades, committees, prices, screener cache).
    Called from worker container startup.

    Returns:
        {"status": "ok"|"skipped"|"error", "jobs": {...}}
    """
    try:
        redis = _get_redis()
    except Exception as e:
        logger.warning(f"Redis unavailable, skipping slow seed enqueue: {e}")
        return {"status": "skipped", "reason": "redis_unavailable"}

    # Check if already enqueued
    if redis.get(SLOW_ENQUEUED_KEY):
        logger.info("Slow seeds already enqueued (Redis flag set), skipping")
        return {"status": "skipped", "reason": "already_enqueued"}

    # Wait for fast seeds to complete (max 60s)
    logger.info("Waiting for fast seeds to complete...")
    for _ in range(30):
        if redis.get(FAST_COMPLETE_KEY):
            logger.info("Fast seeds confirmed complete")
            break
        time.sleep(2)
    else:
        logger.warning("Timed out waiting for fast seeds (60s) — proceeding anyway")

    queue = Queue("default", connection=redis)
    jobs = {}

    try:
        # Congress trades backfill (requires QUIVER_API_KEY)
        quiver_key = os.getenv("QUIVER_API_KEY")
        if quiver_key:
            from high_finance.workers.tasks.backfill_congress_trades import backfill_congress_trades_job
            from high_finance.workers.tasks.refresh_comittees import refresh_committees_job
            from high_finance.workers.tasks.refresh_prices import refresh_prices_job

            congress_job = queue.enqueue(
                backfill_congress_trades_job,
                job_id="seed_backfill_congress_trades",
                job_timeout=7200,  # 2 hours
            )
            jobs["backfill_congress_trades"] = congress_job.id
            logger.info(f"Enqueued backfill_congress_trades: {congress_job.id}")

            committees_job = queue.enqueue(
                refresh_committees_job,
                job_id="seed_refresh_committees",
                job_timeout=3600,
                depends_on=congress_job,
            )
            jobs["committees"] = committees_job.id
            logger.info(f"Enqueued committees (depends_on congress): {committees_job.id}")

            prices_job = queue.enqueue(
                refresh_prices_job,
                job_id="seed_refresh_prices",
                job_timeout=3600,
                depends_on=congress_job,
            )
            jobs["prices"] = prices_job.id
            logger.info(f"Enqueued prices (depends_on congress): {prices_job.id}")
        else:
            logger.warning(
                "QUIVER_API_KEY not set — skipping congress trades, committees, and prices. "
                "Set QUIVER_API_KEY to enable congressional data ingestion."
            )

        # Screener cache (no RQ dependency, fast seeds already ran)
        from high_finance.workers.tasks.refresh_screener_cache import refresh_screener_cache_job

        cache_job = queue.enqueue(
            refresh_screener_cache_job,
            job_id="seed_refresh_screener_cache",
            job_timeout=1800,
        )
        jobs["screener_cache"] = cache_job.id
        logger.info(f"Enqueued screener_cache: {cache_job.id}")

        # Mark as enqueued (30-day TTL)
        redis.set(SLOW_ENQUEUED_KEY, "1", ex=FLAG_TTL)
        logger.info("Slow seeds enqueued, Redis flag set")

        return {"status": "ok", "jobs": jobs}

    except Exception as e:
        logger.exception(f"Failed to enqueue slow seeds: {e}")
        return {"status": "error", "message": str(e), "jobs": jobs}


def clear_seed_flags() -> dict:
    """
    Clear all seed Redis flags. Used by admin endpoint to force re-seeding.
    """
    redis = _get_redis()
    deleted = 0
    for key in [FAST_COMPLETE_KEY, SLOW_ENQUEUED_KEY]:
        deleted += redis.delete(key)
    return {"deleted_flags": deleted}
