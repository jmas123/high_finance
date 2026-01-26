from sqlalchemy.orm import Session
from high_finance.db.models.company import Company
from high_finance.services.fundamentals import fetch_and_update_fundamentals
from rq import job

@job
def refresh_fundamentals(company_id: int, db: Session):
    company = db.query(Company).filter(Company.id == company_id).first()
    if company:
        fetch_and_update_fundamentals(company)
        return {"status": "success", "company_id": company_id}
    return {"status": "error", "message": "Company not found"}