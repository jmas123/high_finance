import os
import httpx
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade

from high_finance.utils.matching import match_entity


QUIVER_BASE = "https://api.quiverquant.com/beta"


def _get_quiver_key() -> str:
    key = os.getenv("QUIVER_API_KEY")
    if not key:
        raise RuntimeError("QUIVER_API_KEY is not set")
    return key


def _parse_date(s: Optional[str]):
    if not s:
        return None
    # Quiver commonly uses YYYY-MM-DD
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _amount_range(amount_str: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """
    Quiver sometimes returns ranges like "$1,001 - $15,000" or similar.
    If Quiver returns numeric fields already, adjust this accordingly.
    """
    if not amount_str:
        return (None, None)

    s = amount_str.replace("$", "").replace(",", "").strip()

    # common separators: '-', '–'
    for sep in [" - ", "–", "-"]:
        if sep in s:
            parts = [p.strip() for p in s.split(sep) if p.strip()]
            if len(parts) == 2:
                try:
                    return (float(parts[0]), float(parts[1]))
                except Exception:
                    return (None, None)

    # fallback: single number
    try:
        v = float(s)
        return (v, v)
    except Exception:
        return (None, None)


async def fetch_quiver_congress_trading() -> List[Dict[str, Any]]:
    """
    Pull latest congress trading disclosures.
    Endpoint name can differ by Quiver plan/version.
    We'll code for the common /beta/congresstrading endpoint.
    """
    key = _get_quiver_key()
    headers = {"Authorization": f"Bearer {key}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{QUIVER_BASE}/congresstrading", headers=headers)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list):
            raise RuntimeError(f"Unexpected Quiver response: {type(data)}")
        return data


def _ensure_politician(db: Session, row: Dict[str, Any]) -> Politician:
    """
    Normalize politician identity. Quiver typically provides Representative/Senator name.
    """
    name = (row.get("Representative") or row.get("Senator") or row.get("Politician") or row.get("Name") or "").strip()
    if not name:
        name = "Unknown"

    party = row.get("Party")
    chamber = row.get("Chamber")  # sometimes present
    state = row.get("State")
    district = row.get("District")
    bioguide_id = row.get("BioguideID") or row.get("bioguide_id")

    q = db.query(Politician).filter(Politician.name == name)
    if bioguide_id:
        q = db.query(Politician).filter((Politician.bioguide_id == bioguide_id) | (Politician.name == name))

    pol = q.first()
    if not pol:
        pol = Politician(
            name=name,
            party=party,
            chamber=chamber,
            state=state,
            district=str(district) if district is not None else None,
            bioguide_id=bioguide_id,
        )
        db.add(pol)
        db.flush()
    else:
        # light update — prefer fresh API data over stale DB values
        pol.party = party or pol.party
        pol.chamber = chamber or pol.chamber
        pol.state = state or pol.state
        pol.district = (str(district) if district is not None else None) or pol.district
        pol.bioguide_id = bioguide_id or pol.bioguide_id

    return pol


def _resolve_company(db: Session, ticker: Optional[str], issuer: Optional[str]) -> Tuple[Optional[int], Optional[str]]:
    """
    Prefer ticker match. If missing, attempt fuzzy match on company names.
    Returns (company_id, matched_ticker).
    """
    if ticker:
        c = db.query(Company).filter(Company.ticker == ticker.upper()).first()
        if c:
            return (c.id, c.ticker)

    if issuer:
        companies = db.query(Company).all()
        names = [c.name for c in companies if c.name]
        best = match_entity(issuer, names)
        if best:
            c = next((x for x in companies if x.name == best), None)
            if c:
                return (c.id, c.ticker)

    return (None, ticker.upper() if ticker else None)


def upsert_quiver_trades(db: Session, trades: List[Dict[str, Any]]) -> int:
    """
    Insert new trades. Simple dedupe based on politician + issuer/ticker + dates + type + amount.
    Returns number inserted.
    """
    inserted = 0

    for row in trades:
        pol = _ensure_politician(db, row)

        ticker = (row.get("Ticker") or row.get("Symbol") or "").strip() or None
        issuer = (row.get("Issuer") or row.get("Asset") or row.get("Company") or "").strip() or None

        transaction_type = row.get("Transaction") or row.get("TransactionType") or row.get("Type")
        transaction_date = _parse_date(row.get("TransactionDate") or row.get("Traded") or row.get("TransactionDate"))
        disclosure_date = _parse_date(row.get("ReportDate") or row.get("DisclosureDate") or row.get("Reported"))

        amount = row.get("Amount") or row.get("Range")
        amount_min, amount_max = _amount_range(amount if isinstance(amount, str) else None)

        source_url = row.get("Source") or row.get("source_url") or row.get("URL")

        company_id, matched_ticker = _resolve_company(db, ticker, issuer)

        # Dedupe
        exists = (
            db.query(PoliticianTrade)
            .filter(
                PoliticianTrade.politician_id == pol.id,
                PoliticianTrade.transaction_date == transaction_date,
                PoliticianTrade.disclosure_date == disclosure_date,
                PoliticianTrade.transaction_type == transaction_type,
                PoliticianTrade.ticker_raw == (ticker or matched_ticker),
                PoliticianTrade.issuer_raw == issuer,
                PoliticianTrade.amount_min == amount_min,
                PoliticianTrade.amount_max == amount_max,
            )
            .first()
        )
        if exists:
            continue

        t = PoliticianTrade(
            politician_id=pol.id,
            company_id=company_id,
            issuer_raw=issuer,
            ticker_raw=(ticker or matched_ticker),
            transaction_date=transaction_date,
            disclosure_date=disclosure_date or transaction_date or datetime.utcnow().date(),
            transaction_type=transaction_type,
            amount_min=amount_min,
            amount_max=amount_max,
            source_url=source_url,
        )
        db.add(t)
        inserted += 1

    return inserted


def refresh_politician_trades_quiver(db: Session) -> int:
    """
    Synchronous wrapper for your stack (since your workers/tasks look sync).
    """
    trades = httpx.get(
        f"{QUIVER_BASE}/congresstrading",
        headers={"Authorization": f"Bearer {_get_quiver_key()}"},
        timeout=30.0,
    ).json()

    if not isinstance(trades, list):
        raise RuntimeError(f"Unexpected Quiver response: {type(trades)}")

    n = upsert_quiver_trades(db, trades)
    db.commit()
    return n
