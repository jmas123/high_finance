"""
Enhanced Valuation API Route

All parameters are optional - if not provided, smart defaults from actual
financials will be used.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from high_finance.services.valuation import get_valuation_bundle

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def read_valuation(
    ticker: str,
    growth: Optional[float] = Query(default=None, description="Revenue growth rate (5Y CAGR). Will be clamped to -10% to 50%."),
    margin: Optional[float] = Query(default=None, description="Operating margin. Will be clamped to -10% to 50%."),
    tax: Optional[float] = Query(default=None, description="Tax rate. Will be clamped to 10% to 35%."),
    wacc: Optional[float] = Query(default=None, description="Discount rate. Will be clamped to 5% to 20%."),
    terminal_g: Optional[float] = Query(default=None, description="Terminal growth rate. Will be clamped to 0% to 4%."),
):
    """
    Get comprehensive valuation analysis for a ticker.
    
    If parameters are not provided, smart defaults will be computed from:
    - Growth: Analyst estimates > 3Y historical CAGR > 1Y historical > sector median
    - Margin: Current operating margin > sector median
    - Tax: Effective tax rate > US statutory (21%)
    - WACC: CAPM from beta > default 10%
    - Terminal growth: 2.5% (long-run nominal GDP proxy)
    
    Returns:
    - DCF fair value with FCFF projections
    - Multiples-based valuations (EV/Revenue, EV/EBITDA, P/E)
    - Sensitivity tornado chart data
    - Bear/Base/Bull scenarios
    - Assumption warnings when inputs look aggressive
    - Analyst consensus targets
    """
    try:
        return await get_valuation_bundle(
            ticker.upper(),
            growth=growth,
            margin=margin,
            tax=tax,
            wacc=wacc,
            terminal_g=terminal_g,
        )
    except Exception as e:
        logger.exception("Valuation failed for %s", ticker)
        raise HTTPException(500, "Unable to compute valuation")