"""
Investment Memo Service
=======================
Gathers ticker data, builds a focused prompt, and streams an AI-generated
investment memo via Claude Haiku.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from high_finance.core.config import settings

logger = logging.getLogger(__name__)

# ── Lazy Anthropic client (module-level singleton) ───────────────────────────
_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


MODEL = "claude-haiku-4-5-20251001"
FETCH_TIMEOUT = 8  # seconds per data fetch


# ═══════════════════════════════════════════════════════════════════════════════
# A. GATHER MEMO DATA
# ═══════════════════════════════════════════════════════════════════════════════

async def gather_memo_data(ticker: str, db: Session) -> Dict[str, Any]:
    """
    Gather all available data for a ticker in parallel.
    Each fetch is wrapped in try/except so partial failures are fine.
    Most data should be warm in Redis since the user already loaded the ticker page.
    """
    from high_finance.services.fundamentals import get_company_fundamentals
    from high_finance.services.financials import get_financial_statements
    from high_finance.services.valuation import get_valuation_bundle
    from high_finance.services.risk import get_risk_bundle
    from high_finance.services.institutional_flow import get_institutional_flow
    from high_finance.services.insider_trades import get_insider_summary
    from high_finance.services.news import get_news_bundle
    from high_finance.services.options_flow import get_options_overview
    from high_finance.services.politicians import get_company_politician_trades
    from high_finance.db.session import SessionLocal

    data: Dict[str, Any] = {}
    errors: List[str] = []

    async def fetch(key: str, coro):
        try:
            result = await asyncio.wait_for(coro, timeout=FETCH_TIMEOUT)
            data[key] = result
        except Exception as e:
            logger.warning("Memo data fetch '%s' failed for %s: %s", key, ticker, e)
            errors.append(key)

    # Politician trades need a separate session (blocking, uses db.commit)
    async def fetch_politician_trades():
        local_db = SessionLocal()
        try:
            trades = get_company_politician_trades(local_db, ticker, limit=20)
            data["politician_trades"] = trades
        except Exception as e:
            logger.warning("Memo data fetch 'politician_trades' failed for %s: %s", ticker, e)
            errors.append("politician_trades")
        finally:
            local_db.close()

    await asyncio.gather(
        fetch("fundamentals", get_company_fundamentals(ticker, db, fetch_peers=False)),
        fetch("financials", get_financial_statements(ticker)),
        fetch("valuation", get_valuation_bundle(ticker)),
        fetch("risk", get_risk_bundle(ticker, period="1y", horizon_days=60, n_sims=500)),
        fetch("institutional", get_institutional_flow(ticker)),
        fetch("insider", get_insider_summary(ticker)),
        fetch("news", get_news_bundle(db, ticker, limit=10)),
        fetch("options", get_options_overview(ticker)),
        asyncio.to_thread(fetch_politician_trades) if False else fetch_politician_trades(),
        return_exceptions=True,
    )

    data["_errors"] = errors
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# B. BUILD MEMO PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

def _fmt_pct(val: Any, mult: float = 100.0) -> str:
    """Safely format a value as percentage string."""
    if val is None:
        return "N/A"
    try:
        return f"{float(val) * mult:.1f}%"
    except (TypeError, ValueError):
        return "N/A"


def _fmt_num(val: Any, prefix: str = "") -> str:
    """Safely format a number with optional prefix."""
    if val is None:
        return "N/A"
    try:
        v = float(val)
        if abs(v) >= 1e12:
            return f"{prefix}{v / 1e12:.1f}T"
        if abs(v) >= 1e9:
            return f"{prefix}{v / 1e9:.1f}B"
        if abs(v) >= 1e6:
            return f"{prefix}{v / 1e6:.1f}M"
        return f"{prefix}{v:,.0f}"
    except (TypeError, ValueError):
        return "N/A"


def _fmt_ratio(val: Any) -> str:
    if val is None:
        return "N/A"
    try:
        return f"{float(val):.1f}x"
    except (TypeError, ValueError):
        return "N/A"


def build_memo_prompt(ticker: str, data: Dict[str, Any]) -> tuple[str, str]:
    """
    Build system + user prompt for the investment memo.
    Returns (system_prompt, user_prompt).

    Strategy: distill each data source into 2-5 lines of key numbers,
    not raw dumps. Haiku works best with focused data.
    """
    sections: List[str] = []

    # ── Company Profile ──────────────────────────────────────────────────
    f = data.get("fundamentals")
    if f and isinstance(f, dict):
        target = f.get("target", f) if isinstance(f.get("target"), dict) else f
        sections.append(
            f"## Company Profile\n"
            f"- Name: {target.get('name', ticker)}\n"
            f"- Sector: {target.get('sector', 'N/A')} | Industry: {target.get('industry', 'N/A')}\n"
            f"- Market Cap: {_fmt_num(target.get('market_cap'), '$')}\n"
            f"- Price: {_fmt_num(target.get('current_price'), '$')} | "
            f"P/E: {_fmt_ratio(target.get('pe_ratio'))} | "
            f"Fwd P/E: {_fmt_ratio(target.get('forward_pe'))}\n"
            f"- EV/EBITDA: {_fmt_ratio(target.get('ev_to_ebitda'))} | "
            f"P/B: {_fmt_ratio(target.get('pb_ratio'))}\n"
            f"- Revenue Growth: {_fmt_pct(target.get('revenue_growth'), 100)} | "
            f"Gross Margin: {_fmt_pct(target.get('gross_margins'), 100)} | "
            f"Profit Margin: {_fmt_pct(target.get('profit_margin'), 100)}\n"
            f"- Beta: {target.get('beta', 'N/A')} | "
            f"Div Yield: {_fmt_pct(target.get('dividend_yield'), 100)}\n"
            f"- 52W Range: {_fmt_num(target.get('fifty_two_week_low'), '$')} – "
            f"{_fmt_num(target.get('fifty_two_week_high'), '$')}"
        )
    # ── Financial Snapshot ───────────────────────────────────────────────
    fin = data.get("financials")
    if fin and isinstance(fin, dict):
        lines = ["## Financial Snapshot"]
    
    # Extract the most recent period from income statement
    income = fin.get("income_statement", {})
    annual = income.get("annual", [])
    if annual:
        latest = annual[0]  # most recent year
        period = latest.get("fiscal_date_ending", latest.get("date", "Unknown"))
        lines.append(f"- Latest Annual Filing: {period}")
        lines.append(
            f"- Revenue: {_fmt_num(latest.get('total_revenue', latest.get('totalRevenue')), '$')} | "
            f"Net Income: {_fmt_num(latest.get('net_income', latest.get('netIncome')), '$')}"
        )
    
    quarterly = income.get("quarterly", [])
    if quarterly:
        latest_q = quarterly[0]
        q_period = latest_q.get("fiscal_date_ending", latest_q.get("date", "Unknown"))
        lines.append(f"- Latest Quarterly Filing: {q_period}")
        lines.append(
            f"- Q Revenue: {_fmt_num(latest_q.get('total_revenue', latest_q.get('totalRevenue')), '$')} | "
            f"Q Net Income: {_fmt_num(latest_q.get('net_income', latest_q.get('netIncome')), '$')}"
        )
    
    sections.append("\n".join(lines))

    # ── Valuation (DCF + Scenarios) ──────────────────────────────────────
    v = data.get("valuation")
    if v and isinstance(v, dict):
        fv = v.get("fair_value_per_share_est")
        upside = v.get("upside_downside", {})
        scenarios = v.get("scenarios", {})
        dcf = v.get("dcf", {})
        multiples = v.get("multiples", {})
        analyst = v.get("analyst_consensus", {})

        lines = ["## Valuation"]
        lines.append(f"- DCF Fair Value: {_fmt_num(fv, '$')} | "
                      f"Upside: {_fmt_pct(upside.get('upside_pct'), 1) if upside else 'N/A'}")
        lines.append(f"- Terminal Value % of EV: {_fmt_pct(dcf.get('terminal_pct_of_ev'), 1) if dcf else 'N/A'}")

        bear = scenarios.get("bear", {})
        base = scenarios.get("base", {})
        bull = scenarios.get("bull", {})
        if bear or base or bull:
            lines.append(
                f"- Scenario FV: Bear {_fmt_num(bear.get('fair_value_per_share'), '$')} | "
                f"Base {_fmt_num(base.get('fair_value_per_share'), '$')} | "
                f"Bull {_fmt_num(bull.get('fair_value_per_share'), '$')}"
            )

        # Multiples
        implied = multiples.get("implied_values", []) if multiples else []
        if implied:
            methods = ", ".join(f"{m.get('method','?')}: {_fmt_num(m.get('fair_value'), '$')}" for m in implied[:3])
            lines.append(f"- Multiples: {methods}")

        # Analyst consensus
        if analyst:
            lines.append(
                f"- Analyst: Target {_fmt_num(analyst.get('target_mean'), '$')} "
                f"({_fmt_num(analyst.get('target_low'), '$')}-{_fmt_num(analyst.get('target_high'), '$')}), "
                f"Rec: {analyst.get('recommendation', 'N/A')}"
            )

        sections.append("\n".join(lines))

    # ── Risk ─────────────────────────────────────────────────────────────
    r = data.get("risk")
    if r and isinstance(r, dict):
        metrics = r.get("metrics", {})
        scenarios = r.get("scenarios", {})
        probs = r.get("probabilities", {})
        lines = ["## Risk"]
        lines.append(
            f"- Annualized Vol: {_fmt_pct(metrics.get('annualized_volatility'), 100)} | "
            f"Max Drawdown: {_fmt_pct(metrics.get('max_drawdown'), 100)}"
        )
        lines.append(
            f"- VaR 95% 1D: {_fmt_pct(metrics.get('var_95_1d'), 100)} | "
            f"VaR 99% 1D: {_fmt_pct(metrics.get('var_99_1d'), 100)}"
        )
        lines.append(
            f"- Monte Carlo 60d: Stress P5 {_fmt_pct(scenarios.get('stress_p5'), 100)}, "
            f"Base P50 {_fmt_pct(scenarios.get('base_p50'), 100)}, "
            f"Bull P95 {_fmt_pct(scenarios.get('bull_p95'), 100)}"
        )
        lines.append(
            f"- Prob positive: {_fmt_pct(probs.get('prob_positive_return'), 100)} | "
            f"Prob >10%: {_fmt_pct(probs.get('prob_above_10pct'), 100)} | "
            f"Prob <-10%: {_fmt_pct(probs.get('prob_below_minus_10pct'), 100)}"
        )
        sections.append("\n".join(lines))

    # ── Institutional Ownership ──────────────────────────────────────────
    inst = data.get("institutional")
    if inst and isinstance(inst, dict):
        lines = ["## Institutional Ownership"]
        lines.append(
            f"- Total Institutions: {inst.get('total_institutions', 'N/A')} | "
            f"% Held: {_fmt_pct(inst.get('pct_held'), 100)}"
        )
        qoq = inst.get("qoq_change", {})
        if qoq:
            lines.append(
                f"- QoQ Change: {_fmt_num(qoq.get('net_shares_change'))} shares "
                f"({qoq.get('buyers', 0)} buyers, {qoq.get('sellers', 0)} sellers)"
            )
        sections.append("\n".join(lines))

    # ── Insider Activity ─────────────────────────────────────────────────
    ins = data.get("insider")
    if ins and isinstance(ins, dict):
        lines = ["## Insider Activity (Last 12M)"]
        lines.append(
            f"- Net Shares: {_fmt_num(ins.get('net_shares_12m'))} | "
            f"Buys: {ins.get('buy_count_12m', 0)} | Sells: {ins.get('sell_count_12m', 0)}"
        )
        lines.append(f"- Net Value: {_fmt_num(ins.get('net_value_12m'), '$')}")
        sections.append("\n".join(lines))

    # ── News Sentiment ───────────────────────────────────────────────────
    news = data.get("news")
    if news and isinstance(news, dict):
        headlines = news.get("headlines", [])
        avg_sent = news.get("avg_headline_sentiment")
        lines = ["## News Sentiment"]

        # Parse dates for coverage window and recency split
        dated_headlines: list[tuple[datetime, dict]] = []
        undated: list[dict] = []
        for h in headlines:
            pub = h.get("published")
            if pub:
                try:
                    dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                    dated_headlines.append((dt, h))
                    continue
                except (ValueError, TypeError):
                    pass
            undated.append(h)

        if dated_headlines:
            dates = [dt for dt, _ in dated_headlines]
            oldest = min(dates).strftime("%Y-%m-%d")
            newest = max(dates).strftime("%Y-%m-%d")
            lines.append(f"- Coverage window: {oldest} to {newest} ({len(headlines)} articles)")

        lines.append(f"- Avg Sentiment: {avg_sent:.2f}/1.0" if avg_sent is not None else "- Avg Sentiment: N/A")

        # Split into recent (last 3 days) vs older for trend detection
        now = datetime.now(timezone.utc)
        recent = [(dt, h) for dt, h in dated_headlines if (now - dt).days <= 3]
        older = [(dt, h) for dt, h in dated_headlines if (now - dt).days > 3]

        if recent and older:
            recent_avg = sum(h["sentiment"]["compound"] for _, h in recent) / len(recent)
            older_avg = sum(h["sentiment"]["compound"] for _, h in older) / len(older)
            lines.append(f"- Recent sentiment (last 3d): {recent_avg:+.2f} ({len(recent)} articles)")
            lines.append(f"- Prior sentiment: {older_avg:+.2f} ({len(older)} articles)")

            shift = recent_avg - older_avg
            if abs(shift) > 0.15:
                direction = "improving" if shift > 0 else "deteriorating"
                lines.append(f"- Warning: Sentiment {direction} ({shift:+.2f} shift)")

        # Headlines with source and date
        lines.append("- Headlines:")
        for h in headlines[:7]:
            sent = h.get("sentiment", {})
            compound = sent.get("compound", 0) if isinstance(sent, dict) else 0
            pub = h.get("published", "")
            pub_short = pub[:10] if pub else "?"
            source = h.get("source") or "Unknown"
            lines.append(f"  - [{compound:+.2f}] ({pub_short}) {h.get('title', '?')} — {source}")
        sections.append("\n".join(lines))

    # ── Options Flow ─────────────────────────────────────────────────────
    opt = data.get("options")
    if opt and isinstance(opt, dict):
        lines = ["## Options Flow"]
        lines.append(
            f"- Put/Call Ratio: {opt.get('put_call_ratio', 'N/A')} | "
            f"Total Volume: {_fmt_num(opt.get('total_volume'))}"
        )
        lines.append(
            f"- Total OI: {_fmt_num(opt.get('total_oi'))} | "
            f"IV Rank: {opt.get('iv_percentile', 'N/A')}"
        )
        em = opt.get("expected_move", {})
        if em:
            lines.append(
                f"- Expected Move: {_fmt_pct(em.get('pct'), 1) if em.get('pct') else 'N/A'}"
            )
        sections.append("\n".join(lines))

    # ── Congressional Trades ─────────────────────────────────────────────
    pol_trades = data.get("politician_trades", [])
    if pol_trades:
        lines = ["## Congressional Trading"]
        for t in pol_trades[:5]:
            pol = t.politician if hasattr(t, 'politician') else None
            name = pol.name if pol else "Unknown"
            party = pol.party if pol else "?"
            txn_type = t.transaction_type if hasattr(t, 'transaction_type') else "?"
            date = t.transaction_date.strftime("%Y-%m-%d") if hasattr(t, 'transaction_date') and t.transaction_date else "?"
            amt_min = t.amount_min if hasattr(t, 'amount_min') else None
            amt_max = t.amount_max if hasattr(t, 'amount_max') else None
            amt = f"{_fmt_num(amt_min, '$')}–{_fmt_num(amt_max, '$')}" if amt_min else "N/A"
            lines.append(f"  - {name} ({party}): {txn_type} {amt} on {date}")
        sections.append("\n".join(lines))

    # ── Data Gaps ────────────────────────────────────────────────────────
    gaps = data.get("_errors", [])
    if gaps:
        sections.append(f"## Data Gaps\nThe following data sources were unavailable: {', '.join(gaps)}")

    # ── Build the prompt ─────────────────────────────────────────────────
    user_prompt = (
    f"Write a one-page investment memo for **{ticker}** using ONLY the data below.\n"
    f"Data gathered: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n"
    f"**Important**: Only make claims supported by the data provided. "
    f"Do not infer, assume, or reference any information not explicitly listed.\n\n"
    + "\n\n".join(sections)
)

    system_prompt = (
       "You are an equity research assistant that writes concise, "
        "data-driven investment memos. You ONLY use data explicitly "
        "provided — never reference external knowledge about the company, "
        "its competitors, or market conditions.\n\n"
        "Use markdown formatting.\n\n"
        "Structure your memo as follows:\n"
        "1. **Executive Summary** – 2-3 sentence overview of the investment case\n"
        "2. **Bull Case** – 3-4 bullet points with specific data\n"
        "3. **Bear Case** – 3-4 bullet points with specific data\n"
        "4. **Key Metrics Commentary** – What stands out in the numbers\n"
        "5. **Risk Factors** – Top 3 risks, ranked by severity\n"
        "6. **Valuation Range** – Where fair value sits and what it implies\n\n"
         "Guidelines:\n"
        "- ONLY cite numbers that appear in the data sections above\n"
        "- If data is missing (N/A) or a section is absent, explicitly note the gap\n"
        "- Do NOT issue buy/sell/hold ratings or price targets beyond the DCF range provided\n"
        "- Note when data may be lagged (e.g., institutional ownership is from 13F filings)\n"
        "- End with: 'This memo is AI-generated for educational purposes and is not investment advice.'"
    )

    return system_prompt, user_prompt


# ═══════════════════════════════════════════════════════════════════════════════
# C. STREAM MEMO GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_memo_stream(
    ticker: str,
    db: Session,
    accumulator: list,
    token_usage: dict,
) -> AsyncGenerator[str, None]:
    """
    Stream a memo for the given ticker. Text chunks are yielded for SSE
    and appended to `accumulator` for DB save. Token usage is written
    to `token_usage` dict after stream completes.
    """
    if not settings.ANTHROPIC_API_KEY:
        error_msg = "AI memo generation is not configured. Set ANTHROPIC_API_KEY in your environment."
        accumulator.append(error_msg)
        yield error_msg
        return

    # Gather data
    memo_data = await gather_memo_data(ticker, db)
    system_prompt, user_prompt = build_memo_prompt(ticker, memo_data)

    client = _get_client()

    async with client.messages.stream(
        model=MODEL,
        max_tokens=1500,
        temperature=0.3,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        async for text in stream.text_stream:
            accumulator.append(text)
            yield text

    # Get token usage after stream completes
    final_message = await stream.get_final_message()
    token_usage["input_tokens"] = final_message.usage.input_tokens
    token_usage["output_tokens"] = final_message.usage.output_tokens
    token_usage["model"] = MODEL


# ═══════════════════════════════════════════════════════════════════════════════
# D. MONTHLY BUDGET CHECK
# ═══════════════════════════════════════════════════════════════════════════════

def check_monthly_budget(db: Session) -> tuple[bool, float, float]:
    """
    Check if AI spending is within the monthly budget.
    Returns (is_within_budget, spent_usd, remaining_usd).

    Pricing (Haiku 4.5): $0.80/1M input, $4.00/1M output
    """
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = db.execute(
        text(
            "SELECT COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0) "
            "FROM investment_memos WHERE created_at >= :start"
        ),
        {"start": first_of_month},
    ).fetchone()

    total_input = result[0]
    total_output = result[1]

    spent = (total_input * 0.80 / 1_000_000) + (total_output * 4.0 / 1_000_000)
    budget = settings.AI_MONTHLY_BUDGET_USD
    remaining = max(0.0, budget - spent)

    return spent <= budget, round(spent, 4), round(remaining, 4)
