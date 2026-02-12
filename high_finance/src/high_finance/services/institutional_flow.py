import asyncio

import yfinance as yf
from typing import List, Dict, Any
from datetime import datetime

from high_finance.core.cache import get_or_compute, trades_ttl
from high_finance.services.yf_cache import get_yf_info


def _parse_holders_df(holders_df, shares_outstanding) -> List[Dict[str, Any]]:
    """Parse a yfinance holders DataFrame into a list of dicts."""
    if holders_df is None or holders_df.empty:
        return []

    results = []
    for _, row in holders_df.iterrows():
        shares = row.get('Shares', 0)
        value = row.get('Value', 0)

        pct_held = None
        if shares_outstanding and shares_outstanding > 0 and shares:
            pct_held = shares / shares_outstanding

        date_reported = row.get('Date Reported')
        if date_reported is not None:
            try:
                date_str = date_reported.strftime('%Y-%m-%d') if hasattr(date_reported, 'strftime') else str(date_reported)
            except:
                date_str = str(date_reported)
        else:
            date_str = None

        pct_change = row.get('% Change', row.get('pctChange', None))

        results.append({
            "holder": row.get('Holder', 'Unknown'),
            "shares": int(shares) if shares and shares == shares else 0,
            "value": float(value) if value and value == value else None,
            "pct_held": pct_held,
            "pct_change": float(pct_change) if pct_change and pct_change == pct_change else None,
            "date_reported": date_str,
        })

    return results


def _fetch_institutional_flow_sync(ticker: str, info: dict) -> Dict[str, Any]:
    """Blocking yfinance calls — runs in thread pool.
    Accepts pre-fetched info dict to avoid duplicate .info HTTP call.
    Still needs yf.Ticker() for .institutional_holders / .mutualfund_holders.
    """
    stock = yf.Ticker(ticker)
    shares_outstanding = info.get('sharesOutstanding', None)

    institutional = _parse_holders_df(stock.institutional_holders, shares_outstanding)
    mutual_funds = _parse_holders_df(stock.mutualfund_holders, shares_outstanding)

    return {
        "institutional": institutional,
        "mutual_funds": mutual_funds,
        "info": {
            "sharesOutstanding": info.get('sharesOutstanding', 0),
            "heldPercentInstitutions": info.get('heldPercentInstitutions', 0),
            "heldPercentInsiders": info.get('heldPercentInsiders', 0),
            "floatShares": info.get('floatShares', 0),
        },
    }


def _fetch_institutional_holders_sync(ticker: str, shares_outstanding) -> List[Dict[str, Any]]:
    stock = yf.Ticker(ticker)
    return _parse_holders_df(stock.institutional_holders, shares_outstanding)


async def get_institutional_holders(ticker: str) -> List[Dict[str, Any]]:
    """Get current institutional holders."""
    info = await get_yf_info(ticker)
    shares_outstanding = info.get('sharesOutstanding', None)
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_institutional_holders_sync, ticker, shares_outstanding),
        timeout=15,
    )


def _fetch_mutual_fund_holders_sync(ticker: str, shares_outstanding) -> List[Dict[str, Any]]:
    stock = yf.Ticker(ticker)
    return _parse_holders_df(stock.mutualfund_holders, shares_outstanding)


async def get_mutual_fund_holders(ticker: str) -> List[Dict[str, Any]]:
    """Get mutual fund holders."""
    info = await get_yf_info(ticker)
    shares_outstanding = info.get('sharesOutstanding', None)
    return await asyncio.wait_for(
        asyncio.to_thread(_fetch_mutual_fund_holders_sync, ticker, shares_outstanding),
        timeout=15,
    )


async def get_institutional_flow(ticker: str) -> Dict[str, Any]:
    """
    Get comprehensive institutional flow data.
    Shows top holders, new positions, biggest changes.
    """
    cache_key = f"hf:institutional:{ticker}"

    async def _compute():
        # Pre-fetch info from shared cache (avoids duplicate .info HTTP call)
        info = await get_yf_info(ticker)
        raw = await asyncio.wait_for(
            asyncio.to_thread(_fetch_institutional_flow_sync, ticker, info),
            timeout=15,
        )
        institutional = raw["institutional"]
        mutual_funds = raw["mutual_funds"]
        info_summary = raw["info"]
        return _build_flow_response(institutional, mutual_funds, info_summary)

    return await get_or_compute(cache_key, trades_ttl(), _compute)


def _build_flow_response(institutional, mutual_funds, info):
    """Pure computation — no I/O."""
    shares_outstanding = info.get('sharesOutstanding', 0)
    institutional_pct = info.get('heldPercentInstitutions', 0)
    insider_pct = info.get('heldPercentInsiders', 0)
    float_shares = info.get('floatShares', 0)
    
    # Analyze institutional holders for changes
    increasing = []
    decreasing = []
    new_positions = []
    
    for holder in institutional:
        pct_change = holder.get('pct_change')
        if pct_change is not None:
            if pct_change > 0.1:  # Increased by more than 10%
                increasing.append(holder)
            elif pct_change < -0.1:  # Decreased by more than 10%
                decreasing.append(holder)
        # Note: yfinance doesn't directly tell us "new" positions,
        # but large % changes could indicate new or exited positions
    
    # Sort by change magnitude
    increasing = sorted(increasing, key=lambda x: x.get('pct_change', 0), reverse=True)[:10]
    decreasing = sorted(decreasing, key=lambda x: x.get('pct_change', 0))[:10]
    
    # Top holders by value
    top_institutional = sorted(institutional, key=lambda x: x.get('value', 0) or 0, reverse=True)[:10]
    top_mutual_funds = sorted(mutual_funds, key=lambda x: x.get('value', 0) or 0, reverse=True)[:10]
    
    # Calculate totals
    total_institutional_value = sum(h.get('value', 0) or 0 for h in institutional)
    total_institutional_shares = sum(h.get('shares', 0) or 0 for h in institutional)
    
    return {
        "summary": {
            "institutional_ownership_pct": institutional_pct,
            "insider_ownership_pct": insider_pct,
            "shares_outstanding": shares_outstanding,
            "float_shares": float_shares,
            "total_institutional_holders": len(institutional),
            "total_mutual_fund_holders": len(mutual_funds),
            "total_institutional_value": total_institutional_value,
            "total_institutional_shares": total_institutional_shares,
        },
        "top_institutional_holders": top_institutional,
        "top_mutual_fund_holders": top_mutual_funds,
        "increasing_positions": increasing,
        "decreasing_positions": decreasing,
    }