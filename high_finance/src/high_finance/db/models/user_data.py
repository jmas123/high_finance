"""
User Data Models
================
Watchlist and Portfolio positions linked to authenticated users.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func

from ..base import Base


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker = Column(String(10), nullable=False)
    name = Column(String(255), nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_watchlist_user_ticker", "user_id", "ticker", unique=True),
    )


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker = Column(String(10), nullable=False)
    name = Column(String(255), nullable=True)
    shares = Column(Float, nullable=False)
    avg_cost = Column(Float, nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("idx_portfolio_user_ticker", "user_id", "ticker", unique=True),
    )
