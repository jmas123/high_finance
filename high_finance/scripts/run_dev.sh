#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")/.."

# Start the development server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload --workers 1