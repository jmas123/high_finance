"""
AI DCF Assumption Suggester
============================
Gathers financial context (reusing existing helpers), sends it to Claude Haiku,
and returns structured JSON with 5 suggested DCF parameters + explanations.

Key design decisions:
- Pre-computes all data server-side (LLMs shouldn't do math)
- Reuses _extract_years, _compute_ratios, formatting helpers from ai_analysis.py
- Returns structured JSON (not markdown) — ~400 output tokens
- Cached in Redis for 1 hour (same data → same suggestion for all users)
"""

import json
import logging
from typing import Any, Dict, Optional

from high_finance.core.config import settings
from high_finance.core.cache import get_or_compute
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL
from high_finance.utils.safe_math import safe_div
from high_finance.services.ai_analysis import (
    _extract_years, _compute_ratios, _fmt, _pct, _ratio,
)

logger = logging.getLogger(__name__)

MODEL = HAIKU_MODEL

# Slider bounds — must match frontend slider ranges
BOUNDS = {
    "growth":     (-0.10, 0.50),
    "margin":     (-0.10, 0.50),
    "wacc":       (0.05,  0.20),
    "tax":        (0.0,   0.50),
    "terminal_g": (0.0,   0.05),
}

SYSTEM_PROMPT = """You are a financial analyst assistant suggesting DCF assumptions.

Return ONLY valid JSON (no markdown, no commentary outside the JSON):
{
  "growth": {"value": 0.12, "confidence": "high", "reasoning": "2-3 sentences"},
  "margin": {"value": 0.18, "confidence": "medium", "reasoning": "2-3 sentences"},
  "wacc":   {"value": 0.095, "confidence": "medium", "reasoning": "2-3 sentences"},
  "tax":    {"value": 0.21, "confidence": "high", "reasoning": "2-3 sentences"},
  "terminal_g": {"value": 0.025, "confidence": "medium", "reasoning": "2-3 sentences"},
  "summary": "1-2 sentence overall thesis",
  "valuation_gap_note": null
}

## How to think about assumptions:

You are suggesting assumptions for a 5-YEAR FORWARD projection — not describing the past.
Companies can and do grow faster (or slower) than historical rates.

When forming your view, weigh these signals:
1. Historical financials: where the company HAS BEEN (base rate)
2. Forward analyst estimates: what coverage analysts project (near-term consensus)
3. Market-implied values: what the current price REQUIRES (market expectation)
4. Sector/maturity context: what growth rates are realistic for this type of business

**Key principle: Your assumptions should reflect the MOST LIKELY forward scenario,
not the most conservative one.** If analyst consensus expects 20% revenue growth
and historical shows 25%, suggesting 8% because "growth must slow" is not analysis —
it's reflexive pessimism.

**When market-implied values diverge sharply from historical data:**
This often means the market is pricing in a business transformation, new revenue
streams, or sector tailwinds not yet visible in trailing financials. In these cases:
- Do NOT simply average historical and market-implied values
- Do NOT dismiss the market view as irrational without specific reasoning
- DO examine whether forward estimates support higher growth expectations
- DO set confidence to "low" when your assumptions require outcomes significantly
  beyond historical precedent
- DO use the "valuation_gap_note" field to flag when a single-scenario DCF may not
  capture the full picture (e.g., optionality in new business lines, binary regulatory
  outcomes, platform-shift dynamics)

If the gap between your suggested DCF output and market price would exceed ~40%,
populate "valuation_gap_note" with a brief explanation of what the market may be
pricing that a backward-looking DCF cannot capture.

Constraints:
- growth: [-0.10, 0.50] (decimal). Use historical CAGR, analyst estimates, and sector context.
- margin: [-0.10, 0.50] (decimal). Use current margin and trend direction.
  For companies with rising revenue but compressing margins, consider whether margin
  compression is investment-driven (temporary) or structural (permanent).
- wacc: [0.05, 0.20] (decimal). Use beta and debt levels from the data.
  You may reference general knowledge about the current interest rate environment.
- tax: [0.0, 0.50] (decimal). Use effective rate history from the data.
- terminal_g: [0.0, 0.05] (decimal). You may reference long-term GDP growth expectations.
- Confidence: "high" = strong data signal, "medium" = reasonable inference,
  "low" = limited data or assumptions require significant extrapolation beyond historical.
- For growth, margin, and tax: cite numbers from the provided data to support your reasoning."""

def _parse_and_clamp(raw_text: str) -> dict:
    """Parse LLM JSON response, clamp all values to slider bounds."""
    text = raw_text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    parsed = json.loads(text)

    for key, (lo, hi) in BOUNDS.items():
        param = parsed.get(key, {})
        val = param.get("value")
        if val is not None:
            param["value"] = round(max(lo, min(hi, float(val))), 4)
        else:
            param["value"] = None
        # Ensure confidence is valid
        if param.get("confidence") not in ("high", "medium", "low"):
            param["confidence"] = "medium"
        # Ensure reasoning exists
        if not param.get("reasoning"):
            param["reasoning"] = "Insufficient data for detailed reasoning."
        parsed[key] = param

    # Ensure summary exists
    if not parsed.get("summary"):
        parsed["summary"] = "Analysis based on available financial data."

    if "valuation_gap_note" not in parsed:
        parsed["valuation_gap_note"] = None

    return parsed


def _build_user_prompt(
    ticker: str,
    financials: Dict[str, Any],
    info: Dict[str, Any],
    valuation: Dict[str, Any],
    news_headlines: list[dict],
) -> str:
    """Build the user prompt with all financial context."""
    sections: list[str] = []

    # Company profile
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
        f"- Beta: {beta_str}"
    )
    if current_price:
        sections[-1] += f" | Current Price: ${current_price:.2f}"

    # Financial statements (3 years)
    years = _extract_years(financials)
    if years:
        for year_label, income, balance, cashflow in years:
            ratios = _compute_ratios(income, balance, cashflow)
            sections.append(
                f"### Fiscal Year {year_label}\n"
                f"- Revenue: {_fmt(ratios['_revenue'], '$')} | "
                f"Operating Income: {_fmt(ratios['_operating_income'], '$')} | "
                f"Net Income: {_fmt(ratios['_net_income'], '$')}\n"
                f"- EBITDA: {_fmt(ratios['_ebitda'], '$')} | "
                f"FCF: {_fmt(ratios['_fcf'], '$')}\n"
                f"- Total Debt: {_fmt(ratios['_total_debt'], '$')} | "
                f"Cash: {_fmt(ratios['_cash'], '$')} | "
                f"Equity: {_fmt(ratios['_equity'], '$')}\n"
                f"- Gross Margin: {_pct(ratios['gross_margin'])} | "
                f"Op Margin: {_pct(ratios['operating_margin'])} | "
                f"Net Margin: {_pct(ratios['net_margin'])}\n"
                f"- D/E: {_ratio(ratios['debt_to_equity'])} | "
                f"ROE: {_pct(ratios['roe'])} | "
                f"FCF/EBITDA: {_pct(ratios['fcf_conversion'])}"
            )

        # Revenue growth trend
        if len(years) >= 2:
            rev_parts = []
            for i in range(len(years) - 1):
                newer = _compute_ratios(*years[i][1:])
                older = _compute_ratios(*years[i + 1][1:])
                growth = safe_div(
                    (newer["_revenue"] or 0) - (older["_revenue"] or 0),
                    older["_revenue"],
                )
                rev_parts.append(f"{years[i + 1][0]}->{years[i][0]}: {_pct(growth)}")
            sections.append(f"### Revenue Growth Trend\n" + " | ".join(rev_parts))

    # Forward-looking estimates from analysts
    fwd_rev_growth = info.get("revenueGrowth")
    fwd_earnings_growth = info.get("earningsGrowth")
    fwd_pe = info.get("forwardPE")
    fwd_eps = info.get("forwardEps")

    if any(v is not None for v in [fwd_rev_growth, fwd_earnings_growth, fwd_pe, fwd_eps]):
        fwd_lines = ["## Forward Estimates (Analyst Consensus)"]
        if fwd_rev_growth is not None:
            fwd_lines.append(f"- Forward Revenue Growth: {_pct(fwd_rev_growth)}")
        if fwd_earnings_growth is not None:
            fwd_lines.append(f"- Forward Earnings Growth: {_pct(fwd_earnings_growth)}")
        if fwd_pe is not None:
            fwd_lines.append(f"- Forward P/E: {fwd_pe:.1f}x")
        if fwd_eps is not None:
            fwd_lines.append(f"- Forward EPS: ${fwd_eps:.2f}")
        sections.append("\n".join(fwd_lines))

    # Market-Implied Expectations (reverse-engineered from current price)
    divergence = valuation.get("divergence_analysis") if isinstance(valuation, dict) else None
    if divergence and divergence.get("implied_assumptions"):
        implied = divergence["implied_assumptions"]
        ig = implied.get("implied_growth")
        im = implied.get("implied_margin")
        iw = implied.get("implied_wacc")
        price = valuation.get("facts", {}).get("current_price")

        parts = []
        if ig is not None:
            capped = " (capped at model maximum)" if ig >= 0.50 else ""
            parts.append(f"- Implied Growth: {_pct(ig)}{capped}")
        if im is not None:
            capped = " (capped at model maximum)" if im >= 0.50 else ""
            parts.append(f"- Implied Margin: {_pct(im)}{capped}")
        if iw is not None:
            parts.append(f"- Implied WACC: {_pct(iw)}")

        if parts:
            price_str = f"${price:.2f}" if price else "current price"
            sections.append(
                f"## Market-Implied Expectations\n"
                f"What the current price ({price_str}) requires to be justified:\n"
                + "\n".join(parts) + "\n"
                f"- These represent what the MARKET believes, not necessarily what is correct.\n"
                f"- Your job: assess whether market expectations are reasonable, too aggressive, or too conservative."
            )

    # Analyst consensus — framed to reduce anchoring bias
    num_analysts = info.get("numberOfAnalystOpinions")
    target_mean = info.get("targetMeanPrice")
    rec = info.get("recommendationKey")
    if num_analysts or target_mean:
        sections.append(
            f"## Analyst Consensus (use as one reference point, not anchor)\n"
            f"- {num_analysts or 'N/A'} analysts | "
            f"Mean Target: {_fmt(target_mean, '$')} | "
            f"Recommendation: {rec or 'N/A'}\n"
            f"- Note: Analyst consensus is frequently wrong at inflection points"
        )

    # News headlines with sentiment and dates
    if news_headlines:
        headline_lines = []
        for h in news_headlines[:8]:
            title = h.get("title", "")
            sentiment = h.get("sentiment", {})
            compound = sentiment.get("compound")
            pub = h.get("published", "")[:10]  # just the date portion
            sent_str = f" [{compound:+.2f}]" if compound is not None else ""
            headline_lines.append(f"- ({pub}){sent_str} {title}")
        sections.append("## Recent Headlines\n" + "\n".join(headline_lines))

    return (
        f"Suggest **5-year forward** DCF assumptions for **{ticker}**.\n"
        f"Historical financials show where the company HAS BEEN. "
        f"Market-implied values show what the stock price REQUIRES. "
        f"Your job: assess where the company IS GOING.\n\n"
        + "\n\n".join(sections)
        + "\n\n**Important:** All ratios are pre-computed — do NOT recalculate them. "
        "For WACC and terminal growth, you may incorporate macro context."
    )


async def suggest_dcf_assumptions(ticker: str, db) -> Dict[str, Any]:
    """
    Generate AI-suggested DCF assumptions for a ticker.

    Returns dict with keys:
    - growth, margin, wacc, tax, terminal_g: each {value, confidence, reasoning}
    - summary: overall thesis
    - model, input_tokens, output_tokens: for budget tracking
    """
    import asyncio
    from high_finance.services.financials import get_financial_statements
    from high_finance.services.valuation import get_valuation_bundle
    from high_finance.services.yf_cache import get_yf_info
    from high_finance.services.news import get_news_bundle

    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("AI suggestions not configured. Set ANTHROPIC_API_KEY.")

    cache_key = f"hf:dcf_suggest:{ticker}"

    async def _compute():
        # Gather data in parallel (most should be warm in Redis)
        financials_task = get_financial_statements(ticker)
        info_task = get_yf_info(ticker)
        valuation_task = get_valuation_bundle(ticker)

        # News needs db session
        news_task = get_news_bundle(ticker, limit=10)

        financials, info, valuation, news = await asyncio.gather(
            financials_task, info_task, valuation_task, news_task,
            return_exceptions=True,
        )

        # Handle partial failures gracefully
        if isinstance(financials, Exception):
            logger.warning("DCF suggest: financials failed for %s: %s", ticker, financials)
            financials = {}
        if isinstance(info, Exception):
            logger.warning("DCF suggest: info failed for %s: %s", ticker, info)
            info = {}
        if isinstance(valuation, Exception):
            logger.warning("DCF suggest: valuation failed for %s: %s", ticker, valuation)
            valuation = {}
        if isinstance(news, Exception):
            logger.warning("DCF suggest: news failed for %s: %s", ticker, news)
            news = {}

        news_headlines = news.get("headlines", []) if isinstance(news, dict) else []
        valuation_dict = valuation if isinstance(valuation, dict) else {}

        user_prompt = _build_user_prompt(ticker, financials, info, valuation_dict, news_headlines)

        client = get_anthropic_client()
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1200,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        result = _parse_and_clamp(raw_text)

        result["model"] = MODEL
        result["input_tokens"] = response.usage.input_tokens
        result["output_tokens"] = response.usage.output_tokens

        return result

    return await get_or_compute(cache_key, 3600, _compute)  # 1 hour TTL
