"""
Portfolio Performance Schemas
============================
Pydantic models for portfolio performance API requests and responses.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class PositionInput(BaseModel):
    """A single portfolio position."""
    ticker: str
    shares: float
    avg_cost: float


class PortfolioPerformanceRequest(BaseModel):
    """Request body for portfolio performance endpoint."""
    positions: List[PositionInput]
    benchmarks: List[str] = Field(
        default=["SPY", "QQQ", "GLD", "BTC-USD"],
        description="List of benchmark tickers to compare against"
    )


class BenchmarkPerformance(BaseModel):
    """Performance data for a single benchmark."""
    name: str
    returns: Dict[str, Optional[float]]  # period -> return %
    sparkline: List[float]


class RiskMetrics(BaseModel):
    """Risk-adjusted performance metrics."""
    beta: Optional[float] = None  # Beta vs SPY
    sharpe: Optional[float] = None  # Sharpe ratio (annualized)


class PortfolioPerformanceResponse(BaseModel):
    """Response from portfolio performance endpoint."""
    portfolio: Dict[str, Any]  # {"returns": {...}, "sparkline": [...]}
    benchmarks: Dict[str, BenchmarkPerformance]
    periods: List[str]
    outperformance: Dict[str, float]  # {"vs_SPY": 5.2, ...}
    risk_metrics: Optional[RiskMetrics] = None  # Beta vs SPY, Sharpe ratio
