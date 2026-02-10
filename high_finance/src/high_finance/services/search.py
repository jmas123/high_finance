import logging
from typing import List, Dict, Any

import httpx

logger = logging.getLogger(__name__)

_client = httpx.AsyncClient(
    timeout=5.0,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    limits=httpx.Limits(max_connections=10),
)

_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"


async def search_tickers(query: str) -> List[Dict[str, Any]]:
    """Search for tickers by company name or symbol."""
    if not query or len(query) > 100:
        return []

    params = {
        "q": query,
        "quotesCount": 8,
        "newsCount": 0,
        "enableFuzzyQuery": True,
        "quotesQueryId": "tss_match_phrase_query",
    }

    try:
        response = await _client.get(_SEARCH_URL, params=params)
        data = response.json()

        quotes = data.get("quotes", [])
        results = []

        for quote in quotes:
            # Only include stocks and ETFs
            quote_type = quote.get("quoteType", "")
            if quote_type not in ["EQUITY", "ETF"]:
                continue

            results.append({
                "symbol": quote.get("symbol"),
                "name": quote.get("shortname") or quote.get("longname", ""),
                "exchange": quote.get("exchange", ""),
                "type": quote_type,
            })

        return results
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning("Search upstream error for q=%s: %s", query, e)
        raise
    except Exception as e:
        logger.warning("Search unexpected error for q=%s: %s", query, e)
        return []
