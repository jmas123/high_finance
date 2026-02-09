"""
Refresh Price History
=====================
Updates historical price data for companies with politician trades.
This job ensures we have price data needed for win rate calculations.
"""

import logging
from datetime import datetime
from typing import Optional

import yfinance as yf
from sqlalchemy import text
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.db.models.price import Price
from high_finance.db.models.company import Company
from high_finance.workers.tasks.base import create_job_result

logger = logging.getLogger(__name__)

# Benchmark tickers to always keep updated (needed for alpha calculations)
BENCHMARK_TICKERS = {
    "SPY": "SPDR S&P 500 ETF Trust",
}


def _ensure_benchmarks(db: Session) -> list[tuple[int, str, str]]:
    """Ensure benchmark ETFs exist as Company records. Returns list of (id, ticker, name)."""
    results = []
    for ticker, name in BENCHMARK_TICKERS.items():
        company = db.query(Company).filter(Company.ticker == ticker).first()
        if not company:
            company = Company(ticker=ticker, name=name, sector="ETF")
            db.add(company)
            db.commit()
            db.refresh(company)
            logger.info(f"Created Company record for benchmark {ticker} (id={company.id})")
        results.append((company.id, company.ticker, company.name))
    return results


def get_companies_with_trades(db: Session) -> list[tuple[int, str, str]]:
    """Get companies that have politician trades and need price data."""
    result = db.execute(
        text("""
            SELECT DISTINCT c.id, c.ticker, c.name
            FROM companies c
            JOIN politician_trades pt ON pt.company_id = c.id
            WHERE c.ticker IS NOT NULL
            ORDER BY c.ticker
        """)
    ).fetchall()
    return result


def fetch_and_save_prices(
    db: Session,
    company_id: int,
    ticker: str,
    period: str = "2y",
) -> tuple[int, bool]:
    """
    Fetch prices from yfinance and save to database.

    Returns:
        Tuple of (count of new prices, success bool)
    """
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period, interval="1d")

        if hist.empty:
            logger.warning(f"No price data returned for {ticker}")
            return 0, False

        count = 0
        for date, row in hist.iterrows():
            # Skip invalid data (NaN check)
            if any(v != v for v in [row["Open"], row["High"], row["Low"], row["Close"]]):
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
        return count, True

    except Exception as e:
        logger.warning(f"Failed to fetch prices for {ticker}: {e}")
        db.rollback()
        return 0, False


def refresh_prices_logic(
    db: Session,
    tickers: Optional[list[str]] = None,
    period: str = "2y",
) -> dict:
    """
    Core logic to refresh price history.

    Args:
        db: Database session
        tickers: Optional list of specific tickers. If None, refreshes all
                 companies with politician trades.
        period: yfinance period string (default "2y" for 2 years)

    Returns:
        Result dict with status and counts.
    """
    if tickers:
        # Fetch specific tickers
        companies = db.query(Company).filter(
            Company.ticker.in_(tickers)
        ).all()
        companies = [(c.id, c.ticker, c.name) for c in companies]
    else:
        # Get all companies with politician trades + benchmarks
        benchmarks = _ensure_benchmarks(db)
        companies = get_companies_with_trades(db)
        # Merge benchmarks (avoid duplicates if SPY happens to have trades)
        existing_ids = {c[0] for c in companies}
        for b in benchmarks:
            if b[0] not in existing_ids:
                companies.append(b)

    total = len(companies)
    updated = 0
    failed: list[str] = []
    total_prices = 0

    logger.info(f"Starting price refresh for {total} companies")

    for company_id, ticker, name in companies:
        count, success = fetch_and_save_prices(db, company_id, ticker, period)
        if success:
            updated += 1
            total_prices += count
            if count > 0:
                logger.debug(f"Fetched {count} new prices for {ticker}")
        else:
            failed.append(ticker)

    logger.info(f"Price refresh completed: {updated}/{total} companies, {total_prices} new prices")

    return create_job_result(
        status="ok" if not failed else "error",
        updated=updated,
        total=total,
        failed=failed,
        new_prices=total_prices,
    )


def refresh_prices_job(
    tickers: Optional[list[str]] = None,
    period: str = "2y",
) -> dict:
    """
    RQ job wrapper - creates its own DB session.

    Args:
        tickers: Optional list of specific tickers to refresh.
        period: yfinance period string.
    """
    db: Session = SessionLocal()
    try:
        result = refresh_prices_logic(db, tickers=tickers, period=period)
        return result
    except Exception as e:
        db.rollback()
        logger.exception(f"Price refresh job failed: {e}")
        return create_job_result(status="error", error_message=str(e))
    finally:
        db.close()


if __name__ == "__main__":
    # Allow running directly for testing
    import sys

    if len(sys.argv) > 1:
        # Refresh specific tickers
        result = refresh_prices_job(tickers=sys.argv[1:])
    else:
        # Refresh all
        result = refresh_prices_job()

    print(result)
