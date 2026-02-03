"""
Stock Screener – Service Layer
==============================
Business logic for screener queries and saved screens.
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from high_finance.db.models.screener import ScreenerUniverse, ScreenerCache, SavedScreen


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENER QUERY
# ═══════════════════════════════════════════════════════════════════════════════

# Valid sort fields mapping to ScreenerCache columns
SORT_FIELDS = {
    "market_cap": ScreenerCache.market_cap,
    "pe_ratio": ScreenerCache.pe_ratio,
    "forward_pe": ScreenerCache.forward_pe,
    "pb_ratio": ScreenerCache.pb_ratio,
    "ev_to_ebitda": ScreenerCache.ev_to_ebitda,
    "revenue_growth": ScreenerCache.revenue_growth,
    "dividend_yield": ScreenerCache.dividend_yield,
    "price_vs_200ma": ScreenerCache.price_vs_200ma,
    "price_vs_52w_high": ScreenerCache.price_vs_52w_high,
    "insider_net_shares_90d": ScreenerCache.insider_net_shares_90d,
    "congress_net_value_90d": ScreenerCache.congress_net_value_90d,
    "current_price": ScreenerCache.current_price,
    "price_change_1d": ScreenerCache.price_change_1d,
}


async def run_screen(
    db: Session,
    *,
    # Size
    market_cap_min: Optional[int] = None,
    market_cap_max: Optional[int] = None,
    # Valuation
    pe_ratio_min: Optional[float] = None,
    pe_ratio_max: Optional[float] = None,
    forward_pe_min: Optional[float] = None,
    forward_pe_max: Optional[float] = None,
    pb_ratio_min: Optional[float] = None,
    pb_ratio_max: Optional[float] = None,
    ev_to_ebitda_min: Optional[float] = None,
    ev_to_ebitda_max: Optional[float] = None,
    # Growth & Dividend
    revenue_growth_min: Optional[float] = None,
    revenue_growth_max: Optional[float] = None,
    dividend_yield_min: Optional[float] = None,
    dividend_yield_max: Optional[float] = None,
    # Price Technicals
    price_vs_200ma_min: Optional[float] = None,
    price_vs_200ma_max: Optional[float] = None,
    price_vs_52w_high_min: Optional[float] = None,
    price_vs_52w_high_max: Optional[float] = None,
    # Sectors
    sectors: Optional[str] = None,
    # Insider
    insider_net_shares_90d_min: Optional[int] = None,
    has_insider_buys_90d: Optional[bool] = None,
    # Congress
    congress_net_value_90d_min: Optional[int] = None,
    # Sort & Pagination
    sort_by: str = "market_cap",
    sort_order: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int, Optional[datetime]]:
    """
    Run a screener query against the cache.
    Returns: (results, total_count, cached_at)
    """
    # Join screener_cache with screener_universe for sector/company_name
    q = db.query(
        ScreenerCache,
        ScreenerUniverse.company_name,
        ScreenerUniverse.sector,
        ScreenerUniverse.industry,
    ).join(
        ScreenerUniverse,
        ScreenerCache.ticker == ScreenerUniverse.ticker
    ).filter(
        ScreenerUniverse.is_active == True
    )

    # Apply filters (exclude NULLs by default for numeric comparisons)
    filters = []

    # Market cap (stored in raw value, filter param is in millions)
    if market_cap_min is not None:
        filters.append(ScreenerCache.market_cap >= market_cap_min * 1_000_000)
    if market_cap_max is not None:
        filters.append(ScreenerCache.market_cap <= market_cap_max * 1_000_000)

    # P/E ratio
    if pe_ratio_min is not None:
        filters.append(ScreenerCache.pe_ratio.isnot(None))
        filters.append(ScreenerCache.pe_ratio >= pe_ratio_min)
    if pe_ratio_max is not None:
        filters.append(ScreenerCache.pe_ratio.isnot(None))
        filters.append(ScreenerCache.pe_ratio <= pe_ratio_max)

    # Forward P/E
    if forward_pe_min is not None:
        filters.append(ScreenerCache.forward_pe.isnot(None))
        filters.append(ScreenerCache.forward_pe >= forward_pe_min)
    if forward_pe_max is not None:
        filters.append(ScreenerCache.forward_pe.isnot(None))
        filters.append(ScreenerCache.forward_pe <= forward_pe_max)

    # P/B ratio
    if pb_ratio_min is not None:
        filters.append(ScreenerCache.pb_ratio.isnot(None))
        filters.append(ScreenerCache.pb_ratio >= pb_ratio_min)
    if pb_ratio_max is not None:
        filters.append(ScreenerCache.pb_ratio.isnot(None))
        filters.append(ScreenerCache.pb_ratio <= pb_ratio_max)

    # EV/EBITDA
    if ev_to_ebitda_min is not None:
        filters.append(ScreenerCache.ev_to_ebitda.isnot(None))
        filters.append(ScreenerCache.ev_to_ebitda >= ev_to_ebitda_min)
    if ev_to_ebitda_max is not None:
        filters.append(ScreenerCache.ev_to_ebitda.isnot(None))
        filters.append(ScreenerCache.ev_to_ebitda <= ev_to_ebitda_max)

    # Revenue growth
    if revenue_growth_min is not None:
        filters.append(ScreenerCache.revenue_growth.isnot(None))
        filters.append(ScreenerCache.revenue_growth >= revenue_growth_min)
    if revenue_growth_max is not None:
        filters.append(ScreenerCache.revenue_growth.isnot(None))
        filters.append(ScreenerCache.revenue_growth <= revenue_growth_max)

    # Dividend yield
    if dividend_yield_min is not None:
        filters.append(ScreenerCache.dividend_yield.isnot(None))
        filters.append(ScreenerCache.dividend_yield >= dividend_yield_min)
    if dividend_yield_max is not None:
        filters.append(ScreenerCache.dividend_yield.isnot(None))
        filters.append(ScreenerCache.dividend_yield <= dividend_yield_max)

    # Price vs 200MA
    if price_vs_200ma_min is not None:
        filters.append(ScreenerCache.price_vs_200ma.isnot(None))
        filters.append(ScreenerCache.price_vs_200ma >= price_vs_200ma_min)
    if price_vs_200ma_max is not None:
        filters.append(ScreenerCache.price_vs_200ma.isnot(None))
        filters.append(ScreenerCache.price_vs_200ma <= price_vs_200ma_max)

    # Price vs 52W high
    if price_vs_52w_high_min is not None:
        filters.append(ScreenerCache.price_vs_52w_high.isnot(None))
        filters.append(ScreenerCache.price_vs_52w_high >= price_vs_52w_high_min)
    if price_vs_52w_high_max is not None:
        filters.append(ScreenerCache.price_vs_52w_high.isnot(None))
        filters.append(ScreenerCache.price_vs_52w_high <= price_vs_52w_high_max)

    # Sectors (comma-separated)
    if sectors:
        sector_list = [s.strip() for s in sectors.split(",") if s.strip()]
        if sector_list:
            filters.append(ScreenerUniverse.sector.in_(sector_list))

    # Insider activity
    if insider_net_shares_90d_min is not None:
        filters.append(ScreenerCache.insider_net_shares_90d >= insider_net_shares_90d_min)
    if has_insider_buys_90d:
        filters.append(ScreenerCache.insider_buys_90d > 0)

    # Congress activity
    if congress_net_value_90d_min is not None:
        filters.append(ScreenerCache.congress_net_value_90d >= congress_net_value_90d_min)

    # Apply all filters
    if filters:
        q = q.filter(and_(*filters))

    # Get total count before pagination
    total_count = q.count()

    # Apply sorting
    sort_col = SORT_FIELDS.get(sort_by, ScreenerCache.market_cap)
    if sort_order.lower() == "asc":
        q = q.order_by(sort_col.asc().nullslast())
    else:
        q = q.order_by(sort_col.desc().nullslast())

    # Apply pagination
    q = q.offset(offset).limit(limit)

    # Execute and build results
    rows = q.all()
    results = []
    cached_at = None

    for row in rows:
        cache: ScreenerCache = row[0]
        company_name = row[1]
        sector = row[2]
        industry = row[3]

        if cached_at is None and cache.cached_at:
            cached_at = cache.cached_at

        results.append({
            "ticker": cache.ticker,
            "company_name": company_name,
            "sector": sector,
            "industry": industry,
            "market_cap": int(cache.market_cap) if cache.market_cap else None,
            "current_price": float(cache.current_price) if cache.current_price else None,
            "price_change_1d": float(cache.price_change_1d) if cache.price_change_1d else None,
            "pe_ratio": float(cache.pe_ratio) if cache.pe_ratio else None,
            "forward_pe": float(cache.forward_pe) if cache.forward_pe else None,
            "pb_ratio": float(cache.pb_ratio) if cache.pb_ratio else None,
            "ev_to_ebitda": float(cache.ev_to_ebitda) if cache.ev_to_ebitda else None,
            "revenue_growth": float(cache.revenue_growth) if cache.revenue_growth else None,
            "dividend_yield": float(cache.dividend_yield) if cache.dividend_yield else None,
            "price_vs_200ma": float(cache.price_vs_200ma) if cache.price_vs_200ma else None,
            "price_vs_52w_high": float(cache.price_vs_52w_high) if cache.price_vs_52w_high else None,
            "insider_net_shares_90d": cache.insider_net_shares_90d or 0,
            "insider_buys_90d": cache.insider_buys_90d or 0,
            "insider_sells_90d": cache.insider_sells_90d or 0,
            "congress_net_value_90d": cache.congress_net_value_90d or 0,
            "congress_buys_90d": cache.congress_buys_90d or 0,
            "congress_sells_90d": cache.congress_sells_90d or 0,
        })

    return results, total_count, cached_at


async def get_sector_counts(db: Session) -> Dict[str, int]:
    """Return count of active stocks per sector."""
    rows = (
        db.query(ScreenerUniverse.sector, func.count(ScreenerUniverse.ticker))
        .filter(ScreenerUniverse.is_active == True)
        .group_by(ScreenerUniverse.sector)
        .all()
    )
    return {sector: count for sector, count in rows if sector}


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED SCREENS CRUD
# ═══════════════════════════════════════════════════════════════════════════════

async def list_saved_screens(db: Session, owner_id: str) -> List[SavedScreen]:
    """List all saved screens for an owner."""
    return (
        db.query(SavedScreen)
        .filter(SavedScreen.owner_id == owner_id)
        .order_by(SavedScreen.created_at.desc())
        .all()
    )


async def create_saved_screen(
    db: Session,
    owner_id: str,
    name: str,
    filters: Dict[str, Any],
) -> SavedScreen:
    """Create a new saved screen."""
    screen = SavedScreen(
        owner_id=owner_id,
        name=name,
        filters=filters,
    )
    db.add(screen)
    db.commit()
    db.refresh(screen)
    return screen


async def get_saved_screen(db: Session, screen_id: int, owner_id: str) -> Optional[SavedScreen]:
    """Get a saved screen by ID, scoped to owner."""
    return (
        db.query(SavedScreen)
        .filter(SavedScreen.id == screen_id, SavedScreen.owner_id == owner_id)
        .first()
    )


async def delete_saved_screen(db: Session, screen_id: int, owner_id: str) -> bool:
    """Delete a saved screen. Returns True if deleted."""
    screen = await get_saved_screen(db, screen_id, owner_id)
    if not screen:
        return False
    db.delete(screen)
    db.commit()
    return True


async def update_saved_screen_stats(
    db: Session,
    screen_id: int,
    owner_id: str,
    result_count: int,
) -> Optional[SavedScreen]:
    """Update last_run_at and last_result_count for a saved screen."""
    screen = await get_saved_screen(db, screen_id, owner_id)
    if not screen:
        return None
    screen.last_run_at = datetime.utcnow()
    screen.last_result_count = result_count
    db.commit()
    db.refresh(screen)
    return screen
