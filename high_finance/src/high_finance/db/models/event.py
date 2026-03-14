from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..base import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(50), nullable=False, index=True)
    source_system = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=False)
    ticker = Column(String(50), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    event_date = Column(Date, nullable=False, index=True)
    event_date_type = Column(String(30), nullable=False)
    actor_type = Column(String(30), nullable=False)
    actor_id = Column(Integer, nullable=False, index=True)
    actor_name = Column(String(200), nullable=False)
    direction = Column(String(10), nullable=False)
    amount_min = Column(Float, nullable=True)
    amount_max = Column(Float, nullable=True)
    meta = Column(JSONB, nullable=True)

    # Relationships
    forward_return = relationship("ForwardReturn", back_populates="event", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source_system", "source_id", "event_date_type", name="uq_event_source_system"),
        Index("ix_events_type_ticker_date", "event_type", "ticker", "event_date"),
        Index("ix_events_actor", "actor_type", "actor_id"),
    )
