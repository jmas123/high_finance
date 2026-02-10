"""
Job Scheduler
=============
Scheduler process for automated data fetching jobs using rq-scheduler.

Run this as a separate process:
    python -m high_finance.workers.scheduler

Schedule (all times in Eastern Time):
- Congressional trades: Every 4 hours
- Screener cache: 9:30 AM, every 15 min 10 AM-4 PM, 4 PM (weekdays, market days only)
- S&P 500 universe: Monday 6 AM
- Committee membership: 1st of month, 3 AM
- 13F holdings: 20th of Feb/May/Aug/Nov (quarterly SEC EDGAR)
- Price history: Daily 5 PM weekdays
- Cleanup old records: Sunday 2 AM
"""

import logging
import os
import sys

from redis import Redis
from rq_scheduler import Scheduler

from high_finance.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def create_scheduler() -> Scheduler:
    """Create and configure the scheduler."""
    redis_conn = Redis.from_url(settings.REDIS_URL)
    scheduler = Scheduler(connection=redis_conn, queue_name="default")
    return scheduler


def register_jobs(scheduler: Scheduler) -> None:
    """Register all scheduled jobs with the scheduler."""

    # Clear existing scheduled jobs to prevent duplicates on restart
    for job in scheduler.get_jobs():
        scheduler.cancel(job)

    # ==========================================================================
    # Congressional Trades - Every 4 hours
    # ==========================================================================
    scheduler.cron(
        "0 */4 * * *",  # Every 4 hours at :00
        func="high_finance.workers.tasks.refresh_congress_trades.refresh_congress_trades_job",
        id="congress_trades_scheduled",
        timeout=3600,  # 1 hour
        kwargs={"symbol": None, "limit": 500},
    )
    logger.info("Registered: congress_trades_scheduled (every 4 hours)")

    # ==========================================================================
    # Screener Cache - Market hours only (9:30 AM, every 15 min 10-4, 4 PM close)
    # Note: These use wrapper that checks is_trading_day() before running
    # ==========================================================================
    scheduler.cron(
        "30 9 * * 1-5",  # 9:30 AM weekdays (market open)
        func="high_finance.workers.tasks.refresh_screener_cache.refresh_screener_cache_market_job",
        id="screener_cache_open",
        timeout=1800,  # 30 minutes
    )
    logger.info("Registered: screener_cache_open (9:30 AM weekdays)")

    scheduler.cron(
        "*/15 10-15 * * 1-5",  # Every 15 min, 10 AM - 3:45 PM weekdays
        func="high_finance.workers.tasks.refresh_screener_cache.refresh_screener_cache_market_job",
        id="screener_cache_intraday",
        timeout=1800,
    )
    logger.info("Registered: screener_cache_intraday (every 15 min 10 AM-4 PM)")

    scheduler.cron(
        "0 16 * * 1-5",  # 4:00 PM weekdays (market close)
        func="high_finance.workers.tasks.refresh_screener_cache.refresh_screener_cache_market_job",
        id="screener_cache_close",
        timeout=1800,
    )
    logger.info("Registered: screener_cache_close (4:00 PM weekdays)")

    # ==========================================================================
    # S&P 500 Universe - Monday 6 AM
    # ==========================================================================
    scheduler.cron(
        "0 6 * * 1",  # Monday 6 AM
        func="high_finance.workers.tasks.refresh_screener_universe.refresh_screener_universe_job",
        id="sp500_universe_scheduled",
        timeout=1800,
    )
    logger.info("Registered: sp500_universe_scheduled (Monday 6 AM)")

    # ==========================================================================
    # Committee Membership - 1st of month, 3 AM
    # ==========================================================================
    scheduler.cron(
        "0 3 1 * *",  # 1st of every month at 3 AM
        func="high_finance.workers.tasks.refresh_comittees.refresh_committees_job",
        id="committee_membership_scheduled",
        timeout=3600,
    )
    logger.info("Registered: committee_membership_scheduled (1st of month 3 AM)")

    # ==========================================================================
    # 13F Holdings - Quarterly (20th of Feb/May/Aug/Nov)
    # SEC EDGAR 13F filings are due within 45 days of quarter end
    # ==========================================================================
    scheduler.cron(
        "0 0 20 2,5,8,11 *",  # 20th of Feb/May/Aug/Nov at midnight
        func="high_finance.workers.tasks.refresh_13f.refresh_13f_job",
        id="13f_holdings_scheduled",
        timeout=7200,  # 2 hours
    )
    logger.info("Registered: 13f_holdings_scheduled (quarterly)")

    # ==========================================================================
    # Price History - Daily 5 PM EST weekdays
    # ==========================================================================
    scheduler.cron(
        "0 17 * * 1-5",  # 5 PM weekdays
        func="high_finance.workers.tasks.refresh_prices.refresh_prices_job",
        id="price_history_scheduled",
        timeout=3600,
    )
    logger.info("Registered: price_history_scheduled (daily 5 PM weekdays)")

    # ==========================================================================
    # Leaderboard Prewarm - Daily 6 PM EST weekdays (1hr after refresh_prices)
    # ==========================================================================
    scheduler.cron(
        "0 18 * * 1-5",  # 6 PM weekdays
        func="high_finance.workers.tasks.prewarm_leaderboard.prewarm_leaderboard_job",
        id="prewarm_leaderboard_scheduled",
        timeout=7200,  # 2 hours (3 combos × ~90s each, with safety margin)
    )
    logger.info("Registered: prewarm_leaderboard_scheduled (daily 6 PM weekdays)")

    # ==========================================================================
    # Cleanup Old Records - Sunday 2 AM
    # ==========================================================================
    scheduler.cron(
        "0 2 * * 0",  # Sunday 2 AM
        func="high_finance.services.job_tracker.cleanup_old_executions_job",
        id="cleanup_scheduled",
        timeout=900,  # 15 minutes
        kwargs={"days": 90},
    )
    logger.info("Registered: cleanup_scheduled (Sunday 2 AM)")


def main() -> None:
    """Entry point for the scheduler process."""
    logger.info("Starting High Finance Job Scheduler")
    logger.info(f"Redis URL: {settings.REDIS_URL}")

    # Verify required config
    scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    if not scheduler_enabled:
        logger.warning("SCHEDULER_ENABLED is false, exiting")
        sys.exit(0)

    try:
        scheduler = create_scheduler()
        register_jobs(scheduler)

        logger.info("Scheduler initialized, entering run loop")
        logger.info("Press Ctrl+C to stop")

        # Run the scheduler (blocks)
        scheduler.run()

    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user")
    except Exception as e:
        logger.exception(f"Scheduler error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
