#!/bin/bash

# This script backfills 13F ownership data by triggering the appropriate task in the worker queue.

# Load environment variables
source .env

# Trigger the refresh_13f task
curl -X POST http://localhost:8000/api/v1/tasks/refresh_13f

echo "13F ownership data backfill triggered."