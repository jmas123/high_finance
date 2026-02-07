import asyncio

import yfinance as yf
from typing import Dict, Any

import logging

from high_finance.core.cache import get_cached, get_or_compute, fundamentals_ttl, set_cached

logger = logging.getLogger(__name__)


def _fetch_financial_statements_sync(ticker: str) -> Dict[str, Any]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    def df_to_dict(df):
        if df is None or df.empty:
            return {}
        result = {}
        for col in df.columns:
            date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
            result[date_str] = {}
            for idx, value in df[col].items():
                key = str(idx)
                if value is None:
                    continue
                if isinstance(value, float) and value != value:
                    continue
                try:
                    result[date_str][key] = float(value)
                except:
                    continue
        return result

    annual = {
        "income_statement": df_to_dict(stock.financials),
        "balance_sheet": df_to_dict(stock.balance_sheet),
        "cash_flow": df_to_dict(stock.cashflow),
    }

    quarterly = {
        "income_statement": df_to_dict(stock.quarterly_financials),
        "balance_sheet": df_to_dict(stock.quarterly_balance_sheet),
        "cash_flow": df_to_dict(stock.quarterly_cashflow),
    }

    return {"annual": annual, "quarterly": quarterly}


def _is_complete(stmts: Dict[str, Any]) -> bool:
    """Reject partial data — yfinance sometimes returns only EPS/shares fields."""
    annual_is = stmts.get("annual", {}).get("income_statement", {})
    if not annual_is:
        return False
    # Find at least one column with >= 10 fields (skips estimate-only columns)
    return any(len(fields) >= 10 for fields in annual_is.values())


async def get_financial_statements(ticker: str) -> Dict[str, Any]:
    cache_key = f"hf:financials:{ticker}"

    # Check cache first
    cached = await get_cached(cache_key)
    if cached is not None and _is_complete(cached):
        return cached

    # Compute fresh — incomplete cached data is treated as a miss
    result = await asyncio.wait_for(
        asyncio.to_thread(_fetch_financial_statements_sync, ticker),
        timeout=15,
    )

    # Only cache if data looks complete
    if _is_complete(result):
        await set_cached(cache_key, result, fundamentals_ttl())
    else:
        logger.warning("Incomplete financials for %s (%d fields), not caching",
                        ticker, len(next(iter(
                            result.get("annual", {}).get("income_statement", {}).values()
                        ), {})))

    return result
