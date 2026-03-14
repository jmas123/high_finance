"""
ENHANCED OPTION DECAY SIMULATOR WITH SMART IV
"""

import asyncio
import logging
import math
from scipy.stats import norm
from typing import Dict, Any, List, Optional
import yfinance as yf

logger = logging.getLogger(__name__)
import pandas as pd
from datetime import datetime

from high_finance.core.cache import get_or_compute, options_ttl
from high_finance.services.yf_cache import get_yf_info


def black_scholes_price(
    S: float,  # Stock price
    K: float,  # Strike price
    T: float,  # Time to expiry in years
    r: float,  # Risk-free rate
    sigma: float,  # Implied volatility (decimal)
    option_type: str = 'call'
) -> float:
    """
    Calculate Black-Scholes option price.
    """
    if T <= 0:
        if option_type == 'call':
            return max(S - K, 0)
        else:
            return max(K - S, 0)
    
    if sigma <= 0:
        if option_type == 'call':
            return max(S - K * math.exp(-r * T), 0)
        else:
            return max(K * math.exp(-r * T) - S, 0)
    
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    
    if option_type == 'call':
        price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    
    return max(price, 0)


def calculate_greeks(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: str = 'call'
) -> Dict[str, float]:
    """Calculate option Greeks."""
    if T <= 0 or sigma <= 0:
        intrinsic = max(S - K, 0) if option_type == 'call' else max(K - S, 0)
        return {
            'delta': 1.0 if (option_type == 'call' and S > K) else (-1.0 if option_type == 'put' and S < K else 0.0),
            'gamma': 0.0,
            'theta': 0.0,
            'vega': 0.0,
            'rho': 0.0
        }
    
    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    
    pdf_d1 = math.exp(-0.5 * d1 ** 2) / math.sqrt(2 * math.pi)
    
    if option_type == 'call':
        delta = norm.cdf(d1)
    else:
        delta = norm.cdf(d1) - 1
    
    gamma = pdf_d1 / (S * sigma * sqrt_T)
    
    theta_annual = (
        -(S * pdf_d1 * sigma) / (2 * sqrt_T)
        - r * K * math.exp(-r * T) * norm.cdf(d2 if option_type == 'call' else -d2)
        * (1 if option_type == 'call' else -1)
    )
    theta_daily = theta_annual / 365
    
    vega = S * pdf_d1 * sqrt_T / 100
    
    if option_type == 'call':
        rho = K * T * math.exp(-r * T) * norm.cdf(d2) / 100
    else:
        rho = -K * T * math.exp(-r * T) * norm.cdf(-d2) / 100
    
    return {
        'delta': round(delta, 4),
        'gamma': round(gamma, 4),
        'theta': round(theta_daily, 4),
        'vega': round(vega, 4),
        'rho': round(rho, 4)
    }


def get_moneyness_label(S: float, K: float, option_type: str) -> str:
    """Determine if option is ITM, ATM, or OTM."""
    # Guard against zero stock price
    if S <= 0:
        return "OTM"  # Cannot determine moneyness with invalid price

    pct_diff = abs(S - K) / S * 100

    if pct_diff < 2:
        return "ATM"
    
    if option_type == 'call':
        return "ITM" if S > K else "OTM"
    else:
        return "ITM" if S < K else "OTM"


def interpret_decay_scenario(
    total_decay_pct: float,
    iv: float,
    days: int,
    option_type: str,
    moneyness: str
) -> Dict[str, Any]:
    """Provide interpretation of the decay scenario."""
    if days <= 7:
        time_label = "very_short"
        time_desc = "Extreme theta decay - final week acceleration"
    elif days <= 21:
        time_label = "short"
        time_desc = "High theta decay zone - options losing value rapidly"
    elif days <= 45:
        time_label = "medium"
        time_desc = "Moderate decay - theta becoming more significant"
    else:
        time_label = "long"
        time_desc = "Lower daily decay - time value erodes slowly"
    
    if iv > 0.50:
        iv_label = "very_high"
        iv_desc = "Very high IV - significant premium to decay"
    elif iv > 0.35:
        iv_label = "high"
        iv_desc = "Elevated IV - above-average premium"
    elif iv > 0.20:
        iv_label = "normal"
        iv_desc = "Normal IV environment"
    else:
        iv_label = "low"
        iv_desc = "Low IV - limited premium"
    
    if iv_label in ["very_high", "high"] and time_label in ["very_short", "short"]:
        favors = "sellers"
        favors_explanation = (
            "High IV combined with short time to expiry creates rapid decay. "
            "Option sellers benefit as premium erodes quickly if the stock stays flat."
        )
        strategy_hint = "Selling strategies (short puts, covered calls, iron condors) may benefit"
    elif iv_label == "low" and time_label == "long":
        favors = "buyers"
        favors_explanation = (
            "Low IV means cheaper options, and longer duration gives time for a move. "
            "Buyers get more time for less premium, reducing theta drag."
        )
        strategy_hint = "Long options or debit spreads may offer reasonable risk/reward"
    elif moneyness == "OTM" and time_label in ["very_short", "short"]:
        favors = "sellers"
        favors_explanation = (
            "OTM options with little time left have low probability of profit for buyers. "
            "These options often expire worthless, benefiting sellers."
        )
        strategy_hint = "OTM credit spreads or naked selling (with caution) may work"
    else:
        favors = "neutral"
        favors_explanation = (
            "This setup doesn't strongly favor buyers or sellers. "
            "Success depends more on directional accuracy than time decay edge."
        )
        strategy_hint = "Consider your directional view and risk tolerance"
    
    return {
        "favors": favors,
        "favors_explanation": favors_explanation,
        "strategy_hint": strategy_hint,
        "time_decay_intensity": time_label,
        "time_description": time_desc,
        "iv_environment": iv_label,
        "iv_description": iv_desc,
        "total_decay_pct": total_decay_pct,
        "key_insight": (
            f"If {option_type.upper()} stays flat, this option loses "
            f"{total_decay_pct:.1f}% of its value by expiration."
        )
    }


def _fetch_iv_context_sync(ticker: str, info: dict) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool.
    Accepts pre-fetched info dict to avoid duplicate .info HTTP call.
    Still needs yf.Ticker() for .history(), .options, .option_chain().
    """
    stock = yf.Ticker(ticker)
    result = {
        "atm_iv": None,
        "iv_percentile": None,
        "iv_high_52w": None,
        "iv_low_52w": None,
        "hv_20": None,
        "hv_60": None,
        "suggested_iv": 0.30,  # Default fallback
        "iv_by_expiry": [],
        "strikes_with_iv": [],
    }

    try:
        # Get current price from pre-fetched info
        current_price = info.get('regularMarketPrice') or info.get('currentPrice')
        
        if not current_price:
            return result
        
        # Get historical volatility for context
        hist = stock.history(period="1y")
        if not hist.empty:
            hist['returns'] = hist['Close'].pct_change()
            
            # 20-day and 60-day historical volatility
            hv_20 = hist['returns'].rolling(20).std() * (252 ** 0.5)
            hv_60 = hist['returns'].rolling(60).std() * (252 ** 0.5)
            
            result["hv_20"] = round(hv_20.iloc[-1], 4) if not pd.isna(hv_20.iloc[-1]) else None
            result["hv_60"] = round(hv_60.iloc[-1], 4) if not pd.isna(hv_60.iloc[-1]) else None
            
            # HV range over last year (proxy for IV range)
            hv_values = hv_20.dropna()
            if len(hv_values) > 20:
                result["iv_low_52w"] = round(hv_values.quantile(0.1), 4)
                result["iv_high_52w"] = round(hv_values.quantile(0.9), 4)
                
                # Current percentile
                current_hv = hv_values.iloc[-1]
                percentile = (hv_values < current_hv).sum() / len(hv_values) * 100
                result["iv_percentile"] = int(percentile)
        
        # Get options chain for actual IV
        expirations = stock.options
        if expirations:
            iv_by_expiry = []
            
            for expiry in expirations[:4]:  # First 4 expirations
                try:
                    chain = stock.option_chain(expiry)
                    calls = chain.calls

                    if not calls.empty:
                        # Find ATM call
                        calls['distance'] = abs(calls['strike'] - current_price)
                        atm_call = calls.loc[calls['distance'].idxmin()]

                        atm_iv = atm_call.get('impliedVolatility', None)
                        # Check if IV is valid (not NaN and not unreasonably low)
                        # IV below 15% is almost never realistic for individual stocks
                        if atm_iv and not pd.isna(atm_iv) and atm_iv >= 0.15:
                            days_to_exp = (datetime.strptime(expiry, "%Y-%m-%d") - datetime.now()).days
                            iv_by_expiry.append({
                                "expiry": expiry,
                                "days": max(days_to_exp, 0),
                                "atm_iv": round(atm_iv, 4),
                                "atm_iv_pct": round(atm_iv * 100, 1),
                                "atm_strike": atm_call['strike'],
                            })
                except Exception:
                    continue

            result["iv_by_expiry"] = iv_by_expiry

            # Set ATM IV from nearest expiry with valid IV
            if iv_by_expiry:
                result["atm_iv"] = iv_by_expiry[0]["atm_iv"]
                result["suggested_iv"] = iv_by_expiry[0]["atm_iv"]
            elif result["hv_20"] and result["hv_20"] >= 0.10:
                # Fall back to historical volatility if no valid option IV
                result["suggested_iv"] = result["hv_20"]
                result["atm_iv"] = result["hv_20"]
        
        # Fallback to HV if no IV available
        if result["suggested_iv"] is None or result["suggested_iv"] <= 0:
            if result["hv_20"]:
                result["suggested_iv"] = result["hv_20"]
            else:
                result["suggested_iv"] = 0.30  # Ultimate fallback
                
    except Exception:
        logger.exception("Error getting IV context for %s", ticker)
    
    return result


async def get_iv_context(ticker: str) -> Dict[str, Any]:
    """Get IV context for a ticker — cached + async."""
    cache_key = f"hf:iv_context:{ticker}"

    async def _compute():
        info = await get_yf_info(ticker) or {}
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_iv_context_sync, ticker, info),
            timeout=15,
        )

    return await get_or_compute(cache_key, options_ttl(), _compute)


def _fetch_contract_iv_sync(
    ticker: str, expiry: str, strike: float, option_type: str = 'call'
) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    try:
        chain = stock.option_chain(expiry)

        if option_type == 'call':
            df = chain.calls
        else:
            df = chain.puts

        contract = df[df['strike'] == strike]

        if contract.empty:
            df['distance'] = abs(df['strike'] - strike)
            contract = df.loc[[df['distance'].idxmin()]]

        if contract.empty:
            return {"error": "Contract not found", "iv": None}

        row = contract.iloc[0]

        iv = row.get('impliedVolatility', None)
        iv_source = 'contract'

        if pd.isna(iv) or iv < 0.15:
            try:
                hist = stock.history(period="3mo")
                if not hist.empty:
                    hist['returns'] = hist['Close'].pct_change()
                    hv_20 = hist['returns'].rolling(20).std() * (252 ** 0.5)
                    hv_value = hv_20.iloc[-1]
                    if not pd.isna(hv_value) and hv_value > 0.10:
                        iv = float(hv_value)
                        iv_source = 'hv'
                    else:
                        iv = 0.25
                        iv_source = 'default'
                else:
                    iv = 0.25
                    iv_source = 'default'
            except:
                iv = 0.25
                iv_source = 'default'

        return {
            "strike": row['strike'],
            "iv": round(iv, 4) if iv else None,
            "iv_pct": round(iv * 100, 1) if iv else None,
            "bid": row.get('bid', 0) or 0,
            "ask": row.get('ask', 0) or 0,
            "last_price": row.get('lastPrice', 0) or 0,
            "volume": int(row.get('volume', 0) or 0),
            "open_interest": int(row.get('openInterest', 0) or 0),
            "iv_source": iv_source,
        }

    except Exception as e:
        return {"error": str(e), "iv": None}


async def get_contract_iv(
    ticker: str, expiry: str, strike: float, option_type: str = 'call'
) -> Dict[str, Any]:
    """Get the implied volatility for a specific contract."""
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_contract_iv_sync, ticker, expiry, strike, option_type),
        timeout=15,
    )


async def simulate_option_decay(
    ticker: str,
    stock_price: float,
    strike: float,
    days_to_expiry: int,
    implied_volatility: float,  # As decimal (0.30 = 30%)
    option_type: str = 'call',
    risk_free_rate: float = 0.045,
    simulation_points: int = 50
) -> Dict[str, Any]:
    """
    Simulate option price decay over time assuming flat stock price and constant IV.
    """
    # Validate inputs
    if stock_price <= 0:
        raise ValueError("Stock price must be positive")
    if strike <= 0:
        raise ValueError("Strike price must be positive")
    if days_to_expiry < 1:
        raise ValueError("Days to expiry must be at least 1")
    if implied_volatility <= 0:
        raise ValueError("Implied volatility must be positive")
    if option_type not in ['call', 'put']:
        raise ValueError("Option type must be 'call' or 'put'")
    
    # Calculate initial price and Greeks
    T_initial = days_to_expiry / 365
    initial_price = black_scholes_price(
        S=stock_price, K=strike, T=T_initial,
        r=risk_free_rate, sigma=implied_volatility,
        option_type=option_type
    )
    
    initial_greeks = calculate_greeks(
        S=stock_price, K=strike, T=T_initial,
        r=risk_free_rate, sigma=implied_volatility,
        option_type=option_type
    )
    
    # Get moneyness
    moneyness = get_moneyness_label(stock_price, strike, option_type)
    
    # Calculate intrinsic and extrinsic value
    if option_type == 'call':
        intrinsic_value = max(stock_price - strike, 0)
    else:
        intrinsic_value = max(strike - stock_price, 0)
    
    extrinsic_value = initial_price - intrinsic_value
    
    # Generate decay curve
    decay_curve: List[Dict[str, Any]] = []
    
    if days_to_expiry <= simulation_points:
        step = 1
        num_points = days_to_expiry + 1
    else:
        step = days_to_expiry / (simulation_points - 1)
        num_points = simulation_points
    
    for i in range(num_points):
        if days_to_expiry <= simulation_points:
            day = i
        else:
            day = int(i * step)
        
        days_remaining = days_to_expiry - day
        T = max(days_remaining / 365, 0)
        
        price = black_scholes_price(
            S=stock_price, K=strike, T=T,
            r=risk_free_rate, sigma=implied_volatility,
            option_type=option_type
        )
        
        greeks = calculate_greeks(
            S=stock_price, K=strike, T=T,
            r=risk_free_rate, sigma=implied_volatility,
            option_type=option_type
        )
        
        decay_from_start = initial_price - price
        decay_pct = (decay_from_start / initial_price * 100) if initial_price > 0 else 0
        
        decay_curve.append({
            "day": day,
            "days_remaining": days_remaining,
            "price": round(price, 4),
            "theta": greeks['theta'],
            "delta": greeks['delta'],
            "decay_from_start": round(decay_from_start, 4),
            "decay_pct": round(decay_pct, 2),
            "extrinsic_remaining": round(max(price - intrinsic_value, 0), 4)
        })
    
    # Ensure we have the final expiration point
    if decay_curve[-1]["days_remaining"] != 0:
        final_price = black_scholes_price(
            S=stock_price, K=strike, T=0,
            r=risk_free_rate, sigma=implied_volatility,
            option_type=option_type
        )
        decay_curve.append({
            "day": days_to_expiry,
            "days_remaining": 0,
            "price": round(final_price, 4),
            "theta": 0,
            "delta": 1.0 if (option_type == 'call' and stock_price > strike) else (-1.0 if option_type == 'put' and stock_price < strike else 0.0),
            "decay_from_start": round(initial_price - final_price, 4),
            "decay_pct": round((initial_price - final_price) / initial_price * 100, 2) if initial_price > 0 else 0,
            "extrinsic_remaining": 0
        })
    
    # Final calculations
    final_price = decay_curve[-1]["price"]
    total_decay = initial_price - final_price
    total_decay_pct = (total_decay / initial_price * 100) if initial_price > 0 else 0
    
    # Calculate decay at key milestones
    milestones = {}
    for pct in [25, 50, 75]:
        target_days = int(days_to_expiry * (1 - pct / 100))
        closest = min(decay_curve, key=lambda x: abs(x["days_remaining"] - target_days))
        milestones[f"at_{pct}pct_time_elapsed"] = {
            "days_remaining": closest["days_remaining"],
            "price": closest["price"],
            "decay_pct": closest["decay_pct"]
        }
    
    # Get interpretation
    interpretation = interpret_decay_scenario(
        total_decay_pct=total_decay_pct,
        iv=implied_volatility,
        days=days_to_expiry,
        option_type=option_type,
        moneyness=moneyness
    )
    
    return {
        "ticker": ticker,
        "inputs": {
            "stock_price": stock_price,
            "strike": strike,
            "days_to_expiry": days_to_expiry,
            "implied_volatility_pct": round(implied_volatility * 100, 2),
            "option_type": option_type,
            "risk_free_rate_pct": round(risk_free_rate * 100, 2)
        },
        "current_values": {
            "option_price": round(initial_price, 4),
            "intrinsic_value": round(intrinsic_value, 4),
            "extrinsic_value": round(extrinsic_value, 4),
            "moneyness": moneyness
        },
        "greeks": initial_greeks,
        "decay_summary": {
            "initial_price": round(initial_price, 4),
            "final_price": round(final_price, 4),
            "total_decay_dollars": round(total_decay, 4),
            "total_decay_pct": round(total_decay_pct, 2),
            "extrinsic_decay_pct": round(
                (extrinsic_value / initial_price * 100) if initial_price > 0 else 0, 2
            ),
            "avg_daily_decay": round(total_decay / days_to_expiry, 4) if days_to_expiry > 0 else 0,
            "current_daily_theta": initial_greeks['theta']
        },
        "milestones": milestones,
        "decay_curve": decay_curve,
        "interpretation": interpretation
    }


def _fetch_contract_for_decay_sync(
    ticker: str, expiry: str, strike: float, option_type: str, info: dict
) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool. Returns params for simulation.
    Accepts pre-fetched info dict to avoid duplicate .info HTTP call.
    """
    stock = yf.Ticker(ticker)

    stock_price = info.get('regularMarketPrice') or info.get('currentPrice')

    if not stock_price:
        raise ValueError(f"Could not get current price for {ticker}")

    try:
        chain = stock.option_chain(expiry)
    except Exception as e:
        raise ValueError(f"Could not get options chain for {expiry}: {e}")

    if option_type == 'call':
        options_df = chain.calls
    else:
        options_df = chain.puts

    contract = options_df[options_df['strike'] == strike]

    if contract.empty:
        raise ValueError(f"No {option_type} contract found at strike {strike}")

    contract = contract.iloc[0]

    iv = contract.get('impliedVolatility', 0.30)
    if pd.isna(iv) or iv <= 0:
        iv = 0.30

    expiry_date = datetime.strptime(expiry, "%Y-%m-%d")
    days_to_expiry = (expiry_date - datetime.now()).days

    if days_to_expiry < 1:
        days_to_expiry = 1

    return {
        "stock_price": stock_price,
        "iv": iv,
        "days_to_expiry": days_to_expiry,
    }


async def get_decay_simulation_for_contract(
    ticker: str,
    expiry: str,
    strike: float,
    option_type: str = 'call'
) -> Dict[str, Any]:
    """Get decay simulation for a specific contract from the options chain."""
    info = await get_yf_info(ticker) or {}
    params = await asyncio.wait_for(
        asyncio.to_thread(_fetch_contract_for_decay_sync, ticker, expiry, strike, option_type, info),
        timeout=15,
    )

    return await simulate_option_decay(
        ticker=ticker,
        stock_price=params["stock_price"],
        strike=strike,
        days_to_expiry=params["days_to_expiry"],
        implied_volatility=params["iv"],
        option_type=option_type,
    )