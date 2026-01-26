from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float
from sqlalchemy.orm import relationship
from ..base import Base

class PoliticianTrade(Base):
    __tablename__ = "politician_trades"

    id = Column(Integer, primary_key=True, index=True)

    politician_id = Column(Integer, ForeignKey("politicians.id"), index=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=True)

    issuer_raw = Column(String, index=True, nullable=True)
    ticker_raw = Column(String, index=True, nullable=True)

    transaction_date = Column(Date, index=True, nullable=True)
    disclosure_date = Column(Date, index=True, nullable=False)

    transaction_type = Column(String, index=True, nullable=True)
    amount_min = Column(Float, nullable=True)
    amount_max = Column(Float, nullable=True)

    source_url = Column(String, nullable=True)

    politician = relationship("Politician", back_populates="trades")
    company = relationship("Company")
