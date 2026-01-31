from pydantic import BaseModel
from datetime import date

from typing import List, Optional, Literal



class PoliticianOut(BaseModel):
    id: int
    name: str
    chamber: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    party: Optional[str] = None

    class Config:
        from_attributes = True

class PoliticianTradeOut(BaseModel):
    id: int
    politician_id: int
    politician: Optional[PoliticianOut] = None
    company_id: Optional[int] = None
    issuer_raw: Optional[str] = None
    ticker_raw: Optional[str] = None
    transaction_date: Optional[date] = None
    disclosure_date: date
    transaction_type: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    source_url: Optional[str] = None

    class Config:
        from_attributes = True

class PoliticianTradeWithPoliticianOut(BaseModel):
    trade: PoliticianTradeOut
    politician: PoliticianOut

    class Config:
        from_attributes = True






class TradeContextReasonOut(BaseModel):
    type: str
    title: str
    detail: str

class TradeContextOut(BaseModel):
    relevance_score: float
    relevance_label: str
    reasons: List[TradeContextReasonOut] = []

class CongressTradeNotificationOut(BaseModel):
    trade: PoliticianTradeOut
    politician: PoliticianOut
    context: TradeContextOut

    class Config:
        from_attributes = True

class PoliticianTradeWithContextOut(BaseModel):
    trade: PoliticianTradeOut
    politician: PoliticianOut
    context: TradeContextOut

    class Config:
        from_attributes = True


class PoliticianPerformanceOut(BaseModel):
    window_days: int
    n: int
    num_used: int
    avg_return_pct: Optional[float] = None
    hit_rate: Optional[float] = None