import logging
import os

from redis import Redis
from rq import Worker, Queue, Connection, Retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Set up Redis connection
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_conn = Redis.from_url(redis_url)

# Default retry policy: 3 attempts with escalating backoff (60s, 120s, 300s)
DEFAULT_RETRY = Retry(max=3, interval=[60, 120, 300])


def main():
    logger.info("Starting RQ worker (queue=default, retry=3 attempts)")
    with Connection(redis_conn):
        worker = Worker(
            queues=map(Queue, ['default']),
            default_worker_ttl=420,  # Worker heartbeat TTL
        )
        worker.work()

if __name__ == '__main__':
    main()
