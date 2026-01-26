from fastapi import APIRouter
from high_finance.services.search import search_tickers

router = APIRouter()

@router.get("")
async def search(q: str = ""):
    """Search for tickers by company name or symbol."""
    results = await search_tickers(q)
    return results