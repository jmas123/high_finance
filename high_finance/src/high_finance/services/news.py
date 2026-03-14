import asyncio
import json
import logging
import re
from typing import Any, Dict, List

import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from high_finance.core.cache import get_or_compute, news_ttl
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL

logger = logging.getLogger(__name__)

_analyzer = SentimentIntensityAnalyzer()


# ── VADER (fallback) ─────────────────────────────────────────────────────────


def _headline_sentiment(text: str) -> Dict[str, Any]:
    """VADER sentiment — used as fallback when Haiku is unavailable."""
    s = _analyzer.polarity_scores(text or "")
    return {
        "compound": s["compound"],
        "pos": s["pos"],
        "neu": s["neu"],
        "neg": s["neg"],
        "source": "vader",
    }


# ── Haiku batch sentiment ────────────────────────────────────────────────────


_SENTIMENT_SYSTEM = (
    "You are a financial sentiment classifier. For each headline, determine whether "
    "the sentiment is positive, negative, or neutral FROM AN INVESTOR'S PERSPECTIVE. "
    "Consider: does this headline suggest the stock should go up (positive), "
    "down (negative), or is it purely informational (neutral)? "
    'Return ONLY a JSON array: [{"index": 1, "label": "positive"|"negative"|"neutral"}]'
)

# Map Haiku labels to compound-like scores so avg_headline_sentiment stays comparable
_LABEL_TO_COMPOUND = {"positive": 0.5, "negative": -0.5, "neutral": 0.0}


def _extract_json_array(raw_text: str) -> str:
    """Extract JSON array from LLM output (mirrors earnings_analysis.py pattern)."""
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", raw_text, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()
    start = raw_text.find("[")
    if start != -1:
        end = raw_text.rfind("]")
        if end != -1 and end > start:
            return raw_text[start : end + 1].strip()
    return raw_text.strip()


async def _haiku_batch_sentiment(headlines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Re-score headlines via a single batched Haiku call.

    Returns the same headline dicts with sentiment replaced by Haiku labels.
    Raises on any failure so caller can fall back to VADER.
    """
    if not headlines:
        return headlines

    client = get_anthropic_client()
    numbered = "\n".join(f"{i}. {h['title']}" for i, h in enumerate(headlines, 1))

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=1000,
        temperature=0.0,
        system=_SENTIMENT_SYSTEM,
        messages=[{"role": "user", "content": numbered}],
    )

    raw_text = response.content[0].text
    cleaned = _extract_json_array(raw_text)
    results = json.loads(cleaned)

    if len(results) != len(headlines):
        raise ValueError(
            f"Haiku returned {len(results)} results for {len(headlines)} headlines"
        )

    for h, r in zip(headlines, results):
        label = r.get("label", "neutral")
        h["sentiment"] = {
            "compound": _LABEL_TO_COMPOUND.get(label, 0.0),
            "label": label,
            "source": "haiku",
        }

    return headlines


# ── Data fetching (sync, runs in thread pool) ────────────────────────────────


def _fetch_yfinance_news_sync(ticker: str, limit: int) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool.

    Headlines come back with VADER sentiment pre-computed so the fallback
    path is zero-cost if Haiku fails.
    """
    stock = yf.Ticker(ticker)
    raw = stock.news or []

    out: List[Dict[str, Any]] = []
    for item in raw[:limit]:
        # yfinance now nests everything under "content"
        content = item.get("content", item)

        title = content.get("title", "") or ""
        published = content.get("pubDate")  # ISO string e.g. "2026-02-03T15:59:34Z"

        # Provider is nested: {"displayName": "Reuters", "url": "..."}
        provider = content.get("provider", {})
        source = provider.get("displayName") if isinstance(provider, dict) else None

        # URL: prefer canonicalUrl, fall back to clickThroughUrl
        url = None
        for url_key in ("canonicalUrl", "clickThroughUrl"):
            url_obj = content.get(url_key, {})
            if isinstance(url_obj, dict) and url_obj.get("url"):
                url = url_obj["url"]
                break

        out.append({
            "title": title,
            "url": url,
            "published": published,
            "source": source,
            "sentiment": _headline_sentiment(title),
        })
    return out


# ── Public API ────────────────────────────────────────────────────────────────


async def get_news_bundle(ticker: str, limit: int = 20) -> Dict[str, Any]:
    """Get news bundle with sentiment, cached via Redis SETNX lock."""
    cache_key = f"hf:news:{ticker}"

    async def _compute():
        # Step 1: fetch headlines with VADER pre-scored (sync, thread pool)
        headlines = await asyncio.wait_for(
            asyncio.to_thread(_fetch_yfinance_news_sync, ticker, limit),
            timeout=15,
        )

        # Step 2: try Haiku batch re-scoring (async, 5s timeout)
        try:
            headlines = await asyncio.wait_for(
                _haiku_batch_sentiment(headlines), timeout=5,
            )
        except Exception as exc:
            logger.warning("Haiku sentiment failed for %s, using VADER: %s", ticker, exc)
            # headlines already have VADER sentiment from step 1

        comps = [h["sentiment"]["compound"] for h in headlines if h.get("sentiment")]
        avg = round(sum(comps) / len(comps), 3) if comps else None
        return {
            "ticker": ticker,
            "avg_headline_sentiment": avg,
            "headlines": headlines,
            "filings": [],
            "x_posts": [],
        }

    return await get_or_compute(cache_key, news_ttl(), _compute)
