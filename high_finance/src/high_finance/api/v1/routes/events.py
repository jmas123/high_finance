"""
Events API Routes
=================
Endpoints for querying events and their forward returns.
"""

import asyncio
from datetime import date, datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, Query
from pydantic import BaseModel

from high_finance.core.cache import get_or_compute
from high_finance.db.session import SessionLocal
from high_finance.db.models.event import Event
from high_finance.db.models.forward_return import ForwardReturn

from sqlalchemy import case, func, asc, desc, text
from sqlalchemy.orm import Session

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────────


class ForwardReturnEvent(BaseModel):
    event_id: int
    event_type: str
    ticker: str
    event_date: date
    event_date_type: str
    direction: str
    actor_type: str
    actor_id: int
    actor_name: str
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    anchor_price: Optional[float] = None
    spy_anchor_price: Optional[float] = None
    ret_7d: Optional[float] = None
    ret_30d: Optional[float] = None
    ret_60d: Optional[float] = None
    ret_90d: Optional[float] = None
    ret_180d: Optional[float] = None
    spy_ret_7d: Optional[float] = None
    spy_ret_30d: Optional[float] = None
    spy_ret_60d: Optional[float] = None
    spy_ret_90d: Optional[float] = None
    spy_ret_180d: Optional[float] = None
    is_complete: Optional[int] = None
    skip_reason: Optional[str] = None
    meta: Optional[dict] = None

    class Config:
        from_attributes = True


class ForwardReturnsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    events: list[ForwardReturnEvent]


class EventStatsResponse(BaseModel):
    total_events: int
    events_with_returns: int
    avg_ret_30d: Optional[float] = None
    median_ret_30d: Optional[float] = None
    win_rate_30d: Optional[float] = None
    avg_alpha_30d: Optional[float] = None
    computed_at: str


# ── Summary schemas ───────────────────────────────────────────────────


class DirectionStats(BaseModel):
    trades: int
    win_rate: Optional[float] = None
    avg_return: Optional[float] = None
    avg_alpha: Optional[float] = None


class PoliticianRank(BaseModel):
    actor_id: int
    name: str
    trade_count: int
    win_rate: Optional[float] = None
    avg_alpha: Optional[float] = None


class DistributionStats(BaseModel):
    median_return: Optional[float] = None
    p25_return: Optional[float] = None
    p75_return: Optional[float] = None
    worst_return: Optional[float] = None
    best_return: Optional[float] = None
    total_with_data: int


class RegimeStats(BaseModel):
    trades: int
    win_rate: Optional[float] = None
    avg_alpha: Optional[float] = None


class EventSummaryResponse(BaseModel):
    buys: DirectionStats
    sells: DirectionStats
    top_politicians: list[PoliticianRank]
    distribution: DistributionStats
    regime_stats: Optional[dict] = None  # {"low_vol": RegimeStats, "high_vol": RegimeStats}
    window: int
    min_trades_filter: int


# ── Sortable columns ───────────────────────────────────────────────────

_SORT_COLUMNS = {
    "event_date": Event.event_date,
    "ret_7d": ForwardReturn.ret_7d,
    "ret_30d": ForwardReturn.ret_30d,
    "ret_60d": ForwardReturn.ret_60d,
    "ret_90d": ForwardReturn.ret_90d,
    "ret_180d": ForwardReturn.ret_180d,
    "anchor_price": ForwardReturn.anchor_price,
    "ticker": Event.ticker,
    "actor_name": Event.actor_name,
}


# ── Endpoints ───────────────────────────────────────────────────────────


@router.get("/forward-returns", response_model=ForwardReturnsResponse)
async def get_forward_returns(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
    direction: Optional[str] = Query(None, description="Filter: buy or sell"),
    actor_id: Optional[int] = Query(None, description="Filter by actor ID"),
    actor_name: Optional[str] = Query(None, description="Partial match on actor name"),
    date_from: Optional[date] = Query(None, description="Events on or after this date"),
    date_to: Optional[date] = Query(None, description="Events on or before this date"),
    has_returns: Optional[bool] = Query(None, description="Only include events with computed returns"),
    sort_by: str = Query("event_date", description="Column to sort by"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Results per page"),
):
    """Query events joined with forward returns, with filtering/sorting/pagination."""
    # Build cache key from all params
    cache_key = (
        f"hf:events:fwd:{event_type}:{ticker}:{direction}:{actor_id}:{actor_name}:"
        f"{date_from}:{date_to}:{has_returns}:{sort_by}:{sort_dir}:{page}:{page_size}"
    )

    async def compute():
        def _run() -> dict:
            db = SessionLocal()
            try:
                return _query_forward_returns(
                    db,
                    event_type=event_type,
                    ticker=ticker,
                    direction=direction,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    date_from=date_from,
                    date_to=date_to,
                    has_returns=has_returns,
                    sort_by=sort_by,
                    sort_dir=sort_dir,
                    page=page,
                    page_size=page_size,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_run)

    return await get_or_compute(cache_key, 300, compute)


@router.get("/stats", response_model=EventStatsResponse)
async def get_event_stats(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
):
    """Aggregate stats for events with forward returns."""
    cache_key = f"hf:events:stats:{event_type}:{ticker}"

    async def compute():
        def _run() -> dict:
            db = SessionLocal()
            try:
                return _compute_stats(db, event_type=event_type, ticker=ticker)
            finally:
                db.close()

        return await asyncio.to_thread(_run)

    return await get_or_compute(cache_key, 300, compute)


@router.get("/summary", response_model=EventSummaryResponse)
async def get_event_summary(
    window: int = Query(30, description="Return horizon in days"),
    direction: str = Query("all", description="Filter: buy, sell, or all"),
    actor_id: Optional[int] = Query(None, description="Filter by actor ID"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
):
    """Intelligence summary: direction stats, top politicians, distribution, and regime."""
    from fastapi import HTTPException

    if window not in (7, 30, 60, 90, 180):
        raise HTTPException(status_code=400, detail="window must be 7, 30, 60, 90, or 180")
    if direction not in ("buy", "sell", "all"):
        raise HTTPException(status_code=400, detail="direction must be buy, sell, or all")

    cache_key = f"hf:events:summary:{window}:{direction}:{actor_id}:{ticker}"

    async def compute():
        def _run() -> dict:
            db = SessionLocal()
            try:
                return _compute_summary(
                    db, window=window, direction=direction,
                    actor_id=actor_id, ticker=ticker,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_run)

    return await get_or_compute(cache_key, 60, compute)


# ── Query helpers ───────────────────────────────────────────────────────


def _query_forward_returns(
    db: Session,
    *,
    event_type: Optional[str],
    ticker: Optional[str],
    direction: Optional[str],
    actor_id: Optional[int],
    actor_name: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
    has_returns: Optional[bool],
    sort_by: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> dict:
    """Build and execute the forward returns query."""
    query = db.query(Event, ForwardReturn).outerjoin(
        ForwardReturn, Event.id == ForwardReturn.event_id
    )

    # Apply filters
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if ticker:
        query = query.filter(Event.ticker == ticker.upper().strip())
    if direction:
        query = query.filter(Event.direction == direction.lower().strip())
    if actor_id is not None:
        query = query.filter(Event.actor_id == actor_id)
    if actor_name:
        query = query.filter(Event.actor_name.ilike(f"%{actor_name}%"))
    if date_from:
        query = query.filter(Event.event_date >= date_from)
    if date_to:
        query = query.filter(Event.event_date <= date_to)
    if has_returns:
        query = query.filter(
            ForwardReturn.anchor_price.isnot(None),
            # At least one horizon must have a computed return
            (ForwardReturn.ret_7d.isnot(None))
            | (ForwardReturn.ret_30d.isnot(None))
            | (ForwardReturn.ret_60d.isnot(None))
            | (ForwardReturn.ret_90d.isnot(None))
            | (ForwardReturn.ret_180d.isnot(None)),
        )

    # Count total before pagination
    total = query.count()

    # Sort
    sort_col = _SORT_COLUMNS.get(sort_by, Event.event_date)
    order_fn = desc if sort_dir.lower() == "desc" else asc
    # NULLS LAST for return columns so NULL values don't dominate sorted results
    # Secondary sort by Event.id for stable pagination with duplicate values
    query = query.order_by(order_fn(sort_col).nullslast(), Event.id)

    # Paginate
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    events = []
    for evt, fr in rows:
        events.append({
            "event_id": evt.id,
            "event_type": evt.event_type,
            "ticker": evt.ticker,
            "event_date": evt.event_date.isoformat(),
            "event_date_type": evt.event_date_type,
            "direction": evt.direction,
            "actor_type": evt.actor_type,
            "actor_id": evt.actor_id,
            "actor_name": evt.actor_name,
            "amount_min": evt.amount_min,
            "amount_max": evt.amount_max,
            "anchor_price": fr.anchor_price if fr else None,
            "spy_anchor_price": fr.spy_anchor_price if fr else None,
            "ret_7d": fr.ret_7d if fr else None,
            "ret_30d": fr.ret_30d if fr else None,
            "ret_60d": fr.ret_60d if fr else None,
            "ret_90d": fr.ret_90d if fr else None,
            "ret_180d": fr.ret_180d if fr else None,
            "spy_ret_7d": fr.spy_ret_7d if fr else None,
            "spy_ret_30d": fr.spy_ret_30d if fr else None,
            "spy_ret_60d": fr.spy_ret_60d if fr else None,
            "spy_ret_90d": fr.spy_ret_90d if fr else None,
            "spy_ret_180d": fr.spy_ret_180d if fr else None,
            "is_complete": fr.is_complete if fr else None,
            "skip_reason": fr.skip_reason if fr else None,
            "meta": evt.meta,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "events": events,
    }


def _compute_stats(
    db: Session,
    *,
    event_type: Optional[str],
    ticker: Optional[str],
) -> dict:
    """Compute aggregate statistics for events with forward returns."""
    # Base query
    base = db.query(Event).outerjoin(ForwardReturn, Event.id == ForwardReturn.event_id)

    if event_type:
        base = base.filter(Event.event_type == event_type)
    if ticker:
        base = base.filter(Event.ticker == ticker.upper().strip())

    total_events = base.count()

    # Events with actual return data
    with_returns = (
        base.filter(ForwardReturn.ret_30d.isnot(None)).count()
    )

    # Aggregate stats on 30d returns
    stats_q = (
        db.query(
            func.avg(ForwardReturn.ret_30d).label("avg_ret"),
        )
        .join(Event, ForwardReturn.event_id == Event.id)
        .filter(ForwardReturn.ret_30d.isnot(None))
    )

    if event_type:
        stats_q = stats_q.filter(Event.event_type == event_type)
    if ticker:
        stats_q = stats_q.filter(Event.ticker == ticker.upper().strip())

    stats_row = stats_q.first()

    avg_ret = float(stats_row.avg_ret) if stats_row and stats_row.avg_ret else None

    # Win rate: count of positive returns / total
    win_count = 0
    if with_returns > 0:
        pos_q = (
            db.query(func.count())
            .select_from(ForwardReturn)
            .join(Event, ForwardReturn.event_id == Event.id)
            .filter(ForwardReturn.ret_30d.isnot(None), ForwardReturn.ret_30d >= 0)
        )
        if event_type:
            pos_q = pos_q.filter(Event.event_type == event_type)
        if ticker:
            pos_q = pos_q.filter(Event.ticker == ticker.upper().strip())
        win_count = pos_q.scalar() or 0

    win_rate = (win_count / with_returns) if with_returns > 0 else None

    # Average alpha (stock return - SPY return)
    alpha_q = (
        db.query(
            func.avg(ForwardReturn.ret_30d - ForwardReturn.spy_ret_30d).label("avg_alpha"),
        )
        .join(Event, ForwardReturn.event_id == Event.id)
        .filter(
            ForwardReturn.ret_30d.isnot(None),
            ForwardReturn.spy_ret_30d.isnot(None),
        )
    )
    if event_type:
        alpha_q = alpha_q.filter(Event.event_type == event_type)
    if ticker:
        alpha_q = alpha_q.filter(Event.ticker == ticker.upper().strip())
    alpha_row = alpha_q.first()
    avg_alpha = float(alpha_row.avg_alpha) if alpha_row and alpha_row.avg_alpha else None

    return {
        "total_events": total_events,
        "events_with_returns": with_returns,
        "avg_ret_30d": avg_ret,
        "median_ret_30d": None,  # Median requires window function; skip for v1
        "win_rate_30d": win_rate,
        "avg_alpha_30d": avg_alpha,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Summary computation ─────────────────────────────────────────────────

MIN_TRADES_FILTER = 5


def _compute_summary(
    db: Session,
    *,
    window: int,
    direction: str,
    actor_id: Optional[int],
    ticker: Optional[str],
) -> dict:
    """Compute intelligence summary for forward returns."""
    ret_col = getattr(ForwardReturn, f"ret_{window}d")
    spy_col = getattr(ForwardReturn, f"spy_ret_{window}d")

    # ── Base query: events with both stock and SPY returns populated ────
    def base_q():
        q = (
            db.query(Event, ForwardReturn)
            .join(ForwardReturn, Event.id == ForwardReturn.event_id)
            .filter(ret_col.isnot(None), spy_col.isnot(None))
        )
        if direction != "all":
            q = q.filter(Event.direction == direction)
        if actor_id is not None:
            q = q.filter(Event.actor_id == actor_id)
        if ticker:
            q = q.filter(Event.ticker == ticker.upper().strip())
        return q

    # ── Direction stats ────────────────────────────────────────────────
    direction_stats = {}
    for dir_val in ("buy", "sell"):
        q = (
            db.query(
                func.count().label("trades"),
                func.avg(ret_col).label("avg_return"),
                func.avg(ret_col - spy_col).label("avg_alpha"),
            )
            .select_from(ForwardReturn)
            .join(Event, ForwardReturn.event_id == Event.id)
            .filter(ret_col.isnot(None), spy_col.isnot(None))
            .filter(Event.direction == dir_val)
        )
        if actor_id is not None:
            q = q.filter(Event.actor_id == actor_id)
        if ticker:
            q = q.filter(Event.ticker == ticker.upper().strip())

        row = q.first()
        trades = row.trades if row else 0

        # Win rate: direction-aware
        # Buys win when alpha > 0, sells win when alpha < 0 (short benefits from underperformance)
        if trades > 0:
            if dir_val == "buy":
                win_expr = case((ret_col - spy_col > 0, 1), else_=0)
            else:
                win_expr = case((spy_col - ret_col > 0, 1), else_=0)

            win_q = (
                db.query(func.sum(win_expr).label("wins"))
                .select_from(ForwardReturn)
                .join(Event, ForwardReturn.event_id == Event.id)
                .filter(ret_col.isnot(None), spy_col.isnot(None))
                .filter(Event.direction == dir_val)
            )
            if actor_id is not None:
                win_q = win_q.filter(Event.actor_id == actor_id)
            if ticker:
                win_q = win_q.filter(Event.ticker == ticker.upper().strip())
            wins = win_q.scalar() or 0
            win_rate = wins / trades
        else:
            win_rate = None

        direction_stats[dir_val] = {
            "trades": trades,
            "win_rate": round(win_rate, 4) if win_rate is not None else None,
            "avg_return": round(float(row.avg_return), 6) if row and row.avg_return else None,
            "avg_alpha": round(float(row.avg_alpha), 6) if row and row.avg_alpha else None,
        }

    # ── Top politicians ────────────────────────────────────────────────
    alpha_expr = ret_col - spy_col
    pol_q = (
        db.query(
            Event.actor_id,
            Event.actor_name,
            func.count().label("trade_count"),
            func.avg(alpha_expr).label("avg_alpha"),
        )
        .join(ForwardReturn, Event.id == ForwardReturn.event_id)
        .filter(ret_col.isnot(None), spy_col.isnot(None))
        .group_by(Event.actor_id, Event.actor_name)
        .having(func.count() >= MIN_TRADES_FILTER)
        .order_by(desc("avg_alpha"))
        .limit(10)
    )
    if direction != "all":
        pol_q = pol_q.filter(Event.direction == direction)
    if ticker:
        pol_q = pol_q.filter(Event.ticker == ticker.upper().strip())

    top_politicians = []
    for pol_row in pol_q.all():
        # Compute win rate per politician (direction-aware)
        # For simplicity when direction=="all", treat buys and sells separately
        pol_win_q = (
            db.query(
                func.count().label("total"),
                func.sum(
                    case(
                        (
                            (Event.direction == "buy") & (alpha_expr > 0),
                            1,
                        ),
                        (
                            (Event.direction == "sell") & (spy_col - ret_col > 0),
                            1,
                        ),
                        else_=0,
                    )
                ).label("wins"),
            )
            .select_from(Event)
            .join(ForwardReturn, Event.id == ForwardReturn.event_id)
            .filter(ret_col.isnot(None), spy_col.isnot(None))
            .filter(Event.actor_id == pol_row.actor_id)
        )
        if direction != "all":
            pol_win_q = pol_win_q.filter(Event.direction == direction)
        if ticker:
            pol_win_q = pol_win_q.filter(Event.ticker == ticker.upper().strip())

        wr_row = pol_win_q.first()
        pol_wr = (wr_row.wins / wr_row.total) if wr_row and wr_row.total > 0 else None

        top_politicians.append({
            "actor_id": pol_row.actor_id,
            "name": pol_row.actor_name,
            "trade_count": pol_row.trade_count,
            "win_rate": round(pol_wr, 4) if pol_wr is not None else None,
            "avg_alpha": round(float(pol_row.avg_alpha), 6) if pol_row.avg_alpha else None,
        })

    # ── Distribution stats ─────────────────────────────────────────────
    # Use raw SQL for percentile_cont (PostgreSQL aggregate)
    dist_filters = ["fr.ret_{w}d IS NOT NULL", "fr.spy_ret_{w}d IS NOT NULL"]
    dist_params: dict = {}
    if direction != "all":
        dist_filters.append("e.direction = :dir")
        dist_params["dir"] = direction
    if actor_id is not None:
        dist_filters.append("e.actor_id = :actor_id")
        dist_params["actor_id"] = actor_id
    if ticker:
        dist_filters.append("e.ticker = :ticker")
        dist_params["ticker"] = ticker.upper().strip()

    where_clause = " AND ".join(dist_filters).replace("{w}", str(window))

    dist_sql = text(f"""
        SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY fr.ret_{window}d - fr.spy_ret_{window}d) AS median_alpha,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY fr.ret_{window}d - fr.spy_ret_{window}d) AS p25_alpha,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY fr.ret_{window}d - fr.spy_ret_{window}d) AS p75_alpha,
            MIN(fr.ret_{window}d - fr.spy_ret_{window}d) AS worst_alpha,
            MAX(fr.ret_{window}d - fr.spy_ret_{window}d) AS best_alpha,
            COUNT(*) AS total_with_data
        FROM forward_returns fr
        JOIN events e ON e.id = fr.event_id
        WHERE {where_clause}
    """)
    dist_row = db.execute(dist_sql, dist_params).first()

    distribution = {
        "median_return": round(float(dist_row.median_alpha), 6) if dist_row and dist_row.median_alpha is not None else None,
        "p25_return": round(float(dist_row.p25_alpha), 6) if dist_row and dist_row.p25_alpha is not None else None,
        "p75_return": round(float(dist_row.p75_alpha), 6) if dist_row and dist_row.p75_alpha is not None else None,
        "worst_return": round(float(dist_row.worst_alpha), 6) if dist_row and dist_row.worst_alpha is not None else None,
        "best_return": round(float(dist_row.best_alpha), 6) if dist_row and dist_row.best_alpha is not None else None,
        "total_with_data": dist_row.total_with_data if dist_row else 0,
    }

    # ── Regime stats (SPY volatility-based) ────────────────────────────
    regime_stats = _compute_regime_stats(
        db, ret_col=ret_col, spy_col=spy_col,
        direction=direction, actor_id=actor_id, ticker=ticker,
    )

    return {
        "buys": direction_stats["buy"],
        "sells": direction_stats["sell"],
        "top_politicians": top_politicians,
        "distribution": distribution,
        "regime_stats": regime_stats,
        "window": window,
        "min_trades_filter": MIN_TRADES_FILTER,
    }


def _compute_regime_stats(
    db: Session,
    *,
    ret_col,
    spy_col,
    direction: str,
    actor_id: Optional[int],
    ticker: Optional[str],
) -> Optional[dict]:
    """Classify events into low/high vol regimes using SPY rolling volatility.

    Delegates vol computation to services/regime.py for reuse by Signal Engine.
    """
    from high_finance.services.regime import build_spy_vol_map, compute_median_vol

    date_vol = build_spy_vol_map(db)
    if not date_vol:
        return None

    median_vol = compute_median_vol(date_vol)

    # Load events with returns and classify
    q = (
        db.query(Event, ForwardReturn)
        .join(ForwardReturn, Event.id == ForwardReturn.event_id)
        .filter(ret_col.isnot(None), spy_col.isnot(None))
    )
    if direction != "all":
        q = q.filter(Event.direction == direction)
    if actor_id is not None:
        q = q.filter(Event.actor_id == actor_id)
    if ticker:
        q = q.filter(Event.ticker == ticker.upper().strip())

    low_alphas: list[float] = []
    high_alphas: list[float] = []
    low_wins = 0
    high_wins = 0

    for evt, fr in q.all():
        anchor = fr.anchor_date or evt.event_date
        vol = date_vol.get(anchor)
        if vol is None:
            continue

        ret_val = getattr(fr, ret_col.key)
        spy_val = getattr(fr, spy_col.key)
        alpha = ret_val - spy_val

        # Direction-aware win
        if evt.direction == "buy":
            is_win = alpha > 0
        else:
            is_win = alpha < 0

        if vol <= median_vol:
            low_alphas.append(alpha)
            if is_win:
                low_wins += 1
        else:
            high_alphas.append(alpha)
            if is_win:
                high_wins += 1

    if not low_alphas and not high_alphas:
        return None

    def _regime_dict(alphas: list[float], wins: int) -> dict:
        n = len(alphas)
        return {
            "trades": n,
            "win_rate": round(wins / n, 4) if n > 0 else None,
            "avg_alpha": round(float(np.mean(alphas)), 6) if n > 0 else None,
        }

    return {
        "low_vol": _regime_dict(low_alphas, low_wins),
        "high_vol": _regime_dict(high_alphas, high_wins),
    }
