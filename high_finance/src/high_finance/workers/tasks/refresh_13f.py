from sqlalchemy.orm import Session
from high_finance.db.models import Investor
from high_finance.services.edgar import fetch_13f_data
from high_finance.utils.parsing import parse_13f_data

def refresh_13f_data(db: Session):
    """
    Task to refresh 13F ownership data for public companies.
    This function fetches the latest 13F data from the SEC EDGAR API,
    parses it, and updates the database with the new ownership information.
    """
    # Fetch the latest 13F data
    raw_data = fetch_13f_data()
    
    # Parse the fetched data
    parsed_data = parse_13f_data(raw_data)
    
    # Update the database with the parsed data
    for investor_data in parsed_data:
        investor = Investor(**investor_data)
        db.merge(investor)
    
    db.commit()