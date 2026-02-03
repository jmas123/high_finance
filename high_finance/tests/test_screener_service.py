"""
Stock Screener Service Tests
============================
Unit tests for the screener service layer.
"""

import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from high_finance.db.base import Base
from high_finance.db.models.screener import ScreenerUniverse, ScreenerCache, SavedScreen
from high_finance.services import screener as svc


# ═══════════════════════════════════════════════════════════════════════════════
# TEST FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

# Use PostgreSQL for tests (JSONB requires it)
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://user:jude2000@localhost:5432/high_finance"
)
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Clean test data before/after each test."""
    db = TestingSessionLocal()
    try:
        db.execute(text("DELETE FROM screener_cache WHERE ticker LIKE 'SVC%'"))
        db.execute(text("DELETE FROM screener_universe WHERE ticker LIKE 'SVC%'"))
        db.execute(text("DELETE FROM saved_screens WHERE owner_id LIKE 'svc-test-%'"))
        db.commit()
    finally:
        db.close()
    yield
    db = TestingSessionLocal()
    try:
        db.execute(text("DELETE FROM screener_cache WHERE ticker LIKE 'SVC%'"))
        db.execute(text("DELETE FROM screener_universe WHERE ticker LIKE 'SVC%'"))
        db.execute(text("DELETE FROM saved_screens WHERE owner_id LIKE 'svc-test-%'"))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def db():
    """Get a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seed_data(db):
    """Seed test data."""
    # Universe
    tickers = [
        ScreenerUniverse(ticker="SVCAAPL", company_name="Test Apple", sector="Technology", industry="Electronics", is_active=True),
        ScreenerUniverse(ticker="SVCMSFT", company_name="Test Microsoft", sector="Technology", industry="Software", is_active=True),
        ScreenerUniverse(ticker="SVCJPM", company_name="Test JPMorgan", sector="Financials", industry="Banks", is_active=True),
    ]
    db.add_all(tickers)
    db.flush()  # Ensure universe records exist before FK-dependent cache records

    # Cache
    cache_rows = [
        ScreenerCache(ticker="SVCAAPL", market_cap=3_000_000_000_000, pe_ratio=28.0, insider_buys_90d=5),
        ScreenerCache(ticker="SVCMSFT", market_cap=2_800_000_000_000, pe_ratio=32.0, insider_buys_90d=0),
        ScreenerCache(ticker="SVCJPM", market_cap=500_000_000_000, pe_ratio=10.0, insider_buys_90d=3),
    ]
    db.add_all(cache_rows)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# RUN_SCREEN TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_run_screen_no_filters(db, seed_data):
    """Test run_screen with no filters returns all active stocks."""
    results, total, cached_at = await svc.run_screen(db)
    # Filter to just our test data
    test_results = [r for r in results if r["ticker"].startswith("SVC")]
    assert len(test_results) == 3


@pytest.mark.asyncio
async def test_run_screen_market_cap_filter(db, seed_data):
    """Test market cap filter (in millions)."""
    # Min 1T (1,000,000 millions)
    results, total, _ = await svc.run_screen(db, market_cap_min=1_000_000)
    tickers = [r["ticker"] for r in results]
    assert "SVCAAPL" in tickers
    assert "SVCMSFT" in tickers


@pytest.mark.asyncio
async def test_run_screen_pe_filter(db, seed_data):
    """Test P/E ratio filter."""
    results, total, _ = await svc.run_screen(db, pe_ratio_max=15)
    tickers = [r["ticker"] for r in results]
    assert "SVCJPM" in tickers
    assert "SVCAAPL" not in tickers


@pytest.mark.asyncio
async def test_run_screen_sector_filter(db, seed_data):
    """Test sector filter."""
    results, total, _ = await svc.run_screen(db, sectors="Technology")
    tickers = [r["ticker"] for r in results]
    assert "SVCAAPL" in tickers
    assert "SVCMSFT" in tickers


@pytest.mark.asyncio
async def test_run_screen_insider_filter(db, seed_data):
    """Test insider activity filter."""
    results, total, _ = await svc.run_screen(db, has_insider_buys_90d=True)
    tickers = [r["ticker"] for r in results]
    assert "SVCAAPL" in tickers
    assert "SVCJPM" in tickers
    assert "SVCMSFT" not in tickers


@pytest.mark.asyncio
async def test_run_screen_sort_asc(db, seed_data):
    """Test sorting ascending."""
    results, _, _ = await svc.run_screen(db, sort_by="pe_ratio", sort_order="asc")
    pe_ratios = [r["pe_ratio"] for r in results if r["pe_ratio"]]
    assert pe_ratios == sorted(pe_ratios)


@pytest.mark.asyncio
async def test_run_screen_sort_desc(db, seed_data):
    """Test sorting descending."""
    results, _, _ = await svc.run_screen(db, sort_by="market_cap", sort_order="desc")
    caps = [r["market_cap"] for r in results if r["market_cap"]]
    assert caps == sorted(caps, reverse=True)


@pytest.mark.asyncio
async def test_run_screen_pagination(db, seed_data):
    """Test pagination."""
    results1, total, _ = await svc.run_screen(db, limit=2, offset=0)
    results2, _, _ = await svc.run_screen(db, limit=2, offset=2)

    assert len(results1) == 2
    assert len(results2) >= 1  # At least 1 more result


@pytest.mark.asyncio
async def test_run_screen_empty_result(db, seed_data):
    """Test query with no matches."""
    results, total, _ = await svc.run_screen(db, market_cap_min=100_000_000)  # 100T
    assert results == []
    assert total == 0


# ═══════════════════════════════════════════════════════════════════════════════
# GET_SECTOR_COUNTS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_get_sector_counts(db, seed_data):
    """Test sector counts."""
    counts = await svc.get_sector_counts(db)
    # Should have Technology (with at least our 2 test tickers)
    assert "Technology" in counts
    assert counts["Technology"] >= 2


@pytest.mark.asyncio
async def test_get_sector_counts_empty(db):
    """Test sector counts returns dict."""
    counts = await svc.get_sector_counts(db)
    assert isinstance(counts, dict)


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED SCREENS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_create_saved_screen(db):
    """Test creating a saved screen."""
    screen = await svc.create_saved_screen(
        db, owner_id="svc-test-user1", name="My Screen", filters={"pe_ratio_max": 20}
    )
    assert screen.id is not None
    assert screen.owner_id == "svc-test-user1"
    assert screen.name == "My Screen"
    assert screen.filters == {"pe_ratio_max": 20}


@pytest.mark.asyncio
async def test_list_saved_screens(db):
    """Test listing saved screens by owner."""
    await svc.create_saved_screen(db, owner_id="svc-test-user1", name="Screen1", filters={})
    await svc.create_saved_screen(db, owner_id="svc-test-user1", name="Screen2", filters={})
    await svc.create_saved_screen(db, owner_id="svc-test-user2", name="Screen3", filters={})

    screens = await svc.list_saved_screens(db, "svc-test-user1")
    assert len(screens) == 2
    names = [s.name for s in screens]
    assert "Screen1" in names
    assert "Screen2" in names
    assert "Screen3" not in names


@pytest.mark.asyncio
async def test_get_saved_screen(db):
    """Test getting a specific saved screen."""
    created = await svc.create_saved_screen(db, owner_id="svc-test-user1", name="Test", filters={})

    # Same owner can get it
    screen = await svc.get_saved_screen(db, created.id, "svc-test-user1")
    assert screen is not None
    assert screen.name == "Test"

    # Different owner cannot get it
    screen = await svc.get_saved_screen(db, created.id, "svc-test-user2")
    assert screen is None


@pytest.mark.asyncio
async def test_delete_saved_screen(db):
    """Test deleting a saved screen."""
    created = await svc.create_saved_screen(db, owner_id="svc-test-user1", name="ToDelete", filters={})

    # Delete
    result = await svc.delete_saved_screen(db, created.id, "svc-test-user1")
    assert result is True

    # Verify deleted
    screen = await svc.get_saved_screen(db, created.id, "svc-test-user1")
    assert screen is None


@pytest.mark.asyncio
async def test_delete_saved_screen_wrong_owner(db):
    """Test cannot delete another user's screen."""
    created = await svc.create_saved_screen(db, owner_id="svc-test-user1", name="Protected", filters={})

    # Different owner cannot delete
    result = await svc.delete_saved_screen(db, created.id, "svc-test-user2")
    assert result is False

    # Original owner can still see it
    screen = await svc.get_saved_screen(db, created.id, "svc-test-user1")
    assert screen is not None


@pytest.mark.asyncio
async def test_update_saved_screen_stats(db):
    """Test updating saved screen stats."""
    created = await svc.create_saved_screen(db, owner_id="svc-test-user1", name="Stats", filters={})
    assert created.last_run_at is None
    assert created.last_result_count is None

    updated = await svc.update_saved_screen_stats(db, created.id, "svc-test-user1", result_count=42)
    assert updated.last_run_at is not None
    assert updated.last_result_count == 42
