"""
Stock Screener API Tests
========================
Tests for the /api/v1/screener endpoints.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from src.main import app
from high_finance.db.base import Base
from high_finance.db.session import get_db
from high_finance.db.models.screener import ScreenerUniverse, ScreenerCache, SavedScreen


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


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Clean screener tables before each test."""
    db = TestingSessionLocal()
    try:
        # Clean up test data (order matters due to FK)
        db.execute(text("DELETE FROM screener_cache WHERE ticker LIKE 'TEST%'"))
        db.execute(text("DELETE FROM screener_universe WHERE ticker LIKE 'TEST%'"))
        db.execute(text("DELETE FROM saved_screens WHERE owner_id LIKE 'test-%'"))
        db.commit()
    finally:
        db.close()
    yield
    # Cleanup after test
    db = TestingSessionLocal()
    try:
        db.execute(text("DELETE FROM screener_cache WHERE ticker LIKE 'TEST%'"))
        db.execute(text("DELETE FROM screener_universe WHERE ticker LIKE 'TEST%'"))
        db.execute(text("DELETE FROM saved_screens WHERE owner_id LIKE 'test-%'"))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def db_session():
    """Get a test database session."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def seed_universe(db_session):
    """Seed the screener universe with test data."""
    tickers = [
        ScreenerUniverse(ticker="TESTAAPL", company_name="Test Apple Inc.", sector="Technology", industry="Consumer Electronics", is_active=True),
        ScreenerUniverse(ticker="TESTMSFT", company_name="Test Microsoft", sector="Technology", industry="Software", is_active=True),
        ScreenerUniverse(ticker="TESTJPM", company_name="Test JPMorgan", sector="Financials", industry="Banks", is_active=True),
        ScreenerUniverse(ticker="TESTJNJ", company_name="Test J&J", sector="Healthcare", industry="Pharmaceuticals", is_active=True),
        ScreenerUniverse(ticker="TESTXOM", company_name="Test Exxon", sector="Energy", industry="Oil & Gas", is_active=True),
        ScreenerUniverse(ticker="TESTINACT", company_name="Test Inactive", sector="Technology", industry="Software", is_active=False),
    ]
    db_session.add_all(tickers)
    db_session.commit()
    return tickers


@pytest.fixture
def seed_cache(db_session, seed_universe):
    """Seed the screener cache with test data."""
    cache_rows = [
        ScreenerCache(
            ticker="TESTAAPL", market_cap=3_000_000_000_000, current_price=180.50, price_change_1d=0.025,
            pe_ratio=28.5, forward_pe=25.0, pb_ratio=45.0, ev_to_ebitda=22.0,
            revenue_growth=0.08, dividend_yield=0.005, price_vs_200ma=0.15, price_vs_52w_high=-0.05,
            insider_net_shares_90d=50000, insider_buys_90d=5, insider_sells_90d=2,
            congress_net_value_90d=500000, congress_buys_90d=3, congress_sells_90d=0,
        ),
        ScreenerCache(
            ticker="TESTMSFT", market_cap=2_800_000_000_000, current_price=380.00, price_change_1d=0.012,
            pe_ratio=32.0, forward_pe=28.0, pb_ratio=12.0, ev_to_ebitda=25.0,
            revenue_growth=0.12, dividend_yield=0.008, price_vs_200ma=0.10, price_vs_52w_high=-0.08,
            insider_net_shares_90d=-10000, insider_buys_90d=1, insider_sells_90d=3,
            congress_net_value_90d=0, congress_buys_90d=0, congress_sells_90d=0,
        ),
        ScreenerCache(
            ticker="TESTJPM", market_cap=500_000_000_000, current_price=175.00, price_change_1d=-0.008,
            pe_ratio=10.5, forward_pe=9.5, pb_ratio=1.5, ev_to_ebitda=None,  # Banks don't use EV/EBITDA
            revenue_growth=0.05, dividend_yield=0.025, price_vs_200ma=0.05, price_vs_52w_high=-0.12,
            insider_net_shares_90d=20000, insider_buys_90d=4, insider_sells_90d=1,
            congress_net_value_90d=100000, congress_buys_90d=2, congress_sells_90d=1,
        ),
        ScreenerCache(
            ticker="TESTJNJ", market_cap=400_000_000_000, current_price=155.00, price_change_1d=0.003,
            pe_ratio=15.0, forward_pe=14.0, pb_ratio=5.5, ev_to_ebitda=14.0,
            revenue_growth=0.03, dividend_yield=0.030, price_vs_200ma=-0.02, price_vs_52w_high=-0.15,
            insider_net_shares_90d=0, insider_buys_90d=0, insider_sells_90d=0,
            congress_net_value_90d=0, congress_buys_90d=0, congress_sells_90d=0,
        ),
        ScreenerCache(
            ticker="TESTXOM", market_cap=450_000_000_000, current_price=105.00, price_change_1d=-0.015,
            pe_ratio=12.0, forward_pe=11.0, pb_ratio=2.0, ev_to_ebitda=5.5,
            revenue_growth=-0.02, dividend_yield=0.035, price_vs_200ma=-0.08, price_vs_52w_high=-0.20,
            insider_net_shares_90d=5000, insider_buys_90d=2, insider_sells_90d=1,
            congress_net_value_90d=250000, congress_buys_90d=4, congress_sells_90d=0,
        ),
    ]
    db_session.add_all(cache_rows)
    db_session.commit()
    return cache_rows


client = TestClient(app)
OWNER_ID = "test-user-123"
HEADERS = {"X-Owner-Id": OWNER_ID}


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENER ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

def test_screener_no_filters(seed_cache):
    """Test screener with no filters returns all active test stocks."""
    response = client.get("/api/v1/screener")
    assert response.status_code == 200
    data = response.json()
    # Filter to just our test tickers
    test_tickers = [r["ticker"] for r in data["results"] if r["ticker"].startswith("TEST")]
    assert len(test_tickers) == 5  # 5 active test stocks


def test_screener_filter_market_cap(seed_cache):
    """Test market cap filtering (in millions)."""
    # Min 1T = 1,000,000M
    response = client.get("/api/v1/screener?market_cap_min=1000000")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" in tickers
    assert "TESTMSFT" in tickers

    # Max 500B = 500,000M
    response = client.get("/api/v1/screener?market_cap_max=500000")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" not in tickers
    assert "TESTJPM" in tickers


def test_screener_filter_pe_ratio(seed_cache):
    """Test P/E ratio filtering excludes NULLs."""
    # P/E under 15
    response = client.get("/api/v1/screener?pe_ratio_max=15")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    # TESTJPM (10.5), TESTXOM (12.0), TESTJNJ (15.0) should match
    assert "TESTJPM" in tickers
    assert "TESTXOM" in tickers
    assert "TESTJNJ" in tickers
    assert "TESTAAPL" not in tickers  # P/E 28.5


def test_screener_filter_sectors(seed_cache):
    """Test multi-sector filtering."""
    response = client.get("/api/v1/screener?sectors=Technology,Financials")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" in tickers
    assert "TESTMSFT" in tickers
    assert "TESTJPM" in tickers
    assert "TESTJNJ" not in tickers  # Healthcare
    assert "TESTXOM" not in tickers  # Energy


def test_screener_filter_insider(seed_cache):
    """Test insider activity filters."""
    # Has insider buys
    response = client.get("/api/v1/screener?has_insider_buys_90d=true")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" in tickers
    assert "TESTJPM" in tickers
    assert "TESTJNJ" not in tickers  # No insider buys

    # Net positive insider shares
    response = client.get("/api/v1/screener?insider_net_shares_90d_min=1")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" in tickers  # +50000
    assert "TESTMSFT" not in tickers  # -10000


def test_screener_filter_congress(seed_cache):
    """Test congress activity filter."""
    response = client.get("/api/v1/screener?congress_net_value_90d_min=100000")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTAAPL" in tickers  # $500k
    assert "TESTXOM" in tickers  # $250k
    assert "TESTJPM" in tickers  # $100k
    assert "TESTMSFT" not in tickers  # $0


def test_screener_sort_order(seed_cache):
    """Test sorting works correctly."""
    # Sort by P/E ascending
    response = client.get("/api/v1/screener?sort_by=pe_ratio&sort_order=asc")
    assert response.status_code == 200
    data = response.json()
    pe_ratios = [r["pe_ratio"] for r in data["results"] if r["pe_ratio"]]
    assert pe_ratios == sorted(pe_ratios)

    # Sort by market cap descending (default)
    response = client.get("/api/v1/screener?sort_by=market_cap&sort_order=desc")
    assert response.status_code == 200
    data = response.json()
    market_caps = [r["market_cap"] for r in data["results"] if r["market_cap"]]
    assert market_caps == sorted(market_caps, reverse=True)


def test_screener_pagination(seed_cache):
    """Test offset and limit work correctly."""
    response = client.get("/api/v1/screener?limit=2&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    first_page_tickers = [r["ticker"] for r in data["results"]]

    response = client.get("/api/v1/screener?limit=2&offset=2")
    assert response.status_code == 200
    data = response.json()
    second_page_tickers = [r["ticker"] for r in data["results"]]

    # No overlap
    assert not set(first_page_tickers) & set(second_page_tickers)


def test_screener_combined_filters(seed_cache):
    """Test multiple filters combined."""
    # Tech sector, P/E under 35, insider buys
    response = client.get(
        "/api/v1/screener?sectors=Technology&pe_ratio_max=35&has_insider_buys_90d=true"
    )
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    # TESTAAPL: Tech, P/E 28.5, has insider buys
    # TESTMSFT: Tech, P/E 32, has insider buys (1)
    assert "TESTAAPL" in tickers
    assert "TESTMSFT" in tickers


def test_screener_excludes_inactive(seed_cache):
    """Test that inactive stocks are excluded."""
    response = client.get("/api/v1/screener")
    assert response.status_code == 200
    data = response.json()
    tickers = [r["ticker"] for r in data["results"]]
    assert "TESTINACT" not in tickers


def test_screener_limit_validation():
    """Test limit is capped at 200."""
    response = client.get("/api/v1/screener?limit=500")
    assert response.status_code == 422  # Validation error


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED SCREENS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

def test_saved_screen_crud(seed_cache):
    """Test create, read, delete saved screens."""
    # Create
    create_response = client.post(
        "/api/v1/screener/saved",
        json={"name": "Value Stocks", "filters": {"pe_ratio_max": 15, "sectors": "Technology"}},
        headers=HEADERS,
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Value Stocks"
    assert created["filters"]["pe_ratio_max"] == 15
    assert created["owner_id"] == OWNER_ID
    screen_id = created["id"]

    # List
    list_response = client.get("/api/v1/screener/saved", headers=HEADERS)
    assert list_response.status_code == 200
    screens = list_response.json()
    assert len(screens) == 1
    assert screens[0]["id"] == screen_id

    # Delete
    delete_response = client.delete(f"/api/v1/screener/saved/{screen_id}", headers=HEADERS)
    assert delete_response.status_code == 204

    # Verify deleted
    list_response = client.get("/api/v1/screener/saved", headers=HEADERS)
    assert len(list_response.json()) == 0


def test_saved_screen_owner_scoping(seed_cache):
    """Test saved screens are scoped to owner."""
    # Create as test-user1
    client.post(
        "/api/v1/screener/saved",
        json={"name": "User1 Screen", "filters": {}},
        headers={"X-Owner-Id": "test-user1"},
    )

    # Create as test-user2
    client.post(
        "/api/v1/screener/saved",
        json={"name": "User2 Screen", "filters": {}},
        headers={"X-Owner-Id": "test-user2"},
    )

    # User1 only sees their screen
    response = client.get("/api/v1/screener/saved", headers={"X-Owner-Id": "test-user1"})
    screens = response.json()
    assert len(screens) == 1
    assert screens[0]["name"] == "User1 Screen"

    # User2 only sees their screen
    response = client.get("/api/v1/screener/saved", headers={"X-Owner-Id": "test-user2"})
    screens = response.json()
    assert len(screens) == 1
    assert screens[0]["name"] == "User2 Screen"


def test_saved_screen_delete_not_found():
    """Test deleting non-existent screen returns 404."""
    response = client.delete("/api/v1/screener/saved/99999", headers=HEADERS)
    assert response.status_code == 404


def test_saved_screen_requires_owner_header():
    """Test saved screen endpoints require X-Owner-Id header."""
    # Missing header
    response = client.get("/api/v1/screener/saved")
    assert response.status_code == 422  # Missing required header

    response = client.post(
        "/api/v1/screener/saved",
        json={"name": "Test", "filters": {}},
    )
    assert response.status_code == 422
