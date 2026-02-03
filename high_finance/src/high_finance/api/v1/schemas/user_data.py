"""
User Data Schemas
=================
Pydantic schemas for watchlist and portfolio API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ═══════════════════════════════════════════════════════════════════════════════
# WATCHLIST
# ═══════════════════════════════════════════════════════════════════════════════

class WatchlistItemCreate(BaseModel):
    ticker: str
    name: Optional[str] = None


class WatchlistItemOut(BaseModel):
    id: int
    ticker: str
    name: Optional[str]
    added_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# PORTFOLIO
# ═══════════════════════════════════════════════════════════════════════════════

class PortfolioPositionCreate(BaseModel):
    ticker: str
    name: Optional[str] = None
    shares: float
    avg_cost: float


class PortfolioPositionUpdate(BaseModel):
    shares: Optional[float] = None
    avg_cost: Optional[float] = None


class PortfolioPositionOut(BaseModel):
    id: int
    ticker: str
    name: Optional[str]
    shares: float
    avg_cost: float
    added_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
