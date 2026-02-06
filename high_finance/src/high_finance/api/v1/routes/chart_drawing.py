"""
Chart Drawings – API Routes
===========================
Endpoints for managing user chart annotations.

Drawings:
    GET    /api/v1/drawings/{ticker}      - List drawings for a ticker
    POST   /api/v1/drawings               - Create a new drawing
    PATCH  /api/v1/drawings/{id}          - Update a drawing (with version check)
    DELETE /api/v1/drawings/{id}          - Soft delete a drawing
    DELETE /api/v1/drawings/{ticker}/all  - Soft delete all drawings for a ticker
    POST   /api/v1/drawings/batch         - Batch create drawings
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.core.security import get_current_user, User
from high_finance.core.rate_limit import limiter
from high_finance.services.chart_drawing import chart_drawing_service
from high_finance.api.v1.schemas.chart_drawing import (
    ChartDrawingCreate,
    ChartDrawingUpdate,
    ChartDrawingResponse,
    ChartDrawingList,
    BatchDrawingCreate,
    BatchDrawingResponse,
    DrawingPoint,
    DrawingStyle,
)

router = APIRouter()


def _drawing_to_response(drawing) -> ChartDrawingResponse:
    """Convert SQLAlchemy model to Pydantic response."""
    return ChartDrawingResponse(
        id=drawing.id,
        user_id=drawing.user_id,
        ticker=drawing.ticker,
        drawing_type=drawing.drawing_type,
        points=[DrawingPoint(**p) for p in drawing.points],
        style=DrawingStyle(**drawing.style),
        text_content=drawing.text_content,
        is_visible=drawing.is_visible,
        is_locked=drawing.is_locked,
        layer_order=drawing.layer_order,
        version=drawing.version,
        created_at=drawing.created_at,
        updated_at=drawing.updated_at,
    )


@router.get("/{ticker}", response_model=ChartDrawingList)
async def list_drawings(
    ticker: str,
    include_hidden: bool = Query(False, description="Include hidden drawings"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all drawings for the current user on a specific ticker.
    Excludes soft-deleted drawings.
    """
    drawings = chart_drawing_service.list_drawings(
        db, user.id, ticker, include_hidden=include_hidden
    )
    return ChartDrawingList(
        items=[_drawing_to_response(d) for d in drawings],
        total=len(drawings),
    )


@router.post("", response_model=ChartDrawingResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_drawing(
    request: Request,
    data: ChartDrawingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new chart drawing.
    Limited to 100 drawings per ticker per user.
    """
    try:
        drawing = chart_drawing_service.create_drawing(db, user.id, data)
        return _drawing_to_response(drawing)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.patch("/{drawing_id}", response_model=ChartDrawingResponse)
@limiter.limit("60/minute")
async def update_drawing(
    request: Request,
    drawing_id: int,
    data: ChartDrawingUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing drawing.
    Uses optimistic concurrency control via version checking.
    Returns 409 Conflict if the drawing was modified by another session.
    """
    drawing = chart_drawing_service.update_drawing(
        db, drawing_id, user.id, data.version, data
    )

    if not drawing:
        # Check if drawing exists at all
        existing = chart_drawing_service.get_drawing(db, drawing_id, user.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Drawing was modified by another session. Please refresh.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found",
        )

    return _drawing_to_response(drawing)


@router.delete("/{drawing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drawing(
    drawing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete a drawing."""
    deleted = chart_drawing_service.delete_drawing(db, drawing_id, user.id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found",
        )

    return None


@router.delete("/{ticker}/all", status_code=status.HTTP_200_OK)
async def delete_all_drawings(
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete all drawings for a ticker."""
    count = chart_drawing_service.delete_all_drawings(db, user.id, ticker)
    return {"deleted": count}


@router.post("/batch", response_model=BatchDrawingResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def batch_create_drawings(
    request: Request,
    data: BatchDrawingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Batch create multiple drawings.
    Maximum 50 drawings per request.
    """
    created, errors = chart_drawing_service.batch_create_drawings(
        db, user.id, data.drawings
    )

    return BatchDrawingResponse(
        created=[_drawing_to_response(d) for d in created],
        errors=errors,
    )
