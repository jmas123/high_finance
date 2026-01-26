from redis import Redis
from rq import Worker, Queue, Connection
import os

# Set up Redis connection
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_conn = Redis.from_url(redis_url)

# Define the worker function
def main():
    with Connection(redis_conn):
        worker = Worker(map(Queue, ['default']))
        worker.work()

if __name__ == '__main__':
    main()