from pydantic import BaseModel
from typing import Optional, List, Dict

class CompTemplate(BaseModel):
    label: str
    metrics: List[str]

class CompanyFundamentals(BaseModel):
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None

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

    # optional: you currently return this per-company
    comp_template: Optional[CompTemplate] = None

    class Config:
        from_attributes = True

class ComparableAnalysis(BaseModel):
    target: CompanyFundamentals
    peers: List[CompanyFundamentals]

    # ✅ new fields that your service returns
    template: CompTemplate
    averages: Dict[str, Optional[float]]

    # ✅ keep legacy fields OPTIONAL so nothing else breaks
    average_pe: Optional[float] = None
    average_ev_ebitda: Optional[float] = None
