"""
Chart Drawing Model
===================
Stores user chart annotations (trend lines, fib retracements, etc.) per ticker.
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from ..base import Base


class ChartDrawing(Base):
    __tablename__ = "chart_drawings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String(10), nullable=False)
    drawing_type = Column(String(50), nullable=False)

    # Core data (JSONB for flexibility)
    points = Column(JSONB, nullable=False)  # [{time: unix, price: number}, ...]
    style = Column(JSONB, nullable=False)   # {color, lineWidth, lineStyle, ...}
    text_content = Column(Text, nullable=True)  # For text annotations

    # State flags
    is_visible = Column(Boolean, server_default="true", nullable=False)
    is_locked = Column(Boolean, server_default="false", nullable=False)
    layer_order = Column(Integer, server_default="0", nullable=False)

    # Optimistic concurrency control
    version = Column(Integer, server_default="1", nullable=False)

    # Soft delete support
    is_deleted = Column(Boolean, server_default="false", nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_chart_drawings_user_ticker", "user_id", "ticker"),
    )
