from httpx import AsyncClient
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from typing import List
from high_finance.clients.sec_edgar import fetch_filings
from high_finance.db.models.company import Company
from high_finance.db.models.investor import Investor
from high_finance.db.models.holding import Holding
from high_finance.db.models.person import Person

async def ingest_filings(cik: str, session: Session) -> None:
    filings = await fetch_filings(cik)
    for filing in filings:
        # Parse filing data
        parsed_data = parse_filing(filing)
        # Save to database
        save_to_db(parsed_data, session)

def parse_filing(filing: str) -> dict:
    soup = BeautifulSoup(filing, 'lxml')
    # Extract relevant data from the filing
    # This is a placeholder for actual parsing logic
    data = {
        "company": extract_company_data(soup),
        "investors": extract_investor_data(soup),
        "leadership": extract_leadership_data(soup),
    }
    return data

def extract_company_data(soup: BeautifulSoup) -> Company:
    # Logic to extract company data from the soup object
    return Company()

def extract_investor_data(soup: BeautifulSoup) -> List[Investor]:
    # Logic to extract investor data from the soup object
    return []

def extract_leadership_data(soup: BeautifulSoup) -> List[Person]:
    # Logic to extract leadership data from the soup object
    return []

def save_to_db(data: dict, session: Session) -> None:
    # Logic to save company, investors, and leadership data to the database
    session.add(data['company'])
    for investor in data['investors']:
        session.add(investor)
    for person in data['leadership']:
        session.add(person)
    session.commit()