import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sqlalchemy.orm import Session

from high_finance.db.models.news_cache import NewsCache
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


async def _fetch_news(ticker: str, limit: int) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_fetch_yfinance_news_sync, ticker, limit)


def _get_cached(db: Session, ticker: str, ttl_seconds: int) -> Optional[Dict[str, Any]]:
    row = db.get(NewsCache, ticker)
    if not row:
        return None
    age = int(time.time()) - int(row.as_of_epoch)
    if age > ttl_seconds:
        return None
    return json.loads(row.payload_json)


def _set_cached(db: Session, ticker: str, payload: Dict[str, Any]) -> None:
    row = db.get(NewsCache, ticker)
    if row is None:
        row = NewsCache(ticker=ticker, as_of_epoch=int(time.time()), payload_json=json.dumps(payload))
        db.add(row)
    else:
        row.as_of_epoch = int(time.time())
        row.payload_json = json.dumps(payload)


async def get_news_bundle(
    db: Session, ticker: str, limit: int = 20, ttl_seconds: int = 900
) -> Dict[str, Any]:
    cached = _get_cached(db, ticker, ttl_seconds)
    if cached:
        return cached

    headlines = await _fetch_news(ticker, limit=limit)

    comps = [h["sentiment"]["compound"] for h in headlines if h.get("sentiment")]
    avg = round(sum(comps) / len(comps), 3) if comps else None

    payload = {
        "ticker": ticker,
        "avg_headline_sentiment": avg,
        "headlines": headlines,
        "filings": [],   # wire in Step 6
        "x_posts": [],   # phase 2
    }

    _set_cached(db, ticker, payload)
    db.commit()
    return payload
