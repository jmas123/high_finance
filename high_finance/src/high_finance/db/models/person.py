from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..base import Base

class Person(Base):
    __tablename__ = 'persons'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    title = Column(String)
    company_id = Column(Integer, ForeignKey('companies.id'))  # Added ForeignKey
    biography = Column(String)

    company = relationship("Company", back_populates="leadership")  # Added relationship

    def __repr__(self):
        return f"<Person(id={self.id}, name={self.name}, title={self.title})>"