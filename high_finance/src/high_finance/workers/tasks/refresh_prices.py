"""
Refresh Price History
=====================
Updates historical price data for companies with politician trades.
This job ensures we have price data needed for win rate calculations.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import yfinance as yf
from sqlalchemy import text
from sqlalchemy.orm import Session

# Stock tickers: 1-5 uppercase letters, optionally with a dot or dash (BRK-B, BF.A)
# Excludes CUSIPs (9-char alphanumeric like 91282CEG2), fund codes, and other non-equity IDs
_TICKER_RE = re.compile(r"^[A-Z]{1,5}([.\-][A-Z]{1,2})?$")

from high_finance.db.session import SessionLocal
from high_finance.db.models.price import Price
from high_finance.db.models.company import Company
from high_finance.workers.tasks.base import create_job_result, tracked_job

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
    """Get companies that have politician trades and need price data.

    Two sources:
    1. Companies already linked via company_id (existing matches)
    2. Unmatched ticker_raw values — creates Company records for these so
       prices can be fetched (most bulk-backfilled trades have company_id=NULL)
    """
    # 1. Already-linked companies
    linked = db.execute(
        text("""
            SELECT DISTINCT c.id, c.ticker, c.name
            FROM companies c
            JOIN politician_trades pt ON pt.company_id = c.id
            WHERE c.ticker IS NOT NULL
            ORDER BY c.ticker
        """)
    ).fetchall()

    existing_tickers = {row[1] for row in linked}
    result = list(linked)

    # 2. Unmatched tickers — create Company stubs so we can attach prices
    unmatched = db.execute(
        text("""
            SELECT DISTINCT pt.ticker_raw
            FROM politician_trades pt
            WHERE pt.ticker_raw IS NOT NULL
              AND pt.company_id IS NULL
              AND pt.ticker_raw NOT IN (SELECT ticker FROM companies WHERE ticker IS NOT NULL)
        """)
    ).fetchall()

    created_count = 0
    for (ticker_raw,) in unmatched:
        ticker = ticker_raw.strip().upper()
        if not ticker or ticker in existing_tickers:
            continue

        # Skip CUSIPs, fund codes, and other non-equity identifiers
        if not _TICKER_RE.match(ticker):
            continue

        # Create a stub Company record
        company = Company(ticker=ticker, name=ticker)
        db.add(company)
        db.flush()
        result.append((company.id, company.ticker, company.name))
        existing_tickers.add(ticker)
        created_count += 1

        # Link existing trades to this new company
        db.execute(
            text("UPDATE politician_trades SET company_id = :cid WHERE ticker_raw = :t AND company_id IS NULL"),
            {"cid": company.id, "t": ticker_raw},
        )

    if created_count:
        db.commit()
        logger.info(f"Created {created_count} Company stubs for unmatched trade tickers (skipped {len(unmatched) - created_count} non-equity IDs)")

    return result


def _enrich_company(db: Session, company_id: int, stock: yf.Ticker) -> None:
    """Backfill sector/industry/name on Company stubs using yfinance info."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company or (company.sector and company.industry):
        return  # already has data

    try:
        info = stock.info or {}
        sector = info.get("sector")
        industry = info.get("industry")
        sic = info.get("sic")
        long_name = info.get("longName") or info.get("shortName")

        changed = False
        if sector and not company.sector:
            company.sector = sector
            changed = True
        if industry and not company.industry:
            company.industry = industry
            changed = True
        if sic and not company.sic_code:
            company.sic_code = str(sic)[:4]
            changed = True
        if long_name and company.name == company.ticker:
            company.name = long_name
            changed = True

        if changed:
            db.commit()
            logger.debug(f"Enriched {company.ticker}: sector={company.sector}, industry={company.industry}")
    except Exception as e:
        logger.debug(f"Could not enrich {company.ticker}: {e}")
        db.rollback()


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

        # Backfill sector/industry on stub companies (needed for relevance scoring)
        _enrich_company(db, company_id, stock)

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


@tracked_job("price_history")
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
