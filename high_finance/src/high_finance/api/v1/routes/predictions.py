import logging

from fastapi import APIRouter, HTTPException, Request

from high_finance.core.rate_limit import limiter
from high_finance.services.ml_predictor import train_and_predict

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{ticker}")
@limiter.limit("10/minute")
async def get_prediction(request: Request, ticker: str):
    """
    Train an ML model on historical data and predict next day's price direction.
    """
    try:
        result = await train_and_predict(ticker.upper())
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("Prediction failed for %s", ticker)
        raise HTTPException(status_code=500, detail="Unable to generate prediction")
