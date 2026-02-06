from sqlalchemy import desc, or_
from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
import os
import requests
import logging
from sqlalchemy.orm import Session, joinedload
from datetime import date, timedelta, datetime
from high_finance.workers.tasks.congress_trades_logic import refresh_congress_trades, _resolve_company_id
from typing import List


logger = logging.getLogger(__name__)


def _backfill_company_ids(db: Session, trades, company_id: int) -> None:
    """Opportunistically set company_id on trades that matched by ticker_raw only."""
    updated = False
    for t in trades:
        if t.company_id is None:
            t.company_id = company_id
            updated = True
    if updated:
        db.commit()


def get_company_politician_trades(db: Session, ticker: str, limit: int = 50):
    ticker_upper = ticker.upper()
    company = db.query(Company).filter(Company.ticker == ticker_upper).first()

    # Match by ticker_raw OR company_id so we catch orphaned trades (company_id=NULL)
    filters = [PoliticianTrade.ticker_raw == ticker_upper]
    if company:
        filters.append(PoliticianTrade.company_id == company.id)

    trades = (
        db.query(PoliticianTrade)
        .options(joinedload(PoliticianTrade.politician))
        .filter(or_(*filters))
        .order_by(desc(PoliticianTrade.disclosure_date))
        .limit(limit)
        .all()
    )

    # Heal orphaned trades: set company_id where it was NULL
    if company and trades:
        _backfill_company_ids(db, trades, company.id)

    # Deduplicate: same politician, ticker, transaction_date, disclosure_date, type
    # Existing DB rows may have dupes from the old broken sync path
    seen = set()
    unique_trades = []
    for t in trades:
        key = (t.politician_id, t.ticker_raw, t.transaction_date, t.disclosure_date, t.transaction_type)
        if key not in seen:
            seen.add(key)
            unique_trades.append(t)

    return unique_trades


def ensure_company_trades_fresh(db: Session, ticker: str, max_age_days: int = 1) -> None:
    ticker_upper = ticker.upper()
    company = db.query(Company).filter(Company.ticker == ticker_upper).first()

    # Check freshness against trades matched by ticker_raw too, not just company_id
    filters = [PoliticianTrade.ticker_raw == ticker_upper]
    if company:
        filters.append(PoliticianTrade.company_id == company.id)

    latest = (
        db.query(PoliticianTrade)
        .filter(or_(*filters))
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
        raw_ticker = item.get("Ticker")
        ticker_norm = raw_ticker.upper() if raw_ticker else None
        exists = db.query(PoliticianTrade).filter(
            PoliticianTrade.politician_id == politician.id,
            PoliticianTrade.ticker_raw == ticker_norm,
            PoliticianTrade.transaction_date == t_date,
            PoliticianTrade.disclosure_date == d_date,
            PoliticianTrade.transaction_type == item.get("Transaction"),
        ).first()

        if exists:
            continue

        # 5. Create Trade
        company_id = _resolve_company_id(db, ticker_norm, ticker_norm)

        trade = PoliticianTrade(
            politician_id=politician.id,
            company_id=company_id,
            ticker_raw=ticker_norm,
            issuer_raw=ticker_norm,
            transaction_type=item.get("Transaction"),
            transaction_date=t_date,
            disclosure_date=d_date,
            amount_min=item.get("Amount"),
            amount_max=item.get("Amount"),
        )
        db.add(trade)
        new_count += 1

    db.commit()
    logger.info(f"🎉 Saved {new_count} new trades to the database.")
    return new_count