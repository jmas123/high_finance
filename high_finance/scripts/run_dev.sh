#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")/.."

# Ensure the package is importable (src layout)
export PYTHONPATH="${PWD}/src:${PYTHONPATH:-}"

# Start the development server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload --workers 1