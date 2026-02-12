import asyncio
import logging
from typing import Any, Dict, List

import httpx
import yfinance as yf
from fastapi import HTTPException

logger = logging.getLogger(__name__)

SEC_EDGAR_BASE_URL = "https://www.sec.gov/edgar"

async def fetch_company_filings(cik: str) -> Dict[str, Any]:
    url = f"{SEC_EDGAR_BASE_URL}/cgi-bin/browse-edgar?action=getcompany&cik={cik}&output=atom"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error fetching data from SEC EDGAR")
        return response.json()

def parse_filings_data(data: Dict[str, Any]) -> Any:
    # Implement parsing logic here
    pass

async def get_company_filings(cik: str) -> Any:
    data = await fetch_company_filings(cik)
    return parse_filings_data(data)


def _get_ownership_data_sync(ticker: str) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    holders = stock.institutional_holders

    if holders is None or holders.empty:
        return []

    # Get shares outstanding to calculate percentage
    shares_outstanding = stock.info.get("sharesOutstanding", None)

    result = []
    for _, row in holders.iterrows():
        shares = int(row.get("Shares", 0)) if row.get("Shares") else 0

        # Calculate percent if we have shares outstanding
        percent_out = None
        if shares_outstanding and shares:
            percent_out = shares / shares_outstanding

        result.append({
            "holder": row.get("Holder"),
            "shares": shares,
            "date_reported": str(row.get("Date Reported", "")),
            "percent_out": percent_out,
            "value": int(row.get("Value", 0)) if row.get("Value") else None,
        })

    return result


async def get_ownership_data(ticker: str, db) -> List[Dict[str, Any]]:
    """Get institutional ownership data for a ticker."""
    return await asyncio.wait_for(
        asyncio.to_thread(_get_ownership_data_sync, ticker),
        timeout=15,
    )
