from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from ..base import Base

class CommitteeMembership(Base):
    __tablename__ = "committee_memberships"

    id = Column(Integer, primary_key=True, index=True)

    politician_id = Column(Integer, ForeignKey("politicians.id"), index=True, nullable=False)
    committee_id = Column(Integer, ForeignKey("committees.id"), index=True, nullable=False)
    subcommittee_id = Column(Integer, ForeignKey("subcommittees.id"), index=True, nullable=True)

    role = Column(String, nullable=True)  # chair/ranking/member/etc
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    politician = relationship("Politician")
    committee = relationship("Committee", back_populates="memberships")
    subcommittee = relationship("Subcommittee", back_populates="memberships")
