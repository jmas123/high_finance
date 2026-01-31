from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..base import Base

class Committee(Base):
    __tablename__ = "committees"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g. "HSIF"
    name = Column(String, nullable=False)
    chamber = Column(String, index=True, nullable=True)  # house/senate/joint

    memberships = relationship("CommitteeMembership", back_populates="committee", cascade="all, delete-orphan")
    subcommittees = relationship("Subcommittee", back_populates="committee", cascade="all, delete-orphan")
