from pydantic import BaseModel
from typing import List, Optional

class Investor(BaseModel):
    name: str
    cik: str
    ownership_percentage: Optional[float] = None
    total_shares: Optional[int] = None

class InvestorResponse(BaseModel):
    investors: List[Investor]