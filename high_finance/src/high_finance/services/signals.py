"""
Signal Discovery & Ranking Engine
===================================
Evaluates predefined trading signals against forward returns data and ranks
them by a modified t-statistic score.

Signals are defined declaratively in SIGNAL_REGISTRY. Each signal specifies
filters (direction, regime, sector, amount) that select a subset of events.
The engine computes alpha stats for each subset, scores them, and applies
statistical corrections.

Design decisions:
- SQL aggregation for simple signals (direction, amount) — fast, single query
- Hybrid SQL+Python for regime signals — vol classification requires numpy
- Bonferroni correction for multiple testing — prevents surfacing noise
- Tiered min-sample: 50 for simple signals, 20 for composites (with warning)
- Coverage % for sector signals — documents bias from NULL company_id joins
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

import numpy as np
from scipy.stats import ttest_1samp
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.event import Event
from high_finance.db.models.forward_return import ForwardReturn
from high_finance.services.regime import build_spy_vol_map, classify_regime, compute_median_vol

logger = logging.getLogger(__name__)


# ── Signal Definitions ─────────────────────────────────────────────────────


@dataclass
class SignalDef:
    """Declarative signal definition."""

    id: str
    label: str
    description: str
    direction: Optional[str] = None  # "buy" | "sell" | None (both)
    regime: Optional[str] = None  # "low_vol" | "high_vol" | None
    sector: Optional[str] = None  # e.g. "Technology"
    amount_min: Optional[float] = None  # min trade amount_min
    is_composite: bool = False  # True if 2+ filters → lower min sample

    @property
    def min_trades(self) -> int:
        return 20 if self.is_composite else 50


SIGNAL_REGISTRY: list[SignalDef] = [
    # ── Direction-only signals ──────────────────────────────────────────
    SignalDef(
        id="buy_all",
        label="All Buys",
        description="All congressional buy transactions",
        direction="buy",
    ),
    SignalDef(
        id="sell_all",
        label="All Sells",
        description="All congressional sell transactions",
        direction="sell",
    ),
    # ── Regime signals ──────────────────────────────────────────────────
    SignalDef(
        id="buy_low_vol",
        label="Buy + Low Vol",
        description="Buys during low-volatility regimes (SPY vol below median)",
        direction="buy",
        regime="low_vol",
        is_composite=True,
    ),
    SignalDef(
        id="buy_high_vol",
        label="Buy + High Vol",
        description="Buys during high-volatility regimes",
        direction="buy",
        regime="high_vol",
        is_composite=True,
    ),
    SignalDef(
        id="sell_low_vol",
        label="Sell + Low Vol",
        description="Sells during low-volatility regimes",
        direction="sell",
        regime="low_vol",
        is_composite=True,
    ),
    SignalDef(
        id="sell_high_vol",
        label="Sell + High Vol",
        description="Sells during high-volatility regimes",
        direction="sell",
        regime="high_vol",
        is_composite=True,
    ),
    # ── Amount signals ──────────────────────────────────────────────────
    SignalDef(
        id="buy_large",
        label="Large Buys ($100K+)",
        description="Buy transactions with amount_min >= $100,000",
        direction="buy",
        amount_min=100_000,
        is_composite=True,
    ),
    SignalDef(
        id="sell_large",
        label="Large Sells ($100K+)",
        description="Sell transactions with amount_min >= $100,000",
        direction="sell",
        amount_min=100_000,
        is_composite=True,
    ),
    # ── Sector signals ──────────────────────────────────────────────────
    SignalDef(
        id="buy_tech",
        label="Buy Tech",
        description="Buys in Technology sector companies",
        direction="buy",
        sector="Technology",
        is_composite=True,
    ),
    SignalDef(
        id="buy_healthcare",
        label="Buy Healthcare",
        description="Buys in Healthcare sector companies",
        direction="buy",
        sector="Healthcare",
        is_composite=True,
    ),
    SignalDef(
        id="buy_financials",
        label="Buy Financials",
        description="Buys in Financial Services sector companies",
        direction="buy",
        sector="Financial Services",
        is_composite=True,
    ),
    SignalDef(
        id="buy_energy",
        label="Buy Energy",
        description="Buys in Energy sector companies",
        direction="buy",
        sector="Energy",
        is_composite=True,
    ),
]


# ── Result Types ───────────────────────────────────────────────────────────


@dataclass
class SignalResult:
    """Evaluation result for a single signal."""

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
    significance: str  # "significant" | "marginal" | "not_significant"
    coverage_pct: Optional[float] = None  # for sector signals
    low_sample: bool = False

    def to_dict(self) -> dict:
        return {
            "signal_id": self.signal_id,
            "label": self.label,
            "description": self.description,
            "trades": self.trades,
            "avg_alpha": round(self.avg_alpha, 6),
            "std_alpha": round(self.std_alpha, 6),
            "win_rate": round(self.win_rate, 4),
            "score": round(self.score, 4),
            "p_value": round(self.p_value, 6),
            "adjusted_p": round(self.adjusted_p, 6),
            "significance": self.significance,
            "coverage_pct": round(self.coverage_pct, 4) if self.coverage_pct is not None else None,
            "low_sample": self.low_sample,
        }


# ── Engine ─────────────────────────────────────────────────────────────────


class SignalEngine:
    """Evaluates all registered signals and returns ranked results."""

    def __init__(self, db: Session, window: int = 30, since_date: Optional[date] = None):
        self.db = db
        self.window = window
        self.since_date = since_date or (date.today() - timedelta(days=730))  # Default: 2 years

        # Column references for the chosen window
        self.ret_col = getattr(ForwardReturn, f"ret_{window}d")
        self.spy_col = getattr(ForwardReturn, f"spy_ret_{window}d")

        # Lazy-loaded regime data (only built if a regime signal exists)
        self._date_vol: Optional[dict[date, float]] = None
        self._median_vol: Optional[float] = None

    def _ensure_regime_data(self) -> bool:
        """Build SPY vol map if not already loaded. Returns False if unavailable."""
        if self._date_vol is not None:
            return True
        self._date_vol = build_spy_vol_map(self.db)
        if self._date_vol is None:
            return False
        self._median_vol = compute_median_vol(self._date_vol)
        return True

    def evaluate_all(self) -> list[dict]:
        """Evaluate all signals, score, apply corrections, and return ranked."""
        results: list[SignalResult] = []
        n_signals = len(SIGNAL_REGISTRY)

        for sig in SIGNAL_REGISTRY:
            result = self._evaluate_signal(sig)
            if result is None:
                continue
            results.append(result)

        # Apply Bonferroni correction
        for r in results:
            r.adjusted_p = min(r.p_value * n_signals, 1.0)
            if r.adjusted_p < 0.05:
                r.significance = "significant"
            elif r.adjusted_p < 0.15:
                r.significance = "marginal"
            else:
                r.significance = "not_significant"

        # Sort by score descending
        results.sort(key=lambda r: r.score, reverse=True)
        return [r.to_dict() for r in results]

    def _evaluate_signal(self, sig: SignalDef) -> Optional[SignalResult]:
        """Evaluate a single signal definition."""
        # Regime signals need hybrid approach
        if sig.regime is not None:
            return self._evaluate_regime_signal(sig)

        # Sector signals need company JOIN
        if sig.sector is not None:
            return self._evaluate_sector_signal(sig)

        # Pure SQL signals (direction, amount)
        return self._evaluate_sql_signal(sig)

    def _evaluate_sql_signal(self, sig: SignalDef) -> Optional[SignalResult]:
        """Evaluate direction/amount signals using pure SQL aggregation."""
        # Load all alphas for the signal's filters
        alphas = self._load_alphas(sig)
        if len(alphas) < sig.min_trades:
            return None

        return self._score_alphas(sig, alphas)

    def _evaluate_sector_signal(self, sig: SignalDef) -> Optional[SignalResult]:
        """Evaluate sector signals with company JOIN + coverage tracking."""
        # Count total eligible events (without sector filter) for coverage
        total_eligible = self._count_eligible(sig.direction, sig.amount_min)

        # Query with sector JOIN
        q = (
            self.db.query(self.ret_col - self.spy_col)
            .select_from(ForwardReturn)
            .join(Event, ForwardReturn.event_id == Event.id)
            .join(Company, Event.company_id == Company.id)  # INNER JOIN — drops NULL company_id
            .filter(
                self.ret_col.isnot(None),
                self.spy_col.isnot(None),
                Event.event_date >= self.since_date,
            )
        )
        if sig.direction:
            q = q.filter(Event.direction == sig.direction)
        if sig.amount_min is not None:
            q = q.filter(Event.amount_min >= sig.amount_min)
        if sig.sector:
            q = q.filter(Company.sector == sig.sector)

        alphas = [float(row[0]) for row in q.all()]
        if len(alphas) < sig.min_trades:
            return None

        result = self._score_alphas(sig, alphas)
        if result is None:
            return None

        # Compute coverage: what % of eligible events had company_id matched
        result.coverage_pct = len(alphas) / total_eligible if total_eligible > 0 else 0.0
        return result

    def _evaluate_regime_signal(self, sig: SignalDef) -> Optional[SignalResult]:
        """Evaluate regime signals using hybrid SQL + Python vol classification."""
        if not self._ensure_regime_data():
            return None

        assert self._date_vol is not None
        assert self._median_vol is not None

        # Load events with returns
        q = (
            self.db.query(Event, ForwardReturn)
            .join(ForwardReturn, Event.id == ForwardReturn.event_id)
            .filter(
                self.ret_col.isnot(None),
                self.spy_col.isnot(None),
                Event.event_date >= self.since_date,
            )
        )
        if sig.direction:
            q = q.filter(Event.direction == sig.direction)
        if sig.amount_min is not None:
            q = q.filter(Event.amount_min >= sig.amount_min)

        alphas: list[float] = []
        for evt, fr in q.all():
            anchor = fr.anchor_date or evt.event_date
            regime = classify_regime(anchor, self._date_vol, self._median_vol)
            if regime != sig.regime:
                continue

            ret_val = getattr(fr, self.ret_col.key)
            spy_val = getattr(fr, self.spy_col.key)
            alphas.append(ret_val - spy_val)

        if len(alphas) < sig.min_trades:
            return None

        return self._score_alphas(sig, alphas)

    def _load_alphas(self, sig: SignalDef) -> list[float]:
        """Load alpha values (ret - spy_ret) for a signal's filters."""
        q = (
            self.db.query(self.ret_col - self.spy_col)
            .select_from(ForwardReturn)
            .join(Event, ForwardReturn.event_id == Event.id)
            .filter(
                self.ret_col.isnot(None),
                self.spy_col.isnot(None),
                Event.event_date >= self.since_date,
            )
        )
        if sig.direction:
            q = q.filter(Event.direction == sig.direction)
        if sig.amount_min is not None:
            q = q.filter(Event.amount_min >= sig.amount_min)

        return [float(row[0]) for row in q.all()]

    def _count_eligible(self, direction: Optional[str], amount_min: Optional[float]) -> int:
        """Count total events matching direction/amount filters (ignoring sector)."""
        q = (
            self.db.query(func.count())
            .select_from(ForwardReturn)
            .join(Event, ForwardReturn.event_id == Event.id)
            .filter(
                self.ret_col.isnot(None),
                self.spy_col.isnot(None),
                Event.event_date >= self.since_date,
            )
        )
        if direction:
            q = q.filter(Event.direction == direction)
        if amount_min is not None:
            q = q.filter(Event.amount_min >= amount_min)
        return q.scalar() or 0

    def _score_alphas(self, sig: SignalDef, alphas: list[float]) -> Optional[SignalResult]:
        """Compute score, p-value, and win stats from a list of alpha values."""
        n = len(alphas)
        if n == 0:
            return None

        arr = np.array(alphas, dtype=np.float64)
        avg_alpha = float(np.mean(arr))
        std_alpha = float(np.std(arr, ddof=1)) if n > 1 else 0.0

        # Direction-aware win rate:
        # For buys: alpha > 0 is a win
        # For sells: alpha < 0 is a win (stock underperformed = sell was correct)
        # For mixed: use alpha > 0
        if sig.direction == "sell":
            wins = int(np.sum(arr < 0))
        else:
            wins = int(np.sum(arr > 0))
        win_rate = wins / n

        # Score = avg_alpha * sqrt(n) / max(std_alpha, epsilon)
        # This is essentially the t-statistic — measures signal strength
        score = avg_alpha * math.sqrt(n) / max(std_alpha, 1e-6)

        # One-sample t-test: is avg_alpha significantly different from 0?
        if n > 1 and std_alpha > 1e-6:
            _, p_value = ttest_1samp(arr, 0)
            p_value = float(p_value)
        else:
            p_value = 1.0  # Can't compute → not significant

        low_sample = sig.is_composite and n < 50

        return SignalResult(
            signal_id=sig.id,
            label=sig.label,
            description=sig.description,
            trades=n,
            avg_alpha=avg_alpha,
            std_alpha=std_alpha,
            win_rate=win_rate,
            score=score,
            p_value=p_value,
            adjusted_p=p_value,  # Will be corrected in evaluate_all()
            significance="not_significant",  # Will be set after correction
            low_sample=low_sample,
        )
