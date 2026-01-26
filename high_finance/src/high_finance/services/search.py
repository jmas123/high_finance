import httpx
from typing import List, Dict, Any

async def search_tickers(query: str) -> List[Dict[str, Any]]:
    """Search for tickers by company name or symbol."""
    if not query or len(query) < 1:
        return []
    
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {
        "q": query,
        "quotesCount": 8,
        "newsCount": 0,
        "enableFuzzyQuery": True,
        "quotesQueryId": "tss_match_phrase_query",
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers, timeout=5.0)
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
    except Exception as e:
        print(f"Search error: {e}")
        return []