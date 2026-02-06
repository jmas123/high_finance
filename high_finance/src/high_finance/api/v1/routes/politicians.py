from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict

from high_finance.db.session import get_db
from high_finance.api.v1.schemas.politician import PoliticianOut, PoliticianTradeOut
from high_finance.services.politicians import (
    get_politician_trades,
    search_politicians,
    ensure_company_trades_fresh,
)

from high_finance.api.v1.schemas.politician import PoliticianTradeWithPoliticianOut
from high_finance.services.politicians import get_company_politician_trades
from high_finance.services.politician_performance import politician_rolling_performance


router = APIRouter()

# Cache for politician grades to avoid repeated DB queries in the same request
_grade_cache: Dict[int, str | None] = {}

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
def company_politician_trades(ticker: str, limit: int = 50, include_performance: bool = True, db: Session = Depends(get_db)):
    ensure_company_trades_fresh(db, ticker)
    trades = get_company_politician_trades(db, ticker, limit=limit)

    results = []
    perf_cache: Dict[int, dict] = {}

    for t in trades:
        politician_data = None
        if t.politician:
            pid = t.politician.id

            # Get performance from cache or compute it
            if pid not in perf_cache and include_performance:
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

        results.append({"trade": t, "politician": politician_data})

    return results