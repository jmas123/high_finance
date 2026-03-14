import logging

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from high_finance.db.session import get_db
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.api.v1.schemas.company import CompanyFundamentals
from high_finance.core.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{ticker}", response_model=CompanyFundamentals)
@limiter.limit("30/minute")
async def read_company_fundamentals(request: Request, ticker: str, db: Session = Depends(get_db)):
    try:
        fundamentals = await get_company_fundamentals(ticker, db)
    except Exception as e:
        logger.exception("Fundamentals failed for %s", ticker)
        raise HTTPException(
            status_code=503,
            detail="Market data temporarily unavailable. Please try again shortly.",
        )
    if not fundamentals:
        raise HTTPException(status_code=404, detail="Company not found")
    return fundamentals