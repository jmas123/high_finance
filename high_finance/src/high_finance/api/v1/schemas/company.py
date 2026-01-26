from pydantic import BaseModel
from typing import Optional, List

class CompanyFundamentals(BaseModel):
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    # NEW METRICS FOR COMPS
    ev_to_ebitda: Optional[float] = None
    revenue_growth: Optional[float] = None  # YoY Growth
    
    eps: Optional[float] = None
    dividend_yield: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    fifty_day_avg: Optional[float] = None
    two_hundred_day_avg: Optional[float] = None
    revenue: Optional[float] = None
    profit_margin: Optional[float] = None
    beta: Optional[float] = None

    class Config:
        from_attributes = True

# New Schema for the Comps Response
class ComparableAnalysis(BaseModel):
    target: CompanyFundamentals
    peers: List[CompanyFundamentals]
    average_pe: Optional[float]
    average_ev_ebitda: Optional[float]