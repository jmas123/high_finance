#!/usr/bin/env python3
"""
DeepSeek Batch Sentiment — Prototype for financial headline classification.

DeepSeek uses an OpenAI-compatible API, so we use the openai SDK pointed
at their base URL. Much cheaper than Haiku (~5-10x) — this script measures
whether accuracy is comparable.

Usage:
    DEEPSEEK_API_KEY=sk-... python studies/03b_deepseek_prototype.py

Or set the env var in your .env file.
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

# ── Constants ─────────────────────────────────────────────────────────────────

DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# Pricing (per MTok) as of early 2026
DEEPSEEK_INPUT_PRICE = 0.27   # $/MTok input
DEEPSEEK_OUTPUT_PRICE = 1.10  # $/MTok output

_SYSTEM_PROMPT = """You are a financial sentiment classifier. For each headline, determine whether \
the sentiment is positive, negative, or neutral FROM AN INVESTOR'S PERSPECTIVE.

Consider: does this headline suggest the stock should go up (positive), \
down (negative), or is it purely informational (neutral)?

Return ONLY a JSON array with one object per headline. No other text.
Each object must have: "index" (1-based), "label" ("positive"|"negative"|"neutral"), \
"confidence" (0.0-1.0), "reasoning" (one sentence)."""


# ── JSON extraction (same pattern as earnings_analysis.py) ────────────────────


def _extract_json(raw_text: str) -> str:
    """Robustly extract JSON from LLM output that may include markdown fences."""
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", raw_text, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()

    start = raw_text.find("[")
    if start != -1:
        end = raw_text.rfind("]")
        if end != -1 and end > start:
            return raw_text[start : end + 1].strip()

    return raw_text.strip()


# ── Async DeepSeek sentiment ─────────────────────────────────────────────────


async def deepseek_batch_sentiment(
    headlines: list[dict[str, Any]],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Classify headlines via a single batched DeepSeek API call.

    Uses the OpenAI-compatible API with DeepSeek's base URL.
    """
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=api_key or os.environ.get("DEEPSEEK_API_KEY"),
        base_url=DEEPSEEK_BASE_URL,
    )

    numbered = "\n".join(
        f"{i}. {h['text']}" for i, h in enumerate(headlines, 1)
    )

    t0 = time.perf_counter()

    response = await client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        max_tokens=2000,
        temperature=0.0,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": numbered},
        ],
    )

    latency_ms = (time.perf_counter() - t0) * 1000

    raw_text = response.choices[0].message.content or ""
    cleaned = _extract_json(raw_text)

    try:
        results = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"WARNING: DeepSeek returned malformed JSON. Error: {e}")
        print(f"Raw response (first 500 chars): {raw_text[:500]}")
        results = [{"error": "malformed_response", "raw": raw_text[:500]}]

    input_tokens = response.usage.prompt_tokens if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    cost_usd = (
        input_tokens * DEEPSEEK_INPUT_PRICE / 1_000_000
        + output_tokens * DEEPSEEK_OUTPUT_PRICE / 1_000_000
    )

    return {
        "results": results,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        },
        "latency_ms": latency_ms,
        "cost_usd": cost_usd,
        "model": DEEPSEEK_MODEL,
    }


# ── Sync wrapper ──────────────────────────────────────────────────────────────


def deepseek_batch_sentiment_sync(
    headlines: list[dict[str, Any]],
    api_key: str | None = None,
) -> dict[str, Any]:
    """Sync wrapper around the async batch sentiment function."""
    return asyncio.run(deepseek_batch_sentiment(headlines, api_key))


# ── Display ───────────────────────────────────────────────────────────────────


def main() -> None:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("ERROR: Set DEEPSEEK_API_KEY environment variable to run this benchmark.")
        print("Usage: DEEPSEEK_API_KEY=sk-... python studies/03b_deepseek_prototype.py")
        return

    print("=" * 90)
    print("DEEPSEEK BATCH SENTIMENT")
    print("=" * 90)
    print()

    print(f"Sending {len(HEADLINES)} headlines to {DEEPSEEK_MODEL}...")
    result = deepseek_batch_sentiment_sync(HEADLINES, api_key)
    print(f"Done in {result['latency_ms']:.0f}ms")
    print()

    # Extract predictions
    ds_results = result["results"]
    if isinstance(ds_results, list) and len(ds_results) == len(HEADLINES):
        predictions = [r.get("label", "unknown") for r in ds_results]
    else:
        print(f"ERROR: Expected {len(HEADLINES)} results, got {len(ds_results)}")
        print("Raw results:", ds_results)
        return

    actuals = [h["expected_label"] for h in HEADLINES]

    # Per-headline table
    print(f"{'#':<4}{'Headline':<50}{'Expected':<11}{'DeepSeek':<11}{'Conf':>5}  {'OK?'}")
    print("-" * 95)

    for i, (h, pred, r) in enumerate(zip(HEADLINES, predictions, ds_results), 1):
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

    # Reasoning
    print("-" * 90)
    print("DEEPSEEK REASONING")
    print("-" * 90)
    for i, r in enumerate(ds_results, 1):
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
    print(f"  Cost:          ${cost:.6f}")
    print(f"  Latency:       {result['latency_ms']:.0f}ms")
    print()

    # Haiku comparison
    haiku_cost = (input_tok * 0.25 / 1_000_000) + (output_tok * 1.25 / 1_000_000)
    if cost > 0:
        ratio = haiku_cost / cost
        print(f"  Haiku equivalent cost: ${haiku_cost:.6f} ({ratio:.1f}x more expensive)")
    print()

    # Monthly projections
    print("Monthly cost projections:")
    print(f"  {'Scenario':<45}{'Calls/day':<12}{'DeepSeek':<14}{'Haiku'}")
    print(f"  {'-'*75}")

    scenarios = [
        ("100 tickers/day, 1hr TTL (24 calls/ticker)", 2_400),
        ("100 tickers/day, 4hr TTL (6 calls/ticker)", 600),
        ("500 tickers/day, 1hr TTL (24 calls/ticker)", 12_000),
        ("500 tickers/day, 4hr TTL (6 calls/ticker)", 3_000),
    ]

    for desc, calls_per_day in scenarios:
        ds_monthly = cost * calls_per_day * 30
        hk_monthly = haiku_cost * calls_per_day * 30
        print(f"  {desc:<45}{calls_per_day:<12}${ds_monthly:<13.2f}${hk_monthly:.2f}")


if __name__ == "__main__":
    main()
