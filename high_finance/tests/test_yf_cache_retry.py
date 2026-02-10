"""
Tests for yfinance retry logic and cache lock-detection fixes.

Requires: DATABASE_URL and DEBUG=True env vars to pass Settings validation.
Run with: DATABASE_URL="postgresql://x:x@localhost/x" DEBUG=True PYTHONPATH=src pytest tests/test_yf_cache_retry.py -v
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from high_finance.services.yf_cache import _fetch_yf_info_sync
from high_finance.core.cache import get_or_compute


# ── Fix 1: _fetch_yf_info_sync retries ALL exceptions ──────────────────────


class TestYfInfoRetry:
    """Verify _fetch_yf_info_sync retries on any exception, not just 401."""

    def test_retries_on_type_error(self):
        """The exact bug: yfinance raises TypeError on failed crumb auth."""
        call_count = 0

        def mock_info():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise TypeError("argument of type 'NoneType' is not iterable")
            return {"symbol": "AAPL", "shortName": "Apple Inc."}

        with patch("high_finance.services.yf_cache.yf") as mock_yf, \
             patch("high_finance.services.yf_cache.time.sleep"):
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(lambda self: mock_info())
            mock_yf.Ticker.return_value = mock_ticker

            result = _fetch_yf_info_sync("AAPL", max_retries=2)

        assert result == {"symbol": "AAPL", "shortName": "Apple Inc."}
        assert call_count == 2  # Failed once, succeeded on retry

    def test_retries_on_401_unauthorized(self):
        """Original 401 case still works."""
        call_count = 0

        def mock_info():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("401 Unauthorized")
            return {"symbol": "MSFT"}

        with patch("high_finance.services.yf_cache.yf") as mock_yf, \
             patch("high_finance.services.yf_cache.time.sleep"):
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(lambda self: mock_info())
            mock_yf.Ticker.return_value = mock_ticker

            result = _fetch_yf_info_sync("MSFT", max_retries=2)

        assert result == {"symbol": "MSFT"}
        assert call_count == 2

    def test_retries_on_connection_error(self):
        """Network errors should also retry."""
        call_count = 0

        def mock_info():
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise ConnectionError("Connection reset by peer")
            return {"symbol": "GOOG"}

        with patch("high_finance.services.yf_cache.yf") as mock_yf, \
             patch("high_finance.services.yf_cache.time.sleep"):
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(lambda self: mock_info())
            mock_yf.Ticker.return_value = mock_ticker

            result = _fetch_yf_info_sync("GOOG", max_retries=2)

        assert result == {"symbol": "GOOG"}
        assert call_count == 3  # Failed twice, succeeded on third

    def test_raises_after_max_retries_exhausted(self):
        """If all retries fail, the exception propagates."""
        with patch("high_finance.services.yf_cache.yf") as mock_yf, \
             patch("high_finance.services.yf_cache.time.sleep"):
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(
                lambda self: (_ for _ in ()).throw(TypeError("always fails"))
            )
            mock_yf.Ticker.return_value = mock_ticker

            with pytest.raises(TypeError, match="always fails"):
                _fetch_yf_info_sync("BAD", max_retries=2)

    def test_returns_empty_dict_on_none_info(self):
        """yfinance returning None should give {} not crash."""
        with patch("high_finance.services.yf_cache.yf") as mock_yf:
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(lambda self: None)
            mock_yf.Ticker.return_value = mock_ticker

            result = _fetch_yf_info_sync("NULL", max_retries=0)

        assert result == {}

    def test_creates_fresh_ticker_on_each_retry(self):
        """Each retry creates a new yf.Ticker() — gets fresh crumb/session."""
        call_count = 0

        def mock_info():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise TypeError("crumb fail")
            return {"symbol": "NVDA"}

        with patch("high_finance.services.yf_cache.yf") as mock_yf, \
             patch("high_finance.services.yf_cache.time.sleep"):
            mock_ticker = MagicMock()
            type(mock_ticker).info = property(lambda self: mock_info())
            mock_yf.Ticker.return_value = mock_ticker

            _fetch_yf_info_sync("NVDA", max_retries=2)

        # yf.Ticker() should be called twice (initial + retry)
        assert mock_yf.Ticker.call_count == 2


# ── Fix 2: get_or_compute detects failed lock ──────────────────────────────


class TestGetOrComputeLockDetection:
    """Verify polling tasks detect a released lock and retry immediately."""

    @pytest.mark.asyncio
    async def test_polls_detect_released_lock_and_compute(self):
        """
        Scenario: Lock holder fails (lock deleted, no value cached).
        Polling task should detect lock gone within one poll and compute itself.
        """
        compute_result = {"data": "fresh"}

        with patch("high_finance.core.cache.get_cached") as mock_get, \
             patch("high_finance.core.cache.get_redis") as mock_redis_fn, \
             patch("high_finance.core.cache.set_cached"):

            mock_r = AsyncMock()
            mock_redis_fn.return_value = mock_r

            # Cache miss on all checks
            mock_get.return_value = None

            # Lock acquisition fails (someone else holds it)
            mock_r.set.return_value = False

            # Lock no longer exists (holder failed and released it)
            mock_r.exists.return_value = 0

            compute_fn = AsyncMock(return_value=compute_result)

            result = await get_or_compute("test:key", 900, compute_fn)

        assert result == compute_result
        compute_fn.assert_called_once()
        mock_r.exists.assert_called()

    @pytest.mark.asyncio
    async def test_polls_wait_when_lock_still_held(self):
        """
        Scenario: Lock holder is still computing (lock exists).
        Polling task should keep waiting and eventually get the cached value.
        """
        poll_iteration = 0

        async def mock_get_cached_fn(key):
            nonlocal poll_iteration
            poll_iteration += 1
            # First call is the initial check (line 154)
            # Return cached value on 3rd overall call (2nd poll iteration)
            if poll_iteration >= 3:
                return {"data": "from_cache"}
            return None

        with patch("high_finance.core.cache.get_cached", side_effect=mock_get_cached_fn), \
             patch("high_finance.core.cache.get_redis") as mock_redis_fn, \
             patch("high_finance.core.cache.set_cached"), \
             patch("high_finance.core.cache.asyncio.sleep", new_callable=AsyncMock):

            mock_r = AsyncMock()
            mock_redis_fn.return_value = mock_r

            # Lock acquisition fails
            mock_r.set.return_value = False
            # Lock still exists (holder is computing)
            mock_r.exists.return_value = 1

            compute_fn = AsyncMock(return_value={"should": "not be called"})

            result = await get_or_compute("test:key", 900, compute_fn)

        assert result == {"data": "from_cache"}
        compute_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_redis_error_in_exists_breaks_poll(self):
        """
        If r.exists() throws (Redis hiccup), break out and compute ourselves
        rather than staying stuck in the poll loop.
        """
        with patch("high_finance.core.cache.get_cached", return_value=None), \
             patch("high_finance.core.cache.get_redis") as mock_redis_fn, \
             patch("high_finance.core.cache.set_cached"), \
             patch("high_finance.core.cache.asyncio.sleep", new_callable=AsyncMock):

            mock_r = AsyncMock()
            mock_redis_fn.return_value = mock_r

            mock_r.set.return_value = False  # Lock not acquired
            mock_r.exists.side_effect = Exception("Redis connection lost")

            compute_fn = AsyncMock(return_value={"fallback": True})

            result = await get_or_compute("test:key", 900, compute_fn)

        assert result == {"fallback": True}
        compute_fn.assert_called_once()
