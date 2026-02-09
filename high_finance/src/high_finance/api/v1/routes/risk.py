"""
Enhanced Risk Analytics API Route

Provides Monte Carlo simulations with probability-based outputs.
"""

import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo
from high_finance.services.risk import get_risk_bundle
from high_finance.services.risk_suggest import suggest_risk_scenarios
from high_finance.services.memo import check_monthly_budget

logger = logging.getLogger(__name__)
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
    try:
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
    except Exception as e:
        logger.exception("Risk analysis failed for %s", ticker)
        raise HTTPException(500, "Unable to compute risk analysis")


@router.get("/{ticker}/ai-assessment")
async def get_ai_risk_assessment(
    ticker: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    AI-powered risk assessment with tailored Monte Carlo scenarios.

    Returns risk factors, severity ratings, and 3 tailored simulation scenarios
    with specific parameter recommendations and plain-English explanations.
    Cached for 1 hour per ticker.
    """
    # Budget gate — shares the monthly AI budget with memos / DCF / financials
    within_budget, spent, _remaining = check_monthly_budget(db)
    if not within_budget:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly AI budget reached (${spent:.2f} spent). Resets next month.",
        )

    try:
        result = await suggest_risk_scenarios(ticker.upper(), db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("AI risk assessment failed for %s", ticker)
        raise HTTPException(500, "Unable to generate AI risk assessment")

    # Persist to investment_memos so it appears in AI History
    try:
        memo = InvestmentMemo(
            user_id=user.id,
            ticker=ticker.upper(),
            content=json.dumps(result, default=str),
            model_used=result.get("model"),
            input_tokens=result.get("input_tokens"),
            output_tokens=result.get("output_tokens"),
            analysis_type="risk_assessment",
        )
        db.add(memo)
        db.commit()
    except Exception:
        logger.exception("Failed to save risk assessment for %s", ticker)

    return result