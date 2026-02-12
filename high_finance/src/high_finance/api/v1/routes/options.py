import logging

from fastapi import APIRouter, HTTPException, Query, Request

from high_finance.core.rate_limit import limiter
from high_finance.services.options_flow import get_options_overview, get_options_chain
from high_finance.services.options_decay import simulate_option_decay, get_decay_simulation_for_contract, get_iv_context, get_contract_iv

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{ticker}")
@limiter.limit("10/minute")
async def read_options_overview(request: Request, ticker: str):
    """Get options overview with unusual activity detection."""
    data = await get_options_overview(ticker.upper())
    return data


@router.get("/{ticker}/chain/{expiry}")
async def read_options_chain(ticker: str, expiry: str):
    """Get full options chain for a specific expiration."""
    data = await get_options_chain(ticker.upper(), expiry)
    return data


@router.get("/{ticker}/iv-context")
async def read_iv_context(ticker: str):
    """
    Get IV context for a ticker to help users understand volatility.
    
    Returns:
    - atm_iv: Current at-the-money implied volatility
    - iv_percentile: Where current IV ranks vs historical (0-100)
    - iv_high_52w / iv_low_52w: Estimated IV range
    - hv_20 / hv_60: 20-day and 60-day historical volatility
    - suggested_iv: Recommended IV to use for simulations
    - iv_by_expiry: ATM IV for each available expiration
    """
    data = await get_iv_context(ticker.upper())
    return data


@router.get("/{ticker}/contract-iv/{expiry}/{strike}")
async def read_contract_iv(
    ticker: str,
    expiry: str,
    strike: float,
    option_type: str = Query("call", pattern="^(call|put)$"),
):
    """
    Get the implied volatility for a specific contract.
    
    Use this to auto-populate IV when user selects a strike.
    """
    data = await get_contract_iv(
        ticker=ticker.upper(),
        expiry=expiry,
        strike=strike,
        option_type=option_type
    )
    return data


@router.post("/{ticker}/decay-simulation")
async def run_decay_simulation(
    ticker: str,
    stock_price: float = Query(..., description="Current stock price"),
    strike: float = Query(..., description="Option strike price"),
    days_to_expiry: int = Query(..., ge=1, le=730, description="Days until expiration"),
    implied_volatility: float = Query(..., gt=0, le=5, description="IV as decimal (0.30 = 30%)"),
    option_type: str = Query("call", pattern="^(call|put)$", description="Option type"),
    risk_free_rate: float = Query(0.045, ge=0, le=0.2, description="Risk-free rate as decimal"),
):
    """
    Simulate option price decay over time with flat stock price.
    
    This educational tool shows how theta erodes option value when
    the underlying doesn't move.
    """
    try:
        result = await simulate_option_decay(
            ticker=ticker.upper(),
            stock_price=stock_price,
            strike=strike,
            days_to_expiry=days_to_expiry,
            implied_volatility=implied_volatility,
            option_type=option_type,
            risk_free_rate=risk_free_rate
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Decay simulation failed for %s", ticker)
        raise HTTPException(status_code=500, detail="Simulation failed")


@router.get("/{ticker}/decay-simulation/{expiry}/{strike}")
async def get_decay_for_contract(
    ticker: str,
    expiry: str,
    strike: float,
    option_type: str = Query("call", pattern="^(call|put)$"),
):
    """
    Get decay simulation for a specific contract from the options chain.
    Automatically fetches current stock price and IV from market data.
    """
    try:
        result = await get_decay_simulation_for_contract(
            ticker=ticker.upper(),
            expiry=expiry,
            strike=strike,
            option_type=option_type
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Decay simulation for contract failed: %s %s %s", ticker, expiry, strike)
        raise HTTPException(status_code=500, detail="Simulation failed")