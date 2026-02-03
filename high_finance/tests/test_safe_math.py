"""Tests for safe_math utilities."""

import math
import pytest

from high_finance.utils.safe_math import (
    safe_div,
    safe_pct_change,
    safe_return,
    safe_round,
    is_valid_price,
)


class TestSafeDiv:
    """Test safe_div function."""

    def test_normal_division(self):
        assert safe_div(10, 2) == 5.0
        assert safe_div(100, 4) == 25.0
        assert safe_div(1, 3) == pytest.approx(0.333333, rel=1e-4)

    def test_zero_denominator(self):
        """Division by zero should return default."""
        assert safe_div(10, 0) is None
        assert safe_div(10, 0, default=0.0) == 0.0
        assert safe_div(100, 0.0) is None

    def test_near_zero_denominator(self):
        """Very small denominators should return default."""
        assert safe_div(10, 1e-15) is None
        assert safe_div(10, -1e-15) is None

    def test_none_inputs(self):
        """None inputs should return default."""
        assert safe_div(None, 5) is None
        assert safe_div(10, None) is None
        assert safe_div(None, None) is None
        assert safe_div(None, 5, default=-1.0) == -1.0

    def test_negative_numbers(self):
        """Negative numbers should work correctly."""
        assert safe_div(-10, 2) == -5.0
        assert safe_div(10, -2) == -5.0
        assert safe_div(-10, -2) == 5.0

    def test_infinity_result(self):
        """Infinity results should return default."""
        # This shouldn't happen with zero check, but test anyway
        assert safe_div(float('inf'), 1) is None
        assert safe_div(1, float('inf')) == 0.0  # This is finite

    def test_nan_input(self):
        """NaN inputs should return default."""
        assert safe_div(float('nan'), 5) is None
        assert safe_div(5, float('nan')) is None


class TestSafePctChange:
    """Test safe_pct_change function."""

    def test_normal_percentage(self):
        """Normal percentage change calculations."""
        # 10% increase: (110 - 100) / 100 = 0.10 = 10%
        assert safe_pct_change(110, 100) == pytest.approx(10.0)
        # 20% decrease: (80 - 100) / 100 = -0.20 = -20%
        assert safe_pct_change(80, 100) == pytest.approx(-20.0)
        # No change
        assert safe_pct_change(100, 100) == pytest.approx(0.0)

    def test_as_decimal(self):
        """Return as decimal instead of percentage."""
        assert safe_pct_change(110, 100, as_percentage=False) == pytest.approx(0.10)
        assert safe_pct_change(80, 100, as_percentage=False) == pytest.approx(-0.20)

    def test_zero_baseline(self):
        """Zero baseline should return default."""
        assert safe_pct_change(100, 0) is None
        assert safe_pct_change(100, 0, default=0.0) == 0.0

    def test_none_inputs(self):
        """None inputs should return default."""
        assert safe_pct_change(None, 100) is None
        assert safe_pct_change(100, None) is None

    def test_small_values(self):
        """Small values should work correctly."""
        # 5% increase from 0.01 to 0.0105
        assert safe_pct_change(0.0105, 0.01) == pytest.approx(5.0, rel=1e-4)

    def test_large_percentage_change(self):
        """Large percentage changes should work."""
        # 900% increase: (1000 - 100) / 100 = 9.0 = 900%
        assert safe_pct_change(1000, 100) == pytest.approx(900.0)


class TestSafeReturn:
    """Test safe_return function."""

    def test_positive_return(self):
        """Positive returns."""
        # Buy at 100, sell at 110 = 10% return
        assert safe_return(100, 110) == pytest.approx(10.0)

    def test_negative_return(self):
        """Negative returns (losses)."""
        # Buy at 100, sell at 90 = -10% return
        assert safe_return(100, 90) == pytest.approx(-10.0)

    def test_as_decimal(self):
        """Return as decimal."""
        assert safe_return(100, 110, as_percentage=False) == pytest.approx(0.10)

    def test_zero_entry(self):
        """Zero entry price should return default."""
        assert safe_return(0, 100) is None
        assert safe_return(0, 100, default=0.0) == 0.0

    def test_negative_entry(self):
        """Negative entry price should return default."""
        assert safe_return(-100, 110) is None

    def test_none_inputs(self):
        """None inputs should return default."""
        assert safe_return(None, 110) is None
        assert safe_return(100, None) is None

    def test_politician_trade_scenario(self):
        """Test real politician trade scenario."""
        # Entry at $50.25, exit at $52.75 (30 days later)
        entry = 50.25
        exit_price = 52.75
        expected_return = ((52.75 / 50.25) - 1) * 100
        assert safe_return(entry, exit_price) == pytest.approx(expected_return)


class TestSafeRound:
    """Test safe_round function."""

    def test_normal_rounding(self):
        """Normal rounding."""
        assert safe_round(3.14159, 2) == 3.14
        assert safe_round(3.14159, 4) == 3.1416
        assert safe_round(3.5, 0) == 4.0

    def test_none_input(self):
        """None input should return default."""
        assert safe_round(None) is None
        assert safe_round(None, default=0.0) == 0.0

    def test_nan_input(self):
        """NaN input should return default."""
        assert safe_round(float('nan')) is None

    def test_infinity_input(self):
        """Infinity input should return default."""
        assert safe_round(float('inf')) is None
        assert safe_round(float('-inf')) is None


class TestIsValidPrice:
    """Test is_valid_price function."""

    def test_valid_prices(self):
        """Valid price values."""
        assert is_valid_price(100.0) is True
        assert is_valid_price(0.01) is True
        assert is_valid_price(1000000) is True

    def test_zero_price(self):
        """Zero is not a valid price."""
        assert is_valid_price(0) is False
        assert is_valid_price(0.0) is False

    def test_negative_price(self):
        """Negative prices are invalid."""
        assert is_valid_price(-1) is False
        assert is_valid_price(-100.50) is False

    def test_none_price(self):
        """None is not valid."""
        assert is_valid_price(None) is False

    def test_nan_price(self):
        """NaN is not valid."""
        assert is_valid_price(float('nan')) is False

    def test_infinity_price(self):
        """Infinity is not valid."""
        assert is_valid_price(float('inf')) is False


class TestEdgeCases:
    """Integration tests for edge cases found in the codebase."""

    def test_moneyness_with_zero_stock_price(self):
        """options_decay.py:105 - get_moneyness_label with S=0."""
        S = 0  # Stock price
        K = 100  # Strike price
        # Original: pct_diff = abs(S - K) / S * 100  # Would crash
        # Fixed:
        pct_diff = safe_div(abs(S - K), S, default=float('inf'))
        if pct_diff is None or pct_diff == float('inf'):
            pct_diff = float('inf')  # Treat as far OTM
        assert pct_diff == float('inf')

    def test_expected_move_with_zero_price(self):
        """options_flow.py:212 - expected_move_pct with current_price=0."""
        straddle_price = 5.50
        current_price = 0
        # Original: expected_move_pct = round((straddle_price / current_price) * 100, 1)
        # Fixed:
        expected_move_pct = safe_pct_change(straddle_price, current_price)
        assert expected_move_pct is None

    def test_eps_surprise_with_zero_estimate(self):
        """earnings.py:125 - surprise_pct with eps_est=0."""
        eps_act = 1.25
        eps_est = 0
        # Original: surprise_pct = (surprise / abs(eps_est)) * 100  # Division by zero
        # Fixed:
        surprise = eps_act - eps_est
        surprise_pct = safe_div(surprise, abs(eps_est) if eps_est != 0 else None)
        if surprise_pct is not None:
            surprise_pct *= 100
        assert surprise_pct is None

    def test_price_returns_with_zero_in_array(self):
        """risk.py:23 - _pct_returns with a zero price."""
        import numpy as np
        closes = [100.0, 105.0, 0.0, 110.0]  # Zero price in middle
        arr = np.array(closes, dtype=float)
        # Original: rets = arr[1:] / arr[:-1] - 1.0  # Would produce inf
        # But the code has: rets = rets[np.isfinite(rets)]
        rets = arr[1:] / arr[:-1] - 1.0
        rets_clean = rets[np.isfinite(rets)]
        # Should filter out the inf
        assert len(rets_clean) == 2  # Only 2 finite returns

    def test_institutional_pct_with_zero_shares(self):
        """institutional_flow.py:25 - pct_held with shares_outstanding=0."""
        shares = 1000000
        shares_outstanding = 0
        # Original: pct_held = shares / shares_outstanding  # Division by zero
        # Fixed:
        pct_held = safe_div(shares, shares_outstanding) if shares_outstanding and shares_outstanding > 0 else None
        assert pct_held is None

    def test_yoy_calculation_with_zero_baseline(self):
        """market.py:293-294 - YoY calculation with zero baseline."""
        current_value = 105.0
        baseline_value = 0.0
        # Original: cur = ((float(raw.iloc[-1]) / float(raw.iloc[-13])) - 1) * 100
        # Fixed:
        yoy_pct = safe_pct_change(current_value, baseline_value)
        assert yoy_pct is None

    def test_total_return_with_zero_start(self):
        """market.py:534 - total return with zero starting price."""
        end_price = 110.0
        start_price = 0.0
        # Original: tr = ((float(chunk.iloc[-1]) / float(chunk.iloc[0])) - 1) * 100
        # Fixed:
        tr = safe_return(start_price, end_price)
        assert tr is None
