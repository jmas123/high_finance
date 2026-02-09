"""
Enhanced Valuation API Route

All parameters are optional - if not provided, smart defaults from actual
financials will be used.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from high_finance.core.rate_limit import limiter
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo
from high_finance.services.valuation import get_valuation_bundle
from high_finance.services.dcf_suggest import suggest_dcf_assumptions
from high_finance.services.memo import check_monthly_budget

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def read_valuation(
    ticker: str,
    growth: Optional[float] = Query(default=None, description="Revenue growth rate (5Y CAGR). Will be clamped to -10% to 50%."),
    margin: Optional[float] = Query(default=None, description="Operating margin. Will be clamped to -10% to 50%."),
    tax: Optional[float] = Query(default=None, description="Tax rate. Will be clamped to 10% to 35%."),
    wacc: Optional[float] = Query(default=None, description="Discount rate. Will be clamped to 5% to 20%."),
    terminal_g: Optional[float] = Query(default=None, description="Terminal growth rate. Will be clamped to 0% to 4%."),
):
    """
    Get comprehensive valuation analysis for a ticker.
    
    If parameters are not provided, smart defaults will be computed from:
    - Growth: Analyst estimates > 3Y historical CAGR > 1Y historical > sector median
    - Margin: Current operating margin > sector median
    - Tax: Effective tax rate > US statutory (21%)
    - WACC: CAPM from beta > default 10%
    - Terminal growth: 2.5% (long-run nominal GDP proxy)
    
    Returns:
    - DCF fair value with FCFF projections
    - Multiples-based valuations (EV/Revenue, EV/EBITDA, P/E)
    - Sensitivity tornado chart data
    - Bear/Base/Bull scenarios
    - Assumption warnings when inputs look aggressive
    - Analyst consensus targets
    """
    try:
        return await get_valuation_bundle(
            ticker.upper(),
            growth=growth,
            margin=margin,
            tax=tax,
            wacc=wacc,
            terminal_g=terminal_g,
        )
    except Exception as e:
        logger.exception("Valuation failed for %s", ticker)
        raise HTTPException(500, "Unable to compute valuation")


@router.post("/{ticker}/ai-suggest")
@limiter.limit("5/minute;20/hour")
async def ai_suggest_assumptions(
    request: Request,
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI-suggested DCF assumptions using Claude Haiku.

    Analyzes financials, sector context, analyst consensus, and news
    to suggest specific values + written explanations for each DCF parameter.

    POST because it triggers an LLM call (side effect), costs money, and is rate-limited.
    """
    # Budget gate — shares the monthly AI budget with memos
    within_budget, spent, _remaining = check_monthly_budget(db)
    if not within_budget:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly AI budget reached (${spent:.2f} spent). Resets next month.",
        )

    try:
        result = await suggest_dcf_assumptions(ticker.upper(), db)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("AI suggest failed for %s", ticker)
        raise HTTPException(500, "AI suggestion temporarily unavailable")

    # Persist to investment_memos so it appears in AI History
    try:
        memo = InvestmentMemo(
            user_id=user.id,
            ticker=ticker.upper(),
            content=json.dumps(result, default=str),
            model_used=result.get("model"),
            input_tokens=result.get("input_tokens"),
            output_tokens=result.get("output_tokens"),
            analysis_type="dcf_suggestion",
        )
        db.add(memo)
        db.commit()
    except Exception:
        logger.exception("Failed to save DCF suggestion for %s", ticker)

    return result