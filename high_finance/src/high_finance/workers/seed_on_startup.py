"""
Seed on Startup
===============
Entry point for worker container seeding.
Run as: python -m high_finance.workers.seed_on_startup

Enqueues slow seed jobs (congress trades backfill, committees, prices, screener cache)
after confirming fast seeds have completed.

Wrapped in try/except so the worker always starts, even if seeding fails.
"""

import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    try:
        from high_finance.seeds.runner import enqueue_slow_seeds

        logger.info("Checking if slow seed jobs need to be enqueued...")
        result = enqueue_slow_seeds()
        logger.info(f"Slow seed result: {result}")

    except Exception:
        logger.exception("Slow seed enqueue failed — worker will start without seed jobs")


if __name__ == "__main__":
    main()
