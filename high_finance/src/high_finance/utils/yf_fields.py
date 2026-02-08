"""Centralized yfinance field name aliases. yfinance occasionally renames
keys between versions. Each constant lists known aliases, most common first."""

from typing import Optional

# Income statement
REVENUE = ["Total Revenue", "TotalRevenue", "Revenue", "Total revenue"]
GROSS_PROFIT = ["Gross Profit", "GrossProfit"]
OPERATING_INCOME = ["Operating Income", "OperatingIncome", "EBIT"]
NET_INCOME = ["Net Income", "NetIncome", "Net Income Common Stockholders"]
EBITDA = ["EBITDA", "Ebitda", "Normalized EBITDA"]
INTEREST_EXPENSE = ["Interest Expense", "InterestExpense"]
DEPRECIATION = ["Depreciation And Amortization", "DepreciationAndAmortization"]
PRETAX_INCOME = ["Pretax Income", "Income Before Tax", "EBT"]
TAX_PROVISION = ["Tax Provision", "Income Tax Expense", "Tax Expense"]

# Balance sheet
TOTAL_ASSETS = ["Total Assets", "TotalAssets"]
TOTAL_DEBT = ["Total Debt", "TotalDebt"]
CASH = ["Cash And Cash Equivalents", "CashAndCashEquivalents"]
EQUITY = ["Total Equity Gross Minority Interest", "TotalEquityGrossMinorityInterest", "Stockholders Equity"]
CURRENT_ASSETS = ["Current Assets", "CurrentAssets"]
CURRENT_LIABILITIES = ["Current Liabilities", "CurrentLiabilities"]
LONG_TERM_DEBT = ["Long Term Debt", "LongTermDebt"]
SHORT_TERM_DEBT = ["Short Term Debt", "Current Portion Of Long Term Debt"]
SHORT_TERM_INVESTMENTS = ["Short Term Investments", "ShortTermInvestments"]
CASH_AND_STI = ["Cash Cash Equivalents And Short Term Investments"]

# Cash flow
OPERATING_CF = ["Operating Cash Flow", "OperatingCashFlow"]
FREE_CF = ["Free Cash Flow", "FreeCashFlow"]
CAPEX = ["Capital Expenditure", "CapitalExpenditure"]


def get_field(data: dict, keys: list[str]) -> Optional[float]:
    """Look up a value trying multiple field name aliases.
    Returns the first match or None."""
    for k in keys:
        if k in data:
            return data[k]
    return None
