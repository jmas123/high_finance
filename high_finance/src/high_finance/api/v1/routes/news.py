import logging

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services.news import get_news_bundle

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{ticker}")
async def read_news(
    ticker: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        return await get_news_bundle(db, ticker.upper(), limit=limit)
    except Exception as e:
        logger.exception("News fetch failed for %s", ticker)
        raise HTTPException(500, "Unable to load news")
