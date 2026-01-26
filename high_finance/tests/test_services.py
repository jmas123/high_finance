from fastapi import FastAPI
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from high_finance.db.models.company import Company
from high_finance.db.models.investor import Investor
from high_finance.db.models.person import Person
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.services.edgar import get_institutional_ownership

@pytest.mark.asyncio
async def test_get_company_fundamentals(async_client: AsyncClient, db_session: AsyncSession):
    response = await async_client.get("/api/v1/companies/AAPL/fundamentals")
    assert response.status_code == 200
    data = response.json()
    assert "marketCap" in data
    assert "peRatio" in data

@pytest.mark.asyncio
async def test_get_leadership_info(async_client: AsyncClient, db_session: AsyncSession):
    response = await async_client.get("/api/v1/companies/AAPL/leadership")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

@pytest.mark.asyncio
async def test_get_institutional_ownership(async_client: AsyncClient, db_session: AsyncSession):
    response = await async_client.get("/api/v1/companies/AAPL/ownership")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

@pytest.mark.asyncio
async def test_database_integration(db_session: AsyncSession):
    result = await db_session.execute(select(Company).where(Company.symbol == "AAPL"))
    company = result.scalars().first()
    assert company is not None

    result = await db_session.execute(select(Investor).where(Investor.name == "Vanguard Group"))
    investor = result.scalars().first()
    assert investor is not None

    result = await db_session.execute(select(Person).where(Person.name == "Tim Cook"))
    person = result.scalars().first()
    assert person is not None