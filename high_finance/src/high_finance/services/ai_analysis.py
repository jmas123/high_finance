"""
AI Financial Analysis Service
==============================
Generates structured financial health analysis using Claude Haiku.

Key design decisions:
- Pre-computes all ratios server-side (LLMs shouldn't do math)
- Extracts 3 years of data for trend analysis
- Uses the same lazy Anthropic client pattern as memo.py
- Returns markdown for consistent rendering with the memo feature
"""

import logging
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from high_finance.core.config import settings
from high_finance.utils.safe_math import safe_div
from high_finance.utils.yf_fields import (
    REVENUE, GROSS_PROFIT, OPERATING_INCOME, NET_INCOME, EBITDA,
    INTEREST_EXPENSE, TOTAL_ASSETS, TOTAL_DEBT, CASH, EQUITY,
    CURRENT_ASSETS, CURRENT_LIABILITIES, OPERATING_CF, FREE_CF, CAPEX,
    get_field,
)

logger = logging.getLogger(__name__)

# ── Lazy Anthropic client (shared singleton with memo.py) ─────────────────
_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


MODEL = "claude-haiku-4-5-20251001"


# ── Formatting helpers ────────────────────────────────────────────────────

def _fmt(val: Optional[float], prefix: str = "", suffix: str = "", decimals: int = 1) -> str:
    if val is None:
        return "N/A"
    try:
        v = float(val)
        abs_v = abs(v)
        sign = "-" if v < 0 else ""
        if abs_v >= 1e12:
            return f"{sign}{prefix}{abs_v / 1e12:.{decimals}f}T{suffix}"
        if abs_v >= 1e9:
            return f"{sign}{prefix}{abs_v / 1e9:.{decimals}f}B{suffix}"
        if abs_v >= 1e6:
            return f"{sign}{prefix}{abs_v / 1e6:.{decimals}f}M{suffix}"
        return f"{sign}{prefix}{abs_v:,.0f}{suffix}"
    except (TypeError, ValueError):
        return "N/A"


def _pct(val: Optional[float]) -> str:
    if val is None:
        return "N/A"
    try:
        return f"{float(val) * 100:.1f}%"
    except (TypeError, ValueError):
        return "N/A"


def _ratio(val: Optional[float]) -> str:
    if val is None:
        return "N/A"
    try:
        return f"{float(val):.2f}x"
    except (TypeError, ValueError):
        return "N/A"


# ── Data extraction ───────────────────────────────────────────────────────

def _extract_years(financials: Dict[str, Any]) -> list[tuple[str, dict, dict, dict]]:
    """
    Extract up to 3 years of aligned annual data.
    Returns list of (year_label, income, balance, cashflow) tuples, newest first.

    The financials structure from get_financial_statements() is:
    {"annual": {"income_statement": {date: {metric: val}}, "balance_sheet": ..., "cash_flow": ...}}
    """
    annual = financials.get("annual", {})
    income_data = annual.get("income_statement", {})
    balance_data = annual.get("balance_sheet", {})
    cashflow_data = annual.get("cash_flow", {})

    # Get all dates across all statements, sorted newest first
    all_dates = sorted(
        set(list(income_data.keys()) + list(balance_data.keys()) + list(cashflow_data.keys())),
        reverse=True,
    )

    years = []
    for date in all_dates[:3]:  # Max 3 years
        income = income_data.get(date, {})
        balance = balance_data.get(date, {})
        cashflow = cashflow_data.get(date, {})

        # Skip years with no income data (sparse columns)
        if not income:
            continue

        # Use fiscal year label from the date
        label = date[:4] if len(date) >= 4 else date
        years.append((label, income, balance, cashflow))

    return years


def _compute_ratios(income: dict, balance: dict, cashflow: dict) -> Dict[str, Optional[float]]:
    """Pre-compute key financial ratios from raw statement data."""
    revenue = get_field(income, REVENUE)
    gross_profit = get_field(income, GROSS_PROFIT)
    operating_income = get_field(income, OPERATING_INCOME)
    net_income = get_field(income, NET_INCOME)
    ebitda = get_field(income, EBITDA)

    total_assets = get_field(balance, TOTAL_ASSETS)
    total_debt = get_field(balance, TOTAL_DEBT)
    cash = get_field(balance, CASH)
    equity = get_field(balance, EQUITY)
    current_assets = get_field(balance, CURRENT_ASSETS)
    current_liabilities = get_field(balance, CURRENT_LIABILITIES)
    interest_expense = get_field(income, INTEREST_EXPENSE)

    op_cashflow = get_field(cashflow, OPERATING_CF)
    fcf = get_field(cashflow, FREE_CF)
    capex = get_field(cashflow, CAPEX)

    return {
        # Profitability
        "gross_margin": safe_div(gross_profit, revenue),
        "operating_margin": safe_div(operating_income, revenue),
        "net_margin": safe_div(net_income, revenue),
        "ebitda_margin": safe_div(ebitda, revenue),
        # Solvency
        "debt_to_equity": safe_div(total_debt, equity),
        "cash_to_debt": safe_div(cash, total_debt),
        "current_ratio": safe_div(current_assets, current_liabilities),
        "interest_coverage": safe_div(operating_income, abs(interest_expense) if interest_expense else None),
        "net_debt": (total_debt or 0) - (cash or 0) if total_debt is not None else None,
        # Cash flow quality
        "fcf_conversion": safe_div(fcf, ebitda),
        "earnings_quality": safe_div(op_cashflow, net_income),
        "capex_to_revenue": safe_div(abs(capex) if capex else None, revenue),
        # Return
        "roa": safe_div(net_income, total_assets),
        "roe": safe_div(net_income, equity),
        # Raw values for the prompt
        "_revenue": revenue,
        "_gross_profit": gross_profit,
        "_operating_income": operating_income,
        "_net_income": net_income,
        "_ebitda": ebitda,
        "_total_assets": total_assets,
        "_total_debt": total_debt,
        "_cash": cash,
        "_equity": equity,
        "_op_cashflow": op_cashflow,
        "_fcf": fcf,
        "_capex": capex,
    }


def _build_prompt(
    ticker: str,
    financials: Dict[str, Any],
    sector: Optional[str] = None,
    industry: Optional[str] = None,
) -> tuple[str, str]:
    """Build system + user prompt with pre-computed data."""
    years = _extract_years(financials)

    if not years:
        return "", ""

    sections: list[str] = []

    for year_label, income, balance, cashflow in years:
        ratios = _compute_ratios(income, balance, cashflow)
        sections.append(
            f"### Fiscal Year {year_label}\n"
            f"**Income Statement:**\n"
            f"- Revenue: {_fmt(ratios['_revenue'], '$')} | Gross Profit: {_fmt(ratios['_gross_profit'], '$')} | "
            f"Operating Income: {_fmt(ratios['_operating_income'], '$')}\n"
            f"- Net Income: {_fmt(ratios['_net_income'], '$')} | EBITDA: {_fmt(ratios['_ebitda'], '$')}\n"
            f"\n"
            f"**Balance Sheet:**\n"
            f"- Total Assets: {_fmt(ratios['_total_assets'], '$')} | Total Debt: {_fmt(ratios['_total_debt'], '$')} | "
            f"Cash: {_fmt(ratios['_cash'], '$')} | Equity: {_fmt(ratios['_equity'], '$')}\n"
            f"\n"
            f"**Cash Flow:**\n"
            f"- Operating CF: {_fmt(ratios['_op_cashflow'], '$')} | FCF: {_fmt(ratios['_fcf'], '$')} | "
            f"CapEx: {_fmt(ratios['_capex'], '$')}\n"
            f"\n"
            f"**Pre-Computed Ratios:**\n"
            f"- Gross Margin: {_pct(ratios['gross_margin'])} | EBITDA Margin: {_pct(ratios['ebitda_margin'])} | "
            f"Net Margin: {_pct(ratios['net_margin'])}\n"
            f"- D/E: {_ratio(ratios['debt_to_equity'])} | Net Debt: {_fmt(ratios['net_debt'], '$')} | "
            f"Current Ratio: {_ratio(ratios['current_ratio'])}\n"
            f"- Interest Coverage: {_ratio(ratios['interest_coverage'])} | "
            f"Cash/Debt: {_ratio(ratios['cash_to_debt'])}\n"
            f"- FCF/EBITDA: {_pct(ratios['fcf_conversion'])} | "
            f"Earnings Quality (OpCF/NI): {_ratio(ratios['earnings_quality'])}\n"
            f"- ROA: {_pct(ratios['roa'])} | ROE: {_pct(ratios['roe'])} | "
            f"CapEx/Revenue: {_pct(ratios['capex_to_revenue'])}"
        )

    # Year-over-year revenue trend if we have 2+ years
    if len(years) >= 2:
        rev_trend_parts = []
        for i in range(len(years) - 1):
            newer = _compute_ratios(*years[i][1:])
            older = _compute_ratios(*years[i + 1][1:])
            growth = safe_div(
                (newer["_revenue"] or 0) - (older["_revenue"] or 0),
                older["_revenue"],
            )
            rev_trend_parts.append(
                f"{years[i + 1][0]}→{years[i][0]}: {_pct(growth)}"
            )
        sections.append(f"### Revenue Growth Trend\n" + " | ".join(rev_trend_parts))

    data_block = "\n\n".join(sections)

    sector_line = ""
    if sector:
        sector_line = f"Sector: {sector} | Industry: {industry or 'N/A'}\n\n"

    user_prompt = (
        f"Analyze the financial health of **{ticker}** using ONLY the data below.\n"
        f"Data retrieved: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"{sector_line}\n"
        f"## Financial Data\n\n"
        f"{data_block}\n\n"
        f"**Important:** All ratios are pre-computed — do NOT recalculate them. "
        f"Only make claims supported by the data provided. "
        f"Do not reference external knowledge about the company."
    )

    system_prompt = (
        "You are a financial analysis assistant writing a concise "
        "financial health assessment based strictly on provided data. "
        "Use markdown formatting.\n\n"
        "Structure your analysis as follows:\n"
        "## Executive Summary\n"
        "2-3 sentences: Is this company fundamentally strong, average, or distressed? "
        "## Profitability\n"
        "Interpret the margin trends. Is profitability improving or deteriorating? "
        "How does earnings quality look (OpCF vs Net Income)?\n\n"
        "## Capital Structure\n"
        "Assess leverage (D/E), liquidity (Cash/Debt), and solvency risk.\n\n"
        "## Cash Flow\n"
        "Evaluate FCF conversion, CapEx sustainability, and cash generation.\n\n"
        "## Key Signal\n"
        "One specific data point that stands out as the strongest bull or bear signal.\n\n"
        "Guidelines:\n"
        "- ONLY cite numbers from the data provided — ratios are pre-computed, don't recalculate\n"
        "- Consider typical industry ranges when interpreting ratios (e.g., D/E norms differ between utilities and tech)\n"
        "- Compare across years when multi-year data is available\n"
        "- Be specific: cite the actual numbers, not vague statements\n"
        "- Keep it concise — this is a quick health check, not a full memo\n"
        "- End with: '*AI-generated analysis for educational purposes. Not investment advice.*'"
    )

    return system_prompt, user_prompt


# ── Main entry point ──────────────────────────────────────────────────────

async def analyze_financials(
    ticker: str,
    financials: dict,
    sector: str | None = None,
    industry: str | None = None,
) -> Dict[str, Any]:
    """
    Generate AI analysis of financial statements using Claude Haiku.

    Returns dict with keys: content, input_tokens, output_tokens, model.
    On error, content holds the error message and token fields are None.
    """
    if not settings.ANTHROPIC_API_KEY:
        return {"content": "AI analysis is not configured. Set ANTHROPIC_API_KEY in your environment.",
                "input_tokens": None, "output_tokens": None, "model": None}

    system_prompt, user_prompt = _build_prompt(ticker, financials, sector=sector, industry=industry)

    if not system_prompt:
        return {"content": "Insufficient financial data available for analysis.",
                "input_tokens": None, "output_tokens": None, "model": None}

    try:
        client = _get_client()
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1500,
            temperature=0.3,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return {
            "content": response.content[0].text,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "model": MODEL,
        }
    except Exception as e:
        logger.exception("AI analysis failed for %s", ticker)
        return {"content": "Analysis temporarily unavailable. Please try again.",
                "input_tokens": None, "output_tokens": None, "model": None}
