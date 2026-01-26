from typing import List, Dict, Any
import httpx

class PriceProvider:
    BASE_URL = "https://api.example.com/prices"  # Replace with actual price data provider API

    @classmethod
    async def get_price_history(cls, symbol: str) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{cls.BASE_URL}/{symbol}/history")
            response.raise_for_status()
            return response.json()

    @classmethod
    async def get_current_price(cls, symbol: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{cls.BASE_URL}/{symbol}/current")
            response.raise_for_status()
            return response.json()