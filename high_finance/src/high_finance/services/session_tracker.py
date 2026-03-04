"""
Session Tracker — Redis-based ephemeral session context
========================================================
Tracks user browsing events (ticker views, tab switches, feature usage)
in Redis with auto-expiring keys. No DB tables required.

Used by the AI assistant to understand what the user has been looking at,
so it can give contextually relevant responses.

Data structure:
  Redis list `session:{session_id}:events` — JSON-encoded events, 30-min TTL
  Each event: {"type": "ticker_load"|"tab_view"|"feature_use", "data": {...}, "ts": epoch}
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from high_finance.core.cache import get_redis

logger = logging.getLogger(__name__)

SESSION_TTL = 1800  # 30 minutes
MAX_EVENTS = 50  # cap per session to bound memory


async def log_event(
    session_id: str,
    event_type: str,
    event_data: Dict[str, Any],
) -> None:
    """
    Log a browsing event to the session's Redis list.
    Fire-and-forget — failures are silently logged, never block the caller.
    """
    try:
        r = await get_redis()
        key = f"session:{session_id}:events"

        event = json.dumps({
            "type": event_type,
            "data": event_data,
            "ts": int(time.time()),
        })

        pipe = r.pipeline()
        pipe.rpush(key, event)
        pipe.ltrim(key, -MAX_EVENTS, -1)  # keep only last N events
        pipe.expire(key, SESSION_TTL)
        await pipe.execute()
    except Exception:
        logger.debug("Session event log failed (non-critical)", exc_info=True)


async def get_session_context(session_id: str) -> Optional[str]:
    """
    Read the session's event list and return a human-readable summary
    for injection into the assistant's system prompt.

    Returns None if no events exist (new session or expired).
    """
    try:
        r = await get_redis()
        key = f"session:{session_id}:events"
        raw_events = await r.lrange(key, 0, -1)

        if not raw_events:
            return None

        events: List[Dict[str, Any]] = []
        for raw in raw_events:
            try:
                events.append(json.loads(raw))
            except (json.JSONDecodeError, TypeError):
                continue

        if not events:
            return None

        # Build summary
        tickers_viewed: List[str] = []
        tabs_viewed: List[str] = []
        features_used: List[str] = []

        for ev in events:
            etype = ev.get("type", "")
            data = ev.get("data", {})

            if etype == "ticker_load":
                ticker = data.get("ticker", "")
                if ticker and ticker not in tickers_viewed:
                    tickers_viewed.append(ticker)
            elif etype == "tab_view":
                tab = data.get("tab", "")
                if tab and tab not in tabs_viewed:
                    tabs_viewed.append(tab)
            elif etype == "feature_use":
                feature = data.get("feature", "")
                if feature and feature not in features_used:
                    features_used.append(feature)

        parts = []
        if tickers_viewed:
            parts.append(f"Tickers viewed this session: {', '.join(tickers_viewed)}")
        if tabs_viewed:
            parts.append(f"Tabs/sections browsed: {', '.join(tabs_viewed)}")
        if features_used:
            parts.append(f"Features used: {', '.join(features_used)}")

        return "\n".join(parts) if parts else None

    except Exception:
        logger.debug("Session context read failed (non-critical)", exc_info=True)
        return None
