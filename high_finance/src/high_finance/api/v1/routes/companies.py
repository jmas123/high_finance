from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from high_finance.db.session import get_db
from high_finance.services.fundamentals import get_company_fundamentals

from high_finance.api.v1.schemas.politician import PoliticianTradeOut
from high_finance.services.politicians import get_company_politician_trades, ensure_company_trades_fresh

router = APIRouter()

@router.get("/{ticker}")
async def read_company(ticker: str, db: Session = Depends(get_db)):
    company = await get_company_fundamentals(ticker, db)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company





@router.get("/{ticker}/politician-trades", response_model=List[PoliticianTradeOut])
def company_politician_trades(ticker: str, limit: int = 50, db: Session = Depends(get_db)):
    ensure_company_trades_fresh(db, ticker)
    return get_company_politician_trades(db, ticker, limit=limit)


