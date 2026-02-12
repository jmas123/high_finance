import asyncio
import logging
from typing import Any, Dict, List

import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from high_finance.core.cache import get_or_compute, news_ttl

logger = logging.getLogger(__name__)

_analyzer = SentimentIntensityAnalyzer()


def _headline_sentiment(text: str) -> Dict[str, float]:
    s = _analyzer.polarity_scores(text or "")
    return {"compound": s["compound"], "pos": s["pos"], "neu": s["neu"], "neg": s["neg"]}


def _fetch_yfinance_news_sync(ticker: str, limit: int) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool."""
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


async def get_news_bundle(ticker: str, limit: int = 20) -> Dict[str, Any]:
    """Get news bundle with sentiment, cached via Redis SETNX lock."""
    cache_key = f"hf:news:{ticker}"

    async def _compute():
        headlines = await asyncio.wait_for(
            asyncio.to_thread(_fetch_yfinance_news_sync, ticker, limit),
            timeout=15,
        )
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
