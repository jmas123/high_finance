"""
Politician Trade Backtesting Engine
====================================
Answers: "If you copied politician X's Buy trades with a 3-day delay
after public disclosure, what would your returns look like?"

Key design decisions:
- Uses disclosure_date + delay_days (not transaction_date) because that's
  the earliest a retail copycat could actually act.
- Only Buy trades (Sells are ambiguous - rebalancing vs bearish signal).
- Cohort-based compounding: multiple lots on the same disclosure date are
  deduplicated by (company_id, disclosure_date), averaged into a single
  equal-weight cohort return, and compounded once per disclosure date.
  This prevents duplicate lots (e.g. 10 buys of ADBE on the same day)
  from generating 10 separate compounding events.
- Annualization guarded for periods < 90 days (show raw return only).
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func, asc
from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.services.politician_performance import (
    _closest_close_on_or_after,
    calculate_politician_grade,
)
from high_finance.utils.safe_math import safe_return, safe_round

logger = logging.getLogger(__name__)


# ── SPY Helpers ──────────────────────────────────────────────────────────────


def _get_spy_company_id(db: Session) -> Optional[int]:
    """Look up the company_id for SPY in the companies table."""
    row = db.query(Company.id).filter(Company.ticker == "SPY").first()
    return row[0] if row else None


def _spy_return_over_period(
    db: Session, start: date, end: date
) -> Optional[float]:
    """
    SPY buy-and-hold return over a date range.
    Returns decimal (e.g. 0.12 = 12%).  None if no data.
    """
    spy_id = _get_spy_company_id(db)
    if spy_id is None:
        return None

    entry = _closest_close_on_or_after(db, spy_id, start)
    exit_ = _closest_close_on_or_after(db, spy_id, end)

    if entry is None or exit_ is None or entry <= 0:
        return None

    return (exit_ / entry) - 1.0


# ── Single Politician Backtest ───────────────────────────────────────────────


def run_backtest_sync(
    db: Session,
    politician_id: int,
    delay_days: int = 3,
    hold_days: int = 30,
    starting_capital: float = 10_000.0,
    since_year: Optional[int] = None,
) -> dict:
    """
    Backtest a single politician's Buy trades with cohort-based compounding.

    Steps:
    1. Fetch all Buy trades ordered by disclosure_date ASC
    2. Deduplicate: key by (company_id, disclosure_date) so multiple lots
       of the same stock on the same day → one position
    3. Group positions into cohorts by disclosure_date
    4. For each cohort: average the position returns (equal-weight),
       compound once into the running portfolio value
    5. Each position still appears in trade_results with its own return_pct,
       plus a cohort_return_pct showing the blended return that was compounded

    Returns dict with: summary, equity_curve, trades
    """
    # Fetch politician info
    politician = db.query(Politician).filter(Politician.id == politician_id).first()
    if not politician:
        return {"error": f"Politician {politician_id} not found"}

    # Fetch Buy trades with company_id, ordered chronologically
    q = (
        db.query(PoliticianTrade)
        .filter(
            PoliticianTrade.politician_id == politician_id,
            PoliticianTrade.transaction_type.ilike("%purchase%"),
            PoliticianTrade.company_id.isnot(None),
        )
    )
    if since_year:
        q = q.filter(PoliticianTrade.disclosure_date >= date(since_year, 1, 1))
    trades = q.order_by(asc(PoliticianTrade.disclosure_date)).all()

    num_trades = len(trades)

    # ── Step 1: Deduplicate into positions ───────────────────────────────
    # Key: (company_id, disclosure_date) → first trade row (for metadata)
    # Multiple lots of ADBE on 2024-01-15 → one position
    position_map: dict[tuple[int, date], PoliticianTrade] = {}
    for t in trades:
        if not t.disclosure_date or not t.company_id:
            continue
        key = (t.company_id, t.disclosure_date)
        if key not in position_map:
            position_map[key] = t

    # ── Step 2: Group positions into cohorts by disclosure_date ──────────
    cohorts: dict[date, list[tuple[tuple[int, date], PoliticianTrade]]] = defaultdict(list)
    for key, t in position_map.items():
        cohorts[key[1]].append((key, t))

    sorted_cohort_dates = sorted(cohorts.keys())

    num_positions = len(position_map)
    num_cohorts = len(sorted_cohort_dates)

    # ── Step 3: Process cohorts ──────────────────────────────────────────
    trade_results: list[dict] = []
    portfolio_value = starting_capital
    equity_curve: list[dict] = []
    cohort_returns_list: list[float] = []  # one per cohort (for win rate / Sharpe)
    all_position_returns: list[float] = []  # flat list of every position return
    skip_reasons = {"no_entry_price": 0, "no_exit_price": 0, "invalid_return": 0}

    spy_id = _get_spy_company_id(db)
    spy_start_price: Optional[float] = None
    first_entry_date: Optional[date] = None
    last_exit_date: Optional[date] = None
    num_positions_priced = 0
    # Track active cohort exit dates for concurrency-aware compounding.
    # With hold_days=90 and disclosures every few weeks, multiple cohorts
    # overlap in time. Without this, we'd compound serially what happens
    # concurrently — inflating returns by N× (where N ≈ average concurrency).
    active_cohort_exits: list[date] = []

    for disc_date in sorted_cohort_dates:
        positions_in_cohort = cohorts[disc_date]
        position_returns: list[float] = []  # decimal returns for this cohort
        cohort_trade_results: list[dict] = []

        entry_date = disc_date + timedelta(days=delay_days)
        exit_date = entry_date + timedelta(days=hold_days)

        for (_cid, _ddate), t in positions_in_cohort:
            entry_price = _closest_close_on_or_after(db, t.company_id, entry_date)
            if entry_price is None:
                skip_reasons["no_entry_price"] += 1
                continue

            exit_price = _closest_close_on_or_after(db, t.company_id, exit_date)
            if exit_price is None:
                skip_reasons["no_exit_price"] += 1
                continue

            ret_pct = safe_return(entry_price, exit_price, as_percentage=True)
            if ret_pct is None:
                skip_reasons["invalid_return"] += 1
                continue

            ret_decimal = ret_pct / 100.0
            position_returns.append(ret_decimal)
            all_position_returns.append(ret_decimal)
            num_positions_priced += 1

            # Get ticker for display
            ticker_display = t.ticker_raw or "?"
            if not t.ticker_raw and t.company:
                ticker_display = t.company.ticker or "?"

            cohort_trade_results.append({
                "ticker": ticker_display,
                "transaction_type": t.transaction_type or "Purchase",
                "disclosure_date": disc_date.isoformat(),
                "entry_date": entry_date.isoformat(),
                "exit_date": exit_date.isoformat(),
                "entry_price": round(entry_price, 2),
                "exit_price": round(exit_price, 2),
                "return_pct": round(ret_pct, 2),
                "hold_days_actual": (exit_date - entry_date).days,
                "cohort_return_pct": None,  # filled below
            })

        # Skip cohort if no positions had valid prices
        if not position_returns:
            continue

        # Equal-weight average return for this cohort
        cohort_return = sum(position_returns) / len(position_returns)
        cohort_returns_list.append(cohort_return)

        # Stamp cohort_return_pct on each trade result in this cohort
        cohort_return_pct_rounded = round(cohort_return * 100, 2)
        for tr in cohort_trade_results:
            tr["cohort_return_pct"] = cohort_return_pct_rounded
        trade_results.extend(cohort_trade_results)

        # Concurrency-aware compounding:
        # Prune cohorts that exited before this entry date, then add this one.
        # If N cohorts overlap, each gets 1/N of the portfolio.
        active_cohort_exits = [ed for ed in active_cohort_exits if ed > entry_date]
        active_cohort_exits.append(exit_date)
        num_concurrent = len(active_cohort_exits)
        allocation_fraction = 1.0 / num_concurrent
        portfolio_value *= (1 + cohort_return * allocation_fraction)

        # Track dates
        if first_entry_date is None:
            first_entry_date = entry_date
            if spy_id:
                spy_start_price = _closest_close_on_or_after(db, spy_id, entry_date)
        last_exit_date = exit_date

        # Build equity curve point (one per cohort)
        spy_value_now = starting_capital
        if spy_id and spy_start_price and spy_start_price > 0:
            spy_now = _closest_close_on_or_after(db, spy_id, exit_date)
            if spy_now:
                spy_value_now = starting_capital * (spy_now / spy_start_price)

        equity_curve.append({
            "date": exit_date.isoformat(),
            "portfolio_value": round(portfolio_value, 2),
            "spy_value": round(spy_value_now, 2),
        })

    # ── Summary stats ────────────────────────────────────────────────────
    total_return_pct = ((portfolio_value / starting_capital) - 1) * 100 if starting_capital > 0 else 0.0

    # Annualized return (only if >= 90 days of history)
    annualized = None
    if first_entry_date and last_exit_date:
        total_days = (last_exit_date - first_entry_date).days
        if total_days >= 90:
            total_return_decimal = total_return_pct / 100.0
            if total_return_decimal > -1:
                annualized = ((1 + total_return_decimal) ** (365.0 / total_days) - 1) * 100

    # Win rate (computed from cohort returns, not individual positions)
    wins = sum(1 for r in cohort_returns_list if r > 0)
    win_rate = (wins / len(cohort_returns_list) * 100) if cohort_returns_list else 0.0

    # Max drawdown (from equity curve)
    max_drawdown = 0.0
    peak = starting_capital
    for pt in equity_curve:
        val = pt["portfolio_value"]
        if val > peak:
            peak = val
        dd = (peak - val) / peak * 100 if peak > 0 else 0
        if dd > max_drawdown:
            max_drawdown = dd

    # Sharpe ratio (annualized, based on per-cohort returns)
    sharpe = None
    if len(cohort_returns_list) >= 10:
        mean_r = sum(cohort_returns_list) / len(cohort_returns_list)
        var_r = sum((r - mean_r) ** 2 for r in cohort_returns_list) / len(cohort_returns_list)
        std_r = math.sqrt(var_r) if var_r > 0 else 0
        if std_r > 0:
            # Annualize: assume hold_days per cohort
            cohorts_per_year = 252 / hold_days if hold_days > 0 else 1
            sharpe = (mean_r / std_r) * math.sqrt(cohorts_per_year)
            sharpe = round(sharpe, 2)

    # SPY return over same period
    spy_total_return_pct = 0.0
    spy_annualized = None
    if first_entry_date and last_exit_date:
        spy_ret = _spy_return_over_period(db, first_entry_date, last_exit_date)
        if spy_ret is not None:
            spy_total_return_pct = round(spy_ret * 100, 2)
            total_days = (last_exit_date - first_entry_date).days
            if total_days >= 90 and spy_ret > -1:
                spy_annualized = round(
                    ((1 + spy_ret) ** (365.0 / total_days) - 1) * 100, 2
                )

    alpha_pct = round(total_return_pct - spy_total_return_pct, 2)

    # Grade (computed from cohort returns)
    avg_return_pct_per_cohort = (
        (sum(cohort_returns_list) / len(cohort_returns_list) * 100) if cohort_returns_list else None
    )
    grade = calculate_politician_grade(
        avg_return_pct_per_cohort, win_rate / 100 if win_rate > 0 else None
    )

    # Best / worst trade (still per individual position)
    best_trade = None
    worst_trade = None
    if trade_results:
        best_trade = max(trade_results, key=lambda t: t["return_pct"])
        worst_trade = min(trade_results, key=lambda t: t["return_pct"])

    summary = {
        "politician_id": politician.id,
        "politician_name": politician.name,
        "party": politician.party,
        "chamber": politician.chamber,
        "state": politician.state,
        "delay_days": delay_days,
        "hold_days": hold_days,
        "num_trades": num_trades,
        "num_positions": num_positions,
        "num_cohorts": num_cohorts,
        "num_trades_priced": num_positions_priced,
        "total_return_pct": round(total_return_pct, 2),
        "avg_return_per_trade_pct": round(
            sum(all_position_returns) / len(all_position_returns) * 100, 2
        ) if all_position_returns else 0.0,
        "annualized_return_pct": safe_round(annualized, 2),
        "win_rate": round(win_rate, 1),
        "max_drawdown_pct": round(max_drawdown, 2),
        "sharpe_ratio": sharpe,
        "spy_total_return_pct": spy_total_return_pct,
        "spy_annualized_return_pct": spy_annualized,
        "alpha_pct": alpha_pct,
        "best_trade": best_trade,
        "worst_trade": worst_trade,
        "first_trade_date": first_entry_date.isoformat() if first_entry_date else None,
        "last_trade_date": last_exit_date.isoformat() if last_exit_date else None,
        "grade": grade,
        "skip_reasons": skip_reasons,
    }

    return {
        "summary": summary,
        "equity_curve": equity_curve,
        "trades": trade_results,
    }


# ── Leaderboard ──────────────────────────────────────────────────────────────


def backtest_all_politicians_sync(
    db: Session,
    delay_days: int = 3,
    hold_days: int = 30,
    min_trades: int = 5,
    chamber: Optional[str] = None,
    party: Optional[str] = None,
    since_year: Optional[int] = None,
) -> list[dict]:
    """
    Run backtests for all politicians with sufficient trades.
    Returns list of summary dicts sorted by annualized_return DESC.
    """
    # Find politician_ids with >= min_trades Buy trades that have company_id
    base_filters = [
        PoliticianTrade.transaction_type.ilike("%purchase%"),
        PoliticianTrade.company_id.isnot(None),
    ]
    if since_year:
        base_filters.append(
            PoliticianTrade.disclosure_date >= date(since_year, 1, 1)
        )

    query = (
        db.query(
            PoliticianTrade.politician_id,
            func.count(PoliticianTrade.id).label("trade_count"),
        )
        .filter(*base_filters)
        .group_by(PoliticianTrade.politician_id)
        .having(func.count(PoliticianTrade.id) >= min_trades)
    )

    # Optional chamber/party filter on the politician table
    if chamber or party:
        query = query.join(
            Politician, PoliticianTrade.politician_id == Politician.id
        )
        if chamber:
            query = query.filter(Politician.chamber.ilike(f"%{chamber}%"))
        if party:
            query = query.filter(Politician.party.ilike(f"%{party}%"))

    candidate_rows = query.all()

    results = []
    for row in candidate_rows:
        pid = row[0]
        try:
            bt = run_backtest_sync(db, pid, delay_days, hold_days, since_year=since_year)
            if "error" in bt:
                continue
            summary = bt["summary"]
            # Only include if >= 3 priced trades
            if summary.get("num_trades_priced", 0) < 3:
                continue
            results.append(summary)
        except Exception as e:
            logger.warning("Backtest failed for politician %d: %s", pid, e)
            continue

    # Sort by annualized return DESC (use total_return as fallback)
    results.sort(
        key=lambda s: s.get("annualized_return_pct") if s.get("annualized_return_pct") is not None else s.get("total_return_pct", 0),
        reverse=True,
    )

    return results
