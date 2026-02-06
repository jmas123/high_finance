#!/usr/bin/env python3
"""
Backfill SIC codes for all companies from SEC EDGAR.

Idempotent: only fetches for companies where sic_code IS NULL.
Respects SEC rate limit (10 req/s) with 150ms sleep between requests.

Usage:
    source .venv/bin/activate
    DATABASE_URL="postgresql://user:jude2000@localhost:5432/high_finance" python scripts/backfill_sic_codes.py
"""

import os
import sys
import time

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from high_finance.db.models.company import Company
from high_finance.services.sec_sic import fetch_sic_code


def get_db():
    database_url = os.environ.get("DATABASE_URL", "postgresql://user:jude2000@localhost:5432/high_finance")
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    return Session()


def main():
    db = get_db()
    companies = db.query(Company).filter(Company.sic_code.is_(None)).all()
    total = len(companies)
    print(f"Found {total} companies without SIC codes")

    updated = 0
    failed = 0

    for i, company in enumerate(companies, 1):
        ticker = company.ticker
        sic = fetch_sic_code(ticker)

        if sic:
            company.sic_code = sic
            db.commit()
            updated += 1
            print(f"[{i}/{total}] {ticker} → SIC {sic}")
        else:
            failed += 1
            print(f"[{i}/{total}] {ticker} → not found")

        # 150ms sleep to stay well under SEC's 10 req/s limit
        time.sleep(0.15)

    print(f"\nDone. Updated: {updated}, Not found: {failed}, Total: {total}")
    db.close()


if __name__ == "__main__":
    main()
