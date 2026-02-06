"""
Enhanced Risk Analytics Service

Provides meaningful Monte Carlo outputs:
- Probability of price exceeding targets
- Probability of drawdown thresholds
- Scenario-based expected returns (bull/base/stress)
- Optional earnings volatility shock injection
"""

import math
import numpy as np
from typing import Any, Dict, List, Optional

from high_finance.services.prices import get_price_history
from high_finance.services.earnings import get_earnings_history_with_moves
from high_finance.core.cache import get_or_compute, risk_ttl

TRADING_DAYS = 252


def _pct_returns(closes: List[float]) -> np.ndarray:
    arr = np.array(closes, dtype=float)
    rets = arr[1:] / arr[:-1] - 1.0
    rets = rets[np.isfinite(rets)]
    return rets


def _max_drawdown(closes: List[float]) -> float:
    arr = np.array(closes, dtype=float)
    if len(arr) < 2:
        return 0.0
    # Filter out non-positive values that would cause division issues
    arr = arr[arr > 0]
    if len(arr) < 2:
        return 0.0
    peak = np.maximum.accumulate(arr)
    # Guard against zero peak (shouldn't happen with positive filter, but be safe)
    with np.errstate(divide='ignore', invalid='ignore'):
        dd = arr / peak - 1.0
        dd = np.where(np.isfinite(dd), dd, 0.0)
    return float(np.min(dd))


def _historical_var(returns: np.ndarray, alpha: float) -> float:
    if len(returns) < 10:
        return 0.0
    q = float(np.quantile(returns, alpha))
    return -q


def _monte_carlo_paths(
    s0: float,
    mu: float,
    sigma: float,
    days: int,
    n_sims: int,
    seed: int = 42,
    earnings_shock: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """
    Generate Monte Carlo paths using geometric Brownian motion.
    
    If earnings_shock is provided, inject a volatility spike on specified days.
    earnings_shock = {
        "day": int,  # day in horizon to apply shock
        "vol_multiplier": float,  # e.g., 3.0 for 3x normal vol on that day
        "mean_shift": float,  # optional drift adjustment (e.g., historical avg move)
    }
    """
    rng = np.random.default_rng(seed)
    dt = 1.0
    
    # Base shocks
    shocks = rng.normal(0.0, 1.0, size=(n_sims, days))
    
    # Build per-day sigma array
    sigmas = np.full(days, sigma)
    mus = np.full(days, mu)
    
    # Apply earnings shock if specified
    if earnings_shock and 0 <= earnings_shock.get("day", -1) < days:
        shock_day = earnings_shock["day"]
        sigmas[shock_day] *= earnings_shock.get("vol_multiplier", 3.0)
        mus[shock_day] += earnings_shock.get("mean_shift", 0.0)
    
    # Compute increments with varying sigma
    increments = np.zeros((n_sims, days))
    for d in range(days):
        increments[:, d] = (mus[d] - 0.5 * sigmas[d] ** 2) * dt + sigmas[d] * math.sqrt(dt) * shocks[:, d]
    
    log_paths = np.cumsum(increments, axis=1)
    paths = s0 * np.exp(log_paths)
    return paths


def _prob_above_target(paths: np.ndarray, target: float) -> float:
    """P(S_T > target) at terminal time"""
    final_prices = paths[:, -1]
    return float(np.mean(final_prices > target))


def _prob_below_target(paths: np.ndarray, target: float) -> float:
    """P(S_T < target) at terminal time"""
    final_prices = paths[:, -1]
    return float(np.mean(final_prices < target))


def _prob_touches_target(paths: np.ndarray, target: float, direction: str = "above") -> float:
    """P(S_t touches target at any point during horizon)"""
    if direction == "above":
        max_prices = np.max(paths, axis=1)
        return float(np.mean(max_prices >= target))
    else:
        min_prices = np.min(paths, axis=1)
        return float(np.mean(min_prices <= target))


def _prob_drawdown_exceeds(paths: np.ndarray, s0: float, threshold: float) -> float:
    """
    P(max drawdown > threshold during horizon)
    threshold should be negative, e.g., -0.15 for 15% drawdown
    """
    # Prepend s0 to get full path including starting price
    full_paths = np.concatenate([np.full((paths.shape[0], 1), s0), paths], axis=1)
    running_max = np.maximum.accumulate(full_paths, axis=1)
    drawdowns = full_paths / running_max - 1.0
    max_dd_per_path = np.min(drawdowns, axis=1)
    return float(np.mean(max_dd_per_path < threshold))


def _scenario_returns(paths: np.ndarray, s0: float) -> Dict[str, float]:
    """
    Calculate expected returns under different scenarios.
    Returns percentile-based scenarios.
    """
    final = paths[:, -1]
    returns = final / s0 - 1.0
    
    return {
        "stress_p5": float(np.percentile(returns, 5)),
        "stress_p10": float(np.percentile(returns, 10)),
        "base_p50": float(np.percentile(returns, 50)),
        "bull_p90": float(np.percentile(returns, 90)),
        "bull_p95": float(np.percentile(returns, 95)),
        "mean": float(np.mean(returns)),
        "std": float(np.std(returns)),
    }


def _terminal_distribution(paths: np.ndarray, s0: float, n_bins: int = 20) -> List[Dict[str, Any]]:
    """
    Generate histogram data for terminal price distribution.
    """
    final = paths[:, -1]
    returns = (final / s0 - 1.0) * 100  # as percentage
    
    hist, bin_edges = np.histogram(returns, bins=n_bins)
    total = len(returns)
    
    distribution = []
    for i in range(len(hist)):
        distribution.append({
            "return_min": float(bin_edges[i]),
            "return_max": float(bin_edges[i + 1]),
            "count": int(hist[i]),
            "probability": float(hist[i] / total),
        })
    
    return distribution


def _expected_value_at_horizon(paths: np.ndarray) -> Dict[str, float]:
    """Get price statistics at terminal time"""
    final = paths[:, -1]
    return {
        "mean": float(np.mean(final)),
        "median": float(np.median(final)),
        "std": float(np.std(final)),
        "p5": float(np.percentile(final, 5)),
        "p25": float(np.percentile(final, 25)),
        "p75": float(np.percentile(final, 75)),
        "p95": float(np.percentile(final, 95)),
    }


async def _get_earnings_volatility_params(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Analyze historical earnings moves to estimate earnings-day volatility.
    Returns parameters for earnings shock injection.
    """
    try:
        history = await get_earnings_history_with_moves(ticker)
        if not history or len(history) < 3:
            return None
        
        # Get absolute 1-day moves around earnings
        moves = [abs(h["one_day_move"]) for h in history if h.get("one_day_move") is not None]
        if len(moves) < 3:
            return None
        
        avg_move = np.mean(moves) / 100  # Convert from percentage
        max_move = np.max(moves) / 100
        
        # Historical direction bias (positive = tends to go up on earnings)
        signed_moves = [h["one_day_move"] for h in history if h.get("one_day_move") is not None]
        direction_bias = np.mean(signed_moves) / 100 if signed_moves else 0.0
        
        return {
            "avg_earnings_move": float(avg_move),
            "max_earnings_move": float(max_move),
            "direction_bias": float(direction_bias),
            "n_observations": len(moves),
            # Estimate vol multiplier: avg daily vol is ~1-2%, earnings moves are typically 3-8%
            "implied_vol_multiplier": float(avg_move / 0.015) if avg_move > 0 else 3.0,
        }
    except Exception as e:
        print(f"Error getting earnings volatility for {ticker}: {e}")
        return None


async def get_risk_bundle(
    ticker: str,
    period: str = "1y",
    horizon_days: int = 60,
    n_sims: int = 500,
    vol_multiplier: float = 1.0,
    include_earnings_shock: bool = False,
    earnings_shock_day: Optional[int] = None,
    target_price: Optional[float] = None,
    drawdown_threshold: float = -0.15,
) -> Dict[str, Any]:
    """
    Enhanced risk bundle with actionable probability metrics.
    """
    cache_key = f"hf:risk:{ticker}:p={period}:h={horizon_days}:s={n_sims}:v={vol_multiplier}"

    async def _compute():
        return await _compute_risk_bundle(
            ticker, period, horizon_days, n_sims, vol_multiplier,
            include_earnings_shock, earnings_shock_day, target_price, drawdown_threshold,
        )

    return await get_or_compute(cache_key, risk_ttl(), _compute)


async def _compute_risk_bundle(
    ticker: str,
    period: str,
    horizon_days: int,
    n_sims: int,
    vol_multiplier: float,
    include_earnings_shock: bool,
    earnings_shock_day: Optional[int],
    target_price: Optional[float],
    drawdown_threshold: float,
) -> Dict[str, Any]:
    """Inner computation for risk bundle."""
    prices = await get_price_history(ticker, period=period)
    if not prices or len(prices) < 30:
        return {"ticker": ticker, "error": "Insufficient price history"}

    daily = [p for p in prices if len(p["date"]) == 10]
    if len(daily) < 30:
        daily = prices

    closes = [float(p["close"]) for p in daily if p.get("close") is not None]
    if len(closes) < 30:
        return {"ticker": ticker, "error": "Insufficient daily closes"}

    rets = _pct_returns(closes)
    if len(rets) < 20:
        return {"ticker": ticker, "error": "Insufficient returns series"}

    mu_d = float(np.mean(rets))
    sigma_d = float(np.std(rets, ddof=1))
    
    # Apply volatility multiplier
    sigma_adjusted = sigma_d * vol_multiplier

    ann_vol = sigma_d * math.sqrt(TRADING_DAYS)
    ann_vol_adjusted = sigma_adjusted * math.sqrt(TRADING_DAYS)
    max_dd = _max_drawdown(closes)

    var_95_1d = _historical_var(rets, 0.05)
    var_99_1d = _historical_var(rets, 0.01)

    s0 = closes[-1]
    
    # Get earnings volatility data if requested
    earnings_params = None
    earnings_shock_config = None
    if include_earnings_shock:
        earnings_params = await _get_earnings_volatility_params(ticker)
        if earnings_params:
            shock_day = earnings_shock_day if earnings_shock_day is not None else horizon_days // 2
            earnings_shock_config = {
                "day": min(shock_day, horizon_days - 1),
                "vol_multiplier": earnings_params["implied_vol_multiplier"],
                "mean_shift": earnings_params["direction_bias"],
            }

    # Run Monte Carlo
    paths = _monte_carlo_paths(
        s0=s0,
        mu=mu_d,
        sigma=sigma_adjusted,
        days=horizon_days,
        n_sims=n_sims,
        earnings_shock=earnings_shock_config,
    )

    # Fan chart percentiles
    p5 = np.percentile(paths, 5, axis=0)
    p10 = np.percentile(paths, 10, axis=0)
    p25 = np.percentile(paths, 25, axis=0)
    p50 = np.percentile(paths, 50, axis=0)
    p75 = np.percentile(paths, 75, axis=0)
    p90 = np.percentile(paths, 90, axis=0)
    p95 = np.percentile(paths, 95, axis=0)

    fan = [
        {
            "day": int(i + 1),
            "p5": float(p5[i]),
            "p10": float(p10[i]),
            "p25": float(p25[i]),
            "p50": float(p50[i]),
            "p75": float(p75[i]),
            "p90": float(p90[i]),
            "p95": float(p95[i]),
        }
        for i in range(horizon_days)
    ]

    # Calculate probabilities
    target = target_price if target_price is not None else s0 * 1.10
    
    probabilities = {
        "prob_positive_return": _prob_above_target(paths, s0),
        "prob_above_5pct": _prob_above_target(paths, s0 * 1.05),
        "prob_above_10pct": _prob_above_target(paths, s0 * 1.10),
        "prob_above_20pct": _prob_above_target(paths, s0 * 1.20),
        "prob_below_minus_5pct": _prob_below_target(paths, s0 * 0.95),
        "prob_below_minus_10pct": _prob_below_target(paths, s0 * 0.90),
        "prob_below_minus_20pct": _prob_below_target(paths, s0 * 0.80),
        "prob_touches_ath_plus_10pct": _prob_touches_target(paths, s0 * 1.10, "above"),
        "prob_drawdown_exceeds_threshold": _prob_drawdown_exceeds(paths, s0, drawdown_threshold),
        "prob_above_target": _prob_above_target(paths, target),
        "target_price_used": float(target),
        "drawdown_threshold_used": float(drawdown_threshold),
    }

    # Scenario analysis
    scenarios = _scenario_returns(paths, s0)
    
    # Terminal distribution
    distribution = _terminal_distribution(paths, s0, n_bins=25)
    
    # Expected values
    expected_prices = _expected_value_at_horizon(paths)

    return {
        "ticker": ticker,
        "as_of_close": float(s0),
        "period_used": period,
        "metrics": {
            "daily_mean_return": float(mu_d),
            "daily_volatility": float(sigma_d),
            "daily_volatility_adjusted": float(sigma_adjusted),
            "annualized_volatility": float(ann_vol),
            "annualized_volatility_adjusted": float(ann_vol_adjusted),
            "max_drawdown": float(max_dd),
            "var_95_1d": float(var_95_1d),
            "var_99_1d": float(var_99_1d),
        },
        "monte_carlo": {
            "horizon_days": horizon_days,
            "n_sims": n_sims,
            "vol_multiplier": vol_multiplier,
            "include_earnings_shock": include_earnings_shock,
            "earnings_params": earnings_params,
            "fan": fan,
        },
        "probabilities": probabilities,
        "scenarios": scenarios,
        "distribution": distribution,
        "expected_prices": expected_prices,
    }