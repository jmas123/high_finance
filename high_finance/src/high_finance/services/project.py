"""
Research Projects – Service layer
=================================
Business logic for project CRUD.  Mirrors the pattern in services/news.py
(async functions, accept db: Session).
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func as sqla_func

from high_finance.db.models.project import (
    Project,
    ProjectThesisBullet,
    ProjectCatalyst,
    ProjectRisk,
    ProjectPeer,
    ProjectDCFSnapshot,
    ProjectSource,
)
from high_finance.db.models.company import Company


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_company(db: Session, ticker: str) -> Optional[int]:
    """Return company_id if the ticker exists in our companies table."""
    row = db.query(Company.id).filter(Company.ticker == ticker.upper()).first()
    return row[0] if row else None


def _project_summary_dict(p: Project) -> dict:
    """Build the lightweight summary shape for list endpoints."""
    latest_fv = None
    if p.dcf_snapshots:
        # relationship is ordered desc by version, so first = latest
        latest_fv = p.dcf_snapshots[0].fair_value_per_share

    return {
        "id": p.id,
        "ticker": p.ticker,
        "title": p.title,
        "status": p.status,
        "conviction": p.conviction,
        "position_type": p.position_type,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "thesis_count": len(p.thesis_bullets),
        "catalyst_count": len(p.catalysts),
        "risk_count": len(p.risks),
        "latest_fair_value": latest_fv,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT CRUD
# ═══════════════════════════════════════════════════════════════════════════════

async def list_projects(
    db: Session,
    status: Optional[str] = None,
    ticker: Optional[str] = None,
) -> List[dict]:
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    if ticker:
        q = q.filter(Project.ticker == ticker.upper())
    q = q.order_by(Project.updated_at.desc())
    return [_project_summary_dict(p) for p in q.all()]


async def get_project(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


async def create_project(db: Session, ticker: str, title: str, **kwargs) -> Project:
    ticker = ticker.upper()
    company_id = _resolve_company(db, ticker)
    p = Project(
        ticker=ticker,
        company_id=company_id,
        title=title,
        summary=kwargs.get("summary"),
        conviction=kwargs.get("conviction"),
        position_type=kwargs.get("position_type"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


async def update_project(db: Session, project_id: int, **kwargs) -> Optional[Project]:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        return None
    for key in ("title", "summary", "status", "conviction", "position_type"):
        val = kwargs.get(key)
        if val is not None:
            setattr(p, key, val)
    db.commit()
    db.refresh(p)
    return p


async def delete_project(db: Session, project_id: int) -> bool:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# THESIS BULLETS
# ═══════════════════════════════════════════════════════════════════════════════

async def add_thesis_bullet(db: Session, project_id: int, text: str, sort_order: int = 0) -> ProjectThesisBullet:
    bullet = ProjectThesisBullet(project_id=project_id, text=text, sort_order=sort_order)
    db.add(bullet)
    db.commit()
    db.refresh(bullet)
    return bullet


async def update_thesis_bullet(db: Session, bullet_id: int, **kwargs) -> Optional[ProjectThesisBullet]:
    b = db.query(ProjectThesisBullet).filter(ProjectThesisBullet.id == bullet_id).first()
    if not b:
        return None
    if "text" in kwargs and kwargs["text"] is not None:
        b.text = kwargs["text"]
    if "sort_order" in kwargs and kwargs["sort_order"] is not None:
        b.sort_order = kwargs["sort_order"]
    db.commit()
    db.refresh(b)
    return b


async def delete_thesis_bullet(db: Session, bullet_id: int) -> bool:
    b = db.query(ProjectThesisBullet).filter(ProjectThesisBullet.id == bullet_id).first()
    if not b:
        return False
    db.delete(b)
    db.commit()
    return True


async def reorder_thesis_bullets(db: Session, project_id: int, ordered_ids: List[int]) -> List[ProjectThesisBullet]:
    bullets = (
        db.query(ProjectThesisBullet)
        .filter(ProjectThesisBullet.project_id == project_id)
        .all()
    )
    id_to_bullet = {b.id: b for b in bullets}
    for idx, bid in enumerate(ordered_ids):
        if bid in id_to_bullet:
            id_to_bullet[bid].sort_order = idx
    db.commit()
    return sorted(bullets, key=lambda b: b.sort_order)


# ═══════════════════════════════════════════════════════════════════════════════
# CATALYSTS
# ═══════════════════════════════════════════════════════════════════════════════

async def add_catalyst(db: Session, project_id: int, title: str, **kwargs) -> ProjectCatalyst:
    cat = ProjectCatalyst(
        project_id=project_id,
        title=title,
        description=kwargs.get("description"),
        expected_date=kwargs.get("expected_date"),
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


async def update_catalyst(db: Session, catalyst_id: int, **kwargs) -> Optional[ProjectCatalyst]:
    c = db.query(ProjectCatalyst).filter(ProjectCatalyst.id == catalyst_id).first()
    if not c:
        return None
    for key in ("title", "description", "expected_date", "status", "outcome_notes"):
        val = kwargs.get(key)
        if val is not None:
            setattr(c, key, val)
    db.commit()
    db.refresh(c)
    return c


async def delete_catalyst(db: Session, catalyst_id: int) -> bool:
    c = db.query(ProjectCatalyst).filter(ProjectCatalyst.id == catalyst_id).first()
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# RISKS
# ═══════════════════════════════════════════════════════════════════════════════

async def add_risk(db: Session, project_id: int, title: str, **kwargs) -> ProjectRisk:
    r = ProjectRisk(
        project_id=project_id,
        title=title,
        description=kwargs.get("description"),
        severity=kwargs.get("severity", "medium"),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


async def update_risk(db: Session, risk_id: int, **kwargs) -> Optional[ProjectRisk]:
    r = db.query(ProjectRisk).filter(ProjectRisk.id == risk_id).first()
    if not r:
        return None
    for key in ("title", "description", "severity", "status"):
        val = kwargs.get(key)
        if val is not None:
            setattr(r, key, val)
    db.commit()
    db.refresh(r)
    return r


async def delete_risk(db: Session, risk_id: int) -> bool:
    r = db.query(ProjectRisk).filter(ProjectRisk.id == risk_id).first()
    if not r:
        return False
    db.delete(r)
    db.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# PEERS
# ═══════════════════════════════════════════════════════════════════════════════

async def add_peer(db: Session, project_id: int, ticker: str, company_name: Optional[str] = None) -> ProjectPeer:
    peer = ProjectPeer(
        project_id=project_id,
        ticker=ticker.upper(),
        company_name=company_name,
    )
    db.add(peer)
    db.commit()
    db.refresh(peer)
    return peer


async def remove_peer(db: Session, peer_id: int) -> bool:
    p = db.query(ProjectPeer).filter(ProjectPeer.id == peer_id).first()
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True


async def get_peer_tickers(db: Session, project_id: int) -> List[str]:
    rows = (
        db.query(ProjectPeer.ticker)
        .filter(ProjectPeer.project_id == project_id)
        .all()
    )
    return [r[0] for r in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# DCF SNAPSHOTS
# ═══════════════════════════════════════════════════════════════════════════════

async def save_dcf_snapshot(db: Session, project_id: int, **kwargs) -> ProjectDCFSnapshot:
    # Auto-increment version
    max_v = (
        db.query(sqla_func.max(ProjectDCFSnapshot.version))
        .filter(ProjectDCFSnapshot.project_id == project_id)
        .scalar()
    ) or 0

    snap = ProjectDCFSnapshot(
        project_id=project_id,
        version=max_v + 1,
        label=kwargs.get("label"),
        growth=kwargs["growth"],
        margin=kwargs["margin"],
        tax=kwargs["tax"],
        wacc=kwargs["wacc"],
        terminal_g=kwargs["terminal_g"],
        fair_value_per_share=kwargs.get("fair_value_per_share"),
        enterprise_value=kwargs.get("enterprise_value"),
        current_price=kwargs.get("current_price"),
        notes=kwargs.get("notes"),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


async def list_dcf_snapshots(db: Session, project_id: int) -> List[ProjectDCFSnapshot]:
    return (
        db.query(ProjectDCFSnapshot)
        .filter(ProjectDCFSnapshot.project_id == project_id)
        .order_by(ProjectDCFSnapshot.version.desc())
        .all()
    )


async def get_dcf_snapshot(db: Session, snapshot_id: int) -> Optional[ProjectDCFSnapshot]:
    return db.query(ProjectDCFSnapshot).filter(ProjectDCFSnapshot.id == snapshot_id).first()


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

async def add_source(db: Session, project_id: int, source_type: str, title: str, **kwargs) -> ProjectSource:
    s = ProjectSource(
        project_id=project_id,
        source_type=source_type,
        title=title,
        url=kwargs.get("url"),
        notes=kwargs.get("notes"),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


async def delete_source(db: Session, source_id: int) -> bool:
    s = db.query(ProjectSource).filter(ProjectSource.id == source_id).first()
    if not s:
        return False
    db.delete(s)
    db.commit()
    return True

async def delete_dcf_snapshot(db: Session, snapshot_id: int) -> bool:
    snap = db.query(ProjectDCFSnapshot).filter(ProjectDCFSnapshot.id == snapshot_id).first()
    if not snap:
        return False
    db.delete(snap)
    db.commit()
    return True