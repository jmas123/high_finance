from sqlalchemy.orm import Session
from typing import List, Dict, Any

from high_finance.services.yf_cache import get_yf_info


async def get_leadership_data(ticker: str, db: Session) -> List[Dict[str, Any]]:
    """
    Retrieve leadership data for a given company ticker.

    Uses the shared yf_info cache — no direct yf.Ticker() call needed.
    Previously this called yf.Ticker(ticker) synchronously inside an async
    function, which blocked the event loop and froze all other gather tasks.
    """
    info = await get_yf_info(ticker) or {}

    officers = info.get('companyOfficers', [])

    if not officers:
        return []

    leaders = []
    for officer in officers:
        leaders.append({
            "name": officer.get("name"),
            "title": officer.get("title"),
            "age": officer.get("age"),
            "year_born": officer.get("yearBorn"),
            "total_pay": officer.get("totalPay"),
        })

    return leaders
