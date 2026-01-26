from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from high_finance.db.session import get_db
from high_finance.api.v1.schemas.politician import PoliticianOut, PoliticianTradeOut
from high_finance.services.politicians import (
    get_politician_trades,
    search_politicians,
)
from typing import List

from high_finance.api.v1.schemas.politician import PoliticianTradeWithPoliticianOut
from high_finance.services.politicians import get_company_politician_trades


router = APIRouter()

@router.get("/search", response_model=List[PoliticianOut])
def search(q: str = "", db: Session = Depends(get_db)):
    return search_politicians(db, q)

@router.get("/{politician_id}/trades", response_model=List[PoliticianTradeOut])
def trades(politician_id: int, limit: int = 100, db: Session = Depends(get_db)):
    return get_politician_trades(db, politician_id, limit=limit)


@router.get(
    "/{ticker}/politician-trades",
    response_model=List[PoliticianTradeWithPoliticianOut],
)
def company_politician_trades(ticker: str, limit: int = 50, db: Session = Depends(get_db)):
    trades = get_company_politician_trades(db, ticker, limit=limit)
    return [{"trade": t, "politician": t.politician} for t in trades]