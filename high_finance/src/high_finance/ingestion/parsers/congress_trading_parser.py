from typing import List, Dict, Optional, Any
import os
import requests

class CongressTradesParser:
    def __init__(self, provider: str = "quiver"):
        self.provider = provider.lower()
        self.api_key = os.getenv("QUIVER_API_KEY", "")

    def fetch_trades(self, symbol: Optional[str] = None, limit: int = 200) -> List[Dict]:
        if self.provider == "quiver":
            return self._fetch_quiver(symbol=symbol, limit=limit)
        raise ValueError(f"Unsupported provider: {self.provider}")

    def _fetch_quiver(self, symbol: Optional[str], limit: int) -> List[Dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("QUIVER_API_KEY is not set")

        # ✅ endpoints that you confirmed work
        if symbol:
            url = f"https://api.quiverquant.com/beta/historical/congresstrading/{symbol.upper()}"
        else:
            url = "https://api.quiverquant.com/beta/live/congresstrading"

        headers = {
            "Accept": "application/json",
            "Authorization": f"Token {self.api_key}",  # ✅ confirmed working
        }

        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()

        return data[:limit] if isinstance(data, list) else []
