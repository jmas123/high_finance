FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

# Set the working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

# Copy the application code
COPY ./src ./src

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser

# Expose the application port
EXPOSE 8000

# Production: use gunicorn with uvicorn workers
# Railway sets PORT dynamically — must use shell form so $PORT expands
CMD gunicorn main:app \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 60 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
