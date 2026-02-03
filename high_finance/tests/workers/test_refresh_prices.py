"""
Tests for price refresh job.
"""

from unittest.mock import patch, MagicMock
from datetime import datetime

import pytest
import pandas as pd


class TestRefreshPricesLogic:
    """Tests for price refresh logic."""

    @patch('high_finance.workers.tasks.refresh_prices.yf')
    def test_handles_empty_history(self, mock_yf):
        """Should handle tickers with no price data."""
        from high_finance.workers.tasks.refresh_prices import fetch_and_save_prices

        mock_ticker = MagicMock()
        mock_ticker.history.return_value = pd.DataFrame()  # Empty
        mock_yf.Ticker.return_value = mock_ticker

        db = MagicMock()
        count, success = fetch_and_save_prices(db, company_id=1, ticker="INVALID")

        assert count == 0
        assert success is False

    @patch('high_finance.workers.tasks.refresh_prices.yf')
    def test_skips_nan_prices(self, mock_yf):
        """Should skip rows with NaN prices."""
        from high_finance.workers.tasks.refresh_prices import fetch_and_save_prices

        # Create history with NaN values
        mock_ticker = MagicMock()
        hist = pd.DataFrame({
            'Open': [100.0, float('nan')],
            'High': [105.0, 106.0],
            'Low': [99.0, 98.0],
            'Close': [104.0, 105.0],
            'Volume': [1000, 2000],
        }, index=pd.date_range('2025-01-01', periods=2))
        mock_ticker.history.return_value = hist
        mock_yf.Ticker.return_value = mock_ticker

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None  # No existing

        count, success = fetch_and_save_prices(db, company_id=1, ticker="AAPL")

        # Should only add 1 price (the valid one)
        assert db.add.call_count == 1
        assert success is True

    @patch('high_finance.workers.tasks.refresh_prices.yf')
    def test_skips_existing_prices(self, mock_yf):
        """Should not duplicate existing prices."""
        from high_finance.workers.tasks.refresh_prices import fetch_and_save_prices

        mock_ticker = MagicMock()
        hist = pd.DataFrame({
            'Open': [100.0],
            'High': [105.0],
            'Low': [99.0],
            'Close': [104.0],
            'Volume': [1000],
        }, index=pd.date_range('2025-01-01', periods=1))
        mock_ticker.history.return_value = hist
        mock_yf.Ticker.return_value = mock_ticker

        db = MagicMock()
        # Simulate existing price
        db.query.return_value.filter.return_value.first.return_value = MagicMock()

        count, success = fetch_and_save_prices(db, company_id=1, ticker="AAPL")

        assert count == 0
        assert db.add.call_count == 0
        assert success is True

    @patch('high_finance.workers.tasks.refresh_prices.yf')
    def test_handles_api_error(self, mock_yf):
        """Should handle yfinance API errors gracefully."""
        from high_finance.workers.tasks.refresh_prices import fetch_and_save_prices

        mock_yf.Ticker.side_effect = Exception("API Error")

        db = MagicMock()
        count, success = fetch_and_save_prices(db, company_id=1, ticker="FAIL")

        assert count == 0
        assert success is False
        db.rollback.assert_called_once()


class TestRefreshPricesJob:
    """Tests for price refresh RQ job wrapper."""

    def test_returns_result_dict(self):
        """Job should return a result dict with status."""
        from high_finance.workers.tasks.refresh_prices import refresh_prices_job

        with patch('high_finance.workers.tasks.refresh_prices.SessionLocal') as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.execute.return_value.fetchall.return_value = []  # No companies

            result = refresh_prices_job()

            assert 'status' in result
            assert result['status'] == 'ok'
            mock_db.close.assert_called_once()

    def test_closes_session_on_error(self):
        """Job should close session even on error."""
        from high_finance.workers.tasks.refresh_prices import refresh_prices_job

        with patch('high_finance.workers.tasks.refresh_prices.SessionLocal') as mock_session:
            mock_db = MagicMock()
            mock_session.return_value = mock_db
            mock_db.execute.side_effect = Exception("DB Error")

            result = refresh_prices_job()

            assert result['status'] == 'error'
            mock_db.close.assert_called_once()
