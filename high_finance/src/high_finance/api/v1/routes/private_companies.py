"""
Private Companies – API Routes
===============================
Browse private companies and their public investors (IPO exposure tracker).

Endpoints:
    GET    /                        - List all private companies
    GET    /{slug}                  - Get a private company profile with investors
    POST   /                        - Create a private company (auth required)
    POST   /{slug}/investors        - Add an investor to a company (auth required)
    DELETE /{slug}/investors/{id}   - Remove an investor (auth required)
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from high_finance.db.session import get_db
from high_finance.core.security import get_current_user, User
from high_finance.db.models.private_company import PrivateCompany, PrivateCompanyInvestor

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class InvestorCreate(BaseModel):
    investor_name: str = Field(..., max_length=200)
    investor_type: str = Field(..., pattern="^(corporate|vc|pe|sovereign|individual)$")
    public_ticker: Optional[str] = Field(None, max_length=10)
    round_or_context: Optional[str] = Field(None, max_length=200)
    investment_amount: Optional[float] = None
    investment_date: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class InvestorResponse(BaseModel):
    id: int
    investor_name: str
    investor_type: str
    public_ticker: Optional[str]
    round_or_context: Optional[str]
    investment_amount: Optional[float]
    investment_date: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class PrivateCompanyCreate(BaseModel):
    slug: str = Field(..., max_length=100, pattern="^[a-z0-9_-]+$")
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    sector: Optional[str] = Field(None, max_length=100)
    founded_year: Optional[int] = None
    hq_location: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    latest_valuation: Optional[float] = None
    valuation_date: Optional[str] = Field(None, max_length=50)
    status: str = Field("private", pattern="^(private|pre_ipo|filed_s1)$")


class PrivateCompanyProfileResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str]
    sector: Optional[str]
    founded_year: Optional[int]
    hq_location: Optional[str]
    website: Optional[str]
    latest_valuation: Optional[float]
    valuation_date: Optional[str]
    status: str
    investors: List[InvestorResponse]

    class Config:
        from_attributes = True


class PrivateCompanySummaryResponse(BaseModel):
    slug: str
    name: str
    sector: Optional[str]
    status: str
    latest_valuation: Optional[float]
    investor_count: int
    public_investor_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PrivateCompanySummaryResponse])
async def list_private_companies(
    status_filter: Optional[str] = Query(None, alias="status"),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all private companies with investor counts."""
    query = db.query(PrivateCompany).options(joinedload(PrivateCompany.investors))

    if status_filter:
        query = query.filter(PrivateCompany.status == status_filter)
    if sector:
        query = query.filter(PrivateCompany.sector == sector)

    companies = query.order_by(PrivateCompany.name).all()

    results = []
    for c in companies:
        investors = c.investors or []
        results.append(PrivateCompanySummaryResponse(
            slug=c.slug,
            name=c.name,
            sector=c.sector,
            status=c.status,
            latest_valuation=c.latest_valuation,
            investor_count=len(investors),
            public_investor_count=sum(1 for i in investors if i.public_ticker),
        ))
    return results


@router.get("/{slug}", response_model=PrivateCompanyProfileResponse)
async def get_private_company(
    slug: str,
    db: Session = Depends(get_db),
):
    """Get a private company profile with its investors."""
    company = (
        db.query(PrivateCompany)
        .options(joinedload(PrivateCompany.investors))
        .filter(PrivateCompany.slug == slug)
        .first()
    )

    if not company:
        raise HTTPException(status_code=404, detail="Private company not found")

    return PrivateCompanyProfileResponse(
        id=company.id,
        slug=company.slug,
        name=company.name,
        description=company.description,
        sector=company.sector,
        founded_year=company.founded_year,
        hq_location=company.hq_location,
        website=company.website,
        latest_valuation=company.latest_valuation,
        valuation_date=company.valuation_date,
        status=company.status,
        investors=[InvestorResponse.model_validate(i) for i in company.investors],
    )


@router.post("", response_model=PrivateCompanyProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_private_company(
    data: PrivateCompanyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new private company (auth required)."""
    company = PrivateCompany(
        slug=data.slug,
        name=data.name,
        description=data.description,
        sector=data.sector,
        founded_year=data.founded_year,
        hq_location=data.hq_location,
        website=data.website,
        latest_valuation=data.latest_valuation,
        valuation_date=data.valuation_date,
        status=data.status,
    )

    try:
        db.add(company)
        db.commit()
        db.refresh(company)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A private company with slug '{data.slug}' already exists",
        )

    return PrivateCompanyProfileResponse(
        id=company.id,
        slug=company.slug,
        name=company.name,
        description=company.description,
        sector=company.sector,
        founded_year=company.founded_year,
        hq_location=company.hq_location,
        website=company.website,
        latest_valuation=company.latest_valuation,
        valuation_date=company.valuation_date,
        status=company.status,
        investors=[],
    )


@router.post("/{slug}/investors", response_model=InvestorResponse, status_code=status.HTTP_201_CREATED)
async def add_investor(
    slug: str,
    data: InvestorCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an investor to a private company (auth required)."""
    company = db.query(PrivateCompany).filter(PrivateCompany.slug == slug).first()
    if not company:
        raise HTTPException(status_code=404, detail="Private company not found")

    investor = PrivateCompanyInvestor(
        private_company_id=company.id,
        investor_name=data.investor_name,
        investor_type=data.investor_type,
        public_ticker=data.public_ticker,
        round_or_context=data.round_or_context,
        investment_amount=data.investment_amount,
        investment_date=data.investment_date,
        notes=data.notes,
    )

    try:
        db.add(investor)
        db.commit()
        db.refresh(investor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Investor '{data.investor_name}' already exists for this company",
        )

    return InvestorResponse.model_validate(investor)


@router.delete("/{slug}/investors/{investor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_investor(
    slug: str,
    investor_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an investor from a private company (auth required)."""
    company = db.query(PrivateCompany).filter(PrivateCompany.slug == slug).first()
    if not company:
        raise HTTPException(status_code=404, detail="Private company not found")

    investor = (
        db.query(PrivateCompanyInvestor)
        .filter(
            PrivateCompanyInvestor.id == investor_id,
            PrivateCompanyInvestor.private_company_id == company.id,
        )
        .first()
    )
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    db.delete(investor)
    db.commit()
    return None
