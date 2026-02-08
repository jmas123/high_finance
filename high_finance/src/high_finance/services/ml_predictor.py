import asyncio

import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score
from typing import Dict, Any, List

from high_finance.core.cache import get_or_compute, risk_ttl

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

HORIZON_DAYS = 5  # 5-day forward return (√5 ≈ 2.2x better SNR than 1-day)
CONFIDENCE_UPPER = 0.58  # P(up) above this → BULLISH
CONFIDENCE_LOWER = 0.42  # P(up) below this → BEARISH
# Between 0.42 and 0.58 → NEUTRAL ("model has no clear signal")

FEATURE_COLS = [
    'ret_1d', 'ret_3d', 'ret_5d', 'ret_10d', 'ret_20d',
    'ma_10_ratio', 'ma_20_ratio',
    'vol_z_20',
    'rsi_14',
    'macd_normalized', 'macd_histogram',
    'trend', 'volume_ratio',
    'volatility',
    'hl_spread',
    'bb_position',
    'vol_regime',
    'gap',
    'close_position',
]

FEATURE_DISPLAY_NAMES = {
    'ret_1d': '1-Day Return',
    'ret_3d': '3-Day Return',
    'ret_5d': '5-Day Return',
    'ret_10d': '10-Day Momentum',
    'ret_20d': '20-Day Momentum',
    'ma_10_ratio': 'Price vs 10-Day MA',
    'ma_20_ratio': 'Price vs 20-Day MA',
    'vol_z_20': 'Volume Z-Score (20d)',
    'rsi_14': 'RSI (14)',
    'macd_normalized': 'MACD (Normalized)',
    'macd_histogram': 'MACD Histogram',
    'trend': 'MA Trend (50/200)',
    'volume_ratio': 'Volume Ratio',
    'volatility': 'Volatility (20d)',
    'hl_spread': 'High-Low Spread',
    'bb_position': 'Bollinger Band Position',
    'vol_regime': 'Volatility Regime',
    'gap': 'Overnight Gap',
    'close_position': 'Close Position in Range',
}


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

def prep_data(stock_data: pd.DataFrame, horizon: int = HORIZON_DAYS):
    """
    Prepare features and target from stock data.

    Key changes from v1:
    - Target is 5-day forward return (better SNR than 1-day)
    - Removed redundant features (avg_c_15_ratio, vol_z_10, macd_signal_normalized)
    - Added: bb_position, vol_regime, gap, close_position, ret_10d, ret_20d, macd_histogram
    """
    data = stock_data.copy()

    # ── Return features at multiple horizons ──────────────────────────
    data['ret_1d'] = data['Close'].pct_change()
    data['ret_3d'] = data['Close'].pct_change(3)
    data['ret_5d'] = data['Close'].pct_change(5)
    data['ret_10d'] = data['Close'].pct_change(10)
    data['ret_20d'] = data['Close'].pct_change(20)

    # ── Moving averages ───────────────────────────────────────────────
    data['ma_10'] = data['Close'].rolling(10).mean()
    data['ma_20'] = data['Close'].rolling(20).mean()
    data['ma_50'] = data['Close'].rolling(50).mean()
    data['ma_200'] = data['Close'].rolling(200).mean()

    # MA ratios (price relative to MA)
    data['ma_10_ratio'] = data['Close'] / data['ma_10'] - 1
    data['ma_20_ratio'] = data['Close'] / data['ma_20'] - 1

    # Trend: 50-day MA above 200-day MA
    data['trend'] = (data['ma_50'] > data['ma_200']).astype(int)

    # ── Volume features ───────────────────────────────────────────────
    vol_mean_20 = data['Volume'].rolling(20).mean()
    vol_std_20 = data['Volume'].rolling(20).std()
    data['vol_z_20'] = (data['Volume'] - vol_mean_20) / (vol_std_20 + 1e-9)
    data['volume_ratio'] = data['Volume'] / (vol_mean_20.replace(0, 1e-10))

    # ── RSI (with safe division for down=0 case) ─────────────────────
    change = data['Close'].diff()
    up = change.clip(lower=0).rolling(15).mean()
    down = (-change.clip(upper=0)).rolling(15).mean()
    down_safe = down.replace(0, 1e-10)
    rs = up / down_safe
    data['rsi_14'] = 100 - (100 / (1 + rs))

    # ── MACD + histogram ──────────────────────────────────────────────
    ema_12 = data['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = data['Close'].ewm(span=26, adjust=False).mean()
    data['macd'] = ema_12 - ema_26
    data['macd_signal'] = data['macd'].ewm(span=9, adjust=False).mean()
    close_safe = data['Close'].replace(0, 1e-10)
    data['macd_normalized'] = data['macd'] / close_safe
    data['macd_histogram'] = (data['macd'] - data['macd_signal']) / close_safe

    # ── Volatility ────────────────────────────────────────────────────
    data['volatility'] = data['ret_1d'].rolling(20).std()

    # High-low spread
    data['hl_spread'] = (data['High'] - data['Low']) / close_safe

    # ── NEW: Bollinger Band position (mean-reversion signal) ─────────
    sma_20 = data['Close'].rolling(20).mean()
    std_20 = data['Close'].rolling(20).std()
    data['bb_position'] = (data['Close'] - sma_20) / (2 * std_20 + 1e-10)

    # ── NEW: Volatility regime (compression/expansion) ───────────────
    vol_20 = data['ret_1d'].rolling(20).std()
    vol_60 = data['ret_1d'].rolling(60).std()
    data['vol_regime'] = vol_20 / (vol_60 + 1e-10)

    # ── NEW: Overnight gap (captures overnight sentiment) ────────────
    data['gap'] = data['Open'] / data['Close'].shift(1) - 1

    # ── NEW: Close position in day's range (intraday momentum) ───────
    day_range = data['High'] - data['Low']
    data['close_position'] = (data['Close'] - data['Low']) / (day_range.replace(0, 1e-10))

    # ── Target: 5-day forward return ─────────────────────────────────
    data['y_return'] = data['Close'].shift(-horizon) / close_safe - 1.0
    data['y_cls'] = (data['y_return'] > 0).astype(int)

    data = data.dropna()

    x = data[FEATURE_COLS]
    y_return = data['y_return']
    y_cls = data['y_cls']

    return x, y_return, y_cls, data


# ═══════════════════════════════════════════════════════════════════════════════
# TRAIN/TEST SPLIT
# ═══════════════════════════════════════════════════════════════════════════════

def time_split(x, y, test_size=0.2):
    """Time-series aware train/test split."""
    n = len(x)
    cut = int(n * (1 - test_size))
    return x.iloc[:cut], x.iloc[cut:], y.iloc[:cut], y.iloc[cut:]


# ═══════════════════════════════════════════════════════════════════════════════
# BACKTEST (adapted for 5-day horizon + classification confidence)
# ═══════════════════════════════════════════════════════════════════════════════

def backtest_strategy(
    y_test: pd.Series,
    probabilities: np.ndarray,
    rebalance_every: int = 5,
    cost_per_rebalance: float = 0.001,
):
    """
    Backtest the confidence-gated strategy with weekly rebalancing.

    Position sizing:
    - P(up) > CONFIDENCE_UPPER → long (+1)
    - P(up) < CONFIDENCE_LOWER → short (-1)
    - Otherwise → flat (0) — model says "I don't know"
    """
    n = len(y_test)
    positions = pd.Series(0.0, index=y_test.index)

    for i in range(n):
        p_up = probabilities[i]
        if p_up > CONFIDENCE_UPPER:
            positions.iloc[i] = 1.0
        elif p_up < CONFIDENCE_LOWER:
            positions.iloc[i] = -1.0
        # else: flat — no trade

    # Only rebalance every N days (for 5-day horizon)
    rebalanced = pd.Series(0.0, index=y_test.index)
    current_pos = 0.0
    for i in range(n):
        if i % rebalance_every == 0:
            current_pos = positions.iloc[i]
        rebalanced.iloc[i] = current_pos

    strategy_returns = rebalanced.shift(1) * y_test
    # Transaction cost only on rebalance days
    tx_cost = rebalanced.diff().abs() * cost_per_rebalance
    net_return = strategy_returns - tx_cost

    total_days = len(net_return)
    positive_days = (net_return > 0).sum()
    num_trades = (rebalanced.diff().abs() > 0).sum()
    trading_days = (rebalanced != 0).sum()

    annual_return = net_return.mean() * 252
    annual_vol = net_return.std() * np.sqrt(252)
    sharpe = annual_return / annual_vol if annual_vol > 0 else 0

    cum_returns = (1 + net_return).cumprod()
    total_return = cum_returns.iloc[-1] - 1
    max_dd = (cum_returns / cum_returns.cummax() - 1).min()

    # Calmar ratio: annualized return / max drawdown
    calmar = abs(annual_return / max_dd) if max_dd != 0 else 0

    # Buy and hold comparison
    buy_hold_return = y_test
    buy_hold_cumulative = (1 + buy_hold_return).cumprod()
    buy_hold_total = buy_hold_cumulative.iloc[-1] - 1
    bh_vol = buy_hold_return.std() * np.sqrt(252)
    buy_hold_sharpe = (buy_hold_return.mean() * 252) / bh_vol if bh_vol > 0 else 0

    buy_hold_max_dd = (buy_hold_cumulative / buy_hold_cumulative.cummax() - 1).min()
    buy_hold_calmar = abs((buy_hold_return.mean() * 252) / buy_hold_max_dd) if buy_hold_max_dd != 0 else 0

    # Cumulative returns for chart
    cum_returns_data = [
        {
            "date": date.strftime("%Y-%m-%d"),
            "strategy": float(val),
            "buyHold": float(buy_hold_cumulative.loc[date])
        }
        for date, val in cum_returns.items()
    ]

    return {
        "sharpe_ratio": round(float(sharpe), 2),
        "annual_return": round(float(annual_return) * 100, 2),
        "annual_volatility": round(float(annual_vol) * 100, 2),
        "total_return": round(float(total_return) * 100, 2),
        "max_drawdown": round(float(max_dd) * 100, 2),
        "calmar_ratio": round(float(calmar), 2),
        "win_rate": round(float(positive_days / total_days) * 100, 2) if total_days > 0 else 0.0,
        "num_trades": int(num_trades),
        "trades_taken": int(trading_days),
        "trades_total": total_days,
        "selectivity_pct": round(float(trading_days / total_days) * 100, 1) if total_days > 0 else 0.0,
        "buy_hold_sharpe": round(float(buy_hold_sharpe), 2),
        "buy_hold_return": round(float(buy_hold_total) * 100, 2),
        "buy_hold_calmar": round(float(buy_hold_calmar), 2),
        "strategy_vs_buyhold": round(float(total_return - buy_hold_total) * 100, 2),
        "cumulative_returns": cum_returns_data[-60:],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PURGED WALK-FORWARD VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def walk_forward_validate(
    x: pd.DataFrame,
    y_cls: pd.Series,
    y_return: pd.Series,
    n_folds: int = 4,
    min_train_pct: float = 0.4,
    purge_window: int = HORIZON_DAYS,
) -> Dict[str, Any]:
    """
    Purged walk-forward (expanding window) cross-validation.

    The purge_window creates a gap between train and test to prevent
    look-ahead bias. With a 5-day target, the last 5 days of training
    overlap with the first test day — the purge removes this leakage.
    """
    n = len(x)
    min_train = int(n * min_train_pct)
    test_size = (n - min_train) // n_folds

    if test_size < 20:
        return {"folds": [], "summary": None}

    fold_results: List[Dict[str, Any]] = []

    for i in range(n_folds):
        train_end = min_train + i * test_size
        test_start = train_end + purge_window  # purge gap
        test_end = min(test_start + test_size, n)

        if test_start >= n or test_end <= test_start:
            break

        x_train = x.iloc[:train_end]
        x_test = x.iloc[test_start:test_end]
        y_cls_train = y_cls.iloc[:train_end]
        y_cls_test = y_cls.iloc[test_start:test_end]
        y_ret_test = y_return.iloc[test_start:test_end]

        # Standardize features
        scaler = StandardScaler()
        x_train_s = scaler.fit_transform(x_train)
        x_test_s = scaler.transform(x_test)

        model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=2,
            learning_rate=0.05,
            subsample=0.8,
            min_samples_leaf=20,
            random_state=42,
        )
        model.fit(x_train_s, y_cls_train)

        proba = model.predict_proba(x_test_s)[:, 1]
        direction_acc = float(((proba > 0.5) == (y_cls_test == 1)).mean())

        # Majority-class baseline for this fold
        majority_up = float(y_cls_test.mean())
        baseline_acc = max(majority_up, 1 - majority_up)

        bt = backtest_strategy(y_ret_test, proba)

        fold_results.append({
            "fold": i + 1,
            "train_size": len(x_train),
            "test_size": len(x_test),
            "purge_days": purge_window,
            "test_start": str(y_cls_test.index[0].date()) if hasattr(y_cls_test.index[0], 'date') else str(y_cls_test.index[0]),
            "test_end": str(y_cls_test.index[-1].date()) if hasattr(y_cls_test.index[-1], 'date') else str(y_cls_test.index[-1]),
            "direction_accuracy": round(direction_acc * 100, 2),
            "baseline_accuracy": round(baseline_acc * 100, 2),
            "accuracy_vs_baseline": round((direction_acc - baseline_acc) * 100, 2),
            "sharpe": bt["sharpe_ratio"],
            "total_return": bt["total_return"],
        })

    if not fold_results:
        return {"folds": [], "summary": None}

    sharpes = [f["sharpe"] for f in fold_results]
    dir_accs = [f["direction_accuracy"] for f in fold_results]
    baselines = [f["baseline_accuracy"] for f in fold_results]
    vs_baselines = [f["accuracy_vs_baseline"] for f in fold_results]

    summary = {
        "n_folds": len(fold_results),
        "purge_window": purge_window,
        "sharpe_mean": round(float(np.mean(sharpes)), 2),
        "sharpe_std": round(float(np.std(sharpes)), 2),
        "sharpe_min": round(float(np.min(sharpes)), 2),
        "sharpe_max": round(float(np.max(sharpes)), 2),
        "direction_accuracy_mean": round(float(np.mean(dir_accs)), 2),
        "direction_accuracy_std": round(float(np.std(dir_accs)), 2),
        "baseline_accuracy_mean": round(float(np.mean(baselines)), 2),
        "accuracy_vs_baseline_mean": round(float(np.mean(vs_baselines)), 2),
        "positive_sharpe_pct": round(
            sum(1 for s in sharpes if s > 0) / len(sharpes) * 100, 0
        ),
    }

    return {"folds": fold_results, "summary": summary}


# ═══════════════════════════════════════════════════════════════════════════════
# BOOTSTRAP CONFIDENCE INTERVALS
# ═══════════════════════════════════════════════════════════════════════════════

def bootstrap_confidence(
    y_test_cls: pd.Series,
    probabilities: np.ndarray,
    n_bootstrap: int = 100,
) -> Dict[str, Any]:
    """
    Bootstrap the test set to get confidence intervals on direction accuracy.

    This measures statistical uncertainty in the metric itself — not model
    internal randomness (like seed robustness did). More useful because it
    answers: "How confident are we that the model's accuracy is X%?"
    """
    n = len(y_test_cls)
    rng = np.random.RandomState(42)
    accuracies = []

    for _ in range(n_bootstrap):
        idx = rng.choice(n, size=n, replace=True)
        y_sample = y_test_cls.values[idx]
        p_sample = probabilities[idx]
        acc = float(((p_sample > 0.5) == (y_sample == 1)).mean()) * 100
        accuracies.append(acc)

    return {
        "n_bootstrap": n_bootstrap,
        "mean": round(float(np.mean(accuracies)), 2),
        "std": round(float(np.std(accuracies)), 2),
        "ci_95_low": round(float(np.percentile(accuracies, 2.5)), 2),
        "ci_95_high": round(float(np.percentile(accuracies, 97.5)), 2),
        "ci_note": f"Direction accuracy lies in [{np.percentile(accuracies, 2.5):.1f}%, {np.percentile(accuracies, 97.5):.1f}%] with 95% confidence.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# INFORMATION COEFFICIENT
# ═══════════════════════════════════════════════════════════════════════════════

def compute_information_coefficient(
    probabilities: np.ndarray,
    actual_returns: pd.Series,
) -> float:
    """
    Rank correlation (Spearman) between predicted probabilities and actual returns.

    IC is the gold standard metric in quant finance. An IC of 0.05 is
    considered meaningful. IC of 0.10+ is excellent. IC near 0 = no signal.
    """
    from scipy.stats import spearmanr
    ic, _ = spearmanr(probabilities, actual_returns.values)
    return round(float(ic), 4) if not np.isnan(ic) else 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# FACTOR ATTRIBUTION (ALPHA vs BETA)
# ═══════════════════════════════════════════════════════════════════════════════

def factor_attribution(
    y_test: pd.Series,
    probabilities: np.ndarray,
    spy_data: pd.DataFrame | None,
) -> Dict[str, Any]:
    """
    Regress strategy returns against market (SPY) to decompose alpha vs beta.
    """
    if spy_data is None or spy_data.empty:
        return {
            "alpha_annualized": None,
            "beta": None,
            "r_squared": None,
            "error": "Could not fetch SPY data for factor attribution",
        }

    # Compute strategy returns from confidence-gated positions
    positions = pd.Series(0.0, index=y_test.index)
    for i in range(len(probabilities)):
        p_up = probabilities[i]
        if p_up > CONFIDENCE_UPPER:
            positions.iloc[i] = 1.0
        elif p_up < CONFIDENCE_LOWER:
            positions.iloc[i] = -1.0

    strategy_ret = positions.shift(1) * y_test
    tx_cost = positions.diff().abs() * 0.001
    net_ret = strategy_ret - tx_cost

    # SPY returns
    spy_returns = spy_data['Close'].pct_change().dropna()

    common_dates = net_ret.index.intersection(spy_returns.index)
    if len(common_dates) < 20:
        return {
            "alpha_annualized": None,
            "beta": None,
            "r_squared": None,
            "error": "Insufficient overlapping dates with SPY for regression",
        }

    strat = net_ret.loc[common_dates].values
    mkt = spy_returns.loc[common_dates].values

    valid = ~(np.isnan(strat) | np.isnan(mkt))
    strat = strat[valid]
    mkt = mkt[valid]

    if len(strat) < 20:
        return {
            "alpha_annualized": None,
            "beta": None,
            "r_squared": None,
            "error": "Insufficient clean data points for regression",
        }

    beta, alpha_daily = np.polyfit(mkt, strat, 1)
    alpha_annual = float(alpha_daily * 252)

    if np.isnan(beta) or np.isnan(alpha_daily):
        return {
            "alpha_annualized": None,
            "beta": None,
            "r_squared": None,
            "error": "Regression produced invalid results",
        }

    predicted = alpha_daily + beta * mkt
    ss_res = np.sum((strat - predicted) ** 2)
    ss_tot = np.sum((strat - np.mean(strat)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    return {
        "alpha_annualized": round(alpha_annual * 100, 2),
        "beta": round(float(beta), 2),
        "r_squared": round(float(r2), 4),
        "interpretation": _interpret_factor(alpha_annual, beta, r2),
    }


def _interpret_factor(alpha: float, beta: float, r2: float) -> str:
    """Generate a plain-English interpretation of factor attribution."""
    parts = []

    if abs(beta) > 1.2:
        parts.append(f"Beta of {beta:.1f} means the strategy has amplified market exposure (levered {'long' if beta > 0 else 'short'}).")
    elif abs(beta) > 0.8:
        parts.append(f"Beta of {beta:.1f} means the strategy moves roughly with the market.")
    elif abs(beta) > 0.3:
        parts.append(f"Beta of {beta:.1f} suggests moderate market exposure.")
    else:
        parts.append(f"Beta of {beta:.1f} suggests the strategy is relatively market-neutral.")

    if alpha > 0.02:
        parts.append(f"Annualized alpha of {alpha*100:.1f}% suggests some genuine skill beyond market exposure.")
    elif alpha > 0:
        parts.append(f"Small positive alpha of {alpha*100:.1f}% — may not survive transaction costs at scale.")
    else:
        parts.append(f"Negative alpha of {alpha*100:.1f}% — the strategy underperforms after accounting for market exposure.")

    if r2 > 0.5:
        parts.append("High R² means most of the strategy's variance is explained by market moves, not unique insight.")

    return " ".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL QUALITY ASSESSMENT (auto-suppression)
# ═══════════════════════════════════════════════════════════════════════════════

def assess_model_quality(
    accuracy_vs_baseline: float,
    ic: float,
    test_r2: float,
    train_r2: float,
    backtest_sharpe: float = 0.0,
    wf_positive_sharpe_pct: float = 0.0,
) -> Dict[str, Any]:
    """
    Auto-assess whether the model's prediction should be trusted.

    Hard failures (any ONE = flagged):
    - accuracy_vs_baseline < -0.03 → model is >3% worse than "always UP"
    - IC < -0.02 → predictions anti-correlated with reality
    - test_r2 < -0.3 → regressor is catastrophically wrong out of sample
    - overfit_gap > 0.5 → memorized training noise

    Redemption clause:
    If direction accuracy fails but the model shows genuine signal through
    other metrics, it gets upgraded from "weak" → "marginal" (unsuppressed).
    A model can have sub-baseline hit rate but still profit if it *times*
    entries well (going flat during crashes). This is exactly what happened
    with O and PH — lower accuracy, but positive Sharpe because timing mattered.

    Redemption requires BOTH:
    - IC > 0.05 (probabilities rank-correlated with actual returns)
    - Backtest Sharpe > 0 OR walk-forward positive Sharpe ≥ 50%
    """
    overfit_gap = train_r2 - test_r2

    failures = []
    if accuracy_vs_baseline < -0.03:
        failures.append(f"Direction accuracy is {accuracy_vs_baseline*100:+.1f}% vs always-UP baseline")
    if ic < -0.02:
        failures.append(f"Negative IC ({ic:.4f}) — predictions anti-correlated with actual returns")
    if test_r2 < -0.3:
        failures.append(f"Test R² is {test_r2:.3f} — worse than predicting the mean")
    if overfit_gap > 0.5:
        failures.append(f"Overfit gap of {overfit_gap:.2f} — model memorized training noise")

    # ── Redemption clause ─────────────────────────────────────────────
    # Direction accuracy isn't everything. A model can have sub-baseline
    # hit rate but still generate positive returns through better timing.
    redeemed = False
    redemption_reasons: List[str] = []
    if len(failures) >= 1 and len(failures) <= 2:
        has_signal = ic > 0.05
        has_profit = backtest_sharpe > 0 or wf_positive_sharpe_pct >= 50
        if has_signal and has_profit:
            redeemed = True
            redemption_reasons.append(f"IC of {ic:.4f} shows predictions correlate with returns")
            if backtest_sharpe > 0:
                redemption_reasons.append(f"Positive backtest Sharpe ({backtest_sharpe:.2f})")
            if wf_positive_sharpe_pct >= 50:
                redemption_reasons.append(f"Walk-forward positive in {wf_positive_sharpe_pct:.0f}% of folds")

    if len(failures) >= 3:
        grade = "no_signal"
        suppressed = True
        message = "Model has no detectable edge on this ticker. The prediction signal should be ignored. This stock may have undergone regime changes that make historical technical patterns unreliable."
    elif len(failures) >= 1 and not redeemed:
        grade = "weak"
        suppressed = True
        message = "Model shows weak or negative edge on this ticker. Prediction signal is unreliable."
    elif redeemed:
        grade = "marginal"
        suppressed = False
        message = ("Direction accuracy is below baseline, but the model shows genuine signal "
                   "through IC and backtest profitability. Predictions may have value through "
                   "timing rather than raw hit rate. Treat with caution.")
    else:
        if accuracy_vs_baseline < 0:
            grade = "marginal"
            suppressed = False
            message = "Model has slight negative edge vs baseline but other metrics are acceptable. Treat predictions with extra caution."
        else:
            grade = "acceptable"
            suppressed = False
            message = None

    return {
        "grade": grade,
        "suppressed": suppressed,
        "redeemed": redeemed,
        "message": message,
        "failures": failures,
        "redemption_reasons": redemption_reasons,
        "overfit_gap": round(overfit_gap, 4),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN TRAINING PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def _train_and_predict_sync(ticker: str) -> Dict[str, Any]:
    """Blocking yfinance + sklearn call — runs in thread pool."""
    stock = yf.Ticker(ticker)
    data = stock.history(period="5y")

    if data.empty or len(data) < 300:
        return {"error": "Insufficient data for prediction (need 5+ years)"}

    x, y_return, y_cls, full_data = prep_data(data)

    if len(x) < 200:
        return {"error": "Insufficient data after feature engineering"}

    # ── Train/test split ──────────────────────────────────────────────
    x_train, x_test, y_cls_train, y_cls_test = time_split(x, y_cls, test_size=0.2)
    _, _, y_ret_train, y_ret_test = time_split(x, y_return, test_size=0.2)

    # ── Standardize features ──────────────────────────────────────────
    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    x_test_s = scaler.transform(x_test)

    # ── PRIMARY MODEL: GBM Classifier (for direction + probabilities) ─
    # Regularization: max_depth=2, min_samples_leaf=20, fewer estimators
    # to fight the massive overfitting we observed (train R²=0.76, test R²=-0.64)
    classifier = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=2,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=20,
        random_state=42,
    )
    classifier.fit(x_train_s, y_cls_train)

    proba_test = classifier.predict_proba(x_test_s)[:, 1]

    # ── SECONDARY MODEL: GBM Regressor (for magnitude estimation) ─────
    regressor = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=2,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=20,
        random_state=42,
    )
    regressor.fit(x_train_s, y_ret_train)
    pred_return_test = regressor.predict(x_test_s)

    # ── Direction accuracy ────────────────────────────────────────────
    direction_accuracy = float(((proba_test > 0.5) == (y_cls_test == 1)).mean())

    # ── Baseline: majority class ("always predict UP") ────────────────
    majority_up_pct = float(y_cls_test.mean())
    baseline_accuracy = max(majority_up_pct, 1 - majority_up_pct)
    accuracy_vs_baseline = direction_accuracy - baseline_accuracy

    # ── Confidence-gated accuracy (only on trades the model takes) ────
    gated_mask = (proba_test > CONFIDENCE_UPPER) | (proba_test < CONFIDENCE_LOWER)
    gated_count = gated_mask.sum()
    if gated_count > 0:
        gated_accuracy = float(
            ((proba_test[gated_mask] > 0.5) == (y_cls_test.values[gated_mask] == 1)).mean()
        )
    else:
        gated_accuracy = None

    # ── Information Coefficient ───────────────────────────────────────
    ic = compute_information_coefficient(proba_test, y_ret_test)

    # ── R² from regressor ─────────────────────────────────────────────
    train_r2 = r2_score(y_ret_train, regressor.predict(x_train_s))
    test_r2 = r2_score(y_ret_test, pred_return_test)

    # ── Feature importance ────────────────────────────────────────────
    feature_importance = dict(zip(FEATURE_COLS, classifier.feature_importances_))
    top_features = sorted(feature_importance.items(), key=lambda kv: kv[1], reverse=True)[:7]

    # ── Backtest ──────────────────────────────────────────────────────
    backtest_results = backtest_strategy(y_ret_test, proba_test)

    # ── Latest prediction ─────────────────────────────────────────────
    latest_features = scaler.transform(x.iloc[-1:].values)
    prob_up = float(classifier.predict_proba(latest_features)[:, 1][0])
    predicted_return = float(regressor.predict(latest_features)[0])

    current_price = float(data['Close'].iloc[-1])
    predicted_price = current_price * (1 + predicted_return)

    # ── Walk-forward validation ───────────────────────────────────────
    wf_results = walk_forward_validate(x, y_cls, y_return, n_folds=4)

    # ── Bootstrap confidence intervals ────────────────────────────────
    bootstrap = bootstrap_confidence(y_cls_test, proba_test)

    # ── Model quality assessment (after backtest + walk-forward) ──────
    wf_summary = wf_results.get("summary") or {}
    quality = assess_model_quality(
        accuracy_vs_baseline=accuracy_vs_baseline,
        ic=ic,
        test_r2=test_r2,
        train_r2=train_r2,
        backtest_sharpe=backtest_results["sharpe_ratio"],
        wf_positive_sharpe_pct=wf_summary.get("positive_sharpe_pct", 0),
    )

    # Signal based on confidence gating (overridden to NEUTRAL if suppressed)
    if quality["suppressed"]:
        signal = "NEUTRAL"
    elif prob_up > CONFIDENCE_UPPER:
        signal = "BULLISH"
    elif prob_up < CONFIDENCE_LOWER:
        signal = "BEARISH"
    else:
        signal = "NEUTRAL"

    # ── Factor attribution ────────────────────────────────────────────
    try:
        spy_data = yf.Ticker("SPY").history(period="5y")
    except Exception:
        spy_data = None

    factor = factor_attribution(
        y_test=y_ret_test,
        probabilities=proba_test,
        spy_data=spy_data,
    )

    # ── Volatility regime detection ───────────────────────────────────
    latest_data = full_data.iloc[-1]
    vol_regime_val = float(latest_data.get('vol_regime', 1.0))
    if vol_regime_val > 1.3:
        vol_regime_label = "High Volatility"
    elif vol_regime_val < 0.7:
        vol_regime_label = "Low Volatility"
    else:
        vol_regime_label = "Normal Volatility"

    # ── Training period info ──────────────────────────────────────────
    train_start = str(x_train.index[0].date()) if hasattr(x_train.index[0], 'date') else str(x_train.index[0])
    train_end = str(x_train.index[-1].date()) if hasattr(x_train.index[-1], 'date') else str(x_train.index[-1])

    return {
        "ticker": ticker,
        "prediction": {
            "signal": signal,
            "probability_up": round(prob_up * 100, 1),
            "probability_down": round((1 - prob_up) * 100, 1),
            "predicted_return": round(predicted_return * 100, 4),
            "current_price": round(current_price, 2),
            "predicted_price": round(predicted_price, 2),
            "horizon_days": HORIZON_DAYS,
            "confidence_thresholds": {
                "bullish_above": CONFIDENCE_UPPER * 100,
                "bearish_below": CONFIDENCE_LOWER * 100,
            },
            # Backwards-compatible fields
            "direction": "UP" if predicted_return > 0 else "DOWN",
            "confidence": signal,
        },
        "model_metrics": {
            "direction_accuracy": round(direction_accuracy * 100, 2),
            "baseline_accuracy": round(baseline_accuracy * 100, 2),
            "accuracy_vs_baseline": round(accuracy_vs_baseline * 100, 2),
            "gated_accuracy": round(gated_accuracy * 100, 2) if gated_accuracy is not None else None,
            "gated_trades": int(gated_count),
            "gated_total": len(proba_test),
            "information_coefficient": ic,
            "train_r2": round(train_r2, 4),
            "test_r2": round(test_r2, 4),
            "training_samples": len(x_train),
            "test_samples": len(x_test),
            "model_type": "GradientBoostingClassifier",
            "horizon_days": HORIZON_DAYS,
        },
        "backtest": backtest_results,
        "walk_forward": wf_results,
        "bootstrap_ci": bootstrap,
        "factor_attribution": factor,
        "top_features": [
            {
                "feature": FEATURE_DISPLAY_NAMES.get(f, f),
                "importance": round(imp * 100, 2)
            }
            for f, imp in top_features
        ],
        "model_quality": quality,
        "model_health": {
            "horizon": f"{HORIZON_DAYS}-Day Forward Return",
            "training_period": f"{train_start} to {train_end}",
            "training_days": len(x_train),
            "vol_regime": vol_regime_label,
            "vol_regime_value": round(vol_regime_val, 2),
            "n_features": len(FEATURE_COLS),
            "disclaimer": "This model uses only public technical data. Academic research shows ~52-55% is the realistic ceiling for direction accuracy on broad indices from technicals alone.",
        },
        "technical_indicators": {
            "rsi_14": round(float(latest_data['rsi_14']), 2),
            "macd": round(float(latest_data['macd']), 4),
            "macd_signal": round(float(latest_data['macd_signal']), 4),
            "trend": "BULLISH" if latest_data['trend'] == 1 else "BEARISH",
            "volatility_20d": round(float(latest_data['volatility']) * 100, 2),
            "volume_ratio": round(float(latest_data['volume_ratio']), 2),
            "ma_10_ratio": round(float(latest_data['ma_10_ratio']) * 100, 2),
            "ma_20_ratio": round(float(latest_data['ma_20_ratio']) * 100, 2),
            "bb_position": round(float(latest_data['bb_position']), 2),
            "vol_regime": round(float(latest_data['vol_regime']), 2),
        }
    }


async def train_and_predict(ticker: str) -> Dict[str, Any]:
    """Train a GBM classification model and predict 5-day direction with calibrated probabilities."""
    cache_key = f"hf:prediction:v2:{ticker}"

    async def _compute():
        return await asyncio.to_thread(_train_and_predict_sync, ticker)

    return await get_or_compute(cache_key, risk_ttl(), _compute)
