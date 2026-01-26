from sqlalchemy import desc
from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade

from sqlalchemy.orm import Session, joinedload
from datetime import date, timedelta
from high_finance.workers.tasks.congress_trades_logic import refresh_congress_trades
from typing import List



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
