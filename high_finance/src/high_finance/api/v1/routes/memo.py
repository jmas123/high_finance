"""
Investment Memo API
===================
SSE streaming endpoint for AI-generated investment memos.
History and detail endpoints for saved memos.
"""

import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from high_finance.core.rate_limit import limiter
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo
from high_finance.services.memo import generate_memo_stream, check_monthly_budget

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class MemoSummary(BaseModel):
    id: int
    ticker: str
    created_at: str
    content_preview: str

    class Config:
        from_attributes = True


class MemoDetail(BaseModel):
    id: int
    ticker: str
    content: str
    model_used: str | None
    created_at: str

    class Config:
        from_attributes = True


# ── POST /{ticker} – Generate memo (SSE stream) ─────────────────────────────

@router.post("/{ticker}")
@limiter.limit("5/minute;20/hour;50/day")
async def generate_memo(
    request: Request,
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an AI-generated investment memo as SSE."""
    ticker = ticker.upper()

    # Budget gate
    within_budget, spent, remaining = check_monthly_budget(db)
    if not within_budget:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly AI budget reached (${spent:.2f} spent). Resets next month.",
        )

    accumulator: list[str] = []
    token_usage: dict = {}

    async def sse_generator():
        try:
            async for chunk in generate_memo_stream(ticker, db, accumulator, token_usage):
                # JSON-encode to preserve newlines/special chars in a single SSE event
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.exception("Memo generation failed for %s", ticker)
            yield f"data: [ERROR] {str(e)}\n\n"
        finally:
            # Save the completed memo to the database
            content = "".join(accumulator)
            if content and not content.startswith("AI memo generation is not configured"):
                try:
                    memo = InvestmentMemo(
                        user_id=user.id,
                        ticker=ticker,
                        content=content,
                        model_used=token_usage.get("model"),
                        input_tokens=token_usage.get("input_tokens"),
                        output_tokens=token_usage.get("output_tokens"),
                    )
                    db.add(memo)
                    db.commit()
                    db.refresh(memo)
                    yield f"data: [SAVED:{memo.id}]\n\n"
                except Exception:
                    logger.exception("Failed to save memo for %s", ticker)

            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── GET /{ticker}/history – List past memos ─────────────────────────────────

@router.get("/{ticker}/history", response_model=List[MemoSummary])
async def memo_history(
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """List past memos for a ticker (most recent first)."""
    ticker = ticker.upper()
    memos = (
        db.query(InvestmentMemo)
        .filter(
            InvestmentMemo.user_id == user.id,
            InvestmentMemo.ticker == ticker,
        )
        .order_by(InvestmentMemo.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        MemoSummary(
            id=m.id,
            ticker=m.ticker,
            created_at=m.created_at.isoformat() if m.created_at else "",
            content_preview=m.content[:200] if m.content else "",
        )
        for m in memos
    ]


# ── GET /detail/{memo_id} – Get full memo ───────────────────────────────────

@router.get("/detail/{memo_id}", response_model=MemoDetail)
async def memo_detail(
    memo_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a full memo by ID (ownership check)."""
    memo = (
        db.query(InvestmentMemo)
        .filter(InvestmentMemo.id == memo_id)
        .first()
    )
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your memo")

    return MemoDetail(
        id=memo.id,
        ticker=memo.ticker,
        content=memo.content,
        model_used=memo.model_used,
        created_at=memo.created_at.isoformat() if memo.created_at else "",
    )
