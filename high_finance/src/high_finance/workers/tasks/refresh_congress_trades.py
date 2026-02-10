from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.workers.tasks.base import tracked_job
from high_finance.workers.tasks.congress_trades_logic import refresh_congress_trades


@tracked_job("congress_trades")
def refresh_congress_trades_job(symbol: str | None = None, limit: int = 200) -> dict:
    """
    RQ-safe task wrapper.
    Creates its own DB session and closes it properly.
    """
    db: Session = SessionLocal()
    try:
        inserted = refresh_congress_trades(db=db, symbol=symbol, limit=limit)
        return {"status": "ok", "inserted": inserted, "symbol": symbol, "limit": limit}
    finally:
        db.close()
