"""
Chart Drawing Schemas
=====================
Pydantic models for chart drawing CRUD operations with per-type validation.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class DrawingType(str, Enum):
    TRENDLINE = "trendline"
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    FIB_RETRACEMENT = "fib_retracement"
    RECTANGLE = "rectangle"
    CHANNEL = "channel"
    TEXT = "text"
    MEASURE = "measure"


class DrawingPoint(BaseModel):
    """A point on the chart with time (Unix timestamp) and price."""
    time: int = Field(..., description="Unix timestamp in seconds")
    price: float = Field(..., description="Price level")


class DrawingStyle(BaseModel):
    """Style configuration for a drawing."""
    color: str = Field(..., pattern=r'^#[0-9a-fA-F]{6}$', description="Hex color code")
    lineWidth: int = Field(2, ge=1, le=10, description="Line width in pixels")
    lineStyle: Literal["solid", "dashed", "dotted"] = "solid"
    fillColor: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    fillOpacity: float = Field(0.1, ge=0, le=1)
    showLabels: bool = True
    extendLeft: bool = False
    extendRight: bool = False
    fontSize: int = Field(12, ge=8, le=24)


# Required point counts per drawing type
REQUIRED_POINTS = {
    DrawingType.HORIZONTAL: 1,
    DrawingType.VERTICAL: 1,
    DrawingType.TEXT: 1,
    DrawingType.TRENDLINE: 2,
    DrawingType.FIB_RETRACEMENT: 2,
    DrawingType.RECTANGLE: 2,
    DrawingType.MEASURE: 2,
    DrawingType.CHANNEL: 2,
}


class ChartDrawingCreate(BaseModel):
    """Schema for creating a new chart drawing."""
    ticker: str = Field(..., min_length=1, max_length=10)
    drawing_type: DrawingType
    points: List[DrawingPoint]
    style: DrawingStyle
    text_content: Optional[str] = Field(None, max_length=500)
    is_visible: bool = True
    is_locked: bool = False
    layer_order: int = 0

    @field_validator('ticker')
    @classmethod
    def uppercase_ticker(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode='after')
    def validate_points_for_type(self):
        expected = REQUIRED_POINTS.get(self.drawing_type, 2)
        if len(self.points) != expected:
            raise ValueError(f"{self.drawing_type.value} requires exactly {expected} point(s), got {len(self.points)}")

        # Additional per-type validation
        if self.drawing_type == DrawingType.FIB_RETRACEMENT:
            if len(self.points) >= 2 and self.points[0].price == self.points[1].price:
                raise ValueError("Fibonacci retracement requires different price levels")

        if self.drawing_type == DrawingType.TRENDLINE:
            if len(self.points) >= 2 and self.points[0].time == self.points[1].time:
                raise ValueError("Trendline requires different time values")

        if self.drawing_type == DrawingType.TEXT:
            if not self.text_content or not self.text_content.strip():
                raise ValueError("Text annotation requires text_content")

        return self


class ChartDrawingUpdate(BaseModel):
    """Schema for updating an existing chart drawing."""
    version: int = Field(..., description="Current version for optimistic concurrency")
    points: Optional[List[DrawingPoint]] = None
    style: Optional[DrawingStyle] = None
    text_content: Optional[str] = Field(None, max_length=500)
    is_visible: Optional[bool] = None
    is_locked: Optional[bool] = None
    layer_order: Optional[int] = None


class ChartDrawingResponse(BaseModel):
    """Schema for chart drawing responses."""
    id: int
    user_id: str
    ticker: str
    drawing_type: str
    points: List[DrawingPoint]
    style: DrawingStyle
    text_content: Optional[str]
    is_visible: bool
    is_locked: bool
    layer_order: int
    version: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChartDrawingList(BaseModel):
    """Schema for listing chart drawings."""
    items: List[ChartDrawingResponse]
    total: int


class BatchDrawingCreate(BaseModel):
    """Schema for batch creating/updating drawings."""
    drawings: List[ChartDrawingCreate] = Field(..., max_length=50)


class BatchDrawingResponse(BaseModel):
    """Schema for batch operation responses."""
    created: List[ChartDrawingResponse]
    errors: List[dict]
