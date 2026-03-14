"""
AI Risk Assessment — Tailored Monte Carlo Scenarios
====================================================
Gathers financial context (reusing existing helpers), pre-computes risk signals,
sends them to Claude Haiku, and returns structured JSON with risk factors +
tailored simulation scenarios.

Key design decisions:
- Pre-computes all ratios/signals server-side (LLMs shouldn't do math)
- Returns structured JSON with risk factors + 3 tailored scenarios
- Cached in Redis for 1 hour (same data → same assessment for all users)
- Completely decoupled from the Monte Carlo endpoint (no added latency)
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from high_finance.core.config import settings
from high_finance.core.cache import get_or_compute
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL
from high_finance.utils.safe_math import safe_div
from high_finance.services.ai_analysis import (
    _extract_years, _compute_ratios, _fmt, _pct, _ratio,
)

logger = logging.getLogger(__name__)

# ── System prompt ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a risk analysis assistant assessing a stock's risk profile for Monte Carlo simulation parameters.

## Critical constraint:
You can ONLY identify risk factors that are directly evidenced by the data sections below.
If a risk category (e.g., customer concentration, regulatory exposure) has no supporting
data provided, you may mention it as a blind spot but must NOT assign a severity rating
or claim it exists. Say: "No data available — check the 10-K for details."

Return ONLY valid JSON (no markdown, no commentary outside the JSON):
{
  "overall_risk_tier": "low | moderate | elevated | high",
  "summary": "2-3 sentence executive risk summary citing specific data points",
  "risk_factors": [
    {
      "category": "leverage | profitability | volatility | concentration | sentiment | regulatory | cyclicality",
      "title": "Short factor name (3-5 words)",
      "severity": "low | medium | high",
      "detail": "2-3 sentences with specific numbers FROM THE PROVIDED DATA",
      "monte_carlo_impact": "How this should affect simulation parameters (1 sentence)"
    }
  ],
  "tailored_scenarios": [
    {
      "name": "Scenario name (e.g., 'Credit Stress')",
      "narrative": "2-3 sentences explaining WHY this scenario, citing specific data",
      "parameters": {
        "vol_multiplier": 1.5,
        "horizon_days": 90,
        "include_earnings_shock": false
      },
      "estimated_likelihood": "low | medium | plausible"
    }
  ],
  "suggested_base_parameters": {
    "vol_multiplier": 1.2,
    "horizon_days": 60,
    "rationale": "Why these defaults better reflect this company's risk profile"
  }
}

## Constraints:
- Return at most 5 risk factors (most material only)
- Return EXACTLY 3 tailored scenarios: one bearish/stress, one base-adjusted, one tail-risk
- vol_multiplier must be between 0.5 and 2.0
- horizon_days must be between 10 and 180
- All numbers cited MUST come from the provided data — do NOT hallucinate figures
- If data is insufficient for a risk category, say so explicitly rather than guessing
- When a risk factor is inferred rather than directly observed, flag it clearly

## How to think about scenarios:
- **Bearish/Stress:** What happens if the most material risk factor(s) play out?
  Higher vol_multiplier (1.3-2.0), possibly longer horizon.
- **Base-Adjusted:** What parameters best reflect the company's ACTUAL risk profile,
  accounting for leverage, profitability trends, and ownership patterns?
  Often vol_multiplier near 1.0-1.3.
- **Tail-Risk:** A low-probability, high-impact event specific to THIS company.
  Highest vol_multiplier, include earnings shock if earnings volatility is high.

## Risk tier guidelines:
- **Low:** Strong balance sheet, stable earnings, low beta, broad ownership
- **Moderate:** Average leverage, some earnings volatility, normal sector risk
- **Elevated:** High D/E, declining margins, concentrated ownership, high vol
- **High:** Distressed fundamentals, extreme volatility, negative cash flow trends"""


# ── JSON parsing & validation ────────────────────────────────────────────

VALID_TIERS = {"low", "moderate", "elevated", "high"}
VALID_SEVERITIES = {"low", "medium", "high"}
VALID_LIKELIHOODS = {"low", "medium", "plausible"}
VALID_CATEGORIES = {
    "leverage", "profitability", "volatility", "concentration",
    "sentiment", "regulatory", "cyclicality",
}


def _clean_json(text: str) -> str:
    """Fix common LLM JSON issues: trailing commas, text outside JSON."""
    text = text.strip()
    # Strip markdown fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    # Extract the outermost JSON object if there's text before/after
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    # Remove trailing commas before } or ] (common LLM mistake)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text


def _parse_and_validate(raw_text: str) -> dict:
    """Parse LLM JSON response, clamp and validate all fields."""
    text = _clean_json(raw_text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI risk response: %s\nRaw: %s", e, raw_text[:500])
        # Return a safe fallback rather than crashing
        return {
            "overall_risk_tier": "moderate",
            "summary": "AI assessment could not be parsed. Try again.",
            "risk_factors": [],
            "tailored_scenarios": [],
            "suggested_base_parameters": {
                "vol_multiplier": 1.0,
                "horizon_days": 60,
                "rationale": "Default parameters (AI response could not be parsed).",
            },
        }

    # Validate overall risk tier
    if parsed.get("overall_risk_tier") not in VALID_TIERS:
        parsed["overall_risk_tier"] = "moderate"

    if not parsed.get("summary"):
        parsed["summary"] = "Risk assessment based on available financial data."

    # Validate risk factors (max 5)
    factors = parsed.get("risk_factors", [])[:5]
    for f in factors:
        if f.get("category") not in VALID_CATEGORIES:
            f["category"] = "volatility"
        if f.get("severity") not in VALID_SEVERITIES:
            f["severity"] = "medium"
        if not f.get("title"):
            f["title"] = "Unspecified risk"
        if not f.get("detail"):
            f["detail"] = "Insufficient data for detailed analysis."
        if not f.get("monte_carlo_impact"):
            f["monte_carlo_impact"] = "Consider adjusting volatility parameters."
    parsed["risk_factors"] = factors

    # Validate tailored scenarios
    scenarios = parsed.get("tailored_scenarios", [])
    for sc in scenarios:
        params = sc.get("parameters", {})
        # Clamp vol_multiplier to [0.5, 2.0]
        vm = params.get("vol_multiplier", 1.0)
        params["vol_multiplier"] = round(max(0.5, min(2.0, float(vm))), 2)
        # Clamp horizon_days to [10, 180]
        hd = params.get("horizon_days", 60)
        params["horizon_days"] = max(10, min(180, int(hd)))
        # Ensure boolean
        params["include_earnings_shock"] = bool(params.get("include_earnings_shock", False))
        sc["parameters"] = params

        if sc.get("estimated_likelihood") not in VALID_LIKELIHOODS:
            sc["estimated_likelihood"] = "medium"
        if not sc.get("name"):
            sc["name"] = "Unnamed Scenario"
        if not sc.get("narrative"):
            sc["narrative"] = "Scenario based on available data."
    parsed["tailored_scenarios"] = scenarios

    # Validate suggested base parameters
    base = parsed.get("suggested_base_parameters", {})
    vm = base.get("vol_multiplier", 1.0)
    base["vol_multiplier"] = round(max(0.5, min(2.0, float(vm))), 2)
    hd = base.get("horizon_days", 60)
    base["horizon_days"] = max(10, min(180, int(hd)))
    if not base.get("rationale"):
        base["rationale"] = "Based on available financial data."
    parsed["suggested_base_parameters"] = base

    return parsed


# ── Data gathering & prompt building ─────────────────────────────────────

def _compute_risk_signals(
    financials: Dict[str, Any],
    info: Dict[str, Any],
    institutional: Dict[str, Any],
    news: Dict[str, Any],
    risk_metrics: Dict[str, Any],
    earnings_history: List[Dict[str, Any]],
) -> str:
    """Build a structured prompt with all pre-computed risk signals."""
    sections: list[str] = []

    # ── Company profile ──
    ticker = info.get("symbol", "N/A")
    sector = info.get("sector", "N/A")
    industry = info.get("industry", "N/A")
    market_cap = info.get("marketCap")
    beta = info.get("beta")
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")

    beta_str = f"{beta:.2f}" if beta else "N/A"
    sections.append(
        f"## Company: {ticker}\n"
        f"- Sector: {sector} | Industry: {industry}\n"
        f"- Market Cap: {_fmt(market_cap, '$')}\n"
        f"- Beta: {beta_str}\n"
        f"- Current Price: ${current_price:.2f}" if current_price else
        f"## Company: {ticker}\n"
        f"- Sector: {sector} | Industry: {industry}\n"
        f"- Market Cap: {_fmt(market_cap, '$')}\n"
        f"- Beta: {beta_str}"
    )

    # ── Leverage & balance sheet signals ──
    de_ratio = info.get("debtToEquity")
    total_debt = info.get("totalDebt")
    total_cash = info.get("totalCash")

    years = _extract_years(financials)
    if years:
        # Revenue & margin trend
        margin_trend = []
        rev_trend = []
        interest_coverages = []

        for year_label, income, balance, cashflow in years:
            ratios = _compute_ratios(income, balance, cashflow)
            sections.append(
                f"### Fiscal Year {year_label}\n"
                f"- Revenue: {_fmt(ratios['_revenue'], '$')} | "
                f"Op Margin: {_pct(ratios['operating_margin'])} | "
                f"Net Margin: {_pct(ratios['net_margin'])}\n"
                f"- D/E: {_ratio(ratios['debt_to_equity'])} | "
                f"FCF: {_fmt(ratios['_fcf'], '$')} | "
                f"FCF/EBITDA: {_pct(ratios['fcf_conversion'])}"
            )
            if ratios.get("operating_margin") is not None:
                margin_trend.append(ratios["operating_margin"])
            if ratios.get("_revenue") is not None:
                rev_trend.append(ratios["_revenue"])

            # Interest coverage: Operating income / Interest expense
            op_income = ratios.get("_operating_income")
            interest_exp = income.get("InterestExpense") or income.get("Interest Expense")
            if op_income and interest_exp and interest_exp != 0:
                interest_coverages.append(safe_div(op_income, abs(interest_exp)))
            elif op_income and not interest_exp:
                logger.debug("No interest expense data found for %s FY%s", ticker, year_label)

        # Summarize trends
        leverage_lines = ["## Leverage Signals"]
        if de_ratio is not None:
            # yfinance returns D/E as percentage (e.g., 150 means 1.5x)
            de_decimal = de_ratio / 100.0 if de_ratio > 10 else de_ratio
            leverage_lines.append(f"- D/E Ratio: {de_decimal:.2f}x")
        if total_debt is not None and total_cash is not None:
            cash_to_debt = safe_div(total_cash, total_debt)
            leverage_lines.append(
                f"- Total Debt: {_fmt(total_debt, '$')} | "
                f"Cash: {_fmt(total_cash, '$')} | "
                f"Cash/Debt: {_pct(cash_to_debt)}"
            )
        if interest_coverages:
            latest_ic = interest_coverages[0]
            leverage_lines.append(f"- Interest Coverage (latest): {latest_ic:.1f}x")
            if len(interest_coverages) >= 2:
                trend = "improving" if interest_coverages[0] > interest_coverages[-1] else "declining"
                leverage_lines.append(f"- Interest Coverage Trend: {trend}")
        sections.append("\n".join(leverage_lines))

        if margin_trend:
            direction = "expanding" if margin_trend[0] > margin_trend[-1] else "compressing"
            sections.append(
                f"## Profitability Trend\n"
                f"- Operating Margin Trend: {direction} "
                f"({_pct(margin_trend[-1])} → {_pct(margin_trend[0])})"
            )

        if len(rev_trend) >= 2:
            growth = safe_div(rev_trend[0] - rev_trend[-1], abs(rev_trend[-1]))
            sections.append(f"- Revenue Growth (multi-year): {_pct(growth)}")

    # ── Volatility signals ──
    metrics = risk_metrics.get("metrics", {}) if isinstance(risk_metrics, dict) else {}
    vol_lines = ["## Volatility Signals"]
    ann_vol = metrics.get("annualized_volatility")
    if ann_vol is not None:
        vol_lines.append(f"- Annualized Volatility: {_pct(ann_vol)}")
    var95 = metrics.get("var_95_1d")
    var99 = metrics.get("var_99_1d")
    if var95 is not None:
        vol_lines.append(f"- VaR 95% (1D): {_pct(var95)}")
    if var99 is not None:
        vol_lines.append(f"- VaR 99% (1D): {_pct(var99)}")
    max_dd = metrics.get("max_drawdown")
    if max_dd is not None:
        vol_lines.append(f"- Max Drawdown: {_pct(max_dd)}")
    if beta is not None:
        vol_lines.append(f"- Beta: {beta:.2f} ({'high' if beta > 1.3 else 'low' if beta < 0.7 else 'moderate'} systematic risk)")

    # 52-week range context
    w52_high = info.get("fiftyTwoWeekHigh")
    w52_low = info.get("fiftyTwoWeekLow")
    if w52_high and w52_low and current_price:
        range_position = safe_div(current_price - w52_low, w52_high - w52_low)
        vol_lines.append(
            f"- 52W Range: ${w52_low:.2f} - ${w52_high:.2f} "
            f"(currently at {_pct(range_position)} of range)"
        )
    sections.append("\n".join(vol_lines))

    # ── Ownership concentration ──
    if isinstance(institutional, dict):
        summary = institutional.get("summary", {})
        top_holders = institutional.get("top_institutional_holders", [])

        own_lines = ["## Ownership Signals"]
        inst_pct = summary.get("institutional_ownership_pct")
        if inst_pct is not None:
            own_lines.append(f"- Institutional Ownership: {_pct(inst_pct / 100.0 if inst_pct > 1 else inst_pct)}")

        # Top 5 concentration
        if top_holders:
            top5_pct = sum(
                (h.get("pct_held") or 0) for h in top_holders[:5]
            )
            own_lines.append(f"- Top 5 Holders Concentration: {_pct(top5_pct / 100.0 if top5_pct > 1 else top5_pct)}")

        # Position changes
        increasing = institutional.get("increasing_positions", [])
        decreasing = institutional.get("decreasing_positions", [])
        if increasing or decreasing:
            own_lines.append(
                f"- Increasing Positions: {len(increasing)} | "
                f"Decreasing Positions: {len(decreasing)}"
            )
        sections.append("\n".join(own_lines))

    # ── Sentiment signals ──
    if isinstance(news, dict):
        headlines = news.get("headlines", [])
        avg_sentiment = news.get("avg_headline_sentiment")

        sent_lines = ["## Sentiment Signals"]
        if avg_sentiment is not None:
            sent_label = "positive" if avg_sentiment > 0.1 else "negative" if avg_sentiment < -0.1 else "neutral"
            sent_lines.append(f"- Average Headline Sentiment: {avg_sentiment:+.2f} ({sent_label})")

        # Recent vs older sentiment shift (sort by date first — order isn't guaranteed)
        if len(headlines) >= 4:
            sorted_hl = sorted(
                [h for h in headlines if h.get("published")],
                key=lambda h: h.get("published", ""),
                reverse=True,
            )
            if len(sorted_hl) >= 4:
                mid = len(sorted_hl) // 2
                recent = sorted_hl[:mid]
                older = sorted_hl[mid:]

                recent_avg = sum(
                    h.get("sentiment", {}).get("compound", 0) for h in recent
                ) / len(recent)
                older_avg = sum(
                    h.get("sentiment", {}).get("compound", 0) for h in older
                ) / len(older)

                shift = recent_avg - older_avg
                direction = "improving" if shift > 0.05 else "deteriorating" if shift < -0.05 else "stable"
                sent_lines.append(f"- Sentiment Trend: {direction} ({older_avg:+.2f} → {recent_avg:+.2f})")

        # Top headlines for context
        if headlines:
            sent_lines.append("- Recent Headlines:")
            for h in headlines[:5]:
                title = h.get("title", "")
                compound = h.get("sentiment", {}).get("compound")
                pub = (h.get("published") or "")[:10]
                s_str = f" [{compound:+.2f}]" if compound is not None else ""
                sent_lines.append(f"  ({pub}){s_str} {title}")
        sections.append("\n".join(sent_lines))

    # ── Earnings volatility ──
    if earnings_history:
        earn_lines = ["## Earnings Volatility"]
        moves = [
            abs(e.get("one_day_move") or 0)
            for e in earnings_history
            if e.get("one_day_move") is not None
        ]
        if moves:
            avg_move = sum(moves) / len(moves)
            max_move = max(moves)
            earn_lines.append(f"- Average Post-Earnings Move: {_pct(avg_move)}")
            earn_lines.append(f"- Max Post-Earnings Move: {_pct(max_move)}")
            earn_lines.append(f"- Observations: {len(moves)}")

            # Direction bias
            up_moves = sum(
                1 for e in earnings_history
                if (e.get("one_day_move") or 0) > 0
            )
            total = len([e for e in earnings_history if e.get("one_day_move") is not None])
            if total > 0:
                bias = up_moves / total
                earn_lines.append(f"- Direction Bias: {_pct(bias)} upward on earnings day")
        sections.append("\n".join(earn_lines))

    return "\n\n".join(sections)


# ── Main function ────────────────────────────────────────────────────────

async def suggest_risk_scenarios(ticker: str, db) -> Dict[str, Any]:
    """
    Generate AI-tailored risk assessment and Monte Carlo scenarios.

    Returns dict with:
    - overall_risk_tier, summary, risk_factors, tailored_scenarios,
      suggested_base_parameters
    - model, input_tokens, output_tokens: for budget tracking
    """
    import asyncio
    from high_finance.services.financials import get_financial_statements
    from high_finance.services.yf_cache import get_yf_info
    from high_finance.services.institutional_flow import get_institutional_flow
    from high_finance.services.news import get_news_bundle
    from high_finance.services.risk import get_risk_bundle
    from high_finance.services.earnings import get_earnings_history_with_moves

    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("AI suggestions not configured. Set ANTHROPIC_API_KEY.")

    cache_key = f"hf:risk_suggest:{ticker}"

    async def _compute():
        # Gather data in parallel (most should be warm in Redis cache)
        financials_task = get_financial_statements(ticker)
        info_task = get_yf_info(ticker)
        institutional_task = get_institutional_flow(ticker)
        news_task = get_news_bundle(ticker, limit=10)
        risk_task = get_risk_bundle(ticker)  # default params for baseline metrics
        earnings_task = get_earnings_history_with_moves(ticker)

        financials, info, institutional, news, risk_data, earnings = await asyncio.gather(
            financials_task, info_task, institutional_task,
            news_task, risk_task, earnings_task,
            return_exceptions=True,
        )

        # Handle partial failures gracefully — risk assessment can work with partial data
        if isinstance(financials, Exception):
            logger.warning("Risk suggest: financials failed for %s: %s", ticker, financials)
            financials = {}
        if isinstance(info, Exception):
            logger.warning("Risk suggest: info failed for %s: %s", ticker, info)
            info = {}
        if isinstance(institutional, Exception):
            logger.warning("Risk suggest: institutional failed for %s: %s", ticker, institutional)
            institutional = {}
        if isinstance(news, Exception):
            logger.warning("Risk suggest: news failed for %s: %s", ticker, news)
            news = {}
        if isinstance(risk_data, Exception):
            logger.warning("Risk suggest: risk metrics failed for %s: %s", ticker, risk_data)
            risk_data = {}
        if isinstance(earnings, Exception):
            logger.warning("Risk suggest: earnings failed for %s: %s", ticker, earnings)
            earnings = []

        # Ensure correct types
        info = info if isinstance(info, dict) else {}
        news = news if isinstance(news, dict) else {}
        risk_data = risk_data if isinstance(risk_data, dict) else {}
        earnings = earnings if isinstance(earnings, list) else []

        user_prompt = _compute_risk_signals(
            financials, info, institutional, news, risk_data, earnings,
        )

        user_prompt = (
            f"Analyze the risk profile of **{ticker}** and suggest tailored Monte Carlo parameters.\n\n"
            + user_prompt
            + "\n\n**Important:** All ratios and signals above are pre-computed — do NOT recalculate them. "
            "Focus on interpreting what they mean for forward-looking risk."
        )

        client = get_anthropic_client()
        response = await client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=2000,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        result = _parse_and_validate(raw_text)

        result["model"] = HAIKU_MODEL
        result["input_tokens"] = response.usage.input_tokens
        result["output_tokens"] = response.usage.output_tokens

        return result

    return await get_or_compute(cache_key, 3600, _compute)  # 1 hour TTL
