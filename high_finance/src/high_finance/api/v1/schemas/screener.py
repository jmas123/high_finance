"""
Stock Screener – Pydantic Schemas
=================================
Request and response models for the Screener REST API.
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENER QUERY FILTERS
# ═══════════════════════════════════════════════════════════════════════════════

class ScreenerFilters(BaseModel):
    """Query parameters for the screener endpoint."""
    # Size
    market_cap_min: Optional[int] = Field(None, description="Min market cap in millions")
    market_cap_max: Optional[int] = Field(None, description="Max market cap in millions")

    # Valuation
    pe_ratio_min: Optional[float] = None
    pe_ratio_max: Optional[float] = None
    forward_pe_min: Optional[float] = None
    forward_pe_max: Optional[float] = None
    pb_ratio_min: Optional[float] = None
    pb_ratio_max: Optional[float] = None
    ev_to_ebitda_min: Optional[float] = None
    ev_to_ebitda_max: Optional[float] = None

    # Growth & Dividend
    revenue_growth_min: Optional[float] = Field(None, description="Decimal, e.g., 0.1 = 10%")
    revenue_growth_max: Optional[float] = None
    dividend_yield_min: Optional[float] = None
    dividend_yield_max: Optional[float] = None

    # Price Technicals
    price_vs_200ma_min: Optional[float] = Field(None, description="Decimal, e.g., 0.05 = 5% above")
    price_vs_200ma_max: Optional[float] = None
    price_vs_52w_high_min: Optional[float] = Field(None, description="Decimal, e.g., -0.1 = within 10% of high")
    price_vs_52w_high_max: Optional[float] = None

    # Sector
    sectors: Optional[str] = Field(None, description="Comma-separated sectors")

    # Insider Activity
    insider_net_shares_90d_min: Optional[int] = None
    has_insider_buys_90d: Optional[bool] = None

    # Congress Activity
    congress_net_value_90d_min: Optional[int] = None

    # Sorting & Pagination
    sort_by: str = Field("market_cap", description="Field to sort by")
    sort_order: str = Field("desc", description="asc or desc")
    limit: int = Field(50, ge=1, le=200, description="Max 200")
    offset: int = Field(0, ge=0)


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENER RESULTS
# ═══════════════════════════════════════════════════════════════════════════════

class ScreenerResult(BaseModel):
    """A single stock result from the screener."""
    ticker: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None

    # Size & Price
    market_cap: Optional[int] = None
    current_price: Optional[float] = None
    price_change_1d: Optional[float] = None

    # Valuation
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    pb_ratio: Optional[float] = None
    ev_to_ebitda: Optional[float] = None

    # Growth & Dividend
    revenue_growth: Optional[float] = None
    dividend_yield: Optional[float] = None

    # Technicals
    price_vs_200ma: Optional[float] = None
    price_vs_52w_high: Optional[float] = None

    # Insider Activity
    insider_net_shares_90d: int = 0
    insider_buys_90d: int = 0
    insider_sells_90d: int = 0

    # Congress Activity
    congress_net_value_90d: int = 0
    congress_buys_90d: int = 0
    congress_sells_90d: int = 0

    class Config:
        from_attributes = True


class ScreenerResponse(BaseModel):
    """Full response from the screener endpoint."""
    results: List[ScreenerResult]
    total_count: int
    filters_applied: Dict[str, Any]
    cached_at: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED SCREENS
# ═══════════════════════════════════════════════════════════════════════════════

class SavedScreenCreate(BaseModel):
    """Create a new saved screen."""
    name: str = Field(..., min_length=1, max_length=100)
    filters: Dict[str, Any]


class SavedScreenOut(BaseModel):
    """Response shape for a saved screen."""
    id: int
    owner_id: str
    name: str
    filters: Dict[str, Any]
    created_at: datetime
    last_run_at: Optional[datetime] = None
    last_result_count: Optional[int] = None

    class Config:
        from_attributes = True
