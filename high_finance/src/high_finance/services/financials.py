import asyncio

import yfinance as yf
from typing import Dict, Any

from high_finance.core.cache import get_or_compute, fundamentals_ttl


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


async def get_financial_statements(ticker: str) -> Dict[str, Any]:
    cache_key = f"hf:financials:{ticker}"

    async def _compute():
        return await asyncio.to_thread(_fetch_financial_statements_sync, ticker)

    return await get_or_compute(cache_key, fundamentals_ttl(), _compute)
