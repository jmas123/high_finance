from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict

from high_finance.db.session import get_db
from high_finance.api.v1.schemas.politician import CongressTradeNotificationOut
from high_finance.services.politicians import get_significant_congress_trades
from high_finance.services.trade_context import build_trade_context
from high_finance.services.politician_performance import politician_rolling_performance


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

    # Cache performance metrics by politician ID to avoid repeated DB queries
    perf_cache: Dict[int, dict] = {}
    results = []

    for t in trades:
        politician_data = None
        if t.politician:
            pid = t.politician.id

            # Get performance from cache or compute it
            if pid not in perf_cache:
                perf = politician_rolling_performance(db, pid, window_days=30, n=10)
                perf_cache[pid] = {
                    "hit_rate": perf.get("hit_rate"),
                    "avg_return_pct": perf.get("avg_return_pct"),
                }

            cached = perf_cache.get(pid, {})
            politician_data = {
                "id": t.politician.id,
                "name": t.politician.name,
                "chamber": t.politician.chamber,
                "state": t.politician.state,
                "district": t.politician.district,
                "party": t.politician.party,
                "hit_rate": cached.get("hit_rate"),
                "avg_return_pct": cached.get("avg_return_pct"),
            }

        results.append({
            "trade": t,
            "politician": politician_data,
            "context": build_trade_context(db, t),
        })

    return results

