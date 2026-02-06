from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..base import Base


class PrivateCompany(Base):
    __tablename__ = 'private_companies'

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sector = Column(String(100), nullable=True)
    founded_year = Column(Integer, nullable=True)
    hq_location = Column(String(200), nullable=True)
    website = Column(String(500), nullable=True)
    latest_valuation = Column(Float, nullable=True)
    valuation_date = Column(String(50), nullable=True)
    status = Column(String(20), server_default='private', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    investors = relationship(
        "PrivateCompanyInvestor",
        back_populates="private_company",
        cascade="all, delete-orphan",
    )


class PrivateCompanyInvestor(Base):
    __tablename__ = 'private_company_investors'
    __table_args__ = (
        UniqueConstraint('private_company_id', 'investor_name',
                         name='uq_private_company_investor'),
    )

    id = Column(Integer, primary_key=True, index=True)
    private_company_id = Column(
        Integer,
        ForeignKey('private_companies.id', ondelete='CASCADE'),
        nullable=False,
    )
    investor_name = Column(String(200), nullable=False)
    investor_type = Column(String(50), nullable=False)
    public_ticker = Column(String(10), nullable=True, index=True)
    round_or_context = Column(String(200), nullable=True)
    investment_amount = Column(Float, nullable=True)
    investment_date = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    private_company = relationship("PrivateCompany", back_populates="investors")
