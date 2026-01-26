import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from high_finance.db.models.company import Company
from high_finance.db.models.politician import Politician
from high_finance.db.models.politician_trade import PoliticianTrade
from high_finance.utils.matching import match_entity

QUIVER_BASE = "https://api.quiverquant.com/beta"


def _get_key() -> str:
    key = os.getenv("QUIVER_API_KEY")
    if not key:
        raise RuntimeError("QUIVER_API_KEY is not set")
    return key


def _parse_date(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _to_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except Exception:
        return None


def _amount_range(row: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """
    Quiver sometimes provides Amount as a string range, and sometimes provides
    Amount/Min/Max as numbers depending on endpoint.
    We try a few common fields.
    """
    # numeric fields (if present)
    mn = _to_float(row.get("AmountMin") or row.get("amount_min"))
    mx = _to_float(row.get("AmountMax") or row.get("amount_max"))
    if mn is not None or mx is not None:
        return (mn, mx)

    # range string
    amt = row.get("Range") or row.get("Amount") or row.get("amount")
    if not amt:
        return (None, None)

    s = str(amt).replace("$", "").replace(",", "").strip()
    for sep in [" - ", "–", "-"]:
        if sep in s:
            parts = [p.strip() for p in s.split(sep) if p.strip()]
            if len(parts) == 2:
                return (_to_float(parts[0]), _to_float(parts[1]))
    v = _to_float(s)
    return (v, v)


def _ensure_politician(db: Session, row: Dict[str, Any]) -> Politician:
    name = (row.get("Representative") or row.get("Senator") or row.get("Politician") or row.get("Name") or "").strip()
    if not name:
        name = "Unknown"

    party = row.get("Party") or row.get("party")
    chamber = row.get("Chamber") or row.get("chamber")
    state = row.get("State") or row.get("state")
    district = row.get("District") or row.get("district")
    bioguide_id = row.get("BioguideID") or row.get("bioguide_id")

    q = db.query(Politician)
    if bioguide_id:
        pol = q.filter(Politician.bioguide_id == bioguide_id).first()
        if pol:
            # light update
            pol.name = pol.name or name
            pol.party = pol.party or party
            pol.chamber = pol.chamber or chamber
            pol.state = pol.state or state
            pol.district = pol.district or (str(district) if district is not None else None)
            return pol

    pol = q.filter(Politician.name == name).first()
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
        pol.party = pol.party or party
        pol.chamber = pol.chamber or chamber
        pol.state = pol.state or state
        pol.district = pol.district or (str(district) if district is not None else None)
        pol.bioguide_id = pol.bioguide_id or bioguide_id

    return pol


def _resolve_company_id(db: Session, ticker: Optional[str], issuer: Optional[str]) -> Optional[int]:
    if ticker:
        c = db.query(Company).filter(Company.ticker == ticker.upper()).first()
        if c:
            return c.id

    if issuer:
        companies = db.query(Company).all()
        names = [c.name for c in companies if c.name]
        best = match_entity(issuer, names)
        if best:
            c = next((x for x in companies if x.name == best), None)
            if c:
                return c.id

    return None


def _fetch_quiver(symbol: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    key = _get_key()

    # ✅ use the endpoints you confirmed work
    if symbol:
        url = f"{QUIVER_BASE}/historical/congresstrading/{symbol.upper()}"
    else:
        url = f"{QUIVER_BASE}/live/congresstrading"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Token {key}",  # ✅ confirmed in your curl test
    }

    r = httpx.get(url, headers=headers, timeout=30.0)
    r.raise_for_status()

    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected Quiver response: {type(data)}")

    return data[:limit]


def refresh_congress_trades(db: Session, symbol: str | None = None, limit: int = 200) -> int:
    """
    Fetch latest congress trades from Quiver and upsert into DB.
    Returns # inserted.
    """
    rows = _fetch_quiver(symbol=symbol, limit=limit)
    inserted = 0

    for row in rows:
        pol = _ensure_politician(db, row)

        ticker = (row.get("Ticker") or row.get("Symbol") or "").strip() or None
        issuer = (row.get("Issuer") or row.get("Asset") or row.get("Company") or "").strip() or None

        txn_type = row.get("Transaction") or row.get("TransactionType") or row.get("Type")
        txn_date = _parse_date(row.get("TransactionDate") or row.get("Traded") or row.get("transaction_date"))
        disc_date = _parse_date(row.get("ReportDate") or row.get("DisclosureDate") or row.get("Reported") or row.get("disclosure_date"))

        amount_min, amount_max = _amount_range(row)
        source_url = row.get("Source") or row.get("URL") or row.get("source_url")

        company_id = _resolve_company_id(db, ticker, issuer)

        # Dedupe: politician + key fields
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

    db.commit()
    return inserted
