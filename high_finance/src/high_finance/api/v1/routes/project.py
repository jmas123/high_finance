"""
Research Projects – API Routes
===============================
Mount on the v1 router:
    from .routes.projects import router as projects_router
    v1_router.include_router(projects_router, prefix="/projects", tags=["projects"])
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services import project as svc
from high_finance.api.v1.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectSummaryOut, ProjectDetailOut,
    ThesisBulletCreate, ThesisBulletUpdate, ThesisBulletOut,
    CatalystCreate, CatalystUpdate, CatalystOut,
    RiskCreate, RiskUpdate, RiskOut,
    PeerCreate, PeerOut,
    DCFSnapshotCreate, DCFSnapshotOut,
    SourceCreate, SourceOut,
    ReorderRequest,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=List[ProjectSummaryOut])
async def list_projects(
    status: Optional[str] = Query(None, description="Filter by status"),
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    db: Session = Depends(get_db),
):
    return await svc.list_projects(db, status=status, ticker=ticker)


@router.post("", response_model=ProjectDetailOut, status_code=201)
async def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    p = await svc.create_project(
        db,
        ticker=body.ticker,
        title=body.title,
        summary=body.summary,
        conviction=body.conviction,
        position_type=body.position_type,
    )
    return p


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    p = await svc.get_project(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.patch("/{project_id}", response_model=ProjectDetailOut)
async def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db)):
    p = await svc.update_project(db, project_id, **body.model_dump(exclude_none=True))
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_project(db, project_id)
    if not ok:
        raise HTTPException(404, "Project not found")


# ═══════════════════════════════════════════════════════════════════════════════
# THESIS BULLETS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/thesis", response_model=ThesisBulletOut, status_code=201)
async def add_thesis(project_id: int, body: ThesisBulletCreate, db: Session = Depends(get_db)):
    return await svc.add_thesis_bullet(db, project_id, text=body.text, sort_order=body.sort_order)


@router.patch("/{project_id}/thesis/{bullet_id}", response_model=ThesisBulletOut)
async def update_thesis(project_id: int, bullet_id: int, body: ThesisBulletUpdate, db: Session = Depends(get_db)):
    b = await svc.update_thesis_bullet(db, bullet_id, **body.model_dump(exclude_none=True))
    if not b:
        raise HTTPException(404, "Bullet not found")
    return b


@router.delete("/{project_id}/thesis/{bullet_id}", status_code=204)
async def delete_thesis(project_id: int, bullet_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_thesis_bullet(db, bullet_id)
    if not ok:
        raise HTTPException(404, "Bullet not found")


@router.put("/{project_id}/thesis/reorder", response_model=List[ThesisBulletOut])
async def reorder_thesis(project_id: int, body: ReorderRequest, db: Session = Depends(get_db)):
    return await svc.reorder_thesis_bullets(db, project_id, body.ordered_ids)


# ═══════════════════════════════════════════════════════════════════════════════
# CATALYSTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/catalysts", response_model=CatalystOut, status_code=201)
async def add_catalyst(project_id: int, body: CatalystCreate, db: Session = Depends(get_db)):
    return await svc.add_catalyst(
        db, project_id, title=body.title,
        description=body.description, expected_date=body.expected_date,
    )


@router.patch("/{project_id}/catalysts/{catalyst_id}", response_model=CatalystOut)
async def update_catalyst(project_id: int, catalyst_id: int, body: CatalystUpdate, db: Session = Depends(get_db)):
    c = await svc.update_catalyst(db, catalyst_id, **body.model_dump(exclude_none=True))
    if not c:
        raise HTTPException(404, "Catalyst not found")
    return c


@router.delete("/{project_id}/catalysts/{catalyst_id}", status_code=204)
async def delete_catalyst(project_id: int, catalyst_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_catalyst(db, catalyst_id)
    if not ok:
        raise HTTPException(404, "Catalyst not found")


# ═══════════════════════════════════════════════════════════════════════════════
# RISKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/risks", response_model=RiskOut, status_code=201)
async def add_risk(project_id: int, body: RiskCreate, db: Session = Depends(get_db)):
    return await svc.add_risk(
        db, project_id, title=body.title,
        description=body.description, severity=body.severity,
    )


@router.patch("/{project_id}/risks/{risk_id}", response_model=RiskOut)
async def update_risk(project_id: int, risk_id: int, body: RiskUpdate, db: Session = Depends(get_db)):
    r = await svc.update_risk(db, risk_id, **body.model_dump(exclude_none=True))
    if not r:
        raise HTTPException(404, "Risk not found")
    return r


@router.delete("/{project_id}/risks/{risk_id}", status_code=204)
async def delete_risk(project_id: int, risk_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_risk(db, risk_id)
    if not ok:
        raise HTTPException(404, "Risk not found")


# ═══════════════════════════════════════════════════════════════════════════════
# PEERS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/peers", response_model=PeerOut, status_code=201)
async def add_peer(project_id: int, body: PeerCreate, db: Session = Depends(get_db)):
    return await svc.add_peer(db, project_id, ticker=body.ticker, company_name=body.company_name)


@router.delete("/{project_id}/peers/{peer_id}", status_code=204)
async def remove_peer(project_id: int, peer_id: int, db: Session = Depends(get_db)):
    ok = await svc.remove_peer(db, peer_id)
    if not ok:
        raise HTTPException(404, "Peer not found")


# ═══════════════════════════════════════════════════════════════════════════════
# DCF SNAPSHOTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/dcf-snapshots", response_model=List[DCFSnapshotOut])
async def list_dcf_snapshots(project_id: int, db: Session = Depends(get_db)):
    return await svc.list_dcf_snapshots(db, project_id)


@router.post("/{project_id}/dcf-snapshots", response_model=DCFSnapshotOut, status_code=201)
async def save_dcf_snapshot(project_id: int, body: DCFSnapshotCreate, db: Session = Depends(get_db)):
    return await svc.save_dcf_snapshot(db, project_id, **body.model_dump())


@router.get("/{project_id}/dcf-snapshots/{snapshot_id}", response_model=DCFSnapshotOut)
async def get_dcf_snapshot(project_id: int, snapshot_id: int, db: Session = Depends(get_db)):
    s = await svc.get_dcf_snapshot(db, snapshot_id)
    if not s:
        raise HTTPException(404, "Snapshot not found")
    return s


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{project_id}/sources", response_model=SourceOut, status_code=201)
async def add_source(project_id: int, body: SourceCreate, db: Session = Depends(get_db)):
    return await svc.add_source(
        db, project_id, source_type=body.source_type,
        title=body.title, url=body.url, notes=body.notes,
    )


@router.delete("/{project_id}/sources/{source_id}", status_code=204)
async def delete_source(project_id: int, source_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_source(db, source_id)
    if not ok:
        raise HTTPException(404, "Source not found")
    

@router.delete("/{project_id}/dcf-snapshots/{snapshot_id}", status_code=204)
async def delete_dcf_snapshot(project_id: int, snapshot_id: int, db: Session = Depends(get_db)):
    ok = await svc.delete_dcf_snapshot(db, snapshot_id)
    if not ok:
        raise HTTPException(404, "Snapshot not found")
    
