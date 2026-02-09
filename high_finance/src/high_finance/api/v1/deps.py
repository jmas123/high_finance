"""
Shared API dependencies
=======================
Reusable FastAPI dependencies for route handlers.
"""

import re

from fastapi import HTTPException, status

# Matches standard tickers: AAPL, BRK.B, BF-B, 005930.KS (1-10 chars, alphanumeric + dot + hyphen)
_TICKER_RE = re.compile(r"^[A-Z0-9.\-]{1,10}$")


def validate_ticker(ticker: str) -> str:
    """
    Validate and normalize a ticker symbol from URL path parameters.

    Prevents path traversal, injection, and abuse via invalid ticker formats.
    """
    normalized = ticker.strip().upper()
    if not _TICKER_RE.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ticker format: '{ticker}'",
        )
    return normalized
