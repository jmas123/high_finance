"""
Investment Memos – SQLAlchemy model
===================================
Stores AI-generated investment memos per user per ticker.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, func
from ..base import Base


class InvestmentMemo(Base):
    __tablename__ = "investment_memos"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(String, index=True, nullable=False)
    ticker        = Column(String, index=True, nullable=False)
    content       = Column(Text, nullable=False)
    model_used    = Column(String, nullable=True)
    input_tokens  = Column(Integer, nullable=True)
    output_tokens  = Column(Integer, nullable=True)
    analysis_type  = Column(String, nullable=False, server_default="memo")
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
