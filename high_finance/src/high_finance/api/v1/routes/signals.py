"""
Signals API Routes
==================
Endpoints for the Signal Discovery & Ranking Engine.
"""

import asyncio
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from high_finance.core.cache import get_or_compute
from high_finance.db.session import SessionLocal

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────────


class SignalResultSchema(BaseModel):
    signal_id: str
    label: str
    description: str
    trades: int
    avg_alpha: float
    std_alpha: float
    win_rate: float
    score: float
    p_value: float
    adjusted_p: float
    significance: str
    coverage_pct: Optional[float] = None
    low_sample: bool = False


class SignalRankingResponse(BaseModel):
    signals: list[SignalResultSchema]
    window: int
    since_date: str
    total_signals_evaluated: int


# ── Endpoint ────────────────────────────────────────────────────────────


@router.get("/ranked", response_model=SignalRankingResponse)
async def get_ranked_signals(
    window: int = Query(30, description="Return horizon in days (7, 30, 60, 90, 180)"),
    since: Optional[str] = Query(None, description="Only evaluate events after this date (YYYY-MM-DD). Default: 2 years ago"),
):
    """Evaluate all predefined signals and return ranked by score.

    Each signal is a filter combination (direction, regime, sector, amount)
    applied to forward returns data. Signals are scored by a t-statistic
    and corrected for multiple testing via Bonferroni.
    """
    from fastapi import HTTPException

    if window not in (7, 30, 60, 90, 180):
        raise HTTPException(status_code=400, detail="window must be 7, 30, 60, 90, or 180")

    since_date: Optional[date] = None
    if since:
        try:
            since_date = date.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="since must be YYYY-MM-DD format")

    cache_key = f"hf:signals:ranked:{window}:{since}"

    async def compute():
        def _run() -> dict:
            from high_finance.services.signals import SignalEngine, SIGNAL_REGISTRY

            db = SessionLocal()
            try:
                engine = SignalEngine(db, window=window, since_date=since_date)
                results = engine.evaluate_all()
                return {
                    "signals": results,
                    "window": window,
                    "since_date": engine.since_date.isoformat(),
                    "total_signals_evaluated": len(SIGNAL_REGISTRY),
                }
            finally:
                db.close()

        return await asyncio.to_thread(_run)

    return await get_or_compute(cache_key, 300, compute)
