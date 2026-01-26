from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..base import Base

class Politician(Base):
    __tablename__ = "politicians"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)

    chamber = Column(String, index=True, nullable=True)
    state = Column(String, index=True, nullable=True)
    district = Column(String, index=True, nullable=True)
    party = Column(String, index=True, nullable=True)

    bioguide_id = Column(String, unique=True, index=True, nullable=True)

    trades = relationship("PoliticianTrade", back_populates="politician", cascade="all, delete-orphan")
