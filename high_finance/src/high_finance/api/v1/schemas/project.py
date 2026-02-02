"""
Research Projects – Pydantic schemas
====================================
Request and response models for the Projects REST API.
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# THESIS BULLETS
# ═══════════════════════════════════════════════════════════════════════════════

class ThesisBulletCreate(BaseModel):
    text: str
    sort_order: int = 0

class ThesisBulletUpdate(BaseModel):
    text: Optional[str] = None
    sort_order: Optional[int] = None

class ThesisBulletOut(BaseModel):
    id: int
    text: str
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# CATALYSTS
# ═══════════════════════════════════════════════════════════════════════════════

class CatalystCreate(BaseModel):
    title: str
    description: Optional[str] = None
    expected_date: Optional[datetime] = None

class CatalystUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    expected_date: Optional[datetime] = None
    status: Optional[str] = None           # pending | occurred | missed
    outcome_notes: Optional[str] = None

class CatalystOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    expected_date: Optional[datetime]
    status: str
    outcome_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# RISKS
# ═══════════════════════════════════════════════════════════════════════════════

class RiskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"               # low | medium | high

class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None           # active | mitigated | realized

class RiskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    severity: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# PEERS
# ═══════════════════════════════════════════════════════════════════════════════

class PeerCreate(BaseModel):
    ticker: str
    company_name: Optional[str] = None

class PeerOut(BaseModel):
    id: int
    ticker: str
    company_name: Optional[str]
    added_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# DCF SNAPSHOTS
# ═══════════════════════════════════════════════════════════════════════════════

class DCFSnapshotCreate(BaseModel):
    label: Optional[str] = None
    growth: float
    margin: float
    tax: float
    wacc: float
    terminal_g: float
    fair_value_per_share: Optional[float] = None
    enterprise_value: Optional[float] = None
    current_price: Optional[float] = None
    notes: Optional[str] = None

class DCFSnapshotOut(BaseModel):
    id: int
    version: int
    label: Optional[str]
    growth: float
    margin: float
    tax: float
    wacc: float
    terminal_g: float
    fair_value_per_share: Optional[float]
    enterprise_value: Optional[float]
    current_price: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

class SourceCreate(BaseModel):
    source_type: str                       # filing | earnings_call | news | note | other
    title: str
    url: Optional[str] = None
    notes: Optional[str] = None

class SourceOut(BaseModel):
    id: int
    source_type: str
    title: str
    url: Optional[str]
    notes: Optional[str]
    linked_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT (top-level)
# ═══════════════════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    ticker: str
    title: str
    summary: Optional[str] = None
    conviction: Optional[str] = None       # high | medium | low
    position_type: Optional[str] = None    # long | short | watching

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None           # active | archived | closed
    conviction: Optional[str] = None
    position_type: Optional[str] = None

class ProjectSummaryOut(BaseModel):
    """Lightweight shape for list views."""
    id: int
    ticker: str
    title: str
    status: str
    conviction: Optional[str]
    position_type: Optional[str]
    created_at: datetime
    updated_at: datetime
    thesis_count: int = 0
    catalyst_count: int = 0
    risk_count: int = 0
    latest_fair_value: Optional[float] = None

class ProjectDetailOut(BaseModel):
    """Full shape with all child collections."""
    id: int
    ticker: str
    title: str
    summary: Optional[str]
    status: str
    conviction: Optional[str]
    position_type: Optional[str]
    created_at: datetime
    updated_at: datetime

    thesis_bullets: List[ThesisBulletOut] = []
    catalysts: List[CatalystOut] = []
    risks: List[RiskOut] = []
    peers: List[PeerOut] = []
    dcf_snapshots: List[DCFSnapshotOut] = []
    sources: List[SourceOut] = []

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# REORDER
# ═══════════════════════════════════════════════════════════════════════════════

class ReorderRequest(BaseModel):
    """List of IDs in desired order."""
    ordered_ids: List[int]