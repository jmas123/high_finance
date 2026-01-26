from fastapi import APIRouter, HTTPException

from high_finance.services.financials import get_financial_statements
from high_finance.services.ai_analysis import analyze_financials

router = APIRouter()

@router.get("/{ticker}")
async def read_financials(ticker: str):
    statements = await get_financial_statements(ticker)
    if not statements:
        raise HTTPException(status_code=404, detail="Financial data not found")
    return statements

@router.post("/{ticker}/analyze")
async def analyze_financials_endpoint(ticker: str):
    statements = await get_financial_statements(ticker)
    if not statements:
        raise HTTPException(status_code=404, detail="Financial data not found")
    
    analysis = await analyze_financials(ticker, statements)
    return {"analysis": analysis}