from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.db.models.price import Price


def _parse_price_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _closest_close_on_or_after(db: Session, company_id: int, target: date) -> Optional[float]:
    """
    Tier-1 simple approach (works with Price.date as a string).
    Later optimization: make Price.date a Date column and query in SQL.
    """
    rows = db.query(Price).filter(Price.company_id == company_id).all()

    best_d: Optional[date] = None
    best_close: Optional[float] = None

    for p in rows:
        d = _parse_price_date(p.date)
        if not d or p.close_price is None:
            continue
        if d >= target and (best_d is None or d < best_d):
            best_d = d
            best_close = float(p.close_price)

    return best_close


def politician_rolling_performance(
    db: Session,
    politician_id: int,
    window_days: int = 30,
    n: int = 10,
):
    """
    Rolling last N trades:
    - entry = close on/after transaction_date (fallback disclosure_date)
    - exit = close on/after entry + window_days
    - return = (exit/entry - 1)
    Not per-trade returns; just aggregate.
    """
    trades = (
        db.query(PoliticianTrade)
        .filter(PoliticianTrade.politician_id == politician_id)
        .order_by(desc(PoliticianTrade.disclosure_date))
        .limit(n * 4)  # oversample due to missing company_id / missing prices
        .all()
    )

    returns: list[float] = []

    for t in trades:
        if not t.company_id:
            continue

        entry_dt = t.transaction_date or t.disclosure_date
        if not entry_dt:
            continue

        entry_close = _closest_close_on_or_after(db, t.company_id, entry_dt)
        exit_close = _closest_close_on_or_after(db, t.company_id, entry_dt + timedelta(days=window_days))

        if entry_close is None or exit_close is None or entry_close == 0:
            continue

        returns.append((exit_close / entry_close) - 1.0)

        if len(returns) >= n:
            break

    if not returns:
        return {
            "window_days": window_days,
            "n": n,
            "num_used": 0,
            "avg_return_pct": None,
            "hit_rate": None,
        }

    avg = sum(returns) / len(returns)
    hit = sum(1 for r in returns if r > 0) / len(returns)

    return {
        "window_days": window_days,
        "n": n,
        "num_used": len(returns),
        "avg_return_pct": round(avg * 100, 2),
        "hit_rate": round(hit, 3),
    }


def calculate_politician_grade(avg_return_pct: Optional[float], hit_rate: Optional[float]) -> Optional[str]:
    """
    Calculate a letter grade for a politician based on their trading performance.

    Grade criteria:
    - A+: avg_return > 5% and hit_rate > 0.70
    - A:  avg_return > 3% and hit_rate > 0.60
    - B:  avg_return > 1% and hit_rate > 0.50
    - C:  avg_return > 0% and hit_rate > 0.45
    - D:  avg_return > -2%
    - F:  avg_return <= -2%
    """
    if avg_return_pct is None or hit_rate is None:
        return None

    if avg_return_pct > 5 and hit_rate > 0.70:
        return "A+"
    elif avg_return_pct > 3 and hit_rate > 0.60:
        return "A"
    elif avg_return_pct > 1 and hit_rate > 0.50:
        return "B"
    elif avg_return_pct > 0 and hit_rate > 0.45:
        return "C"
    elif avg_return_pct > -2:
        return "D"
    else:
        return "F"


def get_politician_grade(db: Session, politician_id: int) -> Optional[str]:
    """
    Get the grade for a politician based on their rolling performance.
    Uses 30-day window with last 10 trades as default.
    """
    perf = politician_rolling_performance(db, politician_id, window_days=30, n=10)
    return calculate_politician_grade(perf.get("avg_return_pct"), perf.get("hit_rate"))
