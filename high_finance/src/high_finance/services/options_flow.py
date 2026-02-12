import asyncio
import logging

import yfinance as yf
from typing import Dict, Any, List
from datetime import datetime
import pandas as pd

logger = logging.getLogger(__name__)

from high_finance.core.cache import get_or_compute, options_ttl
from high_finance.services.yf_cache import get_yf_info


def _fetch_options_overview_sync(ticker: str, info: dict) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool.
    Accepts pre-fetched info dict to avoid duplicate .info HTTP call.
    Still needs yf.Ticker() for .options and .option_chain().
    """
    stock = yf.Ticker(ticker)

    result = {
        "ticker": ticker,
        "current_price": None,
        "expirations": [],
        "put_call_ratio": None,
        "total_call_volume": 0,
        "total_put_volume": 0,
        "total_call_oi": 0,
        "total_put_oi": 0,
        "max_pain": None,
        "unusual_activity": [],
        "iv_percentile": None,
        "nearest_expiry_analysis": None,
    }

    try:
        # Get current price from pre-fetched info
        result["current_price"] = info.get('regularMarketPrice') or info.get('currentPrice')
        
        # Get available expirations
        expirations = stock.options
        if not expirations:
            return result
        
        result["expirations"] = list(expirations)[:8]  # First 8 expiries
        
        # Analyze the nearest expiration
        nearest_expiry = expirations[0]
        chain = stock.option_chain(nearest_expiry)
        
        calls = chain.calls
        puts = chain.puts
        
        if calls.empty and puts.empty:
            return result
        
        # Calculate totals
        total_call_volume = int(calls['volume'].sum()) if 'volume' in calls else 0
        total_put_volume = int(puts['volume'].sum()) if 'volume' in puts else 0
        total_call_oi = int(calls['openInterest'].sum()) if 'openInterest' in calls else 0
        total_put_oi = int(puts['openInterest'].sum()) if 'openInterest' in puts else 0
        
        result["total_call_volume"] = total_call_volume
        result["total_put_volume"] = total_put_volume
        result["total_call_oi"] = total_call_oi
        result["total_put_oi"] = total_put_oi
        
        # Put/Call ratio
        if total_call_volume > 0:
            result["put_call_ratio"] = round(total_put_volume / total_call_volume, 2)
        
        # Max Pain calculation
        result["max_pain"] = calculate_max_pain(calls, puts, result["current_price"])
        
        # Find unusual activity
        result["unusual_activity"] = find_unusual_activity(calls, puts, result["current_price"])
        
        # Nearest expiry analysis
        result["nearest_expiry_analysis"] = analyze_expiry(
            calls, puts, nearest_expiry, result["current_price"]
        )
        
        # Calculate IV percentile (simplified - compare current IV to recent)
        result["iv_percentile"] = calculate_iv_percentile(stock)
        
    except Exception:
        logger.exception("Error getting options overview for %s", ticker)
    
    return result


async def get_options_overview(ticker: str) -> Dict[str, Any]:
    """Get options chain overview with unusual activity detection."""
    cache_key = f"hf:options:{ticker}"

    async def _compute():
        info = await get_yf_info(ticker)
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_options_overview_sync, ticker, info),
            timeout=15,
        )

    return await get_or_compute(cache_key, options_ttl(), _compute)


def calculate_max_pain(calls: pd.DataFrame, puts: pd.DataFrame, current_price: float) -> float:
    """
    Calculate max pain - the strike price where option buyers lose the most money.
    This is where market makers theoretically want the stock to land at expiration.
    """
    if calls.empty and puts.empty:
        return None
    
    try:
        # Get all unique strikes
        all_strikes = set(calls['strike'].tolist() + puts['strike'].tolist())
        
        min_pain = float('inf')
        max_pain_strike = None
        
        for strike in all_strikes:
            total_pain = 0
            
            # Pain from calls (calls are worthless below strike)
            for _, call in calls.iterrows():
                if strike > call['strike']:
                    # Call is ITM, buyers profit
                    pain = (strike - call['strike']) * call.get('openInterest', 0) * 100
                    total_pain += pain
            
            # Pain from puts (puts are worthless above strike)
            for _, put in puts.iterrows():
                if strike < put['strike']:
                    # Put is ITM, buyers profit
                    pain = (put['strike'] - strike) * put.get('openInterest', 0) * 100
                    total_pain += pain
            
            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = strike
        
        return max_pain_strike
    except Exception:
        logger.exception("Error calculating max pain")
        return None


def find_unusual_activity(calls: pd.DataFrame, puts: pd.DataFrame, current_price: float) -> List[Dict[str, Any]]:
    """Find strikes with unusual volume (volume > 2x open interest)."""
    unusual = []
    
    try:
        # Check calls
        for _, row in calls.iterrows():
            volume = row.get('volume', 0) or 0
            oi = row.get('openInterest', 0) or 0
            
            if oi > 0 and volume > oi * 2 and volume >= 100:
                strike = row['strike']
                moneyness = ((strike - current_price) / current_price) * 100 if current_price else 0
                
                unusual.append({
                    "type": "CALL",
                    "strike": strike,
                    "volume": int(volume),
                    "open_interest": int(oi),
                    "volume_oi_ratio": round(volume / oi, 1),
                    "last_price": row.get('lastPrice', 0),
                    "bid": row.get('bid', 0),
                    "ask": row.get('ask', 0),
                    "implied_volatility": round(row.get('impliedVolatility', 0) * 100, 1),
                    "moneyness": round(moneyness, 1),  # % from current price
                    "premium_value": int(volume * row.get('lastPrice', 0) * 100),
                    "signal": "BULLISH" if moneyness > 0 else "ITM CALL",
                })
        
        # Check puts
        for _, row in puts.iterrows():
            volume = row.get('volume', 0) or 0
            oi = row.get('openInterest', 0) or 0
            
            if oi > 0 and volume > oi * 2 and volume >= 100:
                strike = row['strike']
                moneyness = ((current_price - strike) / current_price) * 100 if current_price else 0
                
                unusual.append({
                    "type": "PUT",
                    "strike": strike,
                    "volume": int(volume),
                    "open_interest": int(oi),
                    "volume_oi_ratio": round(volume / oi, 1),
                    "last_price": row.get('lastPrice', 0),
                    "bid": row.get('bid', 0),
                    "ask": row.get('ask', 0),
                    "implied_volatility": round(row.get('impliedVolatility', 0) * 100, 1),
                    "moneyness": round(moneyness, 1),
                    "premium_value": int(volume * row.get('lastPrice', 0) * 100),
                    "signal": "BEARISH" if moneyness > 0 else "ITM PUT",
                })
        
        # Sort by premium value (biggest trades first)
        unusual.sort(key=lambda x: x['premium_value'], reverse=True)
        
        return unusual[:10]  # Top 10 unusual
    
    except Exception:
        logger.exception("Error finding unusual activity")
        return []


def analyze_expiry(calls: pd.DataFrame, puts: pd.DataFrame, expiry: str, current_price: float) -> Dict[str, Any]:
    """Analyze a specific expiration date."""
    try:
        # Find ATM options (closest to current price)
        if not calls.empty and current_price:
            calls['distance'] = abs(calls['strike'] - current_price)
            atm_call = calls.loc[calls['distance'].idxmin()]
        else:
            atm_call = None
        
        if not puts.empty and current_price:
            puts['distance'] = abs(puts['strike'] - current_price)
            atm_put = puts.loc[puts['distance'].idxmin()]
        else:
            atm_put = None
        
        # Calculate expected move (straddle price)
        expected_move = None
        expected_move_pct = None
        if atm_call is not None and atm_put is not None:
            straddle_price = (atm_call.get('lastPrice', 0) or 0) + (atm_put.get('lastPrice', 0) or 0)
            expected_move = round(straddle_price, 2)
            if current_price is not None and current_price > 0:
                expected_move_pct = round((straddle_price / current_price) * 100, 1)
        
        # ATM IV
        atm_iv = None
        if atm_call is not None:
            atm_iv = round((atm_call.get('impliedVolatility', 0) or 0) * 100, 1)
        
        # Volume by strike (for visualization)
        strike_volume = []
        
        call_volume_by_strike = calls.groupby('strike')['volume'].sum().to_dict() if not calls.empty else {}
        put_volume_by_strike = puts.groupby('strike')['volume'].sum().to_dict() if not puts.empty else {}
        
        all_strikes = sorted(set(list(call_volume_by_strike.keys()) + list(put_volume_by_strike.keys())))
        
        # Filter to strikes near the money (±20%)
        if current_price:
            all_strikes = [s for s in all_strikes if abs(s - current_price) / current_price < 0.2]
        
        for strike in all_strikes:
            strike_volume.append({
                "strike": strike,
                "call_volume": int(call_volume_by_strike.get(strike, 0) or 0),
                "put_volume": int(put_volume_by_strike.get(strike, 0) or 0),
            })
        
        return {
            "expiry": expiry,
            "days_to_expiry": (datetime.strptime(expiry, "%Y-%m-%d") - datetime.now()).days,
            "atm_strike": atm_call['strike'] if atm_call is not None else None,
            "atm_iv": atm_iv,
            "expected_move": expected_move,
            "expected_move_pct": expected_move_pct,
            "strike_volume": strike_volume,
        }
    
    except Exception:
        logger.exception("Error analyzing expiry")
        return None


def calculate_iv_percentile(stock) -> int:
    """
    Calculate IV percentile - where current IV ranks vs last year.
    Higher = options are expensive, Lower = options are cheap.
    """
    try:
        # Get historical data
        hist = stock.history(period="1y")
        if hist.empty:
            return None
        
        # Calculate historical volatility for comparison
        hist['returns'] = hist['Close'].pct_change()
        hist['hv_20'] = hist['returns'].rolling(20).std() * (252 ** 0.5) * 100
        
        current_hv = hist['hv_20'].iloc[-1]
        hv_values = hist['hv_20'].dropna()
        
        if len(hv_values) < 20:
            return None
        
        # Percentile rank
        percentile = (hv_values < current_hv).sum() / len(hv_values) * 100
        
        return int(percentile)
    
    except Exception:
        logger.exception("Error calculating IV percentile")
        return None


def _fetch_options_chain_sync(ticker: str, expiry: str) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    try:
        chain = stock.option_chain(expiry)

        calls = chain.calls.to_dict('records') if not chain.calls.empty else []
        puts = chain.puts.to_dict('records') if not chain.puts.empty else []

        for call in calls:
            for key, value in call.items():
                if pd.isna(value):
                    call[key] = None

        for put in puts:
            for key, value in put.items():
                if pd.isna(value):
                    put[key] = None

        return {
            "ticker": ticker,
            "expiry": expiry,
            "calls": calls,
            "puts": puts,
        }

    except Exception:
        logger.exception("Error getting options chain for %s %s", ticker, expiry)
        return {"ticker": ticker, "expiry": expiry, "calls": [], "puts": []}


async def get_options_chain(ticker: str, expiry: str) -> Dict[str, Any]:
    """Get full options chain for a specific expiration."""
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_options_chain_sync, ticker, expiry),
        timeout=15,
    )