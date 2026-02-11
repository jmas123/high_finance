"""
Backfill Congress Trades (RQ Job)
=================================
Bulk backfill of ~109K congressional trades from Quiver's /bulk/congresstrading endpoint.
Reuses the same dedup/upsert helpers as the live ingestion pipeline.

Idempotent — duplicates are skipped via composite key check.
"""

import logging
import os
import time
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.db.session import SessionLocal
from high_finance.workers.tasks.base import tracked_job
from high_finance.workers.tasks.congress_trades_logic import (
    _amount_range,
    _ensure_politician,
    _parse_date,
    _resolve_company_id,
)

logger = logging.getLogger(__name__)

QUIVER_BASE = "https://api.quiverquant.com/beta"
BATCH_SIZE = 1000
PROGRESS_INTERVAL = 5000


def fetch_bulk_trades() -> list[dict]:
    """Fetch all records from the /bulk/congresstrading endpoint."""
    key = os.getenv("QUIVER_API_KEY")
    if not key:
        raise RuntimeError("QUIVER_API_KEY is not set")

    url = f"{QUIVER_BASE}/bulk/congresstrading"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Token {key}",
    }

    logger.info(f"Fetching bulk congress trades from {url}")
    start = time.time()
    r = httpx.get(url, headers=headers, timeout=120.0)
    r.raise_for_status()
    data = r.json()
    elapsed = time.time() - start

    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected response type: {type(data)}")

    logger.info(f"Fetched {len(data):,} records in {elapsed:.1f}s")
    return data


def normalize_bulk_row(row: dict) -> dict:
    """Map bulk endpoint fields to the format existing helpers expect."""
    chamber = row.get("Chamber") or ""
    if "representative" in chamber.lower():
        chamber = "House"
    elif "senate" in chamber.lower():
        chamber = "Senate"

    district = (row.get("District") or "").strip()

    return {
        **row,
        "Chamber": chamber,
        "District": district,
    }


def backfill_congress_trades_logic(db: Session) -> dict:
    """
    Core backfill logic. Fetches bulk trades from Quiver and upserts into DB.
    Batch commits every 1000 rows. Error-tolerant — continues on individual row failures.
    """
    pol_before = db.query(Politician).count()
    trade_before = db.query(PoliticianTrade).count()

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

            if inserted % BATCH_SIZE == 0:
                db.commit()

        except Exception as e:
            errors += 1
            name = raw_row.get("Name") or raw_row.get("Representative") or "?"
            row_ticker = raw_row.get("Ticker") or "?"
            logger.warning(f"Error row {i} ({name}/{row_ticker}): {e}")
            db.rollback()

        if i % PROGRESS_INTERVAL == 0:
            logger.info(f"Progress: {i:,}/{len(rows):,} rows | +{inserted:,} inserted, {skipped:,} skipped, {errors} errors")

    # Final commit
    db.commit()

    pol_after = db.query(Politician).count()
    trade_after = db.query(PoliticianTrade).count()

    return {
        "status": "ok",
        "total_rows": len(rows),
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors,
        "politicians_before": pol_before,
        "politicians_after": pol_after,
        "trades_before": trade_before,
        "trades_after": trade_after,
    }


@tracked_job("backfill_congress_trades")
def backfill_congress_trades_job() -> dict:
    """RQ job wrapper — creates its own DB session."""
    db = SessionLocal()
    try:
        result = backfill_congress_trades_logic(db)
        logger.info(f"Backfill complete: {result}")
        return result
    except Exception as e:
        db.rollback()
        logger.exception(f"Backfill failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
