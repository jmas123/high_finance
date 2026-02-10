from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class CompTemplate(BaseModel):
    label: str
    metrics: List[str]


class MetricStats(BaseModel):
    """Full statistics for a single metric across peers."""
    mean: Optional[float] = None
    median: Optional[float] = None
    p25: Optional[float] = None
    p75: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    n: int = 0

class CompanyFundamentals(BaseModel):
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    current_price: Optional[float] = None  # ✅ you return this
    previous_close: Optional[float] = None
    price_change: Optional[float] = None
    price_change_pct: Optional[float] = None  # decide units below

    # ✅ asset type flags (needed for ETF detection in UI)
    quote_type: Optional[str] = None
    is_etf: Optional[bool] = None
    is_mutual_fund: Optional[bool] = None
    is_index: Optional[bool] = None

    # valuation
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    ev_to_sales: Optional[float] = None
    pb_ratio: Optional[float] = None

    # returns / growth / margins
    roe: Optional[float] = None
    revenue_growth: Optional[float] = None
    gross_margins: Optional[float] = None

    # other existing fields you already had
    eps: Optional[float] = None
    dividend_yield: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    fifty_day_avg: Optional[float] = None
    two_hundred_day_avg: Optional[float] = None
    revenue: Optional[float] = None
    profit_margin: Optional[float] = None
    beta: Optional[float] = None
    net_debt_est: Optional[float] = None
    fetched_at: Optional[str] = None

    # ✅ ETF-specific fields (all optional; filled only for ETFs/funds)
    total_assets: Optional[float] = None
    nav_price: Optional[float] = None
    expense_ratio: Optional[float] = None

    # "yield" is a python keyword; keep JSON key as "yield" with alias
    yield_: Optional[float] = Field(default=None, alias="yield")

    ytd_return: Optional[float] = None
    three_year_return: Optional[float] = None
    five_year_return: Optional[float] = None
    category: Optional[str] = None
    fund_family: Optional[str] = None
    holdings_count: Optional[int] = None

    # optional: you currently return this per-company
    comp_template: Optional[CompTemplate] = None

    class Config:
        from_attributes = True
        populate_by_name = True  # ✅ allows yield_ <-> "yield" alias to work

class ComparableAnalysis(BaseModel):
    target: CompanyFundamentals
    peers: List[CompanyFundamentals]

    template: CompTemplate
    averages: Dict[str, Optional[float]]  # Legacy (keep for backwards compat)

    # NEW: Full statistics per metric
    statistics: Dict[str, MetricStats] = {}

    # NEW: Implied price at peer median for each valuation metric
    implied_prices: Dict[str, Optional[float]] = {}

    # Explains why specific implied prices are None
    implied_price_notes: Dict[str, str] = {}

    # Legacy fields
    average_pe: Optional[float] = None
    average_ev_ebitda: Optional[float] = None
