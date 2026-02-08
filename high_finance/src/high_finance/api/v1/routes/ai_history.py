"""
AI History API
==============
Unified view of all AI-generated content (memos, financial analyses, etc.).
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from high_finance.core.config import settings
from high_finance.core.security import get_current_user, User
from high_finance.db.session import get_db
from high_finance.db.models.memo import InvestmentMemo

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class AIHistoryItem(BaseModel):
    id: int
    ticker: str
    analysis_type: str
    content_preview: str
    created_at: str

    class Config:
        from_attributes = True


class AIHistoryDetail(BaseModel):
    id: int
    ticker: str
    analysis_type: str
    content: str
    model_used: str | None
    input_tokens: int | None
    output_tokens: int | None
    created_at: str

    class Config:
        from_attributes = True


class AIHistoryTypeCount(BaseModel):
    analysis_type: str
    count: int


class AIHistoryStats(BaseModel):
    total_count: int
    by_type: List[AIHistoryTypeCount]
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    budget_usd: float
    budget_remaining_usd: float


# ── GET /ai-history — list all AI analyses ───────────────────────────────────

@router.get("", response_model=List[AIHistoryItem])
async def list_ai_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filter by analysis_type (e.g. memo, financial_analysis)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all AI analyses for the current user, newest first."""
    query = db.query(InvestmentMemo).filter(InvestmentMemo.user_id == user.id)

    if type:
        query = query.filter(InvestmentMemo.analysis_type == type)

    memos = (
        query
        .order_by(InvestmentMemo.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        AIHistoryItem(
            id=m.id,
            ticker=m.ticker,
            analysis_type=m.analysis_type or "memo",
            content_preview=m.content[:200] if m.content else "",
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in memos
    ]


# ── GET /ai-history/stats — usage statistics ────────────────────────────────

@router.get("/stats", response_model=AIHistoryStats)
async def ai_history_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get AI usage stats for the current user this month."""
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total count per type (all time for this user)
    type_counts = db.execute(
        text(
            "SELECT COALESCE(analysis_type, 'memo') AS atype, COUNT(*) AS cnt "
            "FROM investment_memos "
            "WHERE user_id = :uid "
            "GROUP BY atype ORDER BY cnt DESC"
        ),
        {"uid": user.id},
    ).fetchall()

    total_count = sum(r[1] for r in type_counts)
    by_type = [AIHistoryTypeCount(analysis_type=r[0], count=r[1]) for r in type_counts]

    # Token usage this month (all users — matches check_monthly_budget)
    result = db.execute(
        text(
            "SELECT COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0) "
            "FROM investment_memos WHERE created_at >= :start"
        ),
        {"start": first_of_month},
    ).fetchone()

    total_input = result[0]
    total_output = result[1]
    estimated_cost = (total_input * 0.80 / 1_000_000) + (total_output * 4.0 / 1_000_000)
    budget = settings.AI_MONTHLY_BUDGET_USD
    remaining = max(0.0, budget - estimated_cost)

    return AIHistoryStats(
        total_count=total_count,
        by_type=by_type,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        estimated_cost_usd=round(estimated_cost, 4),
        budget_usd=budget,
        budget_remaining_usd=round(remaining, 4),
    )


# ── GET /ai-history/{id} — full content by ID ───────────────────────────────

@router.get("/{item_id}", response_model=AIHistoryDetail)
async def ai_history_detail(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full content of an AI analysis by ID (ownership check)."""
    memo = db.query(InvestmentMemo).filter(InvestmentMemo.id == item_id).first()

    if not memo:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if memo.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your analysis")

    return AIHistoryDetail(
        id=memo.id,
        ticker=memo.ticker,
        analysis_type=memo.analysis_type or "memo",
        content=memo.content,
        model_used=memo.model_used,
        input_tokens=memo.input_tokens,
        output_tokens=memo.output_tokens,
        created_at=memo.created_at.isoformat() if memo.created_at else "",
    )
