"""
Rate Limiting Module
====================
Provides rate limiting for the High Finance API using slowapi.

Usage:
    from high_finance.core.rate_limit import limiter, rate_limit_exceeded_handler

    # In main.py:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    # In routes:
    @router.get("/expensive-endpoint")
    @limiter.limit("10/minute")
    async def expensive_operation(request: Request):
        ...
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_identifier(request: Request) -> str:
    """
    Get a unique identifier for rate limiting.

    Uses the Authorization header if present (for authenticated users),
    otherwise falls back to IP address.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        # Use token as identifier for authenticated users
        # This ensures rate limits are per-user, not per-IP
        return f"user:{auth_header[7:20]}"  # Use first 13 chars of token
    return get_remote_address(request)


# Create the limiter instance
limiter = Limiter(
    key_func=get_identifier,
    default_limits=["200/minute", "1000/hour"],  # Default limits for all endpoints
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for rate limit exceeded errors.

    Returns a JSON response with details about the rate limit.
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": f"Rate limit exceeded: {exc.detail}",
            "retry_after": getattr(exc, "retry_after", None),
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
            "X-RateLimit-Limit": str(exc.detail) if exc.detail else "unknown",
        },
    )
