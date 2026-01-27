from sqlalchemy import Column, String, BigInteger, Text
from high_finance.db.base import Base

class NewsCache(Base):
    __tablename__ = "news_cache"

    ticker = Column(String, primary_key=True, index=True)
    as_of_epoch = Column(BigInteger, nullable=False)
    payload_json = Column(Text, nullable=False)
