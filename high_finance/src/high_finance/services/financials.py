import yfinance as yf
from typing import Dict, Any

async def get_financial_statements(ticker: str) -> Dict[str, Any]:
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
                # drop NaN
                if value is None:
                    continue
                if isinstance(value, float) and value != value:
                    continue
                try:
                    result[date_str][key] = float(value)
                except:
                    # if it can't be cast, skip
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

    # Return both
    return { "annual": annual, "quarterly": quarterly }
