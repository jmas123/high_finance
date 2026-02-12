import logging

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from high_finance.db.session import get_db
from high_finance.services import edgar

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{ticker}", response_model=list)
async def get_ownership(ticker: str, db: Session = Depends(get_db)):
    try:
        ownership_data = await edgar.get_ownership_data(ticker, db)
        if not ownership_data:
            raise HTTPException(status_code=404, detail="Ownership data not found")
        return ownership_data
    except HTTPException:
        raise
    except Exception:
        logger.exception("Ownership fetch failed for %s", ticker)
        raise HTTPException(status_code=500, detail="Unable to load ownership data")
