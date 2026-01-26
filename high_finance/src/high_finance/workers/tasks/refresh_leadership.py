from sqlalchemy.orm import Session
from high_finance.db.models.person import Person
from high_finance.services.people import fetch_leadership_data
from rq import job

@job
def refresh_leadership(company_id: str, db: Session):
    """
    Task to refresh leadership data for a given company.
    
    Args:
        company_id (str): The ID of the company to refresh leadership data for.
        db (Session): The database session to use for database operations.
    """
    # Fetch the latest leadership data from the external source
    leadership_data = fetch_leadership_data(company_id)
    
    # Update the database with the new leadership data
    for person_data in leadership_data:
        person = db.query(Person).filter(Person.id == person_data['id']).first()
        if person:
            for key, value in person_data.items():
                setattr(person, key, value)
        else:
            new_person = Person(**person_data)
            db.add(new_person)
    
    db.commit()