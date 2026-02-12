from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from high_finance.db.session import get_db
from high_finance.services.people import get_leadership_data
from high_finance.core.rate_limit import limiter

router = APIRouter()

@router.get("/{ticker}")
@limiter.limit("30/minute")
async def read_leadership(request: Request, ticker: str, db: Session = Depends(get_db)):
    leadership_info = await get_leadership_data(ticker, db)
    if not leadership_info:
        raise HTTPException(status_code=404, detail="Leadership information not found")
    return leadership_info