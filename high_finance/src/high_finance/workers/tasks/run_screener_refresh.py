#!/usr/bin/env python
"""
Screener Refresh CLI
====================
Run screener refresh jobs directly or enqueue them to RQ.

Usage:
    # Refresh universe (S&P 500 list)
    python -m high_finance.workers.tasks.run_screener_refresh universe

    # Refresh cache (market data for all tickers)
    python -m high_finance.workers.tasks.run_screener_refresh cache

    # Refresh both
    python -m high_finance.workers.tasks.run_screener_refresh all

    # Enqueue to RQ worker instead of running directly
    python -m high_finance.workers.tasks.run_screener_refresh cache --enqueue
"""

import argparse
import os
import sys

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def run_universe():
    """Refresh screener universe with S&P 500 tickers."""
    from high_finance.workers.tasks.refresh_screener_universe import refresh_screener_universe_job

    print("Refreshing screener universe (S&P 500)...")
    result = refresh_screener_universe_job()
    print(f"Result: {result}")
    return result


def run_cache(batch_size: int = 50, delay: float = 2.0):
    """Refresh screener cache with live market data."""
    from high_finance.workers.tasks.refresh_screener_cache import refresh_screener_cache_job

    print(f"Refreshing screener cache (batch_size={batch_size}, delay={delay}s)...")
    result = refresh_screener_cache_job(batch_size=batch_size, delay=delay)
    print(f"Result: {result}")
    return result


def enqueue_universe():
    """Enqueue universe refresh job to RQ."""
    import redis
    from rq import Queue

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    conn = redis.from_url(redis_url)
    q = Queue(connection=conn)

    from high_finance.workers.tasks.refresh_screener_universe import refresh_screener_universe_job

    job = q.enqueue(refresh_screener_universe_job)
    print(f"Enqueued universe refresh job: {job.id}")
    return job


def enqueue_cache(batch_size: int = 50, delay: float = 2.0):
    """Enqueue cache refresh job to RQ."""
    import redis
    from rq import Queue

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    conn = redis.from_url(redis_url)
    q = Queue(connection=conn)

    from high_finance.workers.tasks.refresh_screener_cache import refresh_screener_cache_job

    job = q.enqueue(refresh_screener_cache_job, batch_size, delay)
    print(f"Enqueued cache refresh job: {job.id}")
    return job


def main():
    parser = argparse.ArgumentParser(description="Screener refresh CLI")
    parser.add_argument(
        "command",
        choices=["universe", "cache", "all"],
        help="What to refresh: universe (S&P 500 list), cache (market data), or all"
    )
    parser.add_argument(
        "--enqueue",
        action="store_true",
        help="Enqueue job to RQ instead of running directly"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Batch size for cache refresh (default: 50)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between batches in seconds (default: 2.0)"
    )

    args = parser.parse_args()

    if args.command == "universe":
        if args.enqueue:
            enqueue_universe()
        else:
            run_universe()

    elif args.command == "cache":
        if args.enqueue:
            enqueue_cache(args.batch_size, args.delay)
        else:
            run_cache(args.batch_size, args.delay)

    elif args.command == "all":
        if args.enqueue:
            enqueue_universe()
            enqueue_cache(args.batch_size, args.delay)
        else:
            run_universe()
            run_cache(args.batch_size, args.delay)


if __name__ == "__main__":
    main()
