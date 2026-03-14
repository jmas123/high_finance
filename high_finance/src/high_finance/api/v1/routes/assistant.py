"""
AI Research Assistant API
=========================
Streaming endpoint for conversational AI assistant.
Status endpoint for graceful degradation (hide UI when no API key).
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from high_finance.core.config import settings
from high_finance.core.security import get_current_user, get_current_user_optional, User
from high_finance.db.session import get_db
from high_finance.services.assistant import stream_assistant_response

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AssistantQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    current_ticker: Optional[str] = None
    conversation_history: List[ConversationMessage] = Field(default_factory=list)
    session_id: Optional[str] = None
    page_context: Optional[str] = None  # ← ADD THIS


# ── GET /status – Check if assistant is available ─────────────────────────────

@router.get("/status")
async def assistant_status():
    """
    Check if the AI assistant is available.
    Frontend uses this to show/hide the Cmd+K shortcut.
    """
    available = bool(settings.ANTHROPIC_API_KEY)
    return {"available": available}


# ── POST /query – Stream assistant response (SSE) ────────────────────────────

@router.post("/query")
async def assistant_query(
    request: Request,
    body: AssistantQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an AI assistant response as SSE."""
    if not settings.ANTHROPIC_API_KEY:
        return StreamingResponse(
            iter(["data: [ERROR] AI assistant is not configured.\n\n", "data: [DONE]\n\n"]),
            media_type="text/event-stream",
        )

    ticker = body.current_ticker.upper() if body.current_ticker else None

    # Validate ticker format if provided
    if ticker:
        import re
        if not re.match(r"^[A-Z0-9.\-]{1,10}$", ticker):
            ticker = None

    # Fetch session context if session_id provided
    session_context = None
    if body.session_id:
        try:
            from high_finance.services.session_tracker import get_session_context
            session_context = await get_session_context(body.session_id)
        except Exception:
            logger.debug("Failed to fetch session context", exc_info=True)

    accumulator: list[str] = []

    async def sse_generator():
        try:
            history = [{"role": m.role, "content": m.content} for m in body.conversation_history]
            async for chunk in stream_assistant_response(
                query=body.query,
                ticker=ticker,
                conversation_history=history,
                db=db,
                accumulator=accumulator,
                session_context=session_context,
                page_context=body.page_context,
                user_id=user.id,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.exception("Assistant query failed: %s", e)
            yield f"data: [ERROR] {str(e)}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
