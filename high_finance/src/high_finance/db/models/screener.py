"""
Stock Screener – Database Models
================================
Tables for the screener feature:
- ScreenerUniverse: list of tickers in the screening universe
- ScreenerCache: pre-computed fundamentals/metrics for fast filtering
- SavedScreen: user-saved screen configurations
"""

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime, Numeric, Text,
    ForeignKey, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
from ..base import Base


class ScreenerUniverse(Base):
    """Universe of stocks available for screening."""
    __tablename__ = "screener_universe"

    ticker = Column(String(10), primary_key=True)
    company_name = Column(String(255))
    sector = Column(String(100), index=True)
    industry = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    added_at = Column(DateTime, server_default=func.now())


class ScreenerCache(Base):
    """
    Cached fundamentals and metrics for each ticker.
    Refreshed daily by RQ job; queried by the screener endpoint.
    """
    __tablename__ = "screener_cache"

    ticker = Column(
        String(10),
        ForeignKey("screener_universe.ticker", ondelete="CASCADE"),
        primary_key=True,
    )

    # Size & Price
    market_cap = Column(BigInteger)
    current_price = Column(Numeric(12, 4))
    price_change_1d = Column(Numeric(8, 4))

    # Valuation
    pe_ratio = Column(Numeric(10, 2))
    forward_pe = Column(Numeric(10, 2))
    pb_ratio = Column(Numeric(10, 2))
    ev_to_ebitda = Column(Numeric(10, 2))

    # Growth & Dividend
    revenue_growth = Column(Numeric(8, 4))
    dividend_yield = Column(Numeric(8, 4))

    # Price Technicals
    price_vs_200ma = Column(Numeric(8, 4))
    price_vs_52w_high = Column(Numeric(8, 4))

    # Insider Activity (90-day)
    insider_net_shares_90d = Column(Integer, default=0)
    insider_buys_90d = Column(Integer, default=0)
    insider_sells_90d = Column(Integer, default=0)

    # Congress Activity (90-day)
    congress_net_value_90d = Column(Integer, default=0)
    congress_buys_90d = Column(Integer, default=0)
    congress_sells_90d = Column(Integer, default=0)

    # Cache metadata
    cached_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_screener_cache_market_cap", "market_cap"),
        Index("idx_screener_cache_pe", "pe_ratio", postgresql_where=(pe_ratio.isnot(None))),
        Index("idx_screener_cache_insider", "insider_net_shares_90d",
              postgresql_where=(insider_net_shares_90d != 0)),
        Index("idx_screener_cache_congress", "congress_net_value_90d",
              postgresql_where=(congress_net_value_90d != 0)),
        Index("idx_screener_cache_value_screen", "pe_ratio", "revenue_growth", "market_cap"),
    )


class SavedScreen(Base):
    """User-saved screen configurations."""
    __tablename__ = "saved_screens"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String(100), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    filters = Column(JSONB, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    last_run_at = Column(DateTime, nullable=True)
    last_result_count = Column(Integer, nullable=True)
