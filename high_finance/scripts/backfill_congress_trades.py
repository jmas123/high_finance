#!/usr/bin/env python3
"""
Bulk backfill Congress trades from Quiver's /bulk/congresstrading endpoint.

Fetches ~109K records (408 unique politicians) and upserts into DB using the
same logic as the live ingestion pipeline. Idempotent — duplicates are skipped
via composite key check.

Usage:
    source .venv/bin/activate
    DATABASE_URL="postgresql://..." QUIVER_API_KEY="..." python scripts/backfill_congress_trades.py
"""

import os
import sys
import time
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.workers.tasks.congress_trades_logic import (
    _amount_range,
    _ensure_politician,
    _parse_date,
    _resolve_company_id,
)

QUIVER_BASE = "https://api.quiverquant.com/beta"
BATCH_SIZE = 1000
PROGRESS_INTERVAL = 5000


def get_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required.")
        print("Usage: DATABASE_URL='postgresql://...' QUIVER_API_KEY='...' python scripts/backfill_congress_trades.py")
        sys.exit(1)
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    return Session()


def fetch_bulk_trades() -> list[dict]:
    """Fetch all records from the /bulk/congresstrading endpoint."""
    key = os.getenv("QUIVER_API_KEY")
    if not key:
        print("ERROR: QUIVER_API_KEY environment variable is required.")
        sys.exit(1)

    url = f"{QUIVER_BASE}/bulk/congresstrading"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Token {key}",
    }

    print(f"Fetching bulk congress trades from {url} ...")
    start = time.time()
    r = httpx.get(url, headers=headers, timeout=120.0)
    r.raise_for_status()
    data = r.json()
    elapsed = time.time() - start

    if not isinstance(data, list):
        print(f"ERROR: Unexpected response type: {type(data)}")
        sys.exit(1)

    print(f"Fetched {len(data):,} records in {elapsed:.1f}s")
    return data


def normalize_bulk_row(row: dict) -> dict:
    """Map bulk endpoint fields to the format existing helpers expect."""
    # Chamber: "Representatives" -> "House"
    chamber = row.get("Chamber") or ""
    if "representative" in chamber.lower():
        chamber = "House"
    elif "senate" in chamber.lower():
        chamber = "Senate"

    # District: " NJ01" -> "NJ01" (strip leading whitespace)
    district = (row.get("District") or "").strip()

    return {
        **row,
        "Chamber": chamber,
        "District": district,
    }


def main():
    db = get_db()

    # Pre-counts
    pol_before = db.query(Politician).count()
    trade_before = db.query(PoliticianTrade).count()
    print(f"Before: {pol_before} politicians, {trade_before:,} trades")

    rows = fetch_bulk_trades()

    inserted = 0
    skipped = 0
    errors = 0

    for i, raw_row in enumerate(rows, 1):
        try:
            row = normalize_bulk_row(raw_row)

            pol = _ensure_politician(db, row)

            ticker = (row.get("Ticker") or row.get("Symbol") or "").strip() or None
            issuer = (row.get("Issuer") or row.get("Asset") or row.get("Company") or "").strip() or None

            txn_type = row.get("Transaction") or row.get("TransactionType") or row.get("Type")
            txn_date = _parse_date(row.get("TransactionDate") or row.get("Traded") or row.get("transaction_date"))
            disc_date = _parse_date(row.get("ReportDate") or row.get("DisclosureDate") or row.get("Reported") or row.get("Filed") or row.get("disclosure_date"))

            amount_min, amount_max = _amount_range(row)
            source_url = row.get("Source") or row.get("URL") or row.get("source_url")

            company_id = _resolve_company_id(db, ticker, issuer)

            # Dedupe: same composite key as live ingestion
            exists = (
                db.query(PoliticianTrade)
                .filter(
                    PoliticianTrade.politician_id == pol.id,
                    PoliticianTrade.ticker_raw == (ticker.upper() if ticker else None),
                    PoliticianTrade.issuer_raw == issuer,
                    PoliticianTrade.transaction_type == txn_type,
                    PoliticianTrade.transaction_date == txn_date,
                    PoliticianTrade.disclosure_date == disc_date,
                    PoliticianTrade.amount_min == amount_min,
                    PoliticianTrade.amount_max == amount_max,
                )
                .first()
            )
            if exists:
                skipped += 1
                continue

            trade = PoliticianTrade(
                politician_id=pol.id,
                company_id=company_id,
                issuer_raw=issuer,
                ticker_raw=ticker.upper() if ticker else None,
                transaction_type=txn_type,
                transaction_date=txn_date,
                disclosure_date=disc_date or txn_date or datetime.utcnow().date(),
                amount_min=amount_min,
                amount_max=amount_max,
                source_url=source_url,
            )
            db.add(trade)
            inserted += 1

            # Batch commit
            if inserted % BATCH_SIZE == 0:
                db.commit()

        except Exception as e:
            errors += 1
            name = raw_row.get("Name") or raw_row.get("Representative") or "?"
            ticker = raw_row.get("Ticker") or "?"
            print(f"  ERROR row {i} ({name}/{ticker}): {e}")
            db.rollback()

        # Progress
        if i % PROGRESS_INTERVAL == 0:
            print(f"  Progress: {i:,}/{len(rows):,} rows | +{inserted:,} inserted, {skipped:,} skipped, {errors} errors")

    # Final commit
    db.commit()

    # Post-counts
    pol_after = db.query(Politician).count()
    trade_after = db.query(PoliticianTrade).count()

    print(f"\n{'='*60}")
    print(f"Backfill complete!")
    print(f"  Politicians: {pol_before} -> {pol_after} (+{pol_after - pol_before} new)")
    print(f"  Trades:      {trade_before:,} -> {trade_after:,} (+{trade_after - trade_before:,} new)")
    print(f"  Skipped (dedup): {skipped:,}")
    print(f"  Errors: {errors}")
    print(f"{'='*60}")

    db.close()


if __name__ == "__main__":
    main()
