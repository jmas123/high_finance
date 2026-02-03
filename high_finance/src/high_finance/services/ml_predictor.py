import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from typing import Dict, Any

FEATURE_DISPLAY_NAMES = {
    'ret_1d': '1-Day Return',
    'ret_3d': '3-Day Return',
    'ret_5d': '5-Day Return',
    'ma_10_ratio': 'Price vs 10-Day MA',
    'ma_20_ratio': 'Price vs 20-Day MA',
    'avg_c_15_ratio': 'Price vs 15-Day Avg',
    'vol_z_20': 'Volume Z-Score (20d)',
    'vol_z_10': 'Volume Z-Score (10d)',
    'rsi_14': 'RSI (14)',
    'macd_normalized': 'MACD (Normalized)',
    'macd_signal_normalized': 'MACD Signal (Normalized)',
    'trend': 'MA Trend (50/200)',
    'volume_ratio': 'Volume Ratio',
    'volatility': 'Volatility (20d)',
    'hl_spread': 'High-Low Spread',
}


def prep_data(stock_data: pd.DataFrame):
    """Prepare features and target from stock data."""
    data = stock_data.copy()

    # Return features
    data['ret_1d'] = data['Close'].pct_change()
    data['ret_3d'] = data['Close'].pct_change(3)
    data['ret_5d'] = data['Close'].pct_change(5)

    # Moving averages
    data['ma_10'] = data['Close'].rolling(10).mean()
    data['ma_20'] = data['Close'].rolling(20).mean()
    data['ma_50'] = data['Close'].rolling(50).mean()
    data['ma_200'] = data['Close'].rolling(200).mean()

    # MA ratios
    data['ma_10_ratio'] = data['Close'] / data['ma_10'] - 1
    data['ma_20_ratio'] = data['Close'] / data['ma_20'] - 1

    # Golden cross and trend
    data['golden_cross'] = 0
    data.loc[
        (data['ma_50'] > data['ma_200']) & 
        (data['ma_50'].shift(1) <= data['ma_200'].shift(1)), 
        'golden_cross'
    ] = 1
    data['trend'] = (data['ma_50'] > data['ma_200']).astype(int)

    # 15-day average
    data['avg_c_15'] = data['Close'].rolling(15).mean()
    data['avg_c_15_ratio'] = data['Close'] / data['avg_c_15'] - 1

    # Volume z-scores
    data['vol_z_20'] = (data['Volume'] - data['Volume'].rolling(20).mean()) / (data['Volume'].rolling(20).std() + 1e-9)
    data['vol_z_10'] = (data['Volume'] - data['Volume'].rolling(10).mean()) / (data['Volume'].rolling(10).std() + 1e-9)

    # RSI (with safe division for down=0 case)
    change = data['Close'].diff()
    up = change.clip(lower=0).rolling(15).mean()
    down = (-change.clip(upper=0)).rolling(15).mean()
    # Replace zero down values with small epsilon to avoid division by zero
    down_safe = down.replace(0, 1e-10)
    rs = up / down_safe
    data['rsi_14'] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = data['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = data['Close'].ewm(span=26, adjust=False).mean()
    data['macd'] = ema_12 - ema_26
    data['macd_signal'] = data['macd'].ewm(span=9, adjust=False).mean()
    data['macd_normalized'] = data['macd'] / data['Close']
    data['macd_signal_normalized'] = data['macd_signal'] / data['Close']

    # Volatility and volume (with safe division)
    data['volatility'] = data['ret_1d'].rolling(20).std()
    vol_mean = data['Volume'].rolling(20).mean()
    # Replace zero mean with small epsilon to avoid division by zero
    vol_mean_safe = vol_mean.replace(0, 1e-10)
    data['volume_ratio'] = data['Volume'] / vol_mean_safe

    # High-low spread (with safe division)
    close_safe = data['Close'].replace(0, 1e-10)
    data['hl_spread'] = (data['High'] - data['Low']) / close_safe

    # Target: next day return (with safe division)
    data['y'] = data['Close'].shift(-1) / close_safe - 1.0

    data = data.dropna()

    feature_cols = [
        'ret_1d', 'ret_3d', 'ret_5d',
        'ma_10_ratio', 'ma_20_ratio', 'avg_c_15_ratio',
        'vol_z_20', 'vol_z_10',
        'rsi_14', 'macd_normalized', 'macd_signal_normalized',
        'trend', 'volume_ratio',
        'volatility', 'hl_spread'
    ]

    x = data[feature_cols]
    y = data['y']

    return x, y, data


def time_split(x, y, test_size=0.2):
    """Time-series aware train/test split."""
    n = len(x)
    cut = int(n * (1 - test_size))
    return x.iloc[:cut], x.iloc[cut:], y.iloc[:cut], y.iloc[cut:]


def backtest_strategy(y_test, y_pred_test, threshold=0.0005, cost=0.0005):
    """Backtest the prediction strategy."""
    positions = pd.Series(0, index=y_test.index)
    positions[y_pred_test > threshold] = 1
    positions[y_pred_test < -threshold] = -1

    strategy_returns = positions.shift(1) * y_test
    transaction_cost = positions.diff().abs() * cost
    net_return = strategy_returns - transaction_cost

    total_days = len(net_return)
    positive_days = (net_return > 0).sum()
    num_trades = positions.diff().abs().sum()

    annual_return = net_return.mean() * 252
    annual_vol = net_return.std() * np.sqrt(252)
    sharpe = annual_return / annual_vol if annual_vol > 0 else 0

    cum_returns = (1 + net_return).cumprod()
    total_return = cum_returns.iloc[-1] - 1
    max_dd = (cum_returns / cum_returns.cummax() - 1).min()

    # Buy and hold comparison
    buy_hold_return = y_test
    buy_hold_cumulative = (1 + buy_hold_return).cumprod()
    buy_hold_total = buy_hold_cumulative.iloc[-1] - 1
    buy_hold_sharpe = (buy_hold_return.mean() * 252) / (buy_hold_return.std() * np.sqrt(252))

    # Generate cumulative returns data for chart
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
        "win_rate": round(float(positive_days / total_days) * 100, 2) if total_days > 0 else 0.0,
        "num_trades": int(num_trades),
        "buy_hold_sharpe": round(float(buy_hold_sharpe), 2),
        "buy_hold_return": round(float(buy_hold_total) * 100, 2),
        "strategy_vs_buyhold": round(float(total_return - buy_hold_total) * 100, 2),
        "cumulative_returns": cum_returns_data[-60:],  # Last 60 data points for chart
    }


async def train_and_predict(ticker: str) -> Dict[str, Any]:
    """
    Train a Random Forest regression model and predict next day's return.
    Includes backtesting results.
    """
    # Fetch 5 years of data
    stock = yf.Ticker(ticker)
    data = stock.history(period="5y")

    if data.empty or len(data) < 300:
        return {"error": "Insufficient data for prediction (need 5+ years)"}

    # Prepare features
    x, y, full_data = prep_data(data)

    if len(x) < 200:
        return {"error": "Insufficient data after feature engineering"}

    # Train/test split
    x_train, x_test, y_train, y_test = time_split(x, y, test_size=0.2)

    # Train model
    regressor = RandomForestRegressor(
        n_estimators=200,
        max_depth=5,
        random_state=42,
        n_jobs=-1
    )
    regressor.fit(x_train, y_train)

    # Predictions
    y_pred_train = regressor.predict(x_train)
    y_pred_test = regressor.predict(x_test)

    # Metrics
    train_mse = mean_squared_error(y_train, y_pred_train)
    test_mse = mean_squared_error(y_test, y_pred_test)
    train_r2 = r2_score(y_train, y_pred_train)
    test_r2 = r2_score(y_test, y_pred_test)
    direction_accuracy = ((y_test > 0) == (y_pred_test > 0)).mean()

    # Feature importance
    feature_importance = dict(zip(x.columns, regressor.feature_importances_))
    top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
    # Backtest
    backtest_results = backtest_strategy(y_test, y_pred_test)

    # Predict next day
    latest_features = x.iloc[-1:].values
    predicted_return = float(regressor.predict(latest_features)[0])
    current_price = float(data['Close'].iloc[-1])
    predicted_price = current_price * (1 + predicted_return)

    # Current technical indicators
    latest_data = full_data.iloc[-1]

    return {
        "ticker": ticker,
        "prediction": {
            "direction": "UP" if predicted_return > 0 else "DOWN",
            "predicted_return": round(predicted_return * 100, 4),
            "current_price": round(current_price, 2),
            "predicted_price": round(predicted_price, 2),
            "confidence": "HIGH" if abs(predicted_return) > 0.005 else "MEDIUM" if abs(predicted_return) > 0.001 else "LOW"
        },
        "model_metrics": {
            "direction_accuracy": round(direction_accuracy * 100, 2),
            "train_mse": round(train_mse, 6),
            "test_mse": round(test_mse, 6),
            "train_r2": round(train_r2, 4),
            "test_r2": round(test_r2, 4),
            "training_samples": len(x_train),
            "test_samples": len(x_test),
        },
        "backtest": backtest_results,
        "top_features": [
            {
                "feature": FEATURE_DISPLAY_NAMES.get(f, f),
                "importance": round(imp * 100, 2)
            }
            for f, imp in top_features
        ],
        "technical_indicators": {
            "rsi_14": round(float(latest_data['rsi_14']), 2),
            "macd": round(float(latest_data['macd']), 4),
            "macd_signal": round(float(latest_data['macd_signal']), 4),
            "trend": "BULLISH" if latest_data['trend'] == 1 else "BEARISH",
            "volatility_20d": round(float(latest_data['volatility']) * 100, 2),
            "volume_ratio": round(float(latest_data['volume_ratio']), 2),
            "ma_10_ratio": round(float(latest_data['ma_10_ratio']) * 100, 2),
            "ma_20_ratio": round(float(latest_data['ma_20_ratio']) * 100, 2),
        }
    }