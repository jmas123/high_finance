from fastapi import APIRouter, HTTPException

from high_finance.services.ml_predictor import train_and_predict

router = APIRouter()

@router.get("/{ticker}")
async def get_prediction(ticker: str):
    """
    Train an ML model on historical data and predict next day's price direction.
    """
    try:
        result = await train_and_predict(ticker.upper())
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))