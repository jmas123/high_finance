"""
Refresh 13F Holdings Data
=========================
Fetches institutional ownership data from SEC EDGAR 13F filings.

IMPORTANT: This uses SEC EDGAR API, NOT yfinance institutional_holders.
yfinance data is incomplete and NOT real 13F data.
SEC EDGAR has: share counts, filing dates, comprehensive holdings.

13F filings are due within 45 days of quarter end:
- Q1 (Mar 31) → due May 15
- Q2 (Jun 30) → due Aug 14
- Q3 (Sep 30) → due Nov 14
- Q4 (Dec 31) → due Feb 14
"""

import logging
import time
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from high_finance.db.session import SessionLocal
from high_finance.db.models import Investor, Holding, Company
from high_finance.workers.tasks.base import create_job_result, tracked_job

logger = logging.getLogger(__name__)

# SEC EDGAR API base URL
SEC_EDGAR_BASE = "https://data.sec.gov"

# SEC requires User-Agent header with contact info
SEC_USER_AGENT = "HighFinance Research research@example.com"

# Rate limit: 10 requests per second max
SEC_RATE_LIMIT_DELAY = 0.15


def get_recent_13f_filings(
    limit: int = 100,
    client: Optional[httpx.Client] = None,
) -> list[dict]:
    """
    Get recent 13F-HR filings from SEC EDGAR.

    Args:
        limit: Maximum number of filings to return.
        client: Optional httpx client for connection reuse.

    Returns:
        List of filing metadata dicts.
    """
    own_client = client is None
    if own_client:
        client = httpx.Client(
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=30.0,
        )

    try:
        # Full-text search for recent 13F-HR filings
        url = f"{SEC_EDGAR_BASE}/submissions/CIK0000000000.json"
        # Note: This is a placeholder - actual implementation would use
        # SEC's full-text search API or download the daily index files

        # For now, we'll use the EDGAR filing search
        search_url = "https://efts.sec.gov/LATEST/search-index"
        params = {
            "q": "13F-HR",
            "dateRange": "custom",
            "startdt": "2024-01-01",
            "enddt": datetime.now().strftime("%Y-%m-%d"),
            "forms": "13F-HR",
        }

        # This is a simplified approach - full implementation would parse
        # SEC's daily index files from:
        # https://www.sec.gov/Archives/edgar/daily-index/

        return []  # Placeholder for actual implementation

    finally:
        if own_client:
            client.close()


def fetch_13f_filing_detail(
    accession_number: str,
    cik: str,
    client: Optional[httpx.Client] = None,
) -> Optional[dict]:
    """
    Fetch the detailed holdings from a 13F filing.

    Args:
        accession_number: SEC accession number (e.g., "0001234567-24-000001")
        cik: CIK number of the filer
        client: Optional httpx client

    Returns:
        Dict with filing details and holdings, or None on error.
    """
    own_client = client is None
    if own_client:
        client = httpx.Client(
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=30.0,
        )

    try:
        # Construct URL for the information table (holdings)
        # Format: /Archives/edgar/data/{cik}/{accession}/infotable.xml
        acc_clean = accession_number.replace("-", "")
        url = f"{SEC_EDGAR_BASE}/Archives/edgar/data/{cik}/{acc_clean}/infotable.xml"

        response = client.get(url)
        response.raise_for_status()

        # Parse XML to extract holdings
        # This would use xml.etree.ElementTree or lxml
        # Holdings include: name, cusip, value, shares, type (SH/PUT/CALL)

        return {
            "accession_number": accession_number,
            "holdings": [],  # Placeholder for parsed holdings
        }

    except httpx.HTTPStatusError as e:
        logger.warning(f"Failed to fetch 13F detail {accession_number}: {e}")
        return None
    finally:
        if own_client:
            client.close()
        time.sleep(SEC_RATE_LIMIT_DELAY)


def upsert_investor(db: Session, cik: str, name: str) -> Investor:
    """Get or create an Investor record."""
    investor = db.query(Investor).filter(Investor.cik == cik).first()
    if not investor:
        investor = Investor(cik=cik, name=name)
        db.add(investor)
        db.flush()
    return investor


def refresh_13f_logic(
    db: Session,
    limit: int = 100,
) -> dict:
    """
    Core logic to refresh 13F holdings data.

    Args:
        db: Database session
        limit: Maximum number of filings to process

    Returns:
        Result dict with status and counts.
    """
    logger.info(f"Starting 13F refresh (limit={limit})")

    updated_investors = 0
    updated_holdings = 0
    failed: list[str] = []

    client = httpx.Client(
        headers={"User-Agent": SEC_USER_AGENT},
        timeout=30.0,
    )

    try:
        # Get recent filings
        filings = get_recent_13f_filings(limit=limit, client=client)
        logger.info(f"Found {len(filings)} 13F filings to process")

        for filing in filings:
            try:
                cik = filing.get("cik", "")
                acc_num = filing.get("accession_number", "")
                filer_name = filing.get("filer_name", "")

                if not cik or not acc_num:
                    continue

                # Get or create investor
                investor = upsert_investor(db, cik, filer_name)

                # Fetch detailed holdings
                detail = fetch_13f_filing_detail(acc_num, cik, client)
                if not detail:
                    failed.append(acc_num)
                    continue

                # Process holdings
                for holding in detail.get("holdings", []):
                    # Match to company by CUSIP or ticker
                    cusip = holding.get("cusip")
                    ticker = holding.get("ticker")

                    company = None
                    if cusip:
                        company = db.query(Company).filter(
                            Company.cusip == cusip
                        ).first()
                    if not company and ticker:
                        company = db.query(Company).filter(
                            Company.ticker == ticker
                        ).first()

                    if not company:
                        continue

                    # Upsert holding
                    existing = db.query(Holding).filter(
                        Holding.investor_id == investor.id,
                        Holding.company_id == company.id,
                        Holding.filing_date == filing.get("filing_date"),
                    ).first()

                    if existing:
                        existing.shares = holding.get("shares")
                        existing.value = holding.get("value")
                    else:
                        db.add(Holding(
                            investor_id=investor.id,
                            company_id=company.id,
                            shares=holding.get("shares"),
                            value=holding.get("value"),
                            filing_date=filing.get("filing_date"),
                        ))
                        updated_holdings += 1

                updated_investors += 1
                db.commit()

            except Exception as e:
                logger.warning(f"Error processing filing {filing}: {e}")
                db.rollback()
                failed.append(str(filing.get("accession_number", "unknown")))

    finally:
        client.close()

    logger.info(
        f"13F refresh completed: {updated_investors} investors, "
        f"{updated_holdings} holdings, {len(failed)} failed"
    )

    return create_job_result(
        status="ok" if not failed else "error",
        updated=updated_investors,
        total=len(filings) if 'filings' in dir() else 0,
        failed=failed,
        holdings_updated=updated_holdings,
    )


@tracked_job("13f_holdings")
def refresh_13f_job(limit: int = 100) -> dict:
    """
    RQ job wrapper - creates its own DB session.

    Args:
        limit: Maximum number of filings to process.
    """
    db: Session = SessionLocal()
    try:
        result = refresh_13f_logic(db, limit=limit)
        return result
    except Exception as e:
        db.rollback()
        logger.exception(f"13F refresh job failed: {e}")
        return create_job_result(status="error", error_message=str(e))
    finally:
        db.close()


if __name__ == "__main__":
    # Allow running directly for testing
    import sys

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    result = refresh_13f_job(limit=limit)
    print(result)
