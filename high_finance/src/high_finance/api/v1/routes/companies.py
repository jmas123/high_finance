import logging

from fastapi import APIRouter, HTTPException, Depends, Query, Request, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from high_finance.db.session import get_db
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.services.export_excel import generate_comps_export, sanitize_filename
from high_finance.db.models.peer_group import PeerGroup
from high_finance.core.security import get_current_user_optional, User
from high_finance.core.rate_limit import limiter

from high_finance.api.v1.schemas.politician import PoliticianTradeOut
from high_finance.services.politicians import get_company_politician_trades, ensure_company_trades_fresh

from high_finance.api.v1.schemas.company import ComparableAnalysis
from high_finance.api.v1.deps import _TICKER_RE

logger = logging.getLogger(__name__)

router = APIRouter()


# Schema for comps export request
class CompsExportRequest(BaseModel):
    format: str = Field(default="xlsx", pattern="^(xlsx|csv)$")
    peer_group_id: Optional[int] = None
    peers: Optional[List[str]] = Field(None, max_length=30)


@router.get("/{ticker}")
async def read_company(ticker: str, db: Session = Depends(get_db)):
    company = await get_company_fundamentals(ticker, db)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/{ticker}/comps", response_model=ComparableAnalysis)
async def read_company_comps(
    ticker: str,
    peer_group_id: Optional[int] = Query(None, description="ID of saved peer group to use"),
    peers: Optional[str] = Query(None, description="Comma-separated list of peer tickers (ad-hoc)"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Get comparable analysis: Target company vs. peers.

    Peer selection priority:
    1. If `peer_group_id` is provided, use that saved peer group
    2. If `peers` query param is provided (e.g., "MSFT,GOOGL,META"), use those tickers
    3. Otherwise, auto-select peers by industry/sector proximity
    """
    peer_tickers = None

    # Option 1: Use saved peer group
    if peer_group_id is not None:
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required to use saved peer groups"
            )
        group = db.query(PeerGroup).filter(
            PeerGroup.id == peer_group_id,
            PeerGroup.user_id == user.id,
        ).first()
        if not group:
            raise HTTPException(status_code=404, detail="Peer group not found")
        peer_tickers = group.peer_tickers

    # Option 2: Ad-hoc peer list from query param
    elif peers:
        raw = [t.strip().upper() for t in peers.split(",") if t.strip()]
        invalid = [t for t in raw if not _TICKER_RE.match(t)]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ticker format: {', '.join(invalid[:5])}",
            )
        # Deduplicate (preserve order) and remove target ticker
        peer_tickers = list(dict.fromkeys(t for t in raw if t != ticker.upper()))
        if len(peer_tickers) > 30:
            raise HTTPException(
                status_code=400,
                detail="Maximum 30 peer tickers allowed"
            )

    # Fetch comps data with custom or auto peers
    data = await get_company_fundamentals(
        ticker,
        db,
        fetch_peers=True,
        peer_tickers=peer_tickers,
    )

    if not data:
        raise HTTPException(status_code=404, detail="Company not found")

    return data



@router.post("/{ticker}/comps/export")
@limiter.limit("10/minute")
async def export_company_comps(
    request: Request,
    ticker: str,
    body: CompsExportRequest = Body(default=CompsExportRequest()),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Export comparable analysis as Excel file.

    Peer selection priority:
    1. If `peer_group_id` is provided, use that saved peer group
    2. If `peers` list is provided, use those tickers
    3. Otherwise, auto-select peers by industry/sector proximity

    Rate limited to 10 exports per minute per user.
    """
    peer_tickers = None

    # Option 1: Use saved peer group
    if body.peer_group_id is not None:
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required to use saved peer groups"
            )
        group = db.query(PeerGroup).filter(
            PeerGroup.id == body.peer_group_id,
            PeerGroup.user_id == user.id,
        ).first()
        if not group:
            raise HTTPException(status_code=404, detail="Peer group not found")
        peer_tickers = group.peer_tickers

    # Option 2: Ad-hoc peer list from request body
    elif body.peers:
        raw = [t.strip().upper() for t in body.peers if t.strip()]
        invalid = [t for t in raw if not _TICKER_RE.match(t)]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ticker format: {', '.join(invalid[:5])}",
            )
        # Deduplicate (preserve order) and remove target ticker
        peer_tickers = list(dict.fromkeys(t for t in raw if t != ticker.upper()))
        if len(peer_tickers) > 30:
            raise HTTPException(
                status_code=400,
                detail="Maximum 30 peer tickers allowed"
            )

    # Fetch comps data with custom or auto peers
    data = await get_company_fundamentals(
        ticker,
        db,
        fetch_peers=True,
        peer_tickers=peer_tickers,
    )

    if not data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Generate Excel file
    try:
        excel_bytes = await generate_comps_export(
            target=data.get("target", data),
            peers=data.get("peers", []),
            statistics=data.get("statistics", {}),
            implied_prices=data.get("implied_prices", {}),
            template=data.get("template", {"label": "Standard", "metrics": ["market_cap", "pe_ratio"]}),
            format=body.format,
        )
    except Exception:
        logger.exception("Export generation failed for %s", ticker)
        raise HTTPException(status_code=500, detail="Export generation failed")

    # Generate filename
    safe_ticker = sanitize_filename(ticker)
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = f"{safe_ticker}_comps_{date_str}.{body.format}"

    return StreamingResponse(
        excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if body.format == "xlsx"
        else "text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{ticker}/politician-trades", response_model=List[PoliticianTradeOut])
def company_politician_trades(ticker: str, limit: int = 50, db: Session = Depends(get_db)):
    ensure_company_trades_fresh(db, ticker)
    return get_company_politician_trades(db, ticker, limit=limit)




