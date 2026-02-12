import asyncio
import logging

import yfinance as yf
from datetime import timedelta
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd

logger = logging.getLogger(__name__)

from high_finance.core.cache import get_or_compute, fundamentals_ttl
from high_finance.services.yf_cache import get_yf_info

def _to_naive_ts(ts: pd.Timestamp) -> pd.Timestamp:
    """Convert timestamp to tz-naive (safe for comparing to yfinance price index)."""
    if isinstance(ts, pd.Timestamp) and ts.tz is not None:
        return ts.tz_convert(None)
    return ts

def _safe_float(x) -> Optional[float]:
    return float(x) if pd.notna(x) else None

def _round_or_none(x: Optional[float], ndigits: int = 2) -> Optional[float]:
    return round(x, ndigits) if x is not None else None

def _get_nearest_future_row(df: pd.DataFrame, now: pd.Timestamp) -> Optional[Tuple[pd.Timestamp, pd.Series]]:
    if df is None or df.empty:
        return None
    idx = df.index
    # df.index can be tz-aware; make now match if needed
    if isinstance(idx, pd.DatetimeIndex) and idx.tz is not None and now.tz is None:
        now = now.tz_localize(idx.tz)
    future = df[df.index > now].sort_index()
    if future.empty:
        return None
    ts = future.index[0]  # nearest upcoming
    return ts, future.loc[ts]

def _get_price_moves_around_event(
    history: pd.DataFrame,
    event_dt: pd.Timestamp,
    days_after: int = 5,
) -> Tuple[Optional[float], Optional[float]]:
    """
    Robust 'close-to-close' around event date using trading days.
    - pre_close: last close strictly before event trading day
    - post_close_1d: first close on/after event trading day
    - post_close_5d: 5th trading close on/after event trading day
    This avoids calendar-day errors. If event is AMC vs BMO unknown, this is a safe fallback.
    """
    if history is None or history.empty:
        return None, None
    if "Close" not in history.columns:
        return None, None

    hist = history.copy()

    # yfinance history index is usually tz-naive; normalize everything to naive + date
    idx = hist.index
    if isinstance(idx, pd.DatetimeIndex):
        idx_naive = idx.tz_convert(None) if idx.tz is not None else idx
        hist.index = idx_naive
    else:
        return None, None

    event_dt = _to_naive_ts(event_dt)
    event_date = event_dt.date()

    # Split by trading days relative to event date
    before = hist[hist.index.date < event_date]
    after = hist[hist.index.date >= event_date]

    if before.empty or after.empty:
        return None, None

    pre_close = float(before["Close"].iloc[-1])

    # 1D: first trading close on/after event_date
    post1_close = float(after["Close"].iloc[0])
    one_day = ((post1_close - pre_close) / pre_close) * 100 if pre_close != 0 else None

    # 5D: 5th trading close on/after event_date (index 4)
    five_day = None
    if len(after) >= 5:
        post5_close = float(after["Close"].iloc[4])
        five_day = ((post5_close - pre_close) / pre_close) * 100 if pre_close != 0 else None

    return one_day, five_day


def _fetch_earnings_calendar_sync(ticker: str, info: dict) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool.
    Accepts pre-fetched info dict to avoid duplicate .info HTTP call.
    Still needs yf.Ticker() for .earnings_dates.
    """
    stock = yf.Ticker(ticker)

    result: Dict[str, Any] = {
        "ticker": ticker,
        "next_earnings": None,
        "earnings_history": [],
        "estimates": None,
        "setup": {
            "eps_est_7d_change_pct": None,
            "eps_est_30d_change_pct": None,
            "implied_move_pct": None,
        },
    }

    try:
        earnings_dates = stock.earnings_dates
        if earnings_dates is not None and not earnings_dates.empty:
            now = pd.Timestamp.now(tz=earnings_dates.index.tz) if getattr(earnings_dates.index, "tz", None) else pd.Timestamp.now()

            nearest = _get_nearest_future_row(earnings_dates, now)
            if nearest:
                next_dt, next_row = nearest
                result["next_earnings"] = {
                    "date": _to_naive_ts(next_dt).strftime("%Y-%m-%d"),
                    "time": _to_naive_ts(next_dt).strftime("%H:%M") if _to_naive_ts(next_dt).hour != 0 else "TBD",
                    "eps_estimate": _safe_float(next_row.get("EPS Estimate")),
                }

            past = earnings_dates[earnings_dates.index <= now].sort_index(ascending=False).head(12)
            for dt, row in past.iterrows():
                eps_est = _safe_float(row.get("EPS Estimate"))
                eps_act = _safe_float(row.get("Reported EPS"))

                surprise = None
                surprise_pct = None
                if eps_est is not None and eps_act is not None and eps_est != 0:
                    surprise = eps_act - eps_est
                    surprise_pct = (surprise / abs(eps_est)) * 100

                result["earnings_history"].append(
                    {
                        "date": _to_naive_ts(dt).strftime("%Y-%m-%d"),
                        "eps_estimate": eps_est,
                        "eps_actual": eps_act,
                        "surprise": _round_or_none(surprise, 4),
                        "surprise_pct": _round_or_none(surprise_pct, 2),
                    }
                )
    except Exception:
        logger.exception("Error getting earnings calendar for %s", ticker)

    try:
        result["estimates"] = {
            "current_eps_estimate": info.get("forwardEps"),
            "current_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "earnings_growth": info.get("earningsGrowth"),
            "revenue_growth": info.get("revenueGrowth"),
        }
    except Exception:
        logger.exception("Error getting estimates for %s", ticker)

    return result


async def get_earnings_calendar(ticker: str) -> Dict[str, Any]:
    cache_key = f"hf:earnings:{ticker}"

    async def _compute():
        info = await get_yf_info(ticker)
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_earnings_calendar_sync, ticker, info),
            timeout=15,
        )

    return await get_or_compute(cache_key, fundamentals_ttl(), _compute)


def _fetch_earnings_history_with_moves_sync(ticker: str) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    try:
        earnings_dates = stock.earnings_dates
        if earnings_dates is None or earnings_dates.empty:
            return []

        history = stock.history(period="2y", auto_adjust=False)
        if history is None or history.empty:
            return []

        now = pd.Timestamp.now(tz=earnings_dates.index.tz) if getattr(earnings_dates.index, "tz", None) else pd.Timestamp.now()
        past = earnings_dates[earnings_dates.index <= now].sort_index(ascending=False).head(8)

        out: List[Dict[str, Any]] = []

        for dt, row in past.iterrows():
            eps_est = _safe_float(row.get("EPS Estimate"))
            eps_act = _safe_float(row.get("Reported EPS"))

            surprise_pct = None
            beat = None
            if eps_est is not None and eps_act is not None and eps_est != 0:
                surprise_pct = ((eps_act - eps_est) / abs(eps_est)) * 100
                beat = eps_act > eps_est

            one_day_move, five_day_move = _get_price_moves_around_event(history, dt, days_after=5)

            q = ((pd.Timestamp(dt).month - 1) // 3) + 1
            year = pd.Timestamp(dt).year

            out.append(
                {
                    "date": _to_naive_ts(pd.Timestamp(dt)).strftime("%Y-%m-%d"),
                    "quarter": f"Q{q} {year}",
                    "eps_estimate": eps_est,
                    "eps_actual": eps_act,
                    "surprise_pct": _round_or_none(surprise_pct, 2),
                    "beat": beat,
                    "one_day_move": _round_or_none(one_day_move, 2),
                    "five_day_move": _round_or_none(five_day_move, 2),
                }
            )

        return out

    except Exception:
        logger.exception("Error getting earnings history for %s", ticker)
        return []


async def get_earnings_history_with_moves(ticker: str) -> List[Dict[str, Any]]:
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_earnings_history_with_moves_sync, ticker),
        timeout=15,
    )


def _fetch_upcoming_earnings_sync(tickers: List[str], days_ahead: int = 14) -> List[Dict[str, Any]]:
    """Blocking yfinance calls — runs in thread pool."""
    results: List[Dict[str, Any]] = []

    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            earnings_dates = stock.earnings_dates
            if earnings_dates is None or earnings_dates.empty:
                continue

            now = pd.Timestamp.now(tz=earnings_dates.index.tz) if getattr(earnings_dates.index, "tz", None) else pd.Timestamp.now()
            cutoff = now + pd.Timedelta(days=days_ahead)

            future = earnings_dates[(earnings_dates.index > now) & (earnings_dates.index <= cutoff)].sort_index()
            if future.empty:
                continue

            next_dt = future.index[0]
            row = future.loc[next_dt]

            next_dt_naive = _to_naive_ts(pd.Timestamp(next_dt))
            now_naive = _to_naive_ts(pd.Timestamp(now))

            hr = next_dt_naive.hour
            time_label = "TBD" if hr == 0 else ("BMO" if hr < 12 else "AMC")

            info = stock.info or {}
            results.append(
                {
                    "ticker": ticker,
                    "company_name": info.get("shortName", ticker),
                    "date": next_dt_naive.strftime("%Y-%m-%d"),
                    "time": time_label,
                    "eps_estimate": _safe_float(row.get("EPS Estimate")),
                    "days_until": (next_dt_naive.date() - now_naive.date()).days,
                }
            )
        except Exception:
            logger.exception("Error getting upcoming earnings for %s", ticker)
            continue

    results.sort(key=lambda x: x["date"])
    return results


async def get_upcoming_earnings(tickers: List[str], days_ahead: int = 14) -> List[Dict[str, Any]]:
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_upcoming_earnings_sync, tickers, days_ahead),
        timeout=30,
    )
