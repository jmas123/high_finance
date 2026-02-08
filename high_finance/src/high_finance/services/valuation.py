"""
Enhanced Valuation Service

Features:
- DCF with FCFF proxy
- Multiples-based valuation (EV/EBITDA, EV/Revenue, P/E comps)
- Sensitivity tornado analysis
- Bear/Base/Bull scenario ranges
- Upside/downside vs current price
- Smart defaults from actual financials
- Assumption warnings/guardrails
- Analyst consensus overlay
"""

import asyncio
import math
from typing import Any, Dict, List, Optional

from high_finance.services.financials import get_financial_statements
from high_finance.core.cache import get_cached, get_or_compute, set_cached, valuation_ttl
from high_finance.services.yf_cache import get_yf_info
from high_finance.utils.yf_fields import (
    REVENUE, OPERATING_INCOME, EBITDA, NET_INCOME, DEPRECIATION,
    PRETAX_INCOME, TAX_PROVISION,
    CASH, SHORT_TERM_INVESTMENTS, CASH_AND_STI,
    LONG_TERM_DEBT, SHORT_TERM_DEBT, TOTAL_DEBT,
)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTOR BENCHMARKS
# ═══════════════════════════════════════════════════════════════════════════════

SECTOR_BENCHMARKS = {
    "Technology": {
        "growth": {"p25": 0.08, "median": 0.15, "p75": 0.25, "p90": 0.35},
        "margin": {"p25": 0.12, "median": 0.20, "p75": 0.28, "p90": 0.35},
        "ev_revenue": 6.0,
        "ev_ebitda": 18.0,
        "pe": 28.0,
    },
    "Healthcare": {
        "growth": {"p25": 0.04, "median": 0.10, "p75": 0.18, "p90": 0.28},
        "margin": {"p25": 0.08, "median": 0.15, "p75": 0.22, "p90": 0.30},
        "ev_revenue": 4.0,
        "ev_ebitda": 14.0,
        "pe": 22.0,
    },
    "Financial Services": {
        "growth": {"p25": 0.02, "median": 0.06, "p75": 0.10, "p90": 0.15},
        "margin": {"p25": 0.15, "median": 0.25, "p75": 0.35, "p90": 0.45},
        "ev_revenue": 3.0,
        "ev_ebitda": 10.0,
        "pe": 12.0,
    },
    "Consumer Cyclical": {
        "growth": {"p25": 0.02, "median": 0.07, "p75": 0.12, "p90": 0.20},
        "margin": {"p25": 0.05, "median": 0.10, "p75": 0.15, "p90": 0.20},
        "ev_revenue": 1.5,
        "ev_ebitda": 10.0,
        "pe": 18.0,
    },
    "Consumer Defensive": {
        "growth": {"p25": 0.01, "median": 0.04, "p75": 0.08, "p90": 0.12},
        "margin": {"p25": 0.08, "median": 0.12, "p75": 0.18, "p90": 0.22},
        "ev_revenue": 2.0,
        "ev_ebitda": 12.0,
        "pe": 20.0,
    },
    "Industrials": {
        "growth": {"p25": 0.02, "median": 0.06, "p75": 0.10, "p90": 0.15},
        "margin": {"p25": 0.08, "median": 0.12, "p75": 0.16, "p90": 0.20},
        "ev_revenue": 2.0,
        "ev_ebitda": 11.0,
        "pe": 18.0,
    },
    "Energy": {
        "growth": {"p25": -0.05, "median": 0.03, "p75": 0.10, "p90": 0.20},
        "margin": {"p25": 0.05, "median": 0.12, "p75": 0.18, "p90": 0.25},
        "ev_revenue": 1.5,
        "ev_ebitda": 6.0,
        "pe": 12.0,
    },
    "Utilities": {
        "growth": {"p25": 0.01, "median": 0.03, "p75": 0.05, "p90": 0.08},
        "margin": {"p25": 0.15, "median": 0.22, "p75": 0.28, "p90": 0.35},
        "ev_revenue": 3.0,
        "ev_ebitda": 10.0,
        "pe": 16.0,
    },
    "Real Estate": {
        "growth": {"p25": 0.02, "median": 0.05, "p75": 0.10, "p90": 0.15},
        "margin": {"p25": 0.25, "median": 0.35, "p75": 0.45, "p90": 0.55},
        "ev_revenue": 8.0,
        "ev_ebitda": 18.0,
        "pe": 35.0,
    },
    "Basic Materials": {
        "growth": {"p25": -0.02, "median": 0.04, "p75": 0.10, "p90": 0.18},
        "margin": {"p25": 0.08, "median": 0.14, "p75": 0.20, "p90": 0.28},
        "ev_revenue": 1.5,
        "ev_ebitda": 7.0,
        "pe": 14.0,
    },
    "Communication Services": {
        "growth": {"p25": 0.02, "median": 0.08, "p75": 0.15, "p90": 0.25},
        "margin": {"p25": 0.12, "median": 0.20, "p75": 0.28, "p90": 0.35},
        "ev_revenue": 3.0,
        "ev_ebitda": 10.0,
        "pe": 18.0,
    },
}

DEFAULT_BENCHMARKS = {
    "growth": {"p25": 0.03, "median": 0.08, "p75": 0.15, "p90": 0.25},
    "margin": {"p25": 0.08, "median": 0.15, "p75": 0.22, "p90": 0.30},
    "ev_revenue": 3.0,
    "ev_ebitda": 12.0,
    "pe": 20.0,
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _reported_columns(d: Dict[str, Dict[str, float]], min_fields: int = 10) -> List[str]:
    """Return column date-strings sorted ascending, excluding estimate-only columns.

    yfinance 1.1+ can include forward fiscal-year columns that are mostly NaN
    (e.g., only EPS/shares filled — 4 fields).  These break valuation because
    _latest_column would pick a column with no revenue.
    """
    if not d:
        return []
    return sorted(c for c in d.keys() if len(d[c]) >= min_fields)


def _latest_column(d: Dict[str, Dict[str, float]]) -> Optional[str]:
    cols = _reported_columns(d)
    return cols[-1] if cols else None


def _get_column_by_index(d: Dict[str, Dict[str, float]], index: int) -> Optional[str]:
    """Get column by reverse index (0 = most recent, 1 = second most recent, etc.)"""
    cols = _reported_columns(d)
    cols.reverse()
    if index < len(cols):
        return cols[index]
    return None


def _get_line(table: Dict[str, Dict[str, float]], col: str, keys: list[str]) -> Optional[float]:
    bucket = table.get(col, {})
    for k in keys:
        if k in bucket:
            return float(bucket[k])
    return None


def _safe(v: Optional[float], default: float) -> float:
    return float(v) if v is not None and math.isfinite(v) else default


def _compute_cagr(start_value: float, end_value: float, years: int) -> Optional[float]:
    """Compute compound annual growth rate."""
    if start_value <= 0 or end_value <= 0 or years <= 0:
        return None
    return (end_value / start_value) ** (1 / years) - 1


# ═══════════════════════════════════════════════════════════════════════════════
# SMART DEFAULTS & WARNINGS
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_smart_defaults(
    annual_is: Dict[str, Dict[str, float]],
    info: Dict[str, Any],
    sector: str,
) -> Dict[str, Any]:
    """Compute suggested default values from actual financials."""
    benchmarks = SECTOR_BENCHMARKS.get(sector, DEFAULT_BENCHMARKS)
    
    defaults = {
        "growth": {
            "suggested": benchmarks["growth"]["median"],
            "historical_3y": None,
            "historical_1y": None,
            "analyst_estimate": None,
            "sector_median": benchmarks["growth"]["median"],
            "sector_p25": benchmarks["growth"]["p25"],
            "sector_p75": benchmarks["growth"]["p75"],
            "source": "sector median",
        },
        "margin": {
            "suggested": benchmarks["margin"]["median"],
            "current": None,
            "historical_avg": None,
            "sector_median": benchmarks["margin"]["median"],
            "sector_p25": benchmarks["margin"]["p25"],
            "sector_p75": benchmarks["margin"]["p75"],
            "source": "sector median",
        },
        "wacc": {
            "suggested": 0.10,
            "beta_implied": None,
            "beta": None,
            "source": "default 10%",
        },
        "terminal_g": {
            "suggested": 0.025,
            "source": "long-run GDP proxy",
        },
        "tax": {
            "suggested": 0.21,
            "effective_rate": None,
            "source": "US statutory rate",
        },
    }
    
    # Revenue growth - historical
    revenues = []
    for i in range(4):
        col = _get_column_by_index(annual_is, i)
        if col:
            rev = _get_line(annual_is, col, REVENUE)
            if rev and rev > 0:
                revenues.append(rev)
    
    if len(revenues) >= 2:
        defaults["growth"]["historical_1y"] = (revenues[0] / revenues[1]) - 1
        
    if len(revenues) >= 4:
        cagr_3y = _compute_cagr(revenues[3], revenues[0], 3)
        if cagr_3y is not None:
            defaults["growth"]["historical_3y"] = cagr_3y
    
    # Analyst estimate
    analyst_growth = info.get("revenueGrowth")
    if analyst_growth is not None:
        defaults["growth"]["analyst_estimate"] = float(analyst_growth)
    
    # Pick best growth default
    raw_growth = None
    if defaults["growth"]["analyst_estimate"] is not None:
        raw_growth = defaults["growth"]["analyst_estimate"]
        defaults["growth"]["suggested"] = defaults["growth"]["analyst_estimate"]
        defaults["growth"]["source"] = "analyst estimate"
    elif defaults["growth"]["historical_3y"] is not None:
        raw_growth = defaults["growth"]["historical_3y"]
        defaults["growth"]["suggested"] = defaults["growth"]["historical_3y"]
        defaults["growth"]["source"] = "3-year historical CAGR"
    elif defaults["growth"]["historical_1y"] is not None:
        raw_growth = defaults["growth"]["historical_1y"]
        defaults["growth"]["suggested"] = defaults["growth"]["historical_1y"]
        defaults["growth"]["source"] = "1-year historical"
    
    # Clamp growth to slider bounds (-10% to 50%) but keep raw value
    defaults["growth"]["raw_value"] = raw_growth
    defaults["growth"]["was_clamped"] = raw_growth is not None and (raw_growth > 0.50 or raw_growth < -0.10)
    defaults["growth"]["suggested"] = max(-0.10, min(0.50, defaults["growth"]["suggested"]))
    
    # Operating margin
    col = _latest_column(annual_is)
    if col:
        revenue = _get_line(annual_is, col, REVENUE)
        op_income = _get_line(annual_is, col, OPERATING_INCOME)
        ebitda = _get_line(annual_is, col, EBITDA)
        
        if revenue and revenue > 0:
            if op_income is not None:
                defaults["margin"]["current"] = op_income / revenue
                defaults["margin"]["suggested"] = op_income / revenue
                defaults["margin"]["source"] = "current operating margin"
            elif ebitda is not None:
                defaults["margin"]["current"] = ebitda / revenue
                defaults["margin"]["suggested"] = ebitda / revenue
                defaults["margin"]["source"] = "current EBITDA margin"
    
    # Historical average margin
    margins = []
    for i in range(4):
        col = _get_column_by_index(annual_is, i)
        if col:
            rev = _get_line(annual_is, col, REVENUE)
            op = _get_line(annual_is, col, OPERATING_INCOME)
            if rev and rev > 0 and op is not None:
                margins.append(op / rev)
    
    if margins:
        defaults["margin"]["historical_avg"] = sum(margins) / len(margins)
    
    # Clamp margin to slider bounds (-10% to 50%)
    defaults["margin"]["suggested"] = max(-0.10, min(0.50, defaults["margin"]["suggested"]))
    
    # WACC from beta
    beta = info.get("beta")
    if beta is not None and beta > 0:
        cost_of_equity = 0.045 + float(beta) * 0.055
        wacc_est = 0.70 * cost_of_equity + 0.30 * 0.06 * (1 - 0.21)
        defaults["wacc"]["beta_implied"] = wacc_est
        defaults["wacc"]["beta"] = float(beta)
        defaults["wacc"]["suggested"] = wacc_est
        defaults["wacc"]["source"] = f"CAPM (β={beta:.2f})"
    
    # Clamp WACC to slider bounds (5% to 20%)
    defaults["wacc"]["suggested"] = max(0.05, min(0.20, defaults["wacc"]["suggested"]))
    
    # Effective tax rate
    col = _latest_column(annual_is)
    if col:
        pretax = _get_line(annual_is, col, PRETAX_INCOME)
        tax_expense = _get_line(annual_is, col, TAX_PROVISION)
        if pretax and pretax > 0 and tax_expense is not None:
            effective_rate = tax_expense / pretax
            if 0 < effective_rate < 0.50:
                defaults["tax"]["effective_rate"] = effective_rate
                defaults["tax"]["suggested"] = effective_rate
                defaults["tax"]["source"] = "effective tax rate"
    
    # Clamp tax to slider bounds (10% to 35%)
    defaults["tax"]["suggested"] = max(0.10, min(0.35, defaults["tax"]["suggested"]))
    
    return defaults


def _generate_warnings(
    inputs: Dict[str, float],
    defaults: Dict[str, Any],
    sector: str,
) -> List[Dict[str, Any]]:
    """Generate warnings when assumptions look aggressive or conservative."""
    warnings = []
    benchmarks = SECTOR_BENCHMARKS.get(sector, DEFAULT_BENCHMARKS)
    
    # Check if growth was clamped from a much higher value
    raw_growth = defaults["growth"].get("raw_value")
    if raw_growth is not None and raw_growth > 0.50:
        warnings.append({
            "param": "growth",
            "level": "clamped",
            "severity": "info",
            "message": f"Historical growth was {raw_growth*100:.0f}% - clamped to 50% max for modeling",
            "suggestion": "Extremely high growth rates rarely persist. Consider if this is sustainable.",
        })
    
    growth = inputs["growth"]
    if growth > benchmarks["growth"]["p90"]:
        warnings.append({
            "param": "growth",
            "level": "high",
            "severity": "warning",
            "message": f"Growth {growth*100:.0f}% exceeds 90th percentile for {sector} ({benchmarks['growth']['p90']*100:.0f}%)",
            "suggestion": f"Sector median is {benchmarks['growth']['median']*100:.0f}%",
        })
    elif growth > benchmarks["growth"]["p75"]:
        warnings.append({
            "param": "growth",
            "level": "elevated",
            "severity": "info",
            "message": f"Growth {growth*100:.0f}% is above 75th percentile for {sector}",
            "suggestion": None,
        })
    elif growth > 0.30:
        warnings.append({
            "param": "growth",
            "level": "high",
            "severity": "warning",
            "message": f"Growth {growth*100:.0f}% is very aggressive - only ~5% of S&P 500 sustains this",
            "suggestion": "Consider if competitive moat justifies this",
        })
    
    if growth < 0 and defaults["growth"]["historical_3y"] and defaults["growth"]["historical_3y"] > 0.05:
        warnings.append({
            "param": "growth",
            "level": "low",
            "severity": "info",
            "message": f"Assuming negative growth, but historical 3Y CAGR was {defaults['growth']['historical_3y']*100:.0f}%",
            "suggestion": None,
        })
    
    margin = inputs["margin"]
    if margin > benchmarks["margin"]["p90"]:
        warnings.append({
            "param": "margin",
            "level": "high",
            "severity": "warning",
            "message": f"Margin {margin*100:.0f}% exceeds 90th percentile for {sector} ({benchmarks['margin']['p90']*100:.0f}%)",
            "suggestion": "Assumes best-in-class profitability",
        })
    elif margin > benchmarks["margin"]["p75"]:
        warnings.append({
            "param": "margin",
            "level": "elevated",
            "severity": "info",
            "message": f"Margin {margin*100:.0f}% is above 75th percentile for {sector}",
            "suggestion": None,
        })
    
    current_margin = defaults["margin"].get("current")
    if current_margin and margin > current_margin + 0.10:
        warnings.append({
            "param": "margin",
            "level": "expansion",
            "severity": "warning",
            "message": f"Assuming {(margin - current_margin)*100:.0f}pp margin expansion from current {current_margin*100:.0f}%",
            "suggestion": "Significant margin expansion is rare without structural change",
        })
    
    wacc = inputs["wacc"]
    if wacc < 0.06:
        warnings.append({
            "param": "wacc",
            "level": "low",
            "severity": "warning",
            "message": f"WACC {wacc*100:.1f}% is below investment-grade bond yields",
            "suggestion": "Even Apple's WACC is ~9%",
        })
    elif wacc < 0.08:
        warnings.append({
            "param": "wacc",
            "level": "low",
            "severity": "info",
            "message": f"WACC {wacc*100:.1f}% implies very low risk - appropriate for stable utilities/staples",
            "suggestion": None,
        })
    elif wacc > 0.15:
        warnings.append({
            "param": "wacc",
            "level": "high",
            "severity": "info",
            "message": f"WACC {wacc*100:.1f}% implies high risk / emerging market exposure",
            "suggestion": None,
        })
    
    beta_wacc = defaults["wacc"].get("beta_implied")
    if beta_wacc and abs(wacc - beta_wacc) > 0.02:
        warnings.append({
            "param": "wacc",
            "level": "deviation",
            "severity": "info",
            "message": f"Your WACC differs from CAPM estimate ({beta_wacc*100:.1f}%) by {abs(wacc - beta_wacc)*100:.1f}pp",
            "suggestion": None,
        })
    
    terminal_g = inputs["terminal_g"]
    if terminal_g > 0.035:
        warnings.append({
            "param": "terminal_g",
            "level": "high",
            "severity": "warning",
            "message": f"Terminal growth {terminal_g*100:.1f}% exceeds long-run nominal GDP (~3%)",
            "suggestion": "Company would eventually exceed entire economy",
        })
    
    if terminal_g >= wacc - 0.02:
        warnings.append({
            "param": "terminal_g",
            "level": "critical",
            "severity": "error",
            "message": f"Terminal growth ({terminal_g*100:.1f}%) too close to WACC ({wacc*100:.1f}%)",
            "suggestion": "Creates unstable/infinite terminal value",
        })
    
    return warnings


# ═══════════════════════════════════════════════════════════════════════════════
# DCF CORE
# ═══════════════════════════════════════════════════════════════════════════════

def _dcf(
    revenue0: float,
    margin: float,
    growth: float,
    tax: float,
    wacc: float,
    terminal_g: float,
    years: int = 5,
) -> Dict[str, Any]:
    fcf = []
    rev = revenue0
    for _ in range(years):
        rev *= (1.0 + growth)
        ebit = rev * margin
        fcff = ebit * (1.0 - tax)
        fcf.append(fcff)

    pv = 0.0
    for t, cf in enumerate(fcf, start=1):
        pv += cf / ((1.0 + wacc) ** t)

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
    if not shares or shares <= 0:
        return {"error": "Cannot compute sensitivity without shares outstanding"}

    base_dcf = _dcf(revenue0=revenue0, years=years, **base_inputs)
    base_ev = base_dcf["enterprise_value"]
    base_equity = base_ev - net_debt
    base_fv = base_equity / shares

    sensitivities = []

    perturbations = {
        "growth": {"low": -0.03, "high": 0.03, "label": "Revenue Growth"},
        "margin": {"low": -0.03, "high": 0.03, "label": "Operating Margin"},
        "wacc": {"low": 0.015, "high": -0.015, "label": "WACC"},
        "terminal_g": {"low": -0.01, "high": 0.01, "label": "Terminal Growth"},
        "tax": {"low": 0.03, "high": -0.03, "label": "Tax Rate"},
    }

    for param, config in perturbations.items():
        inputs_low = base_inputs.copy()
        inputs_high = base_inputs.copy()

        inputs_low[param] = max(0.001 if param == "wacc" else -0.5, base_inputs[param] + config["low"])
        inputs_high[param] = min(0.99 if param == "margin" else 1.0, base_inputs[param] + config["high"])

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
    sector: str,
) -> Dict[str, Any]:
    result = {
        "ev_revenue": None,
        "ev_ebitda": None,
        "pe_based": None,
        "implied_values": [],
    }

    if not shares or shares <= 0:
        return result

    benchmarks = SECTOR_BENCHMARKS.get(sector, DEFAULT_BENCHMARKS)

    if revenue > 0:
        implied_ev = revenue * benchmarks["ev_revenue"]
        implied_equity = implied_ev - net_debt
        implied_fv = implied_equity / shares
        result["ev_revenue"] = {
            "multiple_used": benchmarks["ev_revenue"],
            "implied_ev": float(implied_ev),
            "implied_equity": float(implied_equity),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "EV/Revenue",
            "multiple": benchmarks["ev_revenue"],
            "fair_value": float(implied_fv),
        })

    if ebitda and ebitda > 0:
        implied_ev = ebitda * benchmarks["ev_ebitda"]
        implied_equity = implied_ev - net_debt
        implied_fv = implied_equity / shares
        result["ev_ebitda"] = {
            "multiple_used": benchmarks["ev_ebitda"],
            "implied_ev": float(implied_ev),
            "implied_equity": float(implied_equity),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "EV/EBITDA",
            "multiple": benchmarks["ev_ebitda"],
            "fair_value": float(implied_fv),
        })

    if net_income and net_income > 0:
        eps = net_income / shares
        implied_fv = eps * benchmarks["pe"]
        result["pe_based"] = {
            "multiple_used": benchmarks["pe"],
            "eps": float(eps),
            "implied_fv_per_share": float(implied_fv),
        }
        result["implied_values"].append({
            "method": "P/E",
            "multiple": benchmarks["pe"],
            "fair_value": float(implied_fv),
        })

    if result["implied_values"]:
        fvs = [v["fair_value"] for v in result["implied_values"]]
        result["multiples_summary"] = {
            "min": float(min(fvs)),
            "max": float(max(fvs)),
            "avg": float(sum(fvs) / len(fvs)),
            "sector": sector,
            "industry": info.get("industry", ""),
        }

    return result


def _scenario_analysis(
    revenue0: float,
    net_debt: float,
    shares: Optional[float],
    base_inputs: Dict[str, float],
    years: int = 5,
) -> Dict[str, Any]:
    if not shares or shares <= 0:
        return {"error": "Cannot compute scenarios without shares outstanding"}

    scenarios = {}

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


def _get_analyst_consensus(info: Dict[str, Any]) -> Dict[str, Any]:
    """Extract analyst consensus data from yfinance info."""
    return {
        "target_mean": info.get("targetMeanPrice"),
        "target_low": info.get("targetLowPrice"),
        "target_high": info.get("targetHighPrice"),
        "target_median": info.get("targetMedianPrice"),
        "num_analysts": info.get("numberOfAnalystOpinions"),
        "recommendation": info.get("recommendationKey"),
        "recommendation_mean": info.get("recommendationMean"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DIVERGENCE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_implied_assumptions(
    target_equity_value: float,
    revenue0: float,
    net_debt: float,
    base_inputs: Dict[str, float],
    years: int = 5,
    max_iterations: int = 20,
) -> Dict[str, Any]:
    """
    Reverse-solve for growth/margin that would justify a target equity value.
    Uses binary search to find the implied growth rate (primary driver).
    """
    target_ev = target_equity_value + net_debt

    if target_ev <= 0 or revenue0 <= 0:
        return {
            "implied_growth": None,
            "implied_margin": None,
            "implied_wacc": None,
            "primary_driver": None,
            "solver_converged": False,
            "error": "Invalid target value or revenue",
        }

    # Solve for implied growth (most common driver of divergence)
    def ev_at_growth(g: float) -> float:
        test_inputs = base_inputs.copy()
        test_inputs["growth"] = g
        dcf = _dcf(revenue0=revenue0, years=years, **test_inputs)
        return dcf["enterprise_value"]

    # Binary search for growth that matches target EV
    low_g, high_g = -0.10, 0.50
    implied_growth = None
    converged = False

    for _ in range(max_iterations):
        mid_g = (low_g + high_g) / 2
        ev_mid = ev_at_growth(mid_g)

        if abs(ev_mid - target_ev) / target_ev < 0.01:  # 1% tolerance
            implied_growth = mid_g
            converged = True
            break

        if ev_mid < target_ev:
            low_g = mid_g
        else:
            high_g = mid_g

    if not converged:
        # Check if target is beyond our bounds
        ev_at_max = ev_at_growth(0.50)
        if target_ev > ev_at_max:
            implied_growth = 0.50  # Capped at max
            converged = True
        else:
            implied_growth = (low_g + high_g) / 2  # Best guess

    # Solve for implied margin (secondary)
    def ev_at_margin(m: float) -> float:
        test_inputs = base_inputs.copy()
        test_inputs["margin"] = m
        dcf = _dcf(revenue0=revenue0, years=years, **test_inputs)
        return dcf["enterprise_value"]

    low_m, high_m = -0.10, 0.50
    implied_margin = None

    for _ in range(max_iterations):
        mid_m = (low_m + high_m) / 2
        ev_mid = ev_at_margin(mid_m)

        if abs(ev_mid - target_ev) / target_ev < 0.01:
            implied_margin = mid_m
            break

        if ev_mid < target_ev:
            low_m = mid_m
        else:
            high_m = mid_m

    if implied_margin is None:
        ev_at_max = ev_at_margin(0.50)
        if target_ev > ev_at_max:
            implied_margin = 0.50
        else:
            implied_margin = (low_m + high_m) / 2

    # Solve for implied WACC (inverse relationship)
    def ev_at_wacc(w: float) -> float:
        test_inputs = base_inputs.copy()
        test_inputs["wacc"] = w
        # Ensure terminal_g < wacc
        test_inputs["terminal_g"] = min(test_inputs["terminal_g"], w - 0.01)
        dcf = _dcf(revenue0=revenue0, years=years, **test_inputs)
        return dcf["enterprise_value"]

    low_w, high_w = 0.05, 0.20
    implied_wacc = None

    for _ in range(max_iterations):
        mid_w = (low_w + high_w) / 2
        ev_mid = ev_at_wacc(mid_w)

        if abs(ev_mid - target_ev) / target_ev < 0.01:
            implied_wacc = mid_w
            break

        # WACC has inverse relationship with EV
        if ev_mid > target_ev:
            low_w = mid_w
        else:
            high_w = mid_w

    if implied_wacc is None:
        implied_wacc = (low_w + high_w) / 2

    # Determine primary driver (largest gap from base)
    growth_gap = abs((implied_growth or 0) - base_inputs["growth"])
    margin_gap = abs((implied_margin or 0) - base_inputs["margin"])
    wacc_gap = abs((implied_wacc or 0) - base_inputs["wacc"])

    if growth_gap >= margin_gap and growth_gap >= wacc_gap:
        primary_driver = "growth"
    elif margin_gap >= wacc_gap:
        primary_driver = "margin"
    else:
        primary_driver = "wacc"

    return {
        "implied_growth": implied_growth,
        "implied_margin": implied_margin,
        "implied_wacc": implied_wacc,
        "primary_driver": primary_driver,
        "solver_converged": converged,
    }


def _compute_divergence_analysis(
    dcf_fair_value: Optional[float],
    current_price: Optional[float],
    base_inputs: Dict[str, float],
    implied_assumptions: Dict[str, Any],
    net_income: Optional[float],
) -> Optional[Dict[str, Any]]:
    """
    Compute divergence tier and generate explanation for large gaps.
    """
    if not dcf_fair_value or not current_price or current_price <= 0:
        return None

    divergence_pct = (dcf_fair_value - current_price) / current_price
    abs_divergence = abs(divergence_pct)

    # Determine tier
    if abs_divergence <= 0.30:
        tier = "normal"
    elif abs_divergence <= 0.50:
        tier = "notable"
    else:
        tier = "extreme"

    # Generate explanation
    explanation_parts = []
    primary = implied_assumptions.get("primary_driver")

    if tier in ("notable", "extreme"):
        if divergence_pct < 0:
            direction = "below"
            view_type = "more conservative than"
        else:
            direction = "above"
            view_type = "more optimistic than"

        explanation_parts.append(
            f"Your DCF fair value is {abs(divergence_pct)*100:.0f}% {direction} market price."
        )

        if primary == "growth":
            model_growth = base_inputs["growth"]
            implied_growth = implied_assumptions.get("implied_growth")
            if implied_growth is not None:
                growth_diff = (implied_growth - model_growth) * 100
                if implied_growth > 0.50:
                    explanation_parts.append(
                        f"To justify the market price, growth would need to exceed 50% "
                        f"(vs your {model_growth*100:.0f}%). Market is pricing in exceptional growth."
                    )
                else:
                    explanation_parts.append(
                        f"Your assumptions imply {model_growth*100:.0f}% growth vs "
                        f"market-implied {implied_growth*100:.0f}% ({growth_diff:+.0f}pp gap)."
                    )
        elif primary == "margin":
            model_margin = base_inputs["margin"]
            implied_margin = implied_assumptions.get("implied_margin")
            if implied_margin is not None:
                explanation_parts.append(
                    f"Your margin assumption ({model_margin*100:.0f}%) differs from "
                    f"market-implied ({implied_margin*100:.0f}%)."
                )
        elif primary == "wacc":
            model_wacc = base_inputs["wacc"]
            implied_wacc = implied_assumptions.get("implied_wacc")
            if implied_wacc is not None:
                explanation_parts.append(
                    f"Your discount rate ({model_wacc*100:.1f}%) differs from "
                    f"market-implied ({implied_wacc*100:.1f}%)."
                )

        # Add context for negative earnings
        if net_income is not None and net_income <= 0:
            explanation_parts.append(
                "Note: Company has negative earnings. Market may be pricing speculative future value."
            )

    return {
        "divergence_pct": divergence_pct,
        "divergence_tier": tier,
        "explanation": " ".join(explanation_parts) if explanation_parts else None,
        "implied_assumptions": implied_assumptions,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN BUNDLE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_valuation_bundle(
    ticker: str,
    growth: Optional[float] = None,
    margin: Optional[float] = None,
    tax: Optional[float] = None,
    wacc: Optional[float] = None,
    terminal_g: Optional[float] = None,
) -> Dict[str, Any]:
    # Cache the default bundle (no custom params) to avoid re-computation
    # on initial page loads. Slider-parameterized calls bypass cache by design.
    is_default = all(p is None for p in [growth, margin, tax, wacc, terminal_g])

    if is_default:
        cache_key = f"hf:valuation_bundle:{ticker}"
        cached = await get_cached(cache_key)
        if cached is not None:
            return cached

        result = await _compute_bundle(ticker, None, None, None, None, None)
        # Only cache successful results — errors may be transient (yfinance flaky)
        if "error" not in result:
            await set_cached(cache_key, result, valuation_ttl())
        return result

    return await _compute_bundle(ticker, growth, margin, tax, wacc, terminal_g)


async def _compute_bundle(
    ticker: str,
    growth: Optional[float] = None,
    margin: Optional[float] = None,
    tax: Optional[float] = None,
    wacc: Optional[float] = None,
    terminal_g: Optional[float] = None,
) -> Dict[str, Any]:
    # Fetch yfinance info (cached) and financial statements in parallel
    info_task = get_yf_info(ticker)
    stmts_task = get_financial_statements(ticker)
    info, stmts = await asyncio.gather(info_task, stmts_task)

    annual_is = stmts.get("annual", {}).get("income_statement", {})
    annual_bs = stmts.get("annual", {}).get("balance_sheet", {})

    col = _latest_column(annual_is)
    if not col:
        return {"ticker": ticker, "error": "No annual income statement available"}

    revenue = _get_line(annual_is, col, REVENUE)
    revenue0 = _safe(revenue, 0.0)
    if revenue0 <= 0:
        return {"ticker": ticker, "error": "Could not read revenue from financials"}

    sector = info.get("sector", "")

    # Compute smart defaults
    smart_defaults = _compute_smart_defaults(annual_is, info, sector)

    # Use provided values or smart defaults
    final_growth = growth if growth is not None else smart_defaults["growth"]["suggested"]
    final_margin = margin if margin is not None else smart_defaults["margin"]["suggested"]
    final_tax = tax if tax is not None else smart_defaults["tax"]["suggested"]
    final_wacc = wacc if wacc is not None else smart_defaults["wacc"]["suggested"]
    final_terminal_g = terminal_g if terminal_g is not None else smart_defaults["terminal_g"]["suggested"]

    # Final safety clamp to ensure values are within valid ranges
    final_growth = max(-0.10, min(0.50, final_growth))
    final_margin = max(-0.10, min(0.50, final_margin))
    final_tax = max(0.10, min(0.35, final_tax))
    final_wacc = max(0.05, min(0.20, final_wacc))
    final_terminal_g = max(0.00, min(0.04, final_terminal_g))

    base_inputs = {
        "growth": final_growth,
        "margin": final_margin,
        "tax": final_tax,
        "wacc": final_wacc,
        "terminal_g": final_terminal_g,
    }

    warnings = _generate_warnings(base_inputs, smart_defaults, sector)

    ebitda = _get_line(annual_is, col, EBITDA)
    if not ebitda:
        op_income = _get_line(annual_is, col, OPERATING_INCOME)
        da = _get_line(annual_is, col, DEPRECIATION)
        if op_income and da:
            ebitda = op_income + da

    net_income = _get_line(annual_is, col, NET_INCOME)

    bs_col = _latest_column(annual_bs)
    net_debt = 0.0
    if bs_col:
        cash_equiv = _get_line(annual_bs, bs_col, CASH)
        short_term_inv = _get_line(annual_bs, bs_col, SHORT_TERM_INVESTMENTS)
        agg_liquidity = _get_line(annual_bs, bs_col, CASH_AND_STI)
        cash_total = _safe(agg_liquidity or (_safe(cash_equiv, 0) + _safe(short_term_inv, 0)), 0.0)

        long_term_debt = _get_line(annual_bs, bs_col, LONG_TERM_DEBT)
        short_term_debt = _get_line(annual_bs, bs_col, SHORT_TERM_DEBT)
        total_debt = _get_line(annual_bs, bs_col, TOTAL_DEBT)
        debt_total = _safe(total_debt or (_safe(long_term_debt, 0) + _safe(short_term_debt, 0)), 0.0)

        net_debt = debt_total - cash_total

    shares = info.get("sharesOutstanding")
    shares = float(shares) if shares else None

    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    current_price = float(current_price) if current_price else None

    dcf = _dcf(
        revenue0=revenue0,
        margin=final_margin,
        growth=final_growth,
        tax=final_tax,
        wacc=final_wacc,
        terminal_g=final_terminal_g,
        years=5,
    )

    equity_value = dcf["enterprise_value"] - net_debt
    fair_value_per_share = (equity_value / shares) if shares and shares > 0 else None

    upside_downside = None
    if fair_value_per_share and current_price and current_price > 0:
        upside_downside = {
            "current_price": float(current_price),
            "fair_value": float(fair_value_per_share),
            "upside_pct": float((fair_value_per_share - current_price) / current_price),
            "absolute_diff": float(fair_value_per_share - current_price),
        }

    sensitivity = _sensitivity_analysis(
        revenue0=revenue0,
        net_debt=net_debt,
        shares=shares,
        base_inputs=base_inputs,
        years=5,
    )

    multiples = _multiples_valuation(
        ticker=ticker,
        info=info,
        revenue=revenue0,
        ebitda=ebitda,
        net_income=net_income,
        net_debt=net_debt,
        shares=shares,
        sector=sector,
    )

    scenarios = _scenario_analysis(
        revenue0=revenue0,
        net_debt=net_debt,
        shares=shares,
        base_inputs=base_inputs,
        years=5,
    )

    fair_value_range = None
    if scenarios and "bear" in scenarios and "bull" in scenarios:
        all_fvs = [
            scenarios["bear"]["fair_value_per_share"],
            scenarios["base"]["fair_value_per_share"],
            scenarios["bull"]["fair_value_per_share"],
        ]
        if multiples.get("implied_values"):
            all_fvs.extend([v["fair_value"] for v in multiples["implied_values"]])

        fair_value_range = {
            "low": float(min(all_fvs)),
            "mid": float(scenarios["base"]["fair_value_per_share"]),
            "high": float(max(all_fvs)),
            "dcf_base": float(fair_value_per_share) if fair_value_per_share else None,
        }

    analyst_consensus = _get_analyst_consensus(info)

    # Compute divergence analysis for trust transparency
    divergence_analysis = None
    if current_price and current_price > 0 and shares and shares > 0:
        target_equity = current_price * shares
        implied_assumptions = _compute_implied_assumptions(
            target_equity_value=target_equity,
            revenue0=revenue0,
            net_debt=net_debt,
            base_inputs=base_inputs,
            years=5,
        )
        divergence_analysis = _compute_divergence_analysis(
            dcf_fair_value=fair_value_per_share,
            current_price=current_price,
            base_inputs=base_inputs,
            implied_assumptions=implied_assumptions,
            net_income=net_income,
        )

    benchmarks = SECTOR_BENCHMARKS.get(sector, DEFAULT_BENCHMARKS)

    return {
        "ticker": ticker,
        "inputs": base_inputs,
        "smart_defaults": smart_defaults,
        "warnings": warnings,
        "benchmarks": {
            "sector": sector,
            "industry": info.get("industry"),
            "growth": benchmarks["growth"],
            "margin": benchmarks["margin"],
        },
        "facts": {
            "revenue0": revenue0,
            "ebitda": ebitda,
            "net_income": net_income,
            "net_debt_est": net_debt,
            "shares_outstanding": shares,
            "current_price": current_price,
            "sector": sector,
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
        "analyst_consensus": analyst_consensus,
        "divergence_analysis": divergence_analysis,
    }