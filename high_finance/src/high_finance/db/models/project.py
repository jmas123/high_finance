"""
Research Projects – SQLAlchemy models
=====================================
Each Project is a dedicated workspace for a single investment idea.

Tables
------
projects                – core container (ticker, title, status, conviction)
project_thesis_bullets  – ordered rationale bullets
project_catalysts       – dated events that could drive outcome
project_risks           – risks / disconfirming evidence
project_peers           – locked peer set for consistent comps
project_dcf_snapshots   – versioned DCF model inputs + outputs
project_sources         – linked filings, earnings calls, news
"""

from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from ..base import Base


# ── Project ──────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id            = Column(Integer, primary_key=True, index=True)
    owner_id      = Column(String, index=True, nullable=True)    # User ID who owns this project
    ticker        = Column(String, index=True, nullable=False)
    company_id    = Column(Integer, ForeignKey("companies.id"), nullable=True)
    title         = Column(String, nullable=False)               # e.g. "AAPL – AI Hardware Cycle"
    summary       = Column(Text, nullable=True)                  # optional one-paragraph summary
    status        = Column(String, default="active")             # active | archived | closed
    conviction    = Column(String, nullable=True)                # high | medium | low
    position_type = Column(String, nullable=True)                # long | short | watching
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    company        = relationship("Company", lazy="joined")
    thesis_bullets = relationship(
        "ProjectThesisBullet", back_populates="project",
        cascade="all, delete-orphan", order_by="ProjectThesisBullet.sort_order",
    )
    catalysts = relationship(
        "ProjectCatalyst", back_populates="project",
        cascade="all, delete-orphan", order_by="ProjectCatalyst.expected_date",
    )
    risks = relationship(
        "ProjectRisk", back_populates="project",
        cascade="all, delete-orphan",
    )
    peers = relationship(
        "ProjectPeer", back_populates="project",
        cascade="all, delete-orphan",
    )
    dcf_snapshots = relationship(
        "ProjectDCFSnapshot", back_populates="project",
        cascade="all, delete-orphan", order_by="ProjectDCFSnapshot.version.desc()",
    )
    sources = relationship(
        "ProjectSource", back_populates="project",
        cascade="all, delete-orphan", order_by="ProjectSource.linked_at.desc()",
    )


# ── Thesis Bullets ───────────────────────────────────────────────────────────

class ProjectThesisBullet(Base):
    __tablename__ = "project_thesis_bullets"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    text       = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="thesis_bullets")


# ── Catalysts ────────────────────────────────────────────────────────────────

class ProjectCatalyst(Base):
    __tablename__ = "project_catalysts"

    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String, nullable=False)
    description   = Column(Text, nullable=True)
    expected_date = Column(DateTime(timezone=True), nullable=True)     # when it's expected
    status        = Column(String, default="pending")                  # pending | occurred | missed
    outcome_notes = Column(Text, nullable=True)                        # what actually happened
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="catalysts")


# ── Risks ────────────────────────────────────────────────────────────────────

class ProjectRisk(Base):
    __tablename__ = "project_risks"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title      = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity   = Column(String, default="medium")                     # low | medium | high
    status     = Column(String, default="active")                     # active | mitigated | realized
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="risks")


# ── Locked Peer Set ──────────────────────────────────────────────────────────

class ProjectPeer(Base):
    __tablename__ = "project_peers"

    id           = Column(Integer, primary_key=True, index=True)
    project_id   = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker       = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    added_at     = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="peers")


# ── Versioned DCF Snapshots ──────────────────────────────────────────────────

class ProjectDCFSnapshot(Base):
    __tablename__ = "project_dcf_snapshots"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    version    = Column(Integer, nullable=False)                      # 1, 2, 3 …
    label      = Column(String, nullable=True)                        # optional user label

    # Inputs (mirror ValuationScenarioInputs)
    growth     = Column(Float, nullable=False)
    margin     = Column(Float, nullable=False)
    tax        = Column(Float, nullable=False)
    wacc       = Column(Float, nullable=False)
    terminal_g = Column(Float, nullable=False)

    # Snapshot of computed outputs
    fair_value_per_share = Column(Float, nullable=True)
    enterprise_value     = Column(Float, nullable=True)
    current_price        = Column(Float, nullable=True)              # price at time of snapshot

    notes      = Column(Text, nullable=True)                         # "Updated post Q1 beat"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="dcf_snapshots")


# ── Linked Sources ───────────────────────────────────────────────────────────

class ProjectSource(Base):
    __tablename__ = "project_sources"

    id          = Column(Integer, primary_key=True, index=True)
    project_id  = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String, nullable=False)                     # filing | earnings_call | news | note | other
    title       = Column(String, nullable=False)
    url         = Column(String, nullable=True)
    notes       = Column(Text, nullable=True)
    linked_at   = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="sources")