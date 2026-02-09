"""
Earnings Press Release Analysis Routes
=======================================
POST /{ticker}/analyze — Trigger AI analysis of latest 8-K Item 2.02 (costs tokens)
GET  /{ticker}/latest  — Get cached/stored result (free, no LLM cost)
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from high_finance.core.cache import get_cached
from high_finance.core.rate_limit import limiter
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo
from high_finance.services.earnings_analysis import analyze_earnings_press_release
from high_finance.services.memo import check_monthly_budget

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{ticker}/analyze")
@limiter.limit("5/minute;20/hour")
async def analyze_earnings(
    request: Request,
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze the latest 8-K Item 2.02 earnings press release using AI.

    POST because it triggers an LLM call (side effect), costs money, and is rate-limited.
    """
    # Budget gate
    within_budget, spent, _remaining = check_monthly_budget(db)
    if not within_budget:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly AI budget reached (${spent:.2f} spent). Resets next month.",
        )

    result = await analyze_earnings_press_release(ticker.upper())

    # Handle service-level errors
    if result.get("error") == "no_filing_found":
        raise HTTPException(
            status_code=404,
            detail=f"No 8-K Item 2.02 earnings filing found for {ticker.upper()}",
        )
    if result.get("error"):
        raise HTTPException(
            status_code=502,
            detail=result.get("detail", "Failed to analyze earnings filing"),
        )

    # Persist to investment_memos for AI History
    memo_id = None
    try:
        memo = InvestmentMemo(
            user_id=user.id,
            ticker=ticker.upper(),
            content=json.dumps(result, default=str),
            model_used=result.get("model"),
            input_tokens=result.get("input_tokens"),
            output_tokens=result.get("output_tokens"),
            analysis_type="earnings_analysis",
        )
        db.add(memo)
        db.commit()
        memo_id = memo.id
    except Exception:
        logger.exception("Failed to save earnings analysis for %s", ticker)

    return {"analysis": result, "id": memo_id}


@router.get("/{ticker}/latest")
async def get_latest_earnings_analysis(
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the latest cached or stored earnings analysis (no LLM cost).

    Priority:
    1. Redis cache (fastest)
    2. Latest InvestmentMemo with analysis_type='earnings_analysis'
    3. None — frontend shows "Analyze" button
    """
    ticker_upper = ticker.upper()

    # 1. Try Redis cache
    cached = await get_cached(f"hf:earnings_analysis:{ticker_upper}")
    if cached is not None:
        return {"analysis": cached, "id": None, "source": "cache"}

    # 2. Fall back to stored memo
    try:
        memo = (
            db.query(InvestmentMemo)
            .filter(
                InvestmentMemo.ticker == ticker_upper,
                InvestmentMemo.analysis_type == "earnings_analysis",
            )
            .order_by(InvestmentMemo.created_at.desc())
            .first()
        )
        if memo is not None:
            analysis = json.loads(memo.content)
            return {"analysis": analysis, "id": memo.id, "source": "stored"}
    except Exception:
        logger.exception("Failed to load stored earnings analysis for %s", ticker)

    # 3. Nothing found
    return {"analysis": None, "id": None, "source": "none"}
