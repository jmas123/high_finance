"""Fetch SIC codes from SEC EDGAR for public companies.

SEC EDGAR provides two useful endpoints:
  1. company_tickers.json — full ticker→CIK map (~4 MB, cached in-memory)
  2. /submissions/CIK{padded}.json — company metadata including `sic` field

Rate limit: SEC allows 10 req/s. We enforce this in the caller (backfill script
adds 150ms sleep; the opportunistic single-fetch in fundamentals.py is fine).
"""

import logging
import requests

logger = logging.getLogger(__name__)

SEC_HEADERS = {
    "User-Agent": "HighFinance research-platform support@highfinance.app",
    "Accept-Encoding": "gzip, deflate",
}

# In-memory cache: ticker (uppercase) → CIK (int)
_ticker_to_cik: dict[str, int] | None = None


def _load_ticker_map() -> dict[str, int]:
    """Load the SEC company_tickers.json and build a ticker→CIK lookup.

    The JSON structure is: {"0": {"cik_str": "...", "ticker": "...", "title": "..."}, ...}
    """
    global _ticker_to_cik
    if _ticker_to_cik is not None:
        return _ticker_to_cik

    url = "https://www.sec.gov/files/company_tickers.json"
    try:
        resp = requests.get(url, headers=SEC_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("Failed to load SEC ticker map: %s", e)
        _ticker_to_cik = {}
        return _ticker_to_cik

    mapping: dict[str, int] = {}
    for entry in data.values():
        ticker = entry.get("ticker", "").upper()
        cik = entry.get("cik_str")
        if ticker and cik:
            mapping[ticker] = int(cik)

    _ticker_to_cik = mapping
    logger.info("Loaded SEC ticker map: %d entries", len(mapping))
    return _ticker_to_cik


def fetch_sic_code(ticker: str) -> str | None:
    """Return the 4-digit SIC code string for a ticker, or None on failure.

    Steps:
      1. Look up CIK from the cached ticker map.
      2. Hit the SEC submissions endpoint for the company's metadata.
      3. Extract the `sic` field (a string like "3312").
    """
    ticker_upper = ticker.upper()
    cik_map = _load_ticker_map()
    cik = cik_map.get(ticker_upper)
    if cik is None:
        return None

    padded_cik = str(cik).zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded_cik}.json"

    try:
        resp = requests.get(url, headers=SEC_HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("Failed to fetch SEC submissions for %s (CIK %s): %s", ticker, padded_cik, e)
        return None

    sic = data.get("sic")
    if sic:
        return str(sic).strip()[:4]
    return None
