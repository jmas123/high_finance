import logging

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from high_finance.db.session import get_db
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.api.v1.schemas.company import CompanyFundamentals

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{ticker}", response_model=CompanyFundamentals)
async def read_company_fundamentals(ticker: str, db: Session = Depends(get_db)):
    try:
        fundamentals = await get_company_fundamentals(ticker, db)
    except Exception as e:
        logger.exception("Fundamentals failed for %s", ticker)
        raise HTTPException(500, "Unable to load fundamentals")
    if not fundamentals:
        raise HTTPException(status_code=404, detail="Company not found")
    return fundamentals