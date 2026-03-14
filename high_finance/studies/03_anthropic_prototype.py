#!/usr/bin/env python3
"""
Anthropic Haiku Batch Sentiment — Prototype for financial headline classification.

Replicates patterns from:
- core/llm.py (client singleton, HAIKU_MODEL constant)
- services/earnings_analysis.py (_extract_json, error handling)

Usage:
    ANTHROPIC_API_KEY=sk-... python studies/03_anthropic_prototype.py

Or set the env var in your shell first.
"""

import asyncio
import json
import os
import re
import time
from typing import Any

from headlines import (
    HEADLINES,
    accuracy,
    confusion_matrix,
    per_category_accuracy,
    print_confusion_matrix,
)

# ── Constants (mirrors core/llm.py) ──────────────────────────────────────────

HAIKU_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM_PROMPT = """You are a financial sentiment classifier. For each headline, determine whether \
the sentiment is positive, negative, or neutral FROM AN INVESTOR'S PERSPECTIVE.

Consider: does this headline suggest the stock should go up (positive), \
down (negative), or is it purely informational (neutral)?

Return ONLY a JSON array with one object per headline. No other text.
Each object must have: "index" (1-based), "label" ("positive"|"negative"|"neutral"), \
"confidence" (0.0-1.0), "reasoning" (one sentence)."""


# ── JSON extraction (mirrors earnings_analysis.py:268-286) ────────────────────


def _extract_json(raw_text: str) -> str:
    """Robustly extract JSON from LLM output that may include markdown fences."""
    # Strategy 1: content inside ```...``` fences
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", raw_text, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()

    # Strategy 2: find outermost [ ... ] block (array)
    start = raw_text.find("[")
    if start != -1:
        end = raw_text.rfind("]")
        if end != -1 and end > start:
            return raw_text[start : end + 1].strip()

    return raw_text.strip()


# ── Async Haiku sentiment (production pattern) ───────────────────────────────


async def haiku_batch_sentiment(
    headlines: list[dict[str, Any]],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Classify headlines via a single batched Haiku API call.

    Args:
        headlines: List of dicts with at least a "text" key.
        api_key: Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.

    Returns:
        Dict with "results" (list of label dicts), "usage", "latency_ms", "cost_usd".
    """
    import anthropic

    client = anthropic.AsyncAnthropic(
        api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
    )

    # Build numbered headline list
    numbered = "\n".join(
        f"{i}. {h['text']}" for i, h in enumerate(headlines, 1)
    )

    t0 = time.perf_counter()

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=2000,
        temperature=0.0,  # Deterministic for benchmarking
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": numbered}],
    )

    latency_ms = (time.perf_counter() - t0) * 1000

    raw_text = response.content[0].text
    cleaned = _extract_json(raw_text)

    try:
        results = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"WARNING: Haiku returned malformed JSON. Error: {e}")
        print(f"Raw response (first 500 chars): {raw_text[:500]}")
        results = [{"error": "malformed_response", "raw": raw_text[:500]}]

    # Cost calculation (Haiku pricing as of 2025)
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    cost_usd = (input_tokens * 0.25 / 1_000_000) + (output_tokens * 1.25 / 1_000_000)

    return {
        "results": results,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        },
        "latency_ms": latency_ms,
        "cost_usd": cost_usd,
        "model": HAIKU_MODEL,
    }


# ── Sync wrapper for easy testing ────────────────────────────────────────────


def haiku_batch_sentiment_sync(
    headlines: list[dict[str, Any]],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Sync wrapper around the async batch sentiment function."""
    return asyncio.run(haiku_batch_sentiment(headlines, api_key))


# ── Production integration pattern ───────────────────────────────────────────

PRODUCTION_EXAMPLE = """
# How this would integrate into services/news.py:
#
# async def _compute():
#     # Step 1: fetch headlines (sync, thread pool -- unchanged)
#     raw = await asyncio.wait_for(
#         asyncio.to_thread(_fetch_yfinance_news_sync, ticker, limit),
#         timeout=15,
#     )
#     # Step 2: try Haiku batch (async, 5s timeout)
#     try:
#         result = await asyncio.wait_for(
#             _haiku_batch_sentiment([{"text": h["title"]} for h in raw]),
#             timeout=5,
#         )
#         # Merge sentiment back into headlines
#         for h, s in zip(raw, result["results"]):
#             h["sentiment"] = {
#                 "label": s["label"],
#                 "confidence": s["confidence"],
#                 "source": "haiku",
#             }
#     except Exception:
#         logger.warning("Haiku sentiment failed, falling back to VADER")
#         for h in raw:
#             h["sentiment"] = _headline_sentiment(h["title"])  # existing VADER
#     return _build_bundle(ticker, raw)
"""


# ── Display ───────────────────────────────────────────────────────────────────


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable to run this benchmark.")
        print("Usage: ANTHROPIC_API_KEY=sk-... python studies/03_anthropic_prototype.py")
        return

    print("=" * 90)
    print("ANTHROPIC HAIKU BATCH SENTIMENT")
    print("=" * 90)
    print()

    # Run batch classification
    print(f"Sending {len(HEADLINES)} headlines to {HAIKU_MODEL}...")
    result = haiku_batch_sentiment_sync(HEADLINES, api_key)
    print(f"Done in {result['latency_ms']:.0f}ms")
    print()

    # Extract predictions
    haiku_results = result["results"]
    if isinstance(haiku_results, list) and len(haiku_results) == len(HEADLINES):
        predictions = [r.get("label", "unknown") for r in haiku_results]
    else:
        print(f"ERROR: Expected {len(HEADLINES)} results, got {len(haiku_results)}")
        print("Raw results:", haiku_results)
        return

    actuals = [h["expected_label"] for h in HEADLINES]

    # Per-headline table
    print(f"{'#':<4}{'Headline':<50}{'Expected':<11}{'Haiku':<11}{'Conf':>5}  {'OK?'}")
    print("-" * 95)

    for i, (h, pred, r) in enumerate(zip(HEADLINES, predictions, haiku_results), 1):
        title = h["text"][:48].ljust(48)
        conf = r.get("confidence", 0.0)
        correct = "Y" if pred == h["expected_label"] else "X"
        marker = "" if correct == "Y" else " <-- MISS"
        print(f"{i:<4}{title}  {h['expected_label']:<11}{pred:<11}{conf:>5.2f}  {correct}{marker}")

    print()

    # Overall accuracy
    overall = accuracy(predictions, actuals)
    correct_count = sum(p == a for p, a in zip(predictions, actuals))
    print(f"Overall accuracy: {correct_count}/{len(HEADLINES)} ({overall:.0%})")
    print()

    # Per-category accuracy
    print("Per-category accuracy:")
    print(f"  {'Category':<16}{'Correct':<10}{'Total':<8}{'Accuracy'}")
    print(f"  {'-'*42}")
    cat_acc = per_category_accuracy(predictions, HEADLINES)
    for cat, stats in sorted(cat_acc.items()):
        print(f"  {cat:<16}{stats['correct']:<10}{stats['total']:<8}{stats['accuracy']:.0%}")
    print()

    # Confusion matrix
    print("Confusion matrix (rows=actual, cols=predicted):")
    cm = confusion_matrix(predictions, actuals)
    print_confusion_matrix(cm)
    print()

    # Reasoning (show Haiku's explanations)
    print("-" * 90)
    print("HAIKU REASONING")
    print("-" * 90)
    for i, r in enumerate(haiku_results, 1):
        reasoning = r.get("reasoning", "N/A")
        print(f"  [{i:>2}] {reasoning}")
    print()

    # Cost analysis
    print("-" * 90)
    print("COST ANALYSIS")
    print("-" * 90)
    print()

    input_tok = result["usage"]["input_tokens"]
    output_tok = result["usage"]["output_tokens"]
    cost = result["cost_usd"]

    print(f"This call:")
    print(f"  Input tokens:  {input_tok:,}")
    print(f"  Output tokens: {output_tok:,}")
    print(f"  Cost:          ${cost:.4f}")
    print(f"  Latency:       {result['latency_ms']:.0f}ms")
    print()

    # Monthly projections
    print("Monthly cost projections:")
    print(f"  {'Scenario':<45}{'Calls/day':<12}{'Monthly cost'}")
    print(f"  {'-'*65}")

    scenarios = [
        ("100 tickers/day, 1hr TTL (24 calls/ticker)", 2_400),
        ("100 tickers/day, 4hr TTL (6 calls/ticker)", 600),
        ("500 tickers/day, 1hr TTL (24 calls/ticker)", 12_000),
        ("500 tickers/day, 4hr TTL (6 calls/ticker)", 3_000),
    ]

    for desc, calls_per_day in scenarios:
        monthly = cost * calls_per_day * 30
        print(f"  {desc:<45}{calls_per_day:<12}${monthly:.2f}")

    print()
    print("Note: Actual costs depend on headline count per call. Above assumes")
    print(f"~{input_tok} input + ~{output_tok} output tokens per 20-headline batch.")


if __name__ == "__main__":
    main()
