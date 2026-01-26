from pydantic import BaseModel
from typing import Optional

class Person(BaseModel):
    id: Optional[int] = None
    name: str
    title: str
    company_id: int
    biography: Optional[str] = None
    twitter_handle: Optional[str] = None
    linkedin_profile: Optional[str] = None

    class Config:
      from_attributes = True
