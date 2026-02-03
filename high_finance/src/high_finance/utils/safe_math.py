"""
Safe math utilities for price/return/percentage calculations.

Provides zero-division protection, NaN handling, and consistent rounding.
"""

import math
from typing import Optional, Union

Number = Union[int, float]


def safe_div(
    numerator: Optional[Number],
    denominator: Optional[Number],
    default: Optional[float] = None,
) -> Optional[float]:
    """
    Safely divide two numbers, returning default if division is invalid.

    Args:
        numerator: The dividend
        denominator: The divisor
        default: Value to return if division fails (default: None)

    Returns:
        The quotient, or default if:
        - Either input is None
        - Denominator is zero or near-zero (< 1e-10)
        - Result is NaN or Infinity
    """
    if numerator is None or denominator is None:
        return default

    try:
        num = float(numerator)
        denom = float(denominator)
    except (TypeError, ValueError):
        return default

    # Check for zero/near-zero denominator
    if abs(denom) < 1e-10:
        return default

    result = num / denom

    # Check for NaN/Infinity
    if not math.isfinite(result):
        return default

    return result


def safe_pct_change(
    current: Optional[Number],
    previous: Optional[Number],
    as_percentage: bool = True,
    default: Optional[float] = None,
) -> Optional[float]:
    """
    Calculate percentage change safely.

    Args:
        current: Current value
        previous: Previous/baseline value
        as_percentage: If True, return as percentage (e.g., 5.0 for 5%)
                      If False, return as decimal (e.g., 0.05 for 5%)
        default: Value to return if calculation fails

    Returns:
        Percentage change, or default if invalid
    """
    if current is None or previous is None:
        return default

    try:
        curr = float(current)
        prev = float(previous)
    except (TypeError, ValueError):
        return default

    if abs(prev) < 1e-10:
        return default

    change = (curr - prev) / prev

    if not math.isfinite(change):
        return default

    if as_percentage:
        return change * 100
    return change


def safe_return(
    entry_price: Optional[Number],
    exit_price: Optional[Number],
    as_percentage: bool = True,
    default: Optional[float] = None,
) -> Optional[float]:
    """
    Calculate return (exit/entry - 1) safely.

    Args:
        entry_price: Entry/purchase price (baseline)
        exit_price: Exit/sale price
        as_percentage: If True, return as percentage
        default: Value to return if calculation fails

    Returns:
        Return value, or default if invalid
    """
    if entry_price is None or exit_price is None:
        return default

    try:
        entry = float(entry_price)
        exit_val = float(exit_price)
    except (TypeError, ValueError):
        return default

    if entry <= 0:
        return default

    ret = (exit_val / entry) - 1.0

    if not math.isfinite(ret):
        return default

    if as_percentage:
        return ret * 100
    return ret


def safe_round(
    value: Optional[Number],
    decimals: int = 2,
    default: Optional[float] = None,
) -> Optional[float]:
    """
    Safely round a number, handling None and NaN.

    Args:
        value: Number to round
        decimals: Number of decimal places
        default: Value to return if rounding fails

    Returns:
        Rounded value, or default if invalid
    """
    if value is None:
        return default

    try:
        val = float(value)
    except (TypeError, ValueError):
        return default

    if not math.isfinite(val):
        return default

    return round(val, decimals)


def is_valid_price(price: Optional[Number]) -> bool:
    """Check if a price value is valid (positive and finite)."""
    if price is None:
        return False
    try:
        p = float(price)
        return p > 0 and math.isfinite(p)
    except (TypeError, ValueError):
        return False
