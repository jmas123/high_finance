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
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy.orm import Session

from high_finance.core.config import settings
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL

logger = logging.getLogger(__name__)

MAX_HISTORY = 10  # max user/assistant message pairs to send
MAX_TOKENS = 800


# ═════════════════════════════════════════════════════════════════════════════
# A. BUILD ASSISTANT SYSTEM PROMPT
# ═════════════════════════════════════════════════════════════════════════════

def build_assistant_system_prompt(ticker: Optional[str], financial_context: str) -> str:
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
        "- Never give buy/sell/hold recommendations.\n"
        "- Use markdown formatting for readability.\n"
        "- End substantive analyses with: "
        "'This is AI-generated for educational purposes and is not investment advice.'\n"
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
) -> AsyncGenerator[str, None]:
    """
    Stream an assistant response for the given query.

    Args:
        query: The user's current question
        ticker: Currently viewed ticker (or None)
        conversation_history: List of {"role": "user"|"assistant", "content": "..."}
            from previous turns (max 10 pairs)
        db: Database session for data gathering
        accumulator: List to append text chunks to (for logging/saving)

    Yields:
        Text chunks for SSE streaming
    """
    if not settings.ANTHROPIC_API_KEY:
        msg = "AI assistant is not configured. Set ANTHROPIC_API_KEY."
        accumulator.append(msg)
        yield msg
        return

    # Gather financial context if we have a ticker
    financial_context = ""
    if ticker:
        financial_context = await gather_assistant_context(ticker, db)

    system_prompt = build_assistant_system_prompt(ticker, financial_context)

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
