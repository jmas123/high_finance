import asyncio
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from high_finance.api.v1.schemas.politician import (
    BacktestResponseOut,
    LeaderboardResponseOut,
    PoliticianOut,
    PoliticianTradeOut,
    PoliticianTradeWithPoliticianOut,
)
from high_finance.core.cache import get_or_compute
from high_finance.db.session import get_db, SessionLocal
from high_finance.services.politician_backtest import (
    backtest_all_politicians_sync,
    run_backtest_sync,
)
from high_finance.services.politician_performance import politician_rolling_performance
from high_finance.services.politicians import (
    ensure_company_trades_fresh,
    get_company_politician_trades,
    get_politician_trades,
    search_politicians,
)

router = APIRouter()


# ── Backtest endpoints (must come BEFORE /{politician_id} to avoid route clash) ─


@router.get("/leaderboard", response_model=LeaderboardResponseOut)
async def leaderboard(
    delay_days: int = 3,
    hold_days: int = 30,
    min_trades: int = 3,
    since_year: int = 2020,
):
    """Congress trading leaderboard — backtests all politicians with enough trades.

    Chamber/party filtering is done client-side to reduce cache key space.
    Hard floor at 2020: pre-2020 data is unreliable (delisted tickers, disclosure inconsistencies).
    """
    cache_key = f"hf:backtest:leaderboard:{delay_days}:{hold_days}:{min_trades}:{since_year}"

    async def compute():
        def _run():
            db = SessionLocal()
            try:
                return backtest_all_politicians_sync(
                    db, delay_days, hold_days, min_trades,
                    None, None, since_year,
                )
            finally:
                db.close()

        entries = await asyncio.to_thread(_run)
        return {
            "delay_days": delay_days,
            "hold_days": hold_days,
            "entries": entries,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

    return await get_or_compute(cache_key, 3600, compute, lock_ttl=600)


@router.get("/{politician_id}/backtest", response_model=BacktestResponseOut)
async def backtest(
    politician_id: int,
    delay_days: int = 3,
    hold_days: int = 30,
    since_year: int = 2020,
):
    """Full backtest for a single politician — equity curve + per-trade details."""
    cache_key = f"hf:backtest:{politician_id}:{delay_days}:{hold_days}:{since_year}"

    async def compute():
        def _run():
            db = SessionLocal()
            try:
                return run_backtest_sync(
                    db, politician_id, delay_days, hold_days,
                    since_year=since_year,
                )
            finally:
                db.close()

        result = await asyncio.to_thread(_run)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result

    return await get_or_compute(cache_key, 3600, compute)


# ── Existing endpoints ───────────────────────────────────────────────────────


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