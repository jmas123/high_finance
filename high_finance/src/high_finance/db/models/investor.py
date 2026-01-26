from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from ..base import Base

class Investor(Base):
    __tablename__ = 'investors'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cik = Column(String, unique=True, index=True)
    ownership_percentage = Column(String)
    
    holdings = relationship("Holding", back_populates="investor")