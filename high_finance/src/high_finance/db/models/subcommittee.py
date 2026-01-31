from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..base import Base

class Subcommittee(Base):
    __tablename__ = "subcommittees"

    id = Column(Integer, primary_key=True, index=True)
    committee_id = Column(Integer, ForeignKey("committees.id"), index=True, nullable=False)

    code = Column(String, index=True, nullable=False)  # e.g. "HSIF14"
    name = Column(String, nullable=False)

    committee = relationship("Committee", back_populates="subcommittees")
    memberships = relationship("CommitteeMembership", back_populates="subcommittee", cascade="all, delete-orphan")
