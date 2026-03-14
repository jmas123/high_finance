"""
Regime Classification Service
==============================
Classifies market regime (low_vol / high_vol) based on SPY rolling volatility.

Extracted from routes/events.py so both the summary endpoint and the Signal
Engine can import cleanly (routes → services → models, never the reverse).
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.price import Price

logger = logging.getLogger(__name__)

VOL_WINDOW = 20  # 20-day rolling std
ANNUALIZE_FACTOR = np.sqrt(252)


def build_spy_vol_map(db: Session) -> Optional[dict[date, float]]:
    """Load SPY prices and build a date → annualized vol lookup.

    Returns None if SPY data is insufficient (< 30 rows).
    Expensive to compute — callers should build once and reuse.
    """
    spy_company = db.query(Company).filter(Company.ticker == "SPY").first()
    if not spy_company:
        return None

    spy_prices = (
        db.query(Price.date, Price.close_price)
        .filter(Price.company_id == spy_company.id)
        .order_by(Price.date)
        .all()
    )
    if len(spy_prices) < 30:
        return None

    # Parse dates (Price.date may be stored as String)
    from datetime import datetime as dt

    dates = [
        dt.strptime(p.date, "%Y-%m-%d").date() if isinstance(p.date, str) else p.date
        for p in spy_prices
    ]
    closes = np.array([p.close_price for p in spy_prices], dtype=np.float64)
    daily_rets = np.diff(closes) / closes[:-1]

    # 20-day rolling volatility (annualized)
    rolling_vol = np.full(len(daily_rets), np.nan)
    for i in range(VOL_WINDOW - 1, len(daily_rets)):
        rolling_vol[i] = np.std(daily_rets[i - VOL_WINDOW + 1 : i + 1]) * ANNUALIZE_FACTOR

    # Date→vol mapping (dates[1:] because daily_rets shifts by 1)
    date_vol: dict[date, float] = {}
    for i, vol in enumerate(rolling_vol):
        if not np.isnan(vol):
            date_vol[dates[i + 1]] = float(vol)

    return date_vol if date_vol else None


def classify_regime(
    event_date: date,
    date_vol: dict[date, float],
    median_vol: float,
) -> Optional[str]:
    """Classify a single event date as 'low_vol' or 'high_vol'.

    Returns None if the date has no vol data.
    """
    vol = date_vol.get(event_date)
    if vol is None:
        return None
    return "low_vol" if vol <= median_vol else "high_vol"


def compute_median_vol(date_vol: dict[date, float]) -> float:
    """Compute median volatility from a prebuilt vol map."""
    return float(np.median(list(date_vol.values())))
