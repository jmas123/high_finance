from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from ..base import Base

class Holding(Base):
    __tablename__ = 'holdings'

    id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey('investors.id'), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    shares = Column(Integer, nullable=False)
    value = Column(Integer, nullable=False)

    investor = relationship("Investor", back_populates="holdings")
    company = relationship("Company", back_populates="holdings")