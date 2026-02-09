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

# Copy gunicorn config
COPY ./docker/gunicorn_conf.py /app/gunicorn_conf.py

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser

# Expose the application port
EXPOSE 8000

# Production: use gunicorn with uvicorn workers (4 workers, not --reload)
CMD ["gunicorn", "main:app", "-c", "/app/gunicorn_conf.py"]
