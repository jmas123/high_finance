from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from high_finance.db.session import get_db
from high_finance.api.v1.schemas.politician import CongressTradeNotificationOut
from high_finance.services.politicians import get_significant_congress_trades
from high_finance.services.trade_context import build_trade_context


router = APIRouter()

@router.get(
    "/congress-trades",
    response_model=List[CongressTradeNotificationOut],
)
def congress_trade_notifications(
    min_amount: float = 50_000,
    days: int = 7,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    trades = get_significant_congress_trades(db, min_amount=min_amount, days=days, limit=limit)
    return [{"trade": t, "politician": t.politician, "context": build_trade_context(db, t)} for t in trades]

