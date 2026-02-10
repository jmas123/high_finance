"""
Refresh Screener Universe
=========================
Populates the screener_universe table with S&P 500 stocks.
Uses Wikipedia's S&P 500 list as the source.
"""

import requests
import pandas as pd
from io import StringIO
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.db.models.screener import ScreenerUniverse
from high_finance.workers.tasks.base import tracked_job


# Wikipedia URL for S&P 500 constituents
SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


def fetch_sp500_tickers() -> list[dict]:
    """
    Fetch S&P 500 constituents from Wikipedia.
    Returns list of dicts with ticker, company_name, sector, industry.
    """
    # Use requests with proper headers to avoid 403
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    response = requests.get(SP500_WIKI_URL, headers=headers)
    response.raise_for_status()

    tables = pd.read_html(StringIO(response.text))
    df = tables[0]  # First table contains current constituents

    tickers = []
    for _, row in df.iterrows():
        # Handle BRK.B -> BRK-B format (yfinance uses dash)
        ticker = str(row["Symbol"]).replace(".", "-")
        tickers.append({
            "ticker": ticker,
            "company_name": row.get("Security", ""),
            "sector": row.get("GICS Sector", ""),
            "industry": row.get("GICS Sub-Industry", ""),
        })

    return tickers


def refresh_screener_universe_logic(db: Session) -> dict:
    """
    Core logic to refresh screener universe.
    Upserts S&P 500 tickers into screener_universe table.
    """
    tickers = fetch_sp500_tickers()

    inserted = 0
    updated = 0

    for t in tickers:
        existing = db.query(ScreenerUniverse).filter(
            ScreenerUniverse.ticker == t["ticker"]
        ).first()

        if existing:
            # Update if changed
            if (existing.company_name != t["company_name"] or
                existing.sector != t["sector"] or
                existing.industry != t["industry"]):
                existing.company_name = t["company_name"]
                existing.sector = t["sector"]
                existing.industry = t["industry"]
                existing.is_active = True
                updated += 1
        else:
            # Insert new
            universe_entry = ScreenerUniverse(
                ticker=t["ticker"],
                company_name=t["company_name"],
                sector=t["sector"],
                industry=t["industry"],
                is_active=True,
            )
            db.add(universe_entry)
            inserted += 1

    # Mark tickers not in current S&P 500 as inactive
    current_tickers = {t["ticker"] for t in tickers}
    inactive_count = db.query(ScreenerUniverse).filter(
        ScreenerUniverse.ticker.notin_(current_tickers),
        ScreenerUniverse.is_active == True
    ).update({"is_active": False}, synchronize_session=False)

    db.commit()

    return {
        "status": "ok",
        "inserted": inserted,
        "updated": updated,
        "marked_inactive": inactive_count,
        "total_active": len(tickers),
    }


@tracked_job("screener_universe")
def refresh_screener_universe_job() -> dict:
    """
    RQ job wrapper - creates its own DB session.
    """
    db: Session = SessionLocal()
    try:
        result = refresh_screener_universe_logic(db)
        return result
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


if __name__ == "__main__":
    # Allow running directly for testing
    result = refresh_screener_universe_job()
    print(result)
