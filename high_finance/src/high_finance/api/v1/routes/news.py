from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session

from high_finance.api.deps import get_db
from high_finance.services.news import get_news_bundle

router = APIRouter()

@router.get("/{ticker}")
async def read_news(
    ticker: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return await get_news_bundle(db, ticker.upper(), limit=limit)
