"""
Enhanced Risk Analytics API Route

Provides Monte Carlo simulations with probability-based outputs.
"""

from typing import Optional
from fastapi import APIRouter, Query
from high_finance.services.risk import get_risk_bundle

router = APIRouter()


@router.get("/{ticker}")
async def read_risk(
    ticker: str,
    period: str = Query(
        default="1y",
        pattern="^(1mo|3mo|6mo|1y|2y|5y|10y|max)$",
        description="Historical lookback period for volatility estimation"
    ),
    horizon_days: int = Query(
        default=60,
        ge=10,
        le=252,
        description="Forward simulation horizon in trading days"
    ),
    n_sims: int = Query(
        default=500,
        ge=100,
        le=5000,
        description="Number of Monte Carlo simulations"
    ),
    vol_multiplier: float = Query(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Volatility scaling factor (1.0 = historical, 1.5 = stressed)"
    ),
    include_earnings_shock: bool = Query(
        default=False,
        description="Whether to inject earnings-day volatility spike"
    ),
    earnings_shock_day: Optional[int] = Query(
        default=None,
        ge=0,
        description="Day in horizon to apply earnings shock (defaults to midpoint)"
    ),
    target_price: Optional[float] = Query(
        default=None,
        gt=0,
        description="Custom target price for probability calculation"
    ),
    drawdown_threshold: float = Query(
        default=-0.15,
        le=-0.01,
        ge=-0.50,
        description="Drawdown threshold for probability (e.g., -0.15 for 15%)"
    ),
):
    """
    Get comprehensive risk analytics for a ticker.
    
    Returns:
    - Historical risk metrics (VaR, volatility, max drawdown)
    - Monte Carlo fan chart data
    - Probability estimates:
        - P(positive return)
        - P(return > X%)
        - P(drawdown exceeds threshold)
        - P(price > target)
    - Scenario analysis (stress/base/bull expected returns)
    - Terminal return distribution histogram
    """
    return await get_risk_bundle(
        ticker.upper(),
        period=period,
        horizon_days=horizon_days,
        n_sims=n_sims,
        vol_multiplier=vol_multiplier,
        include_earnings_shock=include_earnings_shock,
        earnings_shock_day=earnings_shock_day,
        target_price=target_price,
        drawdown_threshold=drawdown_threshold,
    )