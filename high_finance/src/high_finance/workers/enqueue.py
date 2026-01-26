import os
from redis import Redis
from rq import Queue

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_conn = Redis.from_url(redis_url)

q = Queue("default", connection=redis_conn)

job = q.enqueue(
    "high_finance.workers.tasks.refresh_congress_trades.refresh_congress_trades_job",
    symbol=None,      # or "AAPL"
    limit=200
)

print("Enqueued job:", job.id)
