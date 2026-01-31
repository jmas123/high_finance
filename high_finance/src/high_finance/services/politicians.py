from sqlalchemy import desc
from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
import os
import requests
import logging
from sqlalchemy.orm import Session, joinedload
from datetime import date, timedelta, datetime
from high_finance.workers.tasks.congress_trades_logic import refresh_congress_trades
from typing import List


logger = logging.getLogger(__name__)


def get_company_politician_trades(db: Session, ticker: str, limit: int = 50):
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if not company:
        return []

    return (
        db.query(PoliticianTrade)
        .options(joinedload(PoliticianTrade.politician))  # 👈 load politician row
        .filter(PoliticianTrade.company_id == company.id)
        .order_by(desc(PoliticianTrade.disclosure_date))
        .limit(limit)
        .all()
    )



def ensure_company_trades_fresh(db: Session, ticker: str, max_age_days: int = 1) -> None:
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if not company:
        return

    latest = (
        db.query(PoliticianTrade)
        .filter(PoliticianTrade.company_id == company.id)
        .order_by(desc(PoliticianTrade.disclosure_date))
        .first()
    )

    # if none exist or stale, refresh this ticker from Quiver
    if not latest or (latest.disclosure_date and latest.disclosure_date < (date.today() - timedelta(days=max_age_days))):
        refresh_congress_trades(db=db, symbol=ticker, limit=500)



def get_politician_trades(
    db: Session,
    politician_id: int,
    limit: int = 100,
) -> List[PoliticianTrade]:
    return (
        db.query(PoliticianTrade)
        .filter(PoliticianTrade.politician_id == politician_id)
        .order_by(desc(PoliticianTrade.disclosure_date))
        .limit(limit)
        .all()
    )

def search_politicians(db: Session, q: str, limit: int = 20) -> List[Politician]:
    if not q:
        return []
    return (
        db.query(Politician)
        .filter(Politician.name.ilike(f"%{q}%"))
        .limit(limit)
        .all()
    )

def get_significant_congress_trades(
    db: Session,
    min_amount: float = 50_000,
    days: int = 7,
    limit: int = 100,
):
    cutoff = date.today() - timedelta(days=days)

    return (
        db.query(PoliticianTrade)
        .options(joinedload(PoliticianTrade.politician))
        .filter(PoliticianTrade.disclosure_date >= cutoff)
        .filter(PoliticianTrade.amount_max != None)  # noqa: E711
        .filter(PoliticianTrade.amount_max >= min_amount)
        .order_by(desc(PoliticianTrade.disclosure_date), desc(PoliticianTrade.id))
        .limit(limit)
        .all()
    )


def sync_congress_trades(db: Session, limit: int = 200):
    """
    Fetches the latest trades from Quiver API and saves them to the database.
    Returns the number of new trades added.
    """
    url = "https://api.quiverquant.com/beta/live/congresstrading"
    key = os.getenv("QUIVER_API_KEY")

    if not key or "REMOVED" in key:
        logger.error("❌ API Key is missing or invalid.")
        return 0

    headers = {
        "Authorization": f"Token {key}",
        "Accept": "application/json"
    }

    logger.info("📡 Fetching trades from Quiver API (Timeout=60s)...")
    
    try:
        response = requests.get(url, headers=headers, timeout=60)
        if response.status_code != 200:
            logger.error(f"❌ API Error {response.status_code}: {response.text}")
            return 0
        
        data = response.json()
        logger.info(f"✅ API returned {len(data)} raw trades.")
    except Exception as e:
        logger.error(f"❌ Network/API failed: {e}")
        return 0

    new_count = 0
    
    # Process the data
    for item in data:
        # 1. Get the Name
        name = item.get("Representative") or item.get("Senator")
        if not name:
            continue

        # 2. Find or Create Politician
        politician = db.query(Politician).filter(Politician.name == name).first()
        if not politician:
            # Create a shell record (bio script will fill details later)
            politician = Politician(
                name=name,
                chamber="House" if item.get("Representative") else "Senate",
                party=item.get("Party"),
                state=item.get("State")
            )
            db.add(politician)
            db.flush()  # We need the ID immediately

        # 3. Parse Dates
        try:
            # Quiver format is usually YYYY-MM-DD
            t_date = datetime.strptime(item.get("TransactionDate"), "%Y-%m-%d").date()
            d_date = datetime.strptime(item.get("DisclosureDate"), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue  # Skip if dates are garbage

        # 4. Check for Duplicates
        # A simple check: same politician, ticker, date, and amount
        exists = db.query(PoliticianTrade).filter(
            PoliticianTrade.politician_id == politician.id,
            PoliticianTrade.ticker_raw == item.get("Ticker"),
            PoliticianTrade.transaction_date == t_date,
            PoliticianTrade.amount_raw == item.get("Range")
        ).first()

        if exists:
            continue

        # 5. Create Trade
        trade = PoliticianTrade(
            politician_id=politician.id,
            ticker_raw=item.get("Ticker"),
            issuer_raw=item.get("Ticker"),
            transaction_type=item.get("Transaction"),
            transaction_date=t_date,
            disclosure_date=d_date,
            amount_raw=item.get("Range"),
            amount_min=item.get("Amount"),  # Adjust if your model expects float
            amount_max=item.get("Amount")   # Adjust if your model expects float
        )
        db.add(trade)
        new_count += 1

    db.commit()
    logger.info(f"🎉 Saved {new_count} new trades to the database.")
    return new_count