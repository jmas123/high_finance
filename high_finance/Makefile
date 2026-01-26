# Makefile for managing the high_finance project

.PHONY: install run test lint format clean

install:
    pip install -r requirements.txt

run:
    uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

test:
    pytest

lint:
    ruff .

format:
    black .

clean:
    find . -type __pycache__ -exec rm -r {} +