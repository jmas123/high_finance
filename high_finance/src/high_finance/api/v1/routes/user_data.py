"""
User Data – API Routes
======================
Endpoints for authenticated user's watchlist and portfolio.

Watchlist:
    GET    /api/v1/me/watchlist         - List watchlist items
    POST   /api/v1/me/watchlist         - Add item to watchlist
    DELETE /api/v1/me/watchlist/{ticker} - Remove from watchlist

Portfolio:
    GET    /api/v1/me/portfolio         - List portfolio positions
    POST   /api/v1/me/portfolio         - Add/update position
    PUT    /api/v1/me/portfolio/{ticker} - Update position
    DELETE /api/v1/me/portfolio/{ticker} - Remove position
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.db.models.user_data import WatchlistItem, PortfolioPosition
from high_finance.core.security import get_current_user, User
from high_finance.api.v1.schemas.user_data import (
    WatchlistItemCreate,
    WatchlistItemOut,
    PortfolioPositionCreate,
    PortfolioPositionUpdate,
    PortfolioPositionOut,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# WATCHLIST
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/watchlist", response_model=List[WatchlistItemOut])
async def list_watchlist(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all watchlist items for the current user."""
    items = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == user.id
    ).order_by(WatchlistItem.added_at.desc()).all()
    return items


@router.post("/watchlist", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    data: WatchlistItemCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a ticker to the watchlist."""
    ticker = data.ticker.upper()

    # Check if already exists
    existing = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == user.id,
        WatchlistItem.ticker == ticker,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{ticker} is already in your watchlist",
        )

    item = WatchlistItem(
        user_id=user.id,
        ticker=ticker,
        name=data.name,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/watchlist/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a ticker from the watchlist."""
    ticker = ticker.upper()
    result = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == user.id,
        WatchlistItem.ticker == ticker,
    ).delete()

    if result == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker} not found in your watchlist",
        )

    db.commit()
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# PORTFOLIO
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/portfolio", response_model=List[PortfolioPositionOut])
async def list_portfolio(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all portfolio positions for the current user."""
    positions = db.query(PortfolioPosition).filter(
        PortfolioPosition.user_id == user.id
    ).order_by(PortfolioPosition.added_at.desc()).all()
    return positions


@router.post("/portfolio", response_model=PortfolioPositionOut, status_code=status.HTTP_201_CREATED)
async def add_or_update_position(
    data: PortfolioPositionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a new position or average into existing position.

    If ticker already exists, averages the cost basis:
    new_avg = (old_shares * old_avg + new_shares * new_avg) / total_shares
    """
    ticker = data.ticker.upper()

    existing = db.query(PortfolioPosition).filter(
        PortfolioPosition.user_id == user.id,
        PortfolioPosition.ticker == ticker,
    ).first()

    if existing:
        # Average in
        old_total = existing.shares * existing.avg_cost
        new_total = data.shares * data.avg_cost
        existing.shares += data.shares
        existing.avg_cost = (old_total + new_total) / existing.shares
        if data.name:
            existing.name = data.name
        db.commit()
        db.refresh(existing)
        return existing
    else:
        position = PortfolioPosition(
            user_id=user.id,
            ticker=ticker,
            name=data.name,
            shares=data.shares,
            avg_cost=data.avg_cost,
        )
        db.add(position)
        db.commit()
        db.refresh(position)
        return position


@router.put("/portfolio/{ticker}", response_model=PortfolioPositionOut)
async def update_position(
    ticker: str,
    data: PortfolioPositionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing position's shares and/or cost basis."""
    ticker = ticker.upper()

    position = db.query(PortfolioPosition).filter(
        PortfolioPosition.user_id == user.id,
        PortfolioPosition.ticker == ticker,
    ).first()

    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker} not found in your portfolio",
        )

    if data.shares is not None:
        position.shares = data.shares
    if data.avg_cost is not None:
        position.avg_cost = data.avg_cost

    db.commit()
    db.refresh(position)
    return position


@router.delete("/portfolio/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_position(
    ticker: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a position from the portfolio."""
    ticker = ticker.upper()
    result = db.query(PortfolioPosition).filter(
        PortfolioPosition.user_id == user.id,
        PortfolioPosition.ticker == ticker,
    ).delete()

    if result == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ticker} not found in your portfolio",
        )

    db.commit()
    return None
