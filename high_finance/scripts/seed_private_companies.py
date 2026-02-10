"""
Seed Private Companies (CLI)
============================
Thin CLI wrapper around the seeds module.

Usage:
    source .venv/bin/activate
    DATABASE_URL="postgresql://..." python scripts/seed_private_companies.py
"""

import os
import sys

# Allow running from either high_finance/ or high_finance/high_finance/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is required.")
    print("Usage: DATABASE_URL='postgresql://...' python scripts/seed_private_companies.py")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def main():
    from high_finance.seeds.private_companies import seed_private_companies

    session = Session()
    try:
        result = seed_private_companies(session)
        print(f"Done: {result['created']} created, {result['updated']} updated, {result['total']} total.")
    except Exception as e:
        session.rollback()
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
