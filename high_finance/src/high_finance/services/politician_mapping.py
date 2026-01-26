from typing import Optional
from sqlalchemy.orm import Session
from high_finance.db.models.company import Company
from high_finance.utils.matching import match_entity, normalize_name

def resolve_company_id_from_issuer(db: Session, issuer_raw: str) -> Optional[int]:
    if not issuer_raw:
        return None

    companies = db.query(Company.id, Company.name).all()
    if not companies:
        return None

    # match on normalized names
    name_map = {normalize_name(c.name): c.id for c in companies}
    best = match_entity(normalize_name(issuer_raw), list(name_map.keys()))
    return name_map.get(best) if best else None
