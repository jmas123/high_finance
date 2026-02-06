"""
Chart Drawing Service
=====================
Business logic for chart drawing CRUD operations with optimistic concurrency control.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from high_finance.db.models.chart_drawing import ChartDrawing
from high_finance.api.v1.schemas.chart_drawing import (
    ChartDrawingCreate,
    ChartDrawingUpdate,
)


MAX_DRAWINGS_PER_TICKER = 100


class ChartDrawingService:
    """Service for managing chart drawings."""

    @staticmethod
    def list_drawings(
        db: Session,
        user_id: str,
        ticker: str,
        include_hidden: bool = False,
    ) -> List[ChartDrawing]:
        """
        List all drawings for a user on a specific ticker.
        Excludes soft-deleted drawings.
        """
        query = db.query(ChartDrawing).filter(
            ChartDrawing.user_id == user_id,
            ChartDrawing.ticker == ticker.upper(),
            ChartDrawing.is_deleted == False,
        )

        if not include_hidden:
            query = query.filter(ChartDrawing.is_visible == True)

        return query.order_by(ChartDrawing.layer_order, ChartDrawing.created_at).all()

    @staticmethod
    def get_drawing(
        db: Session,
        drawing_id: int,
        user_id: str,
    ) -> Optional[ChartDrawing]:
        """Get a single drawing by ID, owned by the user."""
        return db.query(ChartDrawing).filter(
            ChartDrawing.id == drawing_id,
            ChartDrawing.user_id == user_id,
            ChartDrawing.is_deleted == False,
        ).first()

    @staticmethod
    def count_drawings(db: Session, user_id: str, ticker: str) -> int:
        """Count non-deleted drawings for a user on a ticker."""
        return db.query(func.count(ChartDrawing.id)).filter(
            ChartDrawing.user_id == user_id,
            ChartDrawing.ticker == ticker.upper(),
            ChartDrawing.is_deleted == False,
        ).scalar() or 0

    @staticmethod
    def create_drawing(
        db: Session,
        user_id: str,
        data: ChartDrawingCreate,
    ) -> ChartDrawing:
        """
        Create a new chart drawing.
        Raises ValueError if drawing limit is reached.
        """
        count = ChartDrawingService.count_drawings(db, user_id, data.ticker)
        if count >= MAX_DRAWINGS_PER_TICKER:
            raise ValueError(f"Maximum {MAX_DRAWINGS_PER_TICKER} drawings per ticker reached")

        drawing = ChartDrawing(
            user_id=user_id,
            ticker=data.ticker.upper(),
            drawing_type=data.drawing_type.value,
            points=[p.model_dump() for p in data.points],
            style=data.style.model_dump(),
            text_content=data.text_content,
            is_visible=data.is_visible,
            is_locked=data.is_locked,
            layer_order=data.layer_order,
        )
        db.add(drawing)
        db.commit()
        db.refresh(drawing)
        return drawing

    @staticmethod
    def update_drawing(
        db: Session,
        drawing_id: int,
        user_id: str,
        expected_version: int,
        data: ChartDrawingUpdate,
    ) -> Optional[ChartDrawing]:
        """
        Update an existing drawing with optimistic concurrency control.
        Returns None if drawing not found or version mismatch.
        """
        drawing = db.query(ChartDrawing).filter(
            ChartDrawing.id == drawing_id,
            ChartDrawing.user_id == user_id,
            ChartDrawing.version == expected_version,
            ChartDrawing.is_deleted == False,
        ).first()

        if not drawing:
            return None

        # Update fields if provided
        if data.points is not None:
            drawing.points = [p.model_dump() for p in data.points]
        if data.style is not None:
            drawing.style = data.style.model_dump()
        if data.text_content is not None:
            drawing.text_content = data.text_content
        if data.is_visible is not None:
            drawing.is_visible = data.is_visible
        if data.is_locked is not None:
            drawing.is_locked = data.is_locked
        if data.layer_order is not None:
            drawing.layer_order = data.layer_order

        # Increment version for concurrency control
        drawing.version += 1
        drawing.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(drawing)
        return drawing

    @staticmethod
    def delete_drawing(
        db: Session,
        drawing_id: int,
        user_id: str,
    ) -> bool:
        """
        Soft delete a drawing.
        Returns True if deleted, False if not found.
        """
        drawing = db.query(ChartDrawing).filter(
            ChartDrawing.id == drawing_id,
            ChartDrawing.user_id == user_id,
            ChartDrawing.is_deleted == False,
        ).first()

        if not drawing:
            return False

        drawing.is_deleted = True
        drawing.deleted_at = datetime.utcnow()
        db.commit()
        return True

    @staticmethod
    def delete_all_drawings(
        db: Session,
        user_id: str,
        ticker: str,
    ) -> int:
        """
        Soft delete all drawings for a user on a ticker.
        Returns count of deleted drawings.
        """
        now = datetime.utcnow()
        result = db.query(ChartDrawing).filter(
            ChartDrawing.user_id == user_id,
            ChartDrawing.ticker == ticker.upper(),
            ChartDrawing.is_deleted == False,
        ).update({
            "is_deleted": True,
            "deleted_at": now,
        })
        db.commit()
        return result

    @staticmethod
    def batch_create_drawings(
        db: Session,
        user_id: str,
        drawings_data: List[ChartDrawingCreate],
    ) -> tuple[List[ChartDrawing], List[dict]]:
        """
        Batch create multiple drawings.
        Returns tuple of (created_drawings, errors).
        """
        created = []
        errors = []

        for i, data in enumerate(drawings_data):
            try:
                drawing = ChartDrawingService.create_drawing(db, user_id, data)
                created.append(drawing)
            except ValueError as e:
                errors.append({"index": i, "error": str(e)})
            except Exception as e:
                errors.append({"index": i, "error": f"Unexpected error: {str(e)}"})

        return created, errors


# Singleton instance
chart_drawing_service = ChartDrawingService()
