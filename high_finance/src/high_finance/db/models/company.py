from sqlalchemy import Column, String, Integer, Float
from sqlalchemy.orm import relationship
from ..base import Base

class Company(Base):
    __tablename__ = 'companies'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ticker = Column(String, unique=True, index=True)
    sector = Column(String)
    industry = Column(String)
    market_cap = Column(Float)
    description = Column(String)
    sic_code = Column(String(4), nullable=True)

    # Relationships
    prices = relationship("Price", back_populates="company", cascade="all, delete-orphan")
    holdings = relationship("Holding", back_populates="company")  # Fixed: direct relationship to Holding
    leadership = relationship("Person", back_populates="company")