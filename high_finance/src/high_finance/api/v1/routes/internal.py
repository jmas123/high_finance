"""Internal API endpoints — consumed by ai-fund, no auth required."""

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.services.politicians import get_significant_congress_trades
from high_finance.services.trade_context import build_trade_context
from high_finance.services.insider_trades import get_insider_trades
from high_finance.services.institutional_flow import get_institutional_flow
from high_finance.services.options_flow import get_options_overview
from high_finance.services.market import market_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/politician-trades")
def politician_trades(
    days: int = Query(7, ge=1, le=90),
    min_relevance: str = Query("low", pattern="^(low|medium|high)$"),
    db: Session = Depends(get_db),
):
    """Recent politician trades with committee relevance scoring."""
    trades = get_significant_congress_trades(db, min_amount=0, days=days, limit=200)

    relevance_cutoff = {"low": 0.0, "medium": 0.30, "high": 0.55}[min_relevance]

    results = []
    for t in trades:
        ctx = build_trade_context(db, t)
        if ctx["relevance_score"] < relevance_cutoff:
            continue

        results.append({
            "politician": t.politician.name if t.politician else None,
            "party": t.politician.party if t.politician else None,
            "chamber": t.politician.chamber if t.politician else None,
            "ticker": t.ticker_raw,
            "transaction_type": t.transaction_type,
            "transaction_date": str(t.transaction_date) if t.transaction_date else None,
            "disclosure_date": str(t.disclosure_date) if t.disclosure_date else None,
            "amount_min": t.amount_min,
            "amount_max": t.amount_max,
            "relevance_score": ctx["relevance_score"],
            "relevance_label": ctx["relevance_label"],
            "relevance_reasons": ctx["reasons"],
        })

    return {"trades": results, "count": len(results)}


@router.get("/institutional-flow")
async def institutional_flow(ticker: str = Query(..., min_length=1, max_length=10)):
    """Institutional ownership flow for a ticker."""
    data = await get_institutional_flow(ticker.upper())
    return data


@router.get("/insider-trades")
async def insider_trades(
    ticker: str = Query(..., min_length=1, max_length=10),
    days: int = Query(30, ge=1, le=365),
):
    """Recent insider trades (Form 4 filings) for a ticker."""
    trades = await get_insider_trades(ticker.upper())

    if days < 365:
        cutoff = str(date.today() - timedelta(days=days))
        trades = [t for t in trades if t.get("date") and t["date"] >= cutoff]

    buys = [t for t in trades if t["transaction_type"] == "BUY"]
    sells = [t for t in trades if t["transaction_type"] == "SELL"]

    return {
        "ticker": ticker.upper(),
        "trades": trades,
        "summary": {
            "total": len(trades),
            "buys": len(buys),
            "sells": len(sells),
            "net_shares": sum(t["shares"] for t in buys) - sum(t["shares"] for t in sells),
            "buy_value": sum(t["value"] or 0 for t in buys),
            "sell_value": sum(t["value"] or 0 for t in sells),
        },
    }


@router.get("/options-flow")
async def options_flow(ticker: str = Query(..., min_length=1, max_length=10)):
    """Options overview with unusual activity detection."""
    data = await get_options_overview(ticker.upper())
    return {
        "ticker": ticker.upper(),
        "put_call_ratio": data.get("put_call_ratio"),
        "total_call_volume": data.get("total_call_volume", 0),
        "total_put_volume": data.get("total_put_volume", 0),
        "max_pain": data.get("max_pain"),
        "iv_percentile": data.get("iv_percentile"),
        "unusual_activity": data.get("unusual_activity", []),
    }


@router.get("/macro-snapshot")
async def macro_snapshot():
    """Current macro indicators: Fed funds, yields, VIX, CPI, etc."""
    indicators = await market_service.get_macro_indicators()
    return {
        "indicators": [
            {
                "name": ind.name,
                "value": ind.value,
                "previous_value": ind.previous_value,
                "change": ind.change,
                "change_pct": ind.change_pct,
                "unit": ind.unit,
                "trend": ind.trend,
            }
            for ind in indicators
        ],
    }
