import yfinance as yf
from typing import Dict, Any

async def get_financial_statements(ticker: str) -> Dict[str, Any]:
    """Fetch financial statements for a ticker."""
    stock = yf.Ticker(ticker)
    
    def df_to_dict(df):
        if df is None or df.empty:
            return {}
        
        result = {}
        for col in df.columns:
            date_str = col.strftime("%Y-%m-%d") if hasattr(col, 'strftime') else str(col)
            result[date_str] = {}
            for idx, value in df[col].items():
                key = str(idx)
                if value is not None and not (isinstance(value, float) and (value != value)):
                    result[date_str][key] = float(value) if isinstance(value, (int, float)) else value
        return result
    
    return {
        "income_statement": df_to_dict(stock.financials),
        "balance_sheet": df_to_dict(stock.balance_sheet),
        "cash_flow": df_to_dict(stock.cashflow),
    }