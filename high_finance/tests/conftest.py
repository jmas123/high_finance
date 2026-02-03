"""
Pytest Configuration
====================
Shared fixtures and configuration for all tests.
"""

import pytest

# Configure pytest-asyncio to auto-detect async tests
pytest_plugins = ('pytest_asyncio',)


@pytest.fixture(scope="session")
def db_session():
    """Session-scoped database fixture (placeholder)."""
    # Setup code for creating a database session
    pass


@pytest.fixture(autouse=True)
def run_around_tests(db_session):
    """Run before/after each test."""
    # Code to run before and after each test
    pass
