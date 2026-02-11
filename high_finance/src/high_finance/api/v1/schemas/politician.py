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
    hit_rate: Optional[float] = None  # Win rate as decimal (0-1), e.g. 0.65 = 65%
    avg_return_pct: Optional[float] = None  # Average return percentage

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


# ═══════════════════════════════════════════════════════════════════════════════
# BACKTEST SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class BacktestTradeResultOut(BaseModel):
    ticker: str
    transaction_type: str
    disclosure_date: str
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    return_pct: float
    hold_days_actual: int
    cohort_return_pct: Optional[float] = None


class EquityCurvePointOut(BaseModel):
    date: str
    portfolio_value: float
    spy_value: float


class BacktestSummaryOut(BaseModel):
    politician_id: int
    politician_name: str
    party: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    delay_days: int
    hold_days: int
    num_trades: int
    num_positions: int = 0
    num_cohorts: int = 0
    num_trades_priced: int
    total_return_pct: float
    annualized_return_pct: Optional[float] = None
    win_rate: float
    max_drawdown_pct: float
    sharpe_ratio: Optional[float] = None
    spy_total_return_pct: float
    spy_annualized_return_pct: Optional[float] = None
    alpha_pct: float
    best_trade: Optional[BacktestTradeResultOut] = None
    worst_trade: Optional[BacktestTradeResultOut] = None
    first_trade_date: Optional[str] = None
    last_trade_date: Optional[str] = None
    grade: Optional[str] = None
    skip_reasons: Optional[dict] = None


class BacktestResponseOut(BaseModel):
    summary: BacktestSummaryOut
    equity_curve: List[EquityCurvePointOut]
    trades: List[BacktestTradeResultOut]


class LeaderboardEntryOut(BaseModel):
    politician_id: int
    politician_name: str
    party: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    num_trades_priced: int
    num_cohorts: int = 0
    total_return_pct: float
    avg_return_per_trade_pct: Optional[float] = None
    annualized_return_pct: Optional[float] = None
    win_rate: float
    max_drawdown_pct: float
    alpha_pct: float
    grade: Optional[str] = None
    first_trade_date: Optional[str] = None
    last_trade_date: Optional[str] = None


class LeaderboardResponseOut(BaseModel):
    delay_days: int
    hold_days: int
    entries: List[LeaderboardEntryOut]
    computed_at: str