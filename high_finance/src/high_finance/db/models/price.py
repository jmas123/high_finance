from sqlalchemy import BigInteger, Column, Float, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..base import Base

class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ Add this FK so ORM can join prices -> company
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=False)

    # you can keep symbol if useful for debugging/backfills
    symbol = Column(String, index=True)

    date = Column(String, index=True)  # ideally Date, but leave for now if you want
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(BigInteger)

    company = relationship("Company", back_populates="prices")
