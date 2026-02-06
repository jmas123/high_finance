"""
Portfolio Performance API Routes
================================
Endpoints for portfolio performance vs benchmark comparison.
"""

import logging
import re
from fastapi import APIRouter, HTTPException

from high_finance.api.v1.schemas.portfolio_performance import (
    PortfolioPerformanceRequest,
    PortfolioPerformanceResponse,
)
from high_finance.services.portfolio_performance import get_portfolio_performance

logger = logging.getLogger(__name__)

# Ticker validation pattern: 1-5 uppercase letters, optionally followed by -USD (for crypto)
VALID_TICKER_PATTERN = re.compile(r'^[A-Z]{1,5}(-USD)?$')
MAX_POSITIONS = 50
MAX_BENCHMARKS = 10


def validate_ticker(ticker: str) -> bool:
    """Validate ticker format to prevent injection attacks."""
    return bool(VALID_TICKER_PATTERN.match(ticker.upper()))

router = APIRouter()


@router.post("/performance", response_model=PortfolioPerformanceResponse)
async def portfolio_performance(request: PortfolioPerformanceRequest):
    """
    Get portfolio performance compared to benchmarks.

    Calculates returns for each time period (1D, 1W, 1M, 3M, YTD, 1Y)
    and provides sparkline data for visualization.

    Request body:
    {
        "positions": [
            {"ticker": "AAPL", "shares": 10, "avg_cost": 150},
            ...
        ],
        "benchmarks": ["SPY", "QQQ", "GLD", "BTC-USD"]
    }

    Returns performance data including:
    - Portfolio returns by period
    - Benchmark returns by period
    - Sparkline data (normalized to 100)
    - Outperformance vs each benchmark (YTD)
    """
    try:
        if not request.positions:
            raise HTTPException(
                status_code=400,
                detail="At least one position is required"
            )

        # Validate and filter positions (limit to MAX_POSITIONS, validate tickers)
        valid_positions = []
        for p in request.positions[:MAX_POSITIONS]:
            ticker_upper = p.ticker.upper()
            if validate_ticker(ticker_upper):
                valid_positions.append({
                    "ticker": ticker_upper,
                    "shares": p.shares,
                    "avg_cost": p.avg_cost,
                })
            else:
                logger.warning(f"Invalid ticker rejected: {p.ticker}")

        if not valid_positions:
            raise HTTPException(
                status_code=400,
                detail="No valid positions provided"
            )

        # Validate and filter benchmarks (limit to MAX_BENCHMARKS)
        benchmarks = [
            b.upper() for b in (request.benchmarks or ["SPY"])[:MAX_BENCHMARKS]
            if validate_ticker(b.upper())
        ]
        if not benchmarks:
            benchmarks = ["SPY"]

        result = await get_portfolio_performance(valid_positions, benchmarks)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error calculating portfolio performance: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate portfolio performance: {str(e)}"
        )
