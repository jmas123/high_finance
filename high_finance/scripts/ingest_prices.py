#!/usr/bin/env python3
"""
Ingest historical price data for companies with politician trades.
This populates the prices table needed for win rate calculations.

Usage:
    source .venv/bin/activate
    DATABASE_URL="postgresql://user:pass@localhost:5432/high_finance" python scripts/ingest_prices.py
"""

import os
import sys
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import yfinance as yf
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from high_finance.db.models.price import Price
from high_finance.db.models.company import Company


def get_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required.")
        print("Example: DATABASE_URL='postgresql://user:pass@localhost:5432/high_finance' python scripts/ingest_prices.py")
        sys.exit(1)
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    return Session()


BENCHMARK_TICKERS = {
    "SPY": "SPDR S&P 500 ETF Trust",
}


def ensure_benchmarks(db, period="5y"):
    """Ensure benchmark ETFs exist as Company records and have price data."""
    for ticker, name in BENCHMARK_TICKERS.items():
        company = db.query(Company).filter(Company.ticker == ticker).first()
        if not company:
            company = Company(ticker=ticker, name=name, sector="ETF")
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"  Created Company record for {ticker} (id={company.id})")
        else:
            print(f"  {ticker} already exists (id={company.id})")
        fetch_and_save_prices(db, company.id, ticker, period=period)


def get_companies_with_trades(db):
    """Get companies that have politician trades and need price data."""
    result = db.execute(text("""
        SELECT DISTINCT c.id, c.ticker, c.name
        FROM companies c
        JOIN politician_trades pt ON pt.company_id = c.id
        WHERE c.ticker IS NOT NULL
        ORDER BY c.ticker
    """)).fetchall()
    return result


def fetch_and_save_prices(db, company_id: int, ticker: str, period: str = "5y"):
    """Fetch prices from yfinance and save to database."""
    try:
        print(f"  Fetching {ticker}...", end=" ", flush=True)

        stock = yf.Ticker(ticker)
        hist = stock.history(period=period, interval="1d")

        if hist.empty:
            print("no data")
            return 0

        count = 0
        for date, row in hist.iterrows():
            # Skip invalid data
            if any(v != v for v in [row["Open"], row["High"], row["Low"], row["Close"]]):  # NaN check
                continue

            date_str = date.strftime("%Y-%m-%d")

            # Check if price already exists
            existing = db.query(Price).filter(
                Price.company_id == company_id,
                Price.date == date_str
            ).first()

            if existing:
                continue

            price = Price(
                company_id=company_id,
                symbol=ticker,
                date=date_str,
                open_price=round(float(row["Open"]), 2),
                high_price=round(float(row["High"]), 2),
                low_price=round(float(row["Low"]), 2),
                close_price=round(float(row["Close"]), 2),
                volume=int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            )
            db.add(price)
            count += 1

        db.commit()
        print(f"{count} new prices")
        return count

    except Exception as e:
        print(f"error: {e}")
        db.rollback()
        return 0


def main():
    print("=" * 50)
    print("Price Data Ingestion")
    print("=" * 50)

    db = get_db()

    # Ensure benchmarks (SPY) exist and have prices
    print("\n-- Benchmarks --")
    ensure_benchmarks(db)

    # Get companies with politician trades
    companies = get_companies_with_trades(db)
    print(f"\nFound {len(companies)} companies with politician trades\n")

    if not companies:
        print("No companies to process.")
        return

    total_prices = 0
    for company_id, ticker, name in companies:
        total_prices += fetch_and_save_prices(db, company_id, ticker)

    print(f"\n{'=' * 50}")
    print(f"Done! Ingested {total_prices} total price records")

    # Verify
    count = db.execute(text("SELECT COUNT(*) FROM prices")).fetchone()[0]
    print(f"Total prices in database: {count}")

    db.close()


if __name__ == "__main__":
    main()
