"""
Stock Screener – API Routes
===========================
Endpoints:
    GET  /api/v1/screener           - Run a screen with filters
    POST /api/v1/screener/saved     - Save a screen
    GET  /api/v1/screener/saved     - List saved screens
    DELETE /api/v1/screener/saved/{id} - Delete a saved screen
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services import screener as svc
from high_finance.core.security import get_current_user_optional, User
from high_finance.api.v1.schemas.screener import (
    ScreenerResponse,
    ScreenerResult,
    SavedScreenCreate,
    SavedScreenOut,
)

router = APIRouter()


def get_owner_id_header(x_owner_id: str = Header(None, description="Owner ID (deprecated, use JWT)")) -> Optional[str]:
    """Extract owner_id from request header (deprecated)."""
    return x_owner_id


def resolve_owner_id(user: Optional[User], header_owner_id: Optional[str]) -> Optional[str]:
    """JWT user takes precedence over header."""
    if user:
        return user.id
    return header_owner_id


def require_owner_id(user: Optional[User], header_owner_id: Optional[str]) -> str:
    """Require authentication for saved screens."""
    owner_id = resolve_owner_id(user, header_owner_id)
    if not owner_id:
        raise HTTPException(401, "Authentication required for saved screens")
    return owner_id


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENER
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=ScreenerResponse)
async def run_screener(
    # Size
    market_cap_min: Optional[int] = Query(None, description="Min market cap in millions"),
    market_cap_max: Optional[int] = Query(None, description="Max market cap in millions"),
    # Valuation
    pe_ratio_min: Optional[float] = Query(None),
    pe_ratio_max: Optional[float] = Query(None),
    forward_pe_min: Optional[float] = Query(None),
    forward_pe_max: Optional[float] = Query(None),
    pb_ratio_min: Optional[float] = Query(None),
    pb_ratio_max: Optional[float] = Query(None),
    ev_to_ebitda_min: Optional[float] = Query(None),
    ev_to_ebitda_max: Optional[float] = Query(None),
    # Growth & Dividend
    revenue_growth_min: Optional[float] = Query(None, description="Decimal, e.g., 0.1 = 10%"),
    revenue_growth_max: Optional[float] = Query(None),
    dividend_yield_min: Optional[float] = Query(None),
    dividend_yield_max: Optional[float] = Query(None),
    # Price Technicals
    price_vs_200ma_min: Optional[float] = Query(None, description="Decimal, e.g., 0.05 = 5% above"),
    price_vs_200ma_max: Optional[float] = Query(None),
    price_vs_52w_high_min: Optional[float] = Query(None, description="Decimal, e.g., -0.1 = within 10%"),
    price_vs_52w_high_max: Optional[float] = Query(None),
    # Sectors
    sectors: Optional[str] = Query(None, description="Comma-separated sector names"),
    # Insider
    insider_net_shares_90d_min: Optional[int] = Query(None),
    has_insider_buys_90d: Optional[bool] = Query(None),
    # Congress
    congress_net_value_90d_min: Optional[int] = Query(None),
    # Sort & Pagination
    sort_by: str = Query("market_cap", description="Field to sort by"),
    sort_order: str = Query("desc", description="asc or desc"),
    limit: int = Query(50, ge=1, le=200, description="Results per page (max 200)"),
    offset: int = Query(0, ge=0),
    # DB
    db: Session = Depends(get_db),
):
    """
    Run a stock screener query with the specified filters.

    Filters are combined with AND logic. Null values are excluded by default
    when a min/max filter is applied for that field.
    """
    # Collect filters applied for response
    filters_applied = {}
    local_vars = locals()
    filter_params = [
        "market_cap_min", "market_cap_max", "pe_ratio_min", "pe_ratio_max",
        "forward_pe_min", "forward_pe_max", "pb_ratio_min", "pb_ratio_max",
        "ev_to_ebitda_min", "ev_to_ebitda_max", "revenue_growth_min", "revenue_growth_max",
        "dividend_yield_min", "dividend_yield_max", "price_vs_200ma_min", "price_vs_200ma_max",
        "price_vs_52w_high_min", "price_vs_52w_high_max", "sectors",
        "insider_net_shares_90d_min", "has_insider_buys_90d", "congress_net_value_90d_min",
        "sort_by", "sort_order", "limit", "offset",
    ]
    for param in filter_params:
        val = local_vars.get(param)
        if val is not None:
            filters_applied[param] = val

    results, total_count, cached_at = await svc.run_screen(
        db,
        market_cap_min=market_cap_min,
        market_cap_max=market_cap_max,
        pe_ratio_min=pe_ratio_min,
        pe_ratio_max=pe_ratio_max,
        forward_pe_min=forward_pe_min,
        forward_pe_max=forward_pe_max,
        pb_ratio_min=pb_ratio_min,
        pb_ratio_max=pb_ratio_max,
        ev_to_ebitda_min=ev_to_ebitda_min,
        ev_to_ebitda_max=ev_to_ebitda_max,
        revenue_growth_min=revenue_growth_min,
        revenue_growth_max=revenue_growth_max,
        dividend_yield_min=dividend_yield_min,
        dividend_yield_max=dividend_yield_max,
        price_vs_200ma_min=price_vs_200ma_min,
        price_vs_200ma_max=price_vs_200ma_max,
        price_vs_52w_high_min=price_vs_52w_high_min,
        price_vs_52w_high_max=price_vs_52w_high_max,
        sectors=sectors,
        insider_net_shares_90d_min=insider_net_shares_90d_min,
        has_insider_buys_90d=has_insider_buys_90d,
        congress_net_value_90d_min=congress_net_value_90d_min,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )

    return ScreenerResponse(
        results=[ScreenerResult(**r) for r in results],
        total_count=total_count,
        filters_applied=filters_applied,
        cached_at=cached_at,
    )


@router.get("/sectors")
async def get_sector_counts(db: Session = Depends(get_db)):
    """Get count of stocks per sector in the universe."""
    return await svc.get_sector_counts(db)


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED SCREENS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/saved", response_model=list[SavedScreenOut])
async def list_saved_screens(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    header_owner_id: Optional[str] = Depends(get_owner_id_header),
):
    """List all saved screens for the current owner."""
    owner_id = require_owner_id(user, header_owner_id)
    screens = await svc.list_saved_screens(db, owner_id)
    return screens


@router.post("/saved", response_model=SavedScreenOut, status_code=201)
async def create_saved_screen(
    body: SavedScreenCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    header_owner_id: Optional[str] = Depends(get_owner_id_header),
):
    """Save a new screen configuration."""
    owner_id = require_owner_id(user, header_owner_id)
    screen = await svc.create_saved_screen(
        db,
        owner_id=owner_id,
        name=body.name,
        filters=body.filters,
    )
    return screen


@router.delete("/saved/{screen_id}", status_code=204)
async def delete_saved_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    header_owner_id: Optional[str] = Depends(get_owner_id_header),
):
    """Delete a saved screen."""
    owner_id = require_owner_id(user, header_owner_id)
    deleted = await svc.delete_saved_screen(db, screen_id, owner_id)
    if not deleted:
        raise HTTPException(404, "Saved screen not found")
