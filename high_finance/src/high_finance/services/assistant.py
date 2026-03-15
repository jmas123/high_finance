"""
AI Research Assistant Service
=============================
Conversational assistant that answers questions about tickers using
the same data pipeline as investment memos. Financial data is injected
once in the system prompt; follow-up messages send only conversation
history (capped at 10 exchanges) to control cost.

Reuses:
  - gather_memo_data() / build_memo_prompt() from services.memo for data
  - get_anthropic_client() / HAIKU_MODEL from core.llm
  - Streaming pattern from services.memo (accumulator + SSE chunks)
"""

import asyncio
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from high_finance.core.config import settings
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL

logger = logging.getLogger(__name__)

MAX_HISTORY = 5  # max user/assistant message pairs to send
MAX_TOKENS = 800

# Common English words that look like tickers (2-5 uppercase letters)
_TICKER_BLOCKLIST = frozenset({
    "OR", "IS", "IT", "AT", "BE", "GO", "NO", "DO", "SO", "AN", "IN", "ON",
    "OF", "BY", "TO", "AS", "IF", "UP", "AM", "US", "WE", "HE", "ME", "MY",
    "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
    "WAS", "ONE", "OUR", "OUT", "HAS", "HIS", "HOW", "ITS", "MAY", "NEW",
    "NOW", "OLD", "SEE", "WAY", "WHO", "DID", "GET", "HIM", "LET", "SAY",
    "SHE", "TOO", "USE", "WHAT", "FIND", "GIVE", "MORE", "MOST", "MUCH",
    "THAN", "THEM", "THEN", "THIS", "VERY", "WHEN", "WITH", "FROM", "JUST",
    "OVER", "ALSO", "BACK", "INTO", "ONLY", "SOME", "TAKE", "WANT", "LONG",
    "GOOD", "HIGH", "LOW", "BIG", "NEXT", "BEST", "BOTH", "EACH",
    "LIKE", "LOOK", "MAKE", "MANY", "SAME", "TECH", "THAT", "HAVE",
    "BEEN", "WELL", "YEAR", "WILL", "WORK", "CALL", "COME", "KEEP",
    "LAST", "SHOW", "TELL", "SELL", "HOLD", "BUYS", "SELL", "RATE",
    "EVEN", "HELP", "HERE", "LESS",
})

# Regex: $AAPL, standalone AAPL (2-5 uppercase at word boundaries), (AAPL)
_TICKER_PATTERN = re.compile(
    r'\$([A-Z]{1,5})'           # $AAPL style
    r'|(?<![A-Za-z])([A-Z]{2,5})(?![A-Za-z])'  # standalone AAPL
    r'|\(([A-Z]{2,5})\)',       # (AAPL) style
)

MAX_COMPARISON_TICKERS = 3


# ═════════════════════════════════════════════════════════════════════════════
# A0. MULTI-TICKER COMPARISON HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def extract_comparison_tickers(query: str, primary_ticker: Optional[str]) -> List[str]:
    """
    Extract ticker symbols from a user query for multi-ticker comparison.
    Excludes the primary ticker (already loaded) and caps at MAX_COMPARISON_TICKERS.
    """
    found: List[str] = []
    seen = set()
    primary_upper = primary_ticker.upper() if primary_ticker else ""

    for match in _TICKER_PATTERN.finditer(query):
        # The regex has 3 groups — exactly one will be non-None
        ticker_str = match.group(1) or match.group(2) or match.group(3)
        if not ticker_str:
            continue
        t = ticker_str.upper()
        if t in seen or t == primary_upper or t in _TICKER_BLOCKLIST:
            continue
        seen.add(t)
        found.append(t)
        if len(found) >= MAX_COMPARISON_TICKERS:
            break

    return found


def _gather_comparison_context_sync(tickers: List[str], db: Session) -> str:
    """
    Query screener_cache for comparison tickers and return a markdown table.
    Runs synchronously (meant to be called via asyncio.to_thread).
    """
    if not tickers:
        return ""

    try:
        placeholders = ", ".join(f":t{i}" for i in range(len(tickers)))
        params = {f"t{i}": t for i, t in enumerate(tickers)}
        query = text(f"""
            SELECT ticker, market_cap, pe_ratio, forward_pe, pb_ratio,
                   ev_to_ebitda, roe, profit_margin, revenue_growth,
                   fcf_yield, dividend_yield, debt_to_equity, beta
            FROM screener_cache
            WHERE ticker IN ({placeholders})
        """)
        result = db.execute(query, params)
        rows = result.fetchall()

        if not rows:
            return ""

        # Build markdown table
        headers = [
            "Ticker", "Market Cap", "P/E", "Fwd P/E", "P/B", "EV/EBITDA",
            "ROE", "Net Margin", "Rev Growth", "FCF Yield", "Div Yield",
            "D/E", "Beta",
        ]
        lines = ["| " + " | ".join(headers) + " |"]
        lines.append("| " + " | ".join("---" for _ in headers) + " |")

        def fmt_cap(v):
            if v is None: return "—"
            if v >= 1e12: return f"${v/1e12:.1f}T"
            if v >= 1e9: return f"${v/1e9:.1f}B"
            if v >= 1e6: return f"${v/1e6:.0f}M"
            return f"${v:,.0f}"

        def fmt_num(v, decimals=2):
            if v is None: return "—"
            return f"{float(v):.{decimals}f}"

        def fmt_pct(v):
            if v is None: return "—"
            return f"{float(v)*100:.1f}%"

        for row in rows:
            cells = [
                row.ticker,
                fmt_cap(row.market_cap),
                fmt_num(row.pe_ratio, 1),
                fmt_num(row.forward_pe, 1),
                fmt_num(row.pb_ratio, 1),
                fmt_num(row.ev_to_ebitda, 1),
                fmt_pct(row.roe),
                fmt_pct(row.profit_margin),
                fmt_pct(row.revenue_growth),
                fmt_pct(row.fcf_yield),
                fmt_pct(row.dividend_yield),
                fmt_num(row.debt_to_equity, 1),
                fmt_num(row.beta, 2),
            ]
            lines.append("| " + " | ".join(cells) + " |")

        return "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to gather comparison context: %s", e)
        return ""


async def gather_comparison_context(tickers: List[str], db: Session) -> str:
    """Fetch comparison data synchronously — query is fast and avoids cross-thread session issues."""
    return _gather_comparison_context_sync(tickers, db)


# ═════════════════════════════════════════════════════════════════════════════
# A1. PORTFOLIO / WATCHLIST CONTEXT
# ═════════════════════════════════════════════════════════════════════════════

def _gather_portfolio_context_sync(user_id: str, db: Session) -> str:
    """
    Query portfolio_positions and watchlist_items for the authenticated user,
    join against screener_cache for current prices, and return a markdown
    section the LLM can reference when answering portfolio questions.
    """
    try:
        logger.info("Gathering portfolio context for user %s", user_id)
        # ── Portfolio positions ──
        pos_rows = db.execute(
            text("SELECT ticker, name, shares, avg_cost FROM portfolio_positions WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchall()

        # ── Watchlist items ──
        wl_rows = db.execute(
            text("SELECT ticker, name FROM watchlist_items WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchall()

        logger.info("Portfolio context for user %s: %d positions, %d watchlist",
                     user_id, len(pos_rows), len(wl_rows))

        if not pos_rows and not wl_rows:
            return "## User's Portfolio\nThe user has not added any positions or watchlist items yet."

        # ── Fetch current prices for all relevant tickers ──
        all_tickers = list({r.ticker for r in pos_rows} | {r.ticker for r in wl_rows})
        prices: Dict[str, float] = {}
        names: Dict[str, str] = {}
        if all_tickers:
            placeholders = ", ".join(f":t{i}" for i in range(len(all_tickers)))
            params = {f"t{i}": t for i, t in enumerate(all_tickers)}
            price_rows = db.execute(
                text(
                    f"SELECT sc.ticker, su.company_name, sc.current_price "
                    f"FROM screener_cache sc "
                    f"LEFT JOIN screener_universe su ON sc.ticker = su.ticker "
                    f"WHERE sc.ticker IN ({placeholders})"
                ),
                params,
            ).fetchall()
            for pr in price_rows:
                if pr.current_price is not None:
                    prices[pr.ticker] = float(pr.current_price)
                if pr.company_name:
                    names[pr.ticker] = pr.company_name

        sections: List[str] = []

        # ── Build portfolio table ──
        if pos_rows:
            total_value = 0.0
            total_cost = 0.0
            table_rows: List[str] = []

            # First pass: compute total value for weight%
            position_data = []
            for row in pos_rows:
                shares = float(row.shares)
                avg_cost = float(row.avg_cost)
                cost_basis = shares * avg_cost
                cur_price = prices.get(row.ticker)
                mkt_value = shares * cur_price if cur_price is not None else None
                if mkt_value is not None:
                    total_value += mkt_value
                total_cost += cost_basis
                display_name = names.get(row.ticker, row.name or row.ticker)
                position_data.append((row.ticker, display_name, shares, avg_cost, cur_price, cost_basis, mkt_value))

            headers = "| Ticker | Name | Shares | Avg Cost | Current | Mkt Value | P&L | P&L% | Weight |"
            sep = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
            table_rows.append(headers)
            table_rows.append(sep)

            for ticker, name, shares, avg_cost, cur_price, cost_basis, mkt_value in position_data:
                if cur_price is not None:
                    pnl = mkt_value - cost_basis
                    pnl_str = f"+${pnl:,.0f}" if pnl >= 0 else f"-${abs(pnl):,.0f}"
                    pnl_pct = f"+{pnl/cost_basis*100:.1f}%" if cost_basis > 0 and pnl >= 0 else (
                        f"{pnl/cost_basis*100:.1f}%" if cost_basis > 0 else "N/A"
                    )
                    weight = f"{mkt_value/total_value*100:.1f}%" if total_value > 0 else "N/A"
                    table_rows.append(
                        f"| {ticker} | {name} | {shares:.2f} | ${avg_cost:,.2f} | ${cur_price:,.2f} "
                        f"| ${mkt_value:,.0f} | {pnl_str} | {pnl_pct} | {weight} |"
                    )
                else:
                    table_rows.append(
                        f"| {ticker} | {name} | {shares:.2f} | ${avg_cost:,.2f} | N/A | N/A | N/A | N/A | N/A |"
                    )

            total_pnl = total_value - total_cost
            pnl_sign = "+" if total_pnl >= 0 else ""
            pnl_pct_total = f" ({pnl_sign}{total_pnl/total_cost*100:.1f}%)" if total_cost > 0 else ""

            sections.append(
                "## User's Portfolio\n"
                + "\n".join(table_rows)
                + f"\n\n**Total value:** ${total_value:,.0f} | "
                f"**Total P&L:** {pnl_sign}${abs(total_pnl):,.0f}{pnl_pct_total}"
            )

        # ── Build watchlist line ──
        if wl_rows:
            wl_tickers = ", ".join(r.ticker for r in wl_rows)
            sections.append(f"## User's Watchlist\n{wl_tickers}")

        return "\n\n".join(sections)

    except Exception as e:
        logger.exception("Failed to gather portfolio context for user %s", user_id)
        return ""


async def gather_portfolio_context(user_id: str, db: Session) -> str:
    """Fetch portfolio data synchronously — query is fast and avoids cross-thread session issues."""
    return _gather_portfolio_context_sync(user_id, db)


# ═════════════════════════════════════════════════════════════════════════════
# A. BUILD ASSISTANT SYSTEM PROMPT
# ═════════════════════════════════════════════════════════════════════════════

def build_assistant_system_prompt(
    ticker: Optional[str],
    financial_context: str,
    session_context: Optional[str] = None,
    comparison_context: Optional[str] = None,
    page_context: Optional[str] = None,
    portfolio_context: Optional[str] = None,
) -> str:
    """
    Build the system prompt for the assistant.

    Financial data is embedded here once — it does NOT get re-sent on each
    follow-up message. Only conversation history is appended per turn.
    """
    base = (
        "You are a research assistant built into the High Finance investment platform. "
        "You help users understand financial data, analyze companies, and answer "
        "questions about investing concepts.\n\n"
        "Guidelines:\n"
        "- Be concise — aim for 2-4 paragraphs unless the user asks for detail.\n"
        "- Use specific numbers from the data when available.\n"
        "- ALWAYS present the data you DO have before noting any gaps. Lead with what you know.\n"
        "- When the user asks about 'today' or 'real-time' data, share the most recent data "
        "you have and note its recency (e.g., 'The most recent insider filing I have is from...').\n"
        "- NEVER suggest external websites or tools (SEC EDGAR, Yahoo Finance, etc.). "
        "You ARE the platform — answer from the data provided.\n"
        "- NEVER say 'I don't have access to' data that IS in your context below. "
        "Read the data sections carefully before claiming something is unavailable.\n"
        "- Never give buy/sell/hold recommendations. However, you CAN and SHOULD suggest "
        "specific companies worth researching when asked — especially based on portfolio gaps "
        "(missing sectors, concentration risk, diversification). Suggesting a company to "
        "research is NOT investment advice. Frame suggestions as 'worth researching' or "
        "'consider looking into', not 'you should buy'.\n"
        "- Use markdown formatting for readability.\n"
        "- End substantive analyses with: "
        "'This is AI-generated for educational purposes and is not investment advice.'\n\n"
        "Action markers — when the user explicitly asks to run/generate/create one of these "
        "platform features, include EXACTLY ONE marker on its own line at the END of your "
        "response:\n"
        "[ACTION:dcf] — when user wants a DCF valuation\n"
        "[ACTION:memo] — when user wants an investment memo\n"
        "[ACTION:risk] — when user wants a risk assessment\n"
        "Do NOT include these markers for general questions. Only when the user explicitly "
        "asks to run, generate, or create one of these features.\n"
    )


    if session_context:
        base += (
            f"\nSession context (what the user has been doing):\n"
            f"{session_context}\n"
        )

    if page_context:
        base += (
            f"\n## Current Page\n"
            f"The user is currently viewing: **{page_context}**\n"
            f"When asked to explain this page or what they're looking at, describe "
            f"what this section shows and how to interpret it in the context of investment research.\n"
        )

    # ── Portfolio & watchlist data (injected for authenticated users) ──
    if portfolio_context:
        base += (
            "\n" + portfolio_context + "\n\n"
            "When the user asks about 'my portfolio', 'my holdings', or 'how am I doing', "
            "use the portfolio data above. Reference specific positions, P&L figures, and "
            "concentration. If a ticker shows N/A for price, note that current pricing is "
            "unavailable for that position.\n"
            "When asked about portfolio gaps, missing sectors, or what to add, analyze their "
            "current sector/industry exposure and suggest specific companies worth researching "
            "to improve diversification. This is research guidance, not investment advice.\n"
            "If the user has no positions yet, tell them they can add holdings from the "
            "Portfolio section on the dashboard. Do NOT ask them to paste holdings in chat.\n"
        )

    if ticker and financial_context:
        base += (
            f"\nThe user is currently viewing **{ticker}**. "
            f"Below is the financial data loaded for this ticker. "
            f"Use it to answer questions — do not reference data not shown here.\n\n"
            f"{financial_context}\n"
        )
    elif ticker:
        base += (
            f"\nThe user is currently viewing **{ticker}**, but financial data "
            f"could not be loaded for this session. Answer general knowledge questions "
            f"about the company, and suggest the user reload the ticker page if they "
            f"need specific data.\n"
        )

    # ── Comparison data (injected when user mentions other tickers) ──
    if comparison_context:
        base += (
            "\n## Comparison Data\n"
            "The user mentioned other tickers. Here is screener data for comparison:\n\n"
            f"{comparison_context}\n\n"
            "Use this data alongside the primary ticker's data to make comparisons. "
            "Note which metrics are stronger or weaker for each company.\n"
        )

    # ── Screening instructions (always available) ──
    base += (
        "\n## Stock Screening\n"
        "When the user asks to find, screen, or filter stocks, you can help them "
        "build a screener query. The platform's screener supports these filter fields "
        "(all use min/max ranges unless noted):\n\n"
        "**Valuation:** market_cap, pe_ratio, forward_pe, pb_ratio, ev_to_ebitda, dividend_yield\n"
        "**Quality:** roe, profit_margin, debt_to_equity, fcf_yield, beta\n"
        "**Growth/Momentum:** revenue_growth, price_vs_200ma, price_vs_52w_high\n"
        "**Smart Money:** has_insider_buys_90d (boolean), insider_net_shares_90d, congress_net_value_90d\n"
        "**Other:** sectors (comma-separated, e.g. 'Technology,Healthcare'), "
        "sort_by (any field name), sort_order ('asc'/'desc')\n\n"
        "Percentage fields (roe, profit_margin, revenue_growth, dividend_yield, fcf_yield, "
        "price_vs_200ma, price_vs_52w_high) use decimals: 0.15 = 15%.\n"
        "Market cap uses raw numbers: 10000000000 = $10B.\n\n"
        "When suggesting screener filters, explain your reasoning, then place EXACTLY ONE "
        "marker on its own line at the END of your response:\n"
        "[SCREEN:{\"pe_ratio_max\": 15, \"revenue_growth_min\": 0.1, \"sectors\": \"Technology\"}]\n"
        "Only include filter fields that are relevant. Do NOT include sort/limit unless the "
        "user specifically asks. The marker must be valid JSON inside the brackets.\n"
    )

    return base


# ═════════════════════════════════════════════════════════════════════════════
# B. GATHER CONTEXT (reuse memo pipeline)
# ═════════════════════════════════════════════════════════════════════════════

async def gather_assistant_context(ticker: str, db: Session) -> str:
    """
    Gather financial data for a ticker and format it as context text.
    Reuses the memo data pipeline so data is likely warm in Redis cache.
    Returns the user_prompt portion from build_memo_prompt (the data sections).
    """
    from high_finance.services.memo import gather_memo_data, build_memo_prompt

    try:
        data = await gather_memo_data(ticker, db)
        errors = data.get("_errors", [])
        if errors:
            logger.info("Assistant context for %s — partial failures: %s", ticker, errors)
        loaded = [k for k in data if k != "_errors" and data[k]]
        logger.info("Assistant context for %s — loaded sections: %s", ticker, loaded)

        _system, user_prompt = build_memo_prompt(ticker, data)
        # The user_prompt contains all the formatted data sections
        # Strip the "Write a one-page investment memo..." instruction prefix
        # and just keep the data
        marker = "\n\n## "
        idx = user_prompt.find(marker)
        if idx >= 0:
            return user_prompt[idx:]
        return user_prompt
    except Exception as e:
        logger.warning("Failed to gather assistant context for %s: %s", ticker, e)
        return ""


# ═════════════════════════════════════════════════════════════════════════════
# C. STREAM ASSISTANT RESPONSE
# ═════════════════════════════════════════════════════════════════════════════

async def stream_assistant_response(
    query: str,
    ticker: Optional[str],
    conversation_history: List[Dict[str, str]],
    db: Session,
    accumulator: list,
    session_context: Optional[str] = None,
    page_context: Optional[str] = None,
    user_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream an assistant response for the given query.

    Args:
        query: The user's current question
        ticker: Currently viewed ticker (or None)
        conversation_history: List of {"role": "user"|"assistant", "content": "..."}
            from previous turns (max 5 pairs)
        db: Database session for data gathering
        accumulator: List to append text chunks to (for logging/saving)
        session_context: Optional session browsing context string

    Yields:
        Text chunks for SSE streaming
    """
    if not settings.ANTHROPIC_API_KEY:
        msg = "AI assistant is not configured. Set ANTHROPIC_API_KEY."
        accumulator.append(msg)
        yield msg
        return

    # Gather financial context, comparison context, and portfolio context in parallel
    coros = []

    # Financial context (if ticker is set)
    async def _get_financial():
        if ticker:
            return await gather_assistant_context(ticker, db)
        return ""

    # Comparison context (if query mentions other tickers)
    comp_tickers = extract_comparison_tickers(query, ticker)

    async def _get_comparison():
        if comp_tickers:
            return await gather_comparison_context(comp_tickers, db)
        return ""

    # Portfolio context (if user is authenticated)
    async def _get_portfolio():
        if user_id:
            return await gather_portfolio_context(user_id, db)
        return ""

    financial_context, comparison_context, portfolio_context = await asyncio.gather(
        _get_financial(), _get_comparison(), _get_portfolio()
    )

    system_prompt = build_assistant_system_prompt(
        ticker, financial_context, session_context, comparison_context, page_context,
        portfolio_context,
    )

    # Build messages: conversation history (capped) + current query
    messages: List[Dict[str, str]] = []

    # Trim to last MAX_HISTORY messages (pairs)
    trimmed = conversation_history[-(MAX_HISTORY * 2):]
    for msg in trimmed:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    # Add current query
    messages.append({"role": "user", "content": query})

    client = get_anthropic_client()

    try:
        async with client.messages.stream(
            model=HAIKU_MODEL,
            max_tokens=MAX_TOKENS,
            temperature=0.3,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                accumulator.append(text)
                yield text
    except Exception as e:
        logger.exception("Assistant stream error: %s", e)
        error_msg = f"Sorry, I encountered an error: {str(e)}"
        accumulator.append(error_msg)
        yield error_msg
