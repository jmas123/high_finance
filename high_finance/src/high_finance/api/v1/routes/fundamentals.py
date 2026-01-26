from fastapi import APIRouter, HTTPException
from fastapi import Depends
from sqlalchemy.orm import Session
from high_finance.db.session import get_db
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.api.v1.schemas.company import CompanyFundamentals

router = APIRouter()

@router.get("/{ticker}", response_model=CompanyFundamentals)
async def read_company_fundamentals(ticker: str, db: Session = Depends(get_db)):
    fundamentals = await get_company_fundamentals(ticker, db)
    if not fundamentals:
        raise HTTPException(status_code=404, detail="Company not found")
    return fundamentals