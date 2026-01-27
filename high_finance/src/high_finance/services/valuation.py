"""
Enhanced Valuation Service

Features:
- DCF with FCFF proxy
- Multiples-based valuation (EV/EBITDA, EV/Revenue, P/E comps)
- Sensitivity tornado analysis
- Bear/Base/Bull scenario ranges
- Upside/downside vs current price
"""

import math
from typing import Any, Dict, List, Optional, Tuple

import yfinance as yf

from high_finance.services.financials import get_financial_statements


def _latest_column(d: Dict[str, Dict[str, float]]) -> Optional[str]:
    if not d:
        return None
    return sorted(d.keys())[-1]


def _get_line(table: Dict[str, Dict[str, float]], col: str, keys: list[str]) -> Optional[float]:
    bucket = table.get(col, {})
    for k in keys:
        if k in bucket:
            return float(bucket[k])
    return None


def _safe(v: Optional[float], default: float) -> float:
    return float(v) if v is not None and math.isfinite(v) else default


def _dcf(
    revenue0: float,
    margin: float,
    growth: float,
    tax: float,
    wacc: float,
    terminal_g: float,
    years: int = 5,
) -> Dict[str, Any]:
    """Simple unlevered FCFF proxy DCF model."""
    fcf = []
    rev = revenue0
    for _ in range(years):
        rev *= (1.0 + growth)
        ebit = rev * margin
        fcff = ebit * (1.0 - tax)
        fcf.append(fcff)

    # PV of explicit period
    pv = 0.0
    for t, cf in enumerate(fcf, start=1):
        pv += cf / ((1.0 + wacc) ** t)

    # Terminal value using Gordon growth
    tv = (fcf[-1] * (1.0 + terminal_g)) / max(1e-9, (wacc - terminal_g))
    pv_tv = tv / ((1.0 + wacc) ** years)

    return {
        "years": years,
        "fcff_projection": [float(x) for x in fcf],
        "pv_explicit": float(pv),
        "pv_terminal": float(pv_tv),
        "enterprise_value": float(pv + pv_tv),
        "terminal_value": float(tv),
        "terminal_pct_of_ev": float(pv_tv / (pv + pv_tv)) if (pv + pv_tv) > 0 else 0,
    }


def _sensitivity_analysis(
    revenue0: float,
    net_debt: float,
    shares: Optional[float],
    base_inputs: Dict[str, float],
    years: int = 5,
) -> Dict[str, Any]:
    """
    Calculate sensitivity of fair value to each input parameter.
    Returns tornado chart data showing impact of ±20% change in each input.
    """
    if not shares or shares <= 0:
        return {"error": "Cannot compute sensitivity without shares outstanding"}

    base_dcf = _dcf(
        revenue0=revenue0,
        margin=base_inputs["margin"],
        growth=base_inputs["growth"],
        tax=base_inputs["tax"],
        wacc=base_inputs["wacc"],
        terminal_g=base_inputs["terminal_g"],
        years=years,
    )
    base_ev = base_dcf["enterprise_value"]
    base_equity = base_ev - net_debt
    base_fv = base_equity / shares

    sensitivities = []

    # Define perturbation ranges for each input
    perturbations = {
        "growth": {"low": -0.03, "high": 0.03, "label": "Revenue Growth"},
        "margin": {"low": -0.03, "high": 0.03, "label": "Operating Margin"},
        "wacc": {"low": 0.015, "high": -0.015, "label": "WACC"},  # inverted: lower WACC = higher value
        "terminal_g": {"low": -0.01, "high": 0.01, "label": "Terminal Growth"},
        "tax": {"low": 0.03, "high": -0.03, "label": "Tax Rate"},  # inverted
    }

    for param, config in perturbations.items():
        inputs_low = base_inputs.copy()
        inputs_high = base_inputs.copy()

        # Clamp to reasonable bounds
        inputs_low[param] = max(0.001 if param == "wacc" else -0.5, base_inputs[param] + config["low"])
        inputs_high[param] = min(0.99 if param == "margin" else 1.0, base_inputs[param] + config["high"])

        # Ensure wacc > terminal_g
        if param == "wacc":
            inputs_low[param] = max(inputs_low[param], base_inputs["terminal_g"] + 0.01)
        if param == "terminal_g":
            inputs_high[param] = min(inputs_high[param], base_inputs["wacc"] - 0.01)

        dcf_low = _dcf(revenue0=revenue0, years=years, **inputs_low)
        dcf_high = _dcf(revenue0=revenue0, years=years, **inputs_high)

        fv_low = (dcf_low["enterprise_value"] - net_debt) / shares
        fv_high = (dcf_high["enterprise_value"] - net_debt) / shares

        sensitivities.append({
            "param": param,
            "label": config["label"],
            "base_value": base_inputs[param],
            "low_value": inputs_low[param],
            "high_value": inputs_high[param],
            "fv_at_low": float(fv_low),
            "fv_at_high": float(fv_high),
            "fv_base": float(base_fv),
            "impact_low": float(fv_low - base_fv),
            "impact_high": float(fv_high - base_fv),
            "impact_range": float(abs(fv_high - fv_low)),
        })

    # Sort by impact range (largest first for tornado)
    sensitivities.sort(key=lambda x: x["impact_range"], reverse=True)

    return {
        "base_fair_value": float(base_fv),
        "sensitivities": sensitivities,
    }


def _multiples_valuation(
    ticker: str,
    info: Dict[str, Any],
    revenue: float,
    ebitda: Optional[float],
    net_income: Optional[float],
    net_debt: float,
    shares: Optional[float],
) -> Dict[str, Any]:
    """
    Valuation using trading multiples and peer comparisons.
    """
    result = {
        "ev_revenue": None,
        "ev_ebitda": None,
        "pe_based": None,
        "implied_values": [],
    }

    if not shares or shares <= 0:
        return result

    # Get current market data
    market_cap = info.get("marketCap")
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    
    # Sector/industry multiples (simplified - in production you'd pull peer comps)
    sector = info.get("sector", "")
    industry = info.get("industry", "")

    # Default multiples by sector (rough approximations)
    sector_multiples = {
        "Technology": {"ev_revenue": 6.0, "ev_ebitda": 18.0, "pe": 28.0},
        "Healthcare": {"ev_revenue": 4.0, "ev_ebitda": 14.0, "pe": 22.0},
        "Financial Services": {"ev_revenue": 3.0, "ev_ebitda": 10.0, "pe": 12.0},
        "Consumer Cyclical": {"ev_revenue": 1.5, "ev_ebitda": 10.0, "pe": 18.0},
        "Consumer Defensive": {"ev_revenue": 2.0, "ev_ebitda": 12.0, "pe": 20.0},
        "Industrials": {"ev_revenue": 2.0, "ev_ebitda": 11.0, "pe": 18.0},
        "Energy": {"ev_revenue": 1.5, "ev_ebitda": 6.0, "pe": 12.0},
        "Utilities": {"ev_revenue": 3.0, "ev_ebitda": 10.0, "pe": 16.0},
        "Real Estate": {"ev_revenue": 8.0, "ev_ebitda": 18.0, "pe": 35.0},
        "Basic Materials": {"ev_revenue": 1.5, "ev_ebitda": 7.0, "pe": 14.0},
        "Communication Services": {"ev_revenue": 3.0, "ev_ebitda": 10.0, "pe": 18.0},
    }

    multiples = sector_multiples.get(sector, {"ev_revenue": 3.0, "ev_ebitda": 12.0, "pe": 20.0})

    # EV/Revenue based valuation
    if revenue > 0:
        implied_ev = revenue * multiples["ev_revenue"]
        implied_equity = implied_ev - net_debt
        implied_fv = implied_equity / shares
        result["ev_revenue"] = {
            "multiple_used": multiples["ev_revenue"],
            "implied_ev": float(implied_ev),
            "implied_equity": float(implied_equity),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "EV/Revenue",
            "multiple": multiples["ev_revenue"],
            "fair_value": float(implied_fv),
        })

    # EV/EBITDA based valuation
    if ebitda and ebitda > 0:
        implied_ev = ebitda * multiples["ev_ebitda"]
        implied_equity = implied_ev - net_debt
        implied_fv = implied_equity / shares
        result["ev_ebitda"] = {
            "multiple_used": multiples["ev_ebitda"],
            "implied_ev": float(implied_ev),
            "implied_equity": float(implied_equity),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "EV/EBITDA",
            "multiple": multiples["ev_ebitda"],
            "fair_value": float(implied_fv),
        })

    # P/E based valuation
    if net_income and net_income > 0:
        eps = net_income / shares
        implied_fv = eps * multiples["pe"]
        result["pe_based"] = {
            "multiple_used": multiples["pe"],
            "eps": float(eps),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "P/E",
            "multiple": multiples["pe"],
            "fair_value": float(implied_fv),
        })

    # Summary stats
    if result["implied_values"]:
        fvs = [v["fair_value"] for v in result["implied_values"]]
        result["multiples_summary"] = {
            "min": float(min(fvs)),
            "max": float(max(fvs)),
            "avg": float(sum(fvs) / len(fvs)),
            "sector": sector,
            "industry": industry,
        }

    return result


def _scenario_analysis(
    revenue0: float,
    net_debt: float,
    shares: Optional[float],
    base_inputs: Dict[str, float],
    years: int = 5,
) -> Dict[str, Any]:
    """
    Generate bear/base/bull scenario valuations.
    """
    if not shares or shares <= 0:
        return {"error": "Cannot compute scenarios without shares outstanding"}

    scenarios = {}

    # Define scenario adjustments
    scenario_defs = {
        "bear": {
            "growth": base_inputs["growth"] - 0.05,
            "margin": base_inputs["margin"] - 0.03,
            "wacc": base_inputs["wacc"] + 0.02,
            "terminal_g": base_inputs["terminal_g"] - 0.01,
            "tax": base_inputs["tax"],
        },
        "base": base_inputs.copy(),
        "bull": {
            "growth": base_inputs["growth"] + 0.05,
            "margin": base_inputs["margin"] + 0.03,
            "wacc": base_inputs["wacc"] - 0.015,
            "terminal_g": base_inputs["terminal_g"] + 0.005,
            "tax": base_inputs["tax"],
        },
    }

    for scenario_name, inputs in scenario_defs.items():
        # Clamp values
        inputs["growth"] = max(-0.2, min(0.5, inputs["growth"]))
        inputs["margin"] = max(-0.1, min(0.6, inputs["margin"]))
        inputs["wacc"] = max(0.04, min(0.25, inputs["wacc"]))
        inputs["terminal_g"] = max(-0.01, min(inputs["wacc"] - 0.01, inputs["terminal_g"]))

        dcf = _dcf(revenue0=revenue0, years=years, **inputs)
        equity_value = dcf["enterprise_value"] - net_debt
        fair_value = equity_value / shares

        scenarios[scenario_name] = {
            "inputs": inputs,
            "enterprise_value": float(dcf["enterprise_value"]),
            "equity_value": float(equity_value),
            "fair_value_per_share": float(fair_value),
        }

    return scenarios


async def get_valuation_bundle(
    ticker: str,
    growth: float = 0.10,
    margin: float = 0.20,
    tax: float = 0.21,
    wacc: float = 0.10,
    terminal_g: float = 0.03,
) -> Dict[str, Any]:
    """
    Comprehensive valuation bundle with DCF, multiples, sensitivity, and scenarios.
    """
    stock = yf.Ticker(ticker)
    info = stock.info or {}

    stmts = await get_financial_statements(ticker)

    annual_is = stmts.get("annual", {}).get("income_statement", {})
    annual_bs = stmts.get("annual", {}).get("balance_sheet", {})

    col = _latest_column(annual_is)
    if not col:
        return {"ticker": ticker, "error": "No annual income statement available"}

    # Revenue
    revenue = _get_line(annual_is, col, ["Total Revenue", "TotalRevenue", "Revenue", "Total revenue"])
    revenue0 = _safe(revenue, 0.0)
    if revenue0 <= 0:
        return {"ticker": ticker, "error": "Could not read revenue from financials"}

    # EBITDA (for multiples)
    ebitda = _get_line(annual_is, col, ["EBITDA", "Ebitda", "Normalized EBITDA"])
    if not ebitda:
        # Try to compute: Operating Income + D&A
        op_income = _get_line(annual_is, col, ["Operating Income", "OperatingIncome", "EBIT"])
        da = _get_line(annual_is, col, ["Depreciation And Amortization", "DepreciationAndAmortization"])
        if op_income and da:
            ebitda = op_income + da

    # Net Income (for P/E)
    net_income = _get_line(annual_is, col, ["Net Income", "NetIncome", "Net Income Common Stockholders"])

    # Net debt
    bs_col = _latest_column(annual_bs)
    net_debt = 0.0
    if bs_col:
        cash_equiv = _get_line(annual_bs, bs_col, ["Cash And Cash Equivalents", "CashAndCashEquivalents"])
        short_term_inv = _get_line(annual_bs, bs_col, ["Short Term Investments", "ShortTermInvestments"])
        agg_liquidity = _get_line(annual_bs, bs_col, ["Cash Cash Equivalents And Short Term Investments"])
        cash_total = _safe(agg_liquidity or (_safe(cash_equiv, 0) + _safe(short_term_inv, 0)), 0.0)

        long_term_debt = _get_line(annual_bs, bs_col, ["Long Term Debt", "LongTermDebt"])
        short_term_debt = _get_line(annual_bs, bs_col, ["Short Term Debt", "Current Portion Of Long Term Debt"])
        total_debt = _get_line(annual_bs, bs_col, ["Total Debt", "TotalDebt"])
        debt_total = _safe(total_debt or (_safe(long_term_debt, 0) + _safe(short_term_debt, 0)), 0.0)

        net_debt = debt_total - cash_total

    # Shares outstanding
    shares = info.get("sharesOutstanding")
    shares = float(shares) if shares else None

    # Current price for upside/downside
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    current_price = float(current_price) if current_price else None

    # Base inputs dict
    base_inputs = {
        "growth": growth,
        "margin": margin,
        "tax": tax,
        "wacc": wacc,
        "terminal_g": terminal_g,
    }

    # Run DCF
    dcf = _dcf(
        revenue0=revenue0,
        margin=margin,
        growth=growth,
        tax=tax,
        wacc=wacc,
        terminal_g=terminal_g,
        years=5,
    )

    equity_value = dcf["enterprise_value"] - net_debt
    fair_value_per_share = (equity_value / shares) if shares and shares > 0 else None

    # Calculate upside/downside
    upside_downside = None
    if fair_value_per_share and current_price and current_price > 0:
        upside_downside = {
            "current_price": float(current_price),
            "fair_value": float(fair_value_per_share),
            "upside_pct": float((fair_value_per_share - current_price) / current_price),
            "absolute_diff": float(fair_value_per_share - current_price),
        }

    # Sensitivity analysis
    sensitivity = _sensitivity_analysis(
        revenue0=revenue0,
        net_debt=net_debt,
        shares=shares,
        base_inputs=base_inputs,
        years=5,
    )

    # Multiples valuation
    multiples = _multiples_valuation(
        ticker=ticker,
        info=info,
        revenue=revenue0,
        ebitda=ebitda,
        net_income=net_income,
        net_debt=net_debt,
        shares=shares,
    )

    # Scenario analysis
    scenarios = _scenario_analysis(
        revenue0=revenue0,
        net_debt=net_debt,
        shares=shares,
        base_inputs=base_inputs,
        years=5,
    )

    # Blended fair value range
    fair_value_range = None
    if scenarios and "bear" in scenarios and "bull" in scenarios:
        all_fvs = [scenarios["bear"]["fair_value_per_share"], scenarios["base"]["fair_value_per_share"], scenarios["bull"]["fair_value_per_share"]]
        
        # Add multiples if available
        if multiples.get("implied_values"):
            all_fvs.extend([v["fair_value"] for v in multiples["implied_values"]])

        fair_value_range = {
            "low": float(min(all_fvs)),
            "mid": float(scenarios["base"]["fair_value_per_share"]),
            "high": float(max(all_fvs)),
            "dcf_base": float(fair_value_per_share) if fair_value_per_share else None,
        }

    return {
        "ticker": ticker,
        "inputs": base_inputs,
        "facts": {
            "revenue0": revenue0,
            "ebitda": ebitda,
            "net_income": net_income,
            "net_debt_est": net_debt,
            "shares_outstanding": shares,
            "current_price": current_price,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
        },
        "dcf": dcf,
        "equity_value_est": float(equity_value),
        "fair_value_per_share_est": float(fair_value_per_share) if fair_value_per_share else None,
        "upside_downside": upside_downside,
        "sensitivity": sensitivity,
        "multiples": multiples,
        "scenarios": scenarios,
        "fair_value_range": fair_value_range,
    }