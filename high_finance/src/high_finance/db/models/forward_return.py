from sqlalchemy import Column, Integer, Float, Date, DateTime, String, ForeignKey, func
from sqlalchemy.orm import relationship
from ..base import Base


class ForwardReturn(Base):
    __tablename__ = "forward_returns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True)

    anchor_date = Column(Date, nullable=True)
    anchor_price = Column(Float, nullable=True)
    spy_anchor_price = Column(Float, nullable=True)

    # Stock forward returns (decimal, e.g. 0.05 = +5%)
    ret_7d = Column(Float, nullable=True)
    ret_30d = Column(Float, nullable=True)
    ret_60d = Column(Float, nullable=True)
    ret_90d = Column(Float, nullable=True)
    ret_180d = Column(Float, nullable=True)

    # SPY benchmark returns (same windows)
    spy_ret_7d = Column(Float, nullable=True)
    spy_ret_30d = Column(Float, nullable=True)
    spy_ret_60d = Column(Float, nullable=True)
    spy_ret_90d = Column(Float, nullable=True)
    spy_ret_180d = Column(Float, nullable=True)

    # Metadata
    computed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    is_complete = Column(Integer, nullable=False, server_default="0")
    skip_reason = Column(String(100), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="forward_return")
