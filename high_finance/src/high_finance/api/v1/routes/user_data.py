"""
User Data – API Routes
======================
Endpoints for authenticated user's watchlist, portfolio, and peer groups.

Watchlist:
    GET    /api/v1/me/watchlist         - List watchlist items
    POST   /api/v1/me/watchlist         - Add item to watchlist
    DELETE /api/v1/me/watchlist/{ticker} - Remove from watchlist

Portfolio:
    GET    /api/v1/me/portfolio         - List portfolio positions
    POST   /api/v1/me/portfolio         - Add/update position
    PUT    /api/v1/me/portfolio/{ticker} - Update position
    DELETE /api/v1/me/portfolio/{ticker} - Remove position

Peer Groups:
    GET    /api/v1/me/peer-groups       - List peer groups (optionally filter by ticker)
    POST   /api/v1/me/peer-groups       - Create a peer group
    PUT    /api/v1/me/peer-groups/{id}  - Update a peer group
    DELETE /api/v1/me/peer-groups/{id}  - Delete a peer group
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from high_finance.db.session import get_db
from high_finance.db.models.user_data import WatchlistItem, PortfolioPosition
from high_finance.db.models.peer_group import PeerGroup
from high_finance.core.security import get_current_user, User
from high_finance.api.v1.schemas.user_data import (
    WatchlistItemCreate,
    WatchlistItemOut,
    PortfolioPositionCreate,
    PortfolioPositionUpdate,
    PortfolioPositionOut,
)
from high_finance.api.v1.schemas.peer_group import (
    PeerGroupCreate,
    PeerGroupUpdate,
    PeerGroupResponse,
    PeerGroupList,
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{ticker} is already in your watchlist",
        )
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

    existing = db.query(PortfolioPosition).with_for_update().filter(
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
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # Race condition: another request already inserted this ticker.
            # Re-read and average in instead.
            existing = db.query(PortfolioPosition).filter(
                PortfolioPosition.user_id == user.id,
                PortfolioPosition.ticker == ticker,
            ).first()
            if existing:
                old_total = existing.shares * existing.avg_cost
                new_total = data.shares * data.avg_cost
                existing.shares += data.shares
                existing.avg_cost = (old_total + new_total) / existing.shares
                if data.name:
                    existing.name = data.name
                db.commit()
                db.refresh(existing)
                return existing
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unexpected error adding portfolio position",
            )
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


# ═══════════════════════════════════════════════════════════════════════════════
# PEER GROUPS
# ═══════════════════════════════════════════════════════════════════════════════

MAX_PEER_GROUPS_PER_USER = 50


@router.get("/peer-groups", response_model=PeerGroupList)
async def list_peer_groups(
    ticker: Optional[str] = Query(None, max_length=10, description="Filter by ticker (optional)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List peer groups for the current user.

    Optionally filter by ticker to get groups relevant to a specific company.
    Returns both ticker-specific groups and user-level groups (ticker=NULL).
    """
    query = db.query(PeerGroup).filter(PeerGroup.user_id == user.id)

    if ticker:
        ticker = ticker.upper()
        # Return ticker-specific groups OR user-level groups (ticker IS NULL)
        query = query.filter(
            (PeerGroup.ticker == ticker) | (PeerGroup.ticker.is_(None))
        )

    total = query.count()
    groups = query.order_by(
        PeerGroup.is_default.desc(),  # Default groups first
        PeerGroup.updated_at.desc()
    ).offset(offset).limit(limit).all()

    return PeerGroupList(
        items=groups,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/peer-groups", response_model=PeerGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_peer_group(
    data: PeerGroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new peer group.

    - If `ticker` is provided, the group is ticker-specific.
    - If `ticker` is NULL, the group is a user-level reusable group.
    - The target ticker cannot be in the peer_tickers list.
    - Maximum 50 peer groups per user.
    """
    # Check user limit
    count = db.query(func.count(PeerGroup.id)).filter(
        PeerGroup.user_id == user.id
    ).scalar()

    if count >= MAX_PEER_GROUPS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_PEER_GROUPS_PER_USER} peer groups allowed per user",
        )

    # Validate target ticker not in peers
    if data.ticker and data.ticker.upper() in data.peer_tickers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot include target ticker in peer group",
        )

    # Check for duplicate name
    existing = db.query(PeerGroup).filter(
        PeerGroup.user_id == user.id,
        PeerGroup.ticker == data.ticker,
        PeerGroup.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A peer group named '{data.name}' already exists",
        )

    # If setting as default, unset other defaults for this ticker
    if data.is_default:
        db.query(PeerGroup).filter(
            PeerGroup.user_id == user.id,
            PeerGroup.ticker == data.ticker,
            PeerGroup.is_default == True,
        ).update({"is_default": False})

    group = PeerGroup(
        user_id=user.id,
        ticker=data.ticker,
        name=data.name,
        peer_tickers=data.peer_tickers,
        is_default=data.is_default,
    )
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A peer group named '{data.name}' already exists",
        )
    db.refresh(group)
    return group


@router.put("/peer-groups/{group_id}", response_model=PeerGroupResponse)
async def update_peer_group(
    group_id: int,
    data: PeerGroupUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing peer group."""
    group = db.query(PeerGroup).filter(
        PeerGroup.id == group_id,
        PeerGroup.user_id == user.id,
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peer group not found",
        )

    # Validate target ticker not in peers
    new_peers = data.peer_tickers if data.peer_tickers is not None else group.peer_tickers
    if group.ticker and group.ticker.upper() in new_peers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot include target ticker in peer group",
        )

    # Check for duplicate name if changing name
    if data.name and data.name != group.name:
        existing = db.query(PeerGroup).filter(
            PeerGroup.user_id == user.id,
            PeerGroup.ticker == group.ticker,
            PeerGroup.name == data.name,
            PeerGroup.id != group_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A peer group named '{data.name}' already exists",
            )

    # Update fields
    if data.name is not None:
        group.name = data.name
    if data.peer_tickers is not None:
        group.peer_tickers = data.peer_tickers

    # Handle default flag
    if data.is_default is not None:
        if data.is_default and not group.is_default:
            # Unset other defaults for this ticker
            db.query(PeerGroup).filter(
                PeerGroup.user_id == user.id,
                PeerGroup.ticker == group.ticker,
                PeerGroup.is_default == True,
                PeerGroup.id != group_id,
            ).update({"is_default": False})
        group.is_default = data.is_default

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A peer group named '{data.name}' already exists or default conflict",
        )
    db.refresh(group)
    return group


@router.delete("/peer-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_peer_group(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a peer group."""
    result = db.query(PeerGroup).filter(
        PeerGroup.id == group_id,
        PeerGroup.user_id == user.id,
    ).delete()

    if result == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peer group not found",
        )

    db.commit()
    return None


@router.get("/peer-groups/{group_id}", response_model=PeerGroupResponse)
async def get_peer_group(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single peer group by ID."""
    group = db.query(PeerGroup).filter(
        PeerGroup.id == group_id,
        PeerGroup.user_id == user.id,
    ).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Peer group not found",
        )

    return group
