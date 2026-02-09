#!/bin/bash
# Combined RQ Worker + Scheduler entrypoint for Railway
# Runs both processes in a single container to save costs.
#
# - Worker: processes jobs from the Redis queue
# - Scheduler: enqueues jobs on cron schedules (congress trades, screener, prices, etc.)

set -e

echo "Starting RQ Worker + Scheduler..."
echo "Redis URL: ${REDIS_URL:-(not set)}"
echo "Timezone: $(date +%Z)"

# Start the scheduler in the background
echo "Starting scheduler..."
python -m high_finance.workers.scheduler &
SCHEDULER_PID=$!

# Start the RQ worker in the foreground
echo "Starting RQ worker..."
rq worker default --url "$REDIS_URL" &
WORKER_PID=$!

# If either process exits, kill the other and exit
trap "kill $SCHEDULER_PID $WORKER_PID 2>/dev/null; exit" SIGTERM SIGINT

wait -n $SCHEDULER_PID $WORKER_PID
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE, shutting down..."
kill $SCHEDULER_PID $WORKER_PID 2>/dev/null
exit $EXIT_CODE
