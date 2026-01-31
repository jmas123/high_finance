"""
OPTION DECAY ROUTES - Add these routes to high_finance/api/v1/routes/options.py
"""

from fastapi import APIRouter, HTTPException, Query

from high_finance.services.options_decay import (
     simulate_option_decay,  
     get_decay_simulation_for_contract
)

router = APIRouter()

# ADD THIS NEW ENDPOINT to options.py:

@router.post("/{ticker}/decay-simulation")
async def run_decay_simulation(
    ticker: str,
    stock_price: float = Query(..., description="Current stock price"),
    strike: float = Query(..., description="Option strike price"),
    days_to_expiry: int = Query(..., ge=1, le=730, description="Days until expiration"),
    implied_volatility: float = Query(..., gt=0, le=5, description="IV as decimal (0.30 = 30%)"),
    option_type: str = Query("call", regex="^(call|put)$", description="Option type"),
    risk_free_rate: float = Query(0.045, ge=0, le=0.2, description="Risk-free rate as decimal"),
):
    """
    Simulate option price decay over time with flat stock price.
    
    This educational tool shows how theta erodes option value when
    the underlying doesn't move. Useful for understanding time decay
    dynamics and whether a setup favors buyers or sellers.
    
    Parameters:
    - stock_price: Current price of the underlying
    - strike: Option strike price  
    - days_to_expiry: Number of days until expiration
    - implied_volatility: As decimal (0.30 = 30%, not 30)
    - option_type: 'call' or 'put'
    - risk_free_rate: Annual risk-free rate (default 4.5%)
    
    Returns decay curve and analysis of the time decay scenario.
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


@router.get("/{ticker}/decay-simulation/{expiry}/{strike}")
async def get_decay_for_contract(
    ticker: str,
    expiry: str,
    strike: float,
    option_type: str = Query("call", regex="^(call|put)$"),
):
    """
    Get decay simulation for a specific contract from the options chain.
    
    Automatically fetches current stock price and IV from market data.
    
    Parameters:
    - ticker: Stock symbol
    - expiry: Expiration date (YYYY-MM-DD)
    - strike: Strike price
    - option_type: 'call' or 'put'
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")