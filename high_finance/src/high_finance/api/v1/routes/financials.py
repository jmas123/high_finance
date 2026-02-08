import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from high_finance.core.rate_limit import limiter
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo
from high_finance.services.financials import get_financial_statements
from high_finance.services.ai_analysis import analyze_financials
from high_finance.services.memo import check_monthly_budget
from high_finance.services.yf_cache import get_yf_info

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/{ticker}")
async def read_financials(ticker: str):
    statements = await get_financial_statements(ticker)
    if not statements:
        raise HTTPException(status_code=404, detail="Financial data not found")
    return statements

@router.post("/{ticker}/analyze")
@limiter.limit("5/minute;20/hour")
async def analyze_financials_endpoint(
    request: Request,
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Budget gate — shares the monthly AI budget with memos
    within_budget, spent, _remaining = check_monthly_budget(db)
    if not within_budget:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly AI budget reached (${spent:.2f} spent). Resets next month.",
        )

    statements = await get_financial_statements(ticker)
    if not statements:
        raise HTTPException(status_code=404, detail="Financial data not found")

    info = await get_yf_info(ticker)
    sector = info.get("sector") if info else None
    industry = info.get("industry") if info else None

    result = await analyze_financials(ticker.upper(), statements, sector=sector, industry=industry)

    # Persist to investment_memos so it appears in AI History
    saved_id = None
    content = result["content"]
    if content and not content.startswith("AI analysis is not configured"):
        try:
            memo = InvestmentMemo(
                user_id=user.id,
                ticker=ticker.upper(),
                content=content,
                model_used=result.get("model"),
                input_tokens=result.get("input_tokens"),
                output_tokens=result.get("output_tokens"),
                analysis_type="financial_analysis",
            )
            db.add(memo)
            db.commit()
            db.refresh(memo)
            saved_id = memo.id
        except Exception:
            logger.exception("Failed to save financial analysis for %s", ticker)

    return {"analysis": content, "id": saved_id}
