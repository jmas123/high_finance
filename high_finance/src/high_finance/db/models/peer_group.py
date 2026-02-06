"""
Peer Group Model
================
User-scoped peer groups for comparable analysis.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..base import Base


class PeerGroup(Base):
    __tablename__ = "peer_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker = Column(String(10), nullable=True)  # NULL = user-level group, not ticker-specific
    name = Column(String(100), nullable=False)
    peer_tickers = Column(ARRAY(String(10)), nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship back to User
    user = relationship("User", backref="peer_groups")
