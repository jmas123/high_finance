"""
Session Tracking API
====================
Fire-and-forget event logging for session-aware AI assistant.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from high_finance.services.session_tracker import log_event, get_session_context

logger = logging.getLogger(__name__)

router = APIRouter()


class SessionEventRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    event_type: str = Field(..., min_length=1, max_length=50)
    event_data: Dict[str, Any] = Field(default_factory=dict)


@router.post("/event", status_code=204)
async def post_session_event(body: SessionEventRequest):
    """Log a session event. Fire-and-forget — always returns 204."""
    await log_event(body.session_id, body.event_type, body.event_data)
    return None


@router.get("/{session_id}/context")
async def get_context(session_id: str):
    """Get session context summary for the AI assistant."""
    context = await get_session_context(session_id)
    return {"context": context}
