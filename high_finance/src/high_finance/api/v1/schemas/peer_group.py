"""
Peer Group Schemas
==================
Pydantic models for peer group CRUD operations.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class PeerGroupCreate(BaseModel):
    """Schema for creating a new peer group."""
    ticker: Optional[str] = None  # None = user-level group
    name: str = Field(..., min_length=1, max_length=100)
    peer_tickers: List[str] = Field(..., min_length=1, max_length=30)
    is_default: bool = False

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()

    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.upper().strip()

    @field_validator('peer_tickers')
    @classmethod
    def validate_peer_tickers(cls, v: List[str], info) -> List[str]:
        # Uppercase, strip, and dedupe
        tickers = list(set(t.upper().strip() for t in v if t.strip()))
        if len(tickers) < 1:
            raise ValueError("At least one peer ticker is required")
        if len(tickers) > 30:
            raise ValueError("Maximum 30 peer tickers allowed")
        return tickers


class PeerGroupUpdate(BaseModel):
    """Schema for updating a peer group."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    peer_tickers: Optional[List[str]] = Field(None, min_length=1, max_length=30)
    is_default: Optional[bool] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip()

    @field_validator('peer_tickers')
    @classmethod
    def validate_peer_tickers(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        # Uppercase, strip, and dedupe
        tickers = list(set(t.upper().strip() for t in v if t.strip()))
        if len(tickers) < 1:
            raise ValueError("At least one peer ticker is required")
        if len(tickers) > 30:
            raise ValueError("Maximum 30 peer tickers allowed")
        return tickers


class PeerGroupResponse(BaseModel):
    """Schema for peer group response."""
    id: int
    user_id: str
    ticker: Optional[str]
    name: str
    peer_tickers: List[str]
    is_default: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PeerGroupList(BaseModel):
    """Schema for paginated peer group list."""
    items: List[PeerGroupResponse]
    total: int
    limit: int
    offset: int
