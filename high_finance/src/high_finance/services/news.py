import asyncio
import json
import time
from typing import Any, Dict, List, Optional

import feedparser
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sqlalchemy.orm import Session
from fastapi import Depends

from high_finance.db.session import get_db
from high_finance.db.models.news_cache import NewsCache
from high_finance.core.cache import get_or_compute, news_ttl

_analyzer = SentimentIntensityAnalyzer()

def _headline_sentiment(text: str) -> Dict[str, float]:
    s = _analyzer.polarity_scores(text or "")
    return {"compound": s["compound"], "pos": s["pos"], "neu": s["neu"], "neg": s["neg"]}

def _rss_url(ticker: str) -> str:
    q = f"{ticker}%20(stock%20OR%20earnings%20OR%20guidance%20OR%20contract%20OR%20SEC%20OR%208-K%20OR%2010-Q)"
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

def _fetch_google_news_sync(ticker: str, limit: int) -> List[Dict[str, Any]]:
    """Blocking feedparser call — runs in thread pool."""
    feed = feedparser.parse(_rss_url(ticker))
    out: List[Dict[str, Any]] = []
    for e in (feed.entries or [])[:limit]:
        title = getattr(e, "title", "") or ""
        out.append({
            "title": title,
            "url": getattr(e, "link", None),
            "published": getattr(e, "published", None),
            "source": getattr(getattr(e, "source", None), "title", None),
            "sentiment": _headline_sentiment(title),
        })
    return out

async def _fetch_google_news(ticker: str, limit: int) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_fetch_google_news_sync, ticker, limit)

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

    headlines = await _fetch_google_news(ticker, limit=limit)

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
