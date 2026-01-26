import yfinance as yf
from sqlalchemy.orm import Session
from typing import List, Dict, Any

async def get_leadership_data(ticker: str, db: Session) -> List[Dict[str, Any]]:
    """
    Retrieve leadership data for a given company ticker.
    """
    stock = yf.Ticker(ticker)
    
    officers = stock.info.get('companyOfficers', [])
    
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