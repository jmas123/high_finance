from fastapi import APIRouter, Query
from high_finance.services.valuation import get_valuation_bundle

router = APIRouter()

@router.get("/{ticker}")
async def read_valuation(
    ticker: str,
    growth: float = Query(default=0.10, ge=-0.50, le=1.00),
    margin: float = Query(default=0.20, ge=-0.50, le=0.80),
    tax: float = Query(default=0.21, ge=0.0, le=0.50),
    wacc: float = Query(default=0.10, ge=0.01, le=0.30),
    terminal_g: float = Query(default=0.03, ge=-0.02, le=0.06),
):
    return await get_valuation_bundle(
        ticker.upper(),
        growth=growth,
        margin=margin,
        tax=tax,
        wacc=wacc,
        terminal_g=terminal_g,
    )
