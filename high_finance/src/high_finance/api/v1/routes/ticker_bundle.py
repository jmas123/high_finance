"""
Ticker Mega-Bundle API
======================
Returns ALL ticker page data in a single request to eliminate browser connection overhead.
"""

import asyncio
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from high_finance.db.session import get_db

# Core data services
from high_finance.services.fundamentals import get_company_fundamentals
from high_finance.services.prices import get_price_history
from high_finance.services.people import get_leadership_data
from high_finance.services.financials import get_financial_statements

# Component-specific services
from high_finance.services.risk import get_risk_bundle
from high_finance.services.valuation import get_valuation_bundle
from high_finance.services.institutional_flow import get_institutional_flow
from high_finance.services.insider_trades import get_insider_trades, get_insider_summary
from high_finance.services.politicians import get_company_politician_trades
from high_finance.services.options_flow import get_options_overview
from high_finance.services.options_decay import get_iv_context
from high_finance.services.earnings import get_earnings_calendar
from high_finance.services.news import get_news_bundle
from high_finance.services.ml_predictor import train_and_predict
from high_finance.services.market import market_service


class TickerBundleResponse(BaseModel):
    """All data for a ticker page in one response."""
    # Core data
    company: Optional[dict] = None
    fundamentals: Optional[dict] = None
    prices: list = []
    leadership: list = []
    financials: Optional[dict] = None
    comps: Optional[dict] = None

    # Component data
    risk: Optional[dict] = None
    valuation: Optional[dict] = None
    institutional_flow: Optional[dict] = None
    insider_trades: list = []
    insider_summary: Optional[dict] = None
    politician_trades: list = []
    options_overview: Optional[dict] = None
    iv_context: Optional[dict] = None
    earnings: Optional[dict] = None
    news: Optional[dict] = None
    prediction: Optional[dict] = None

    # Market context (shared across all tickers)
    macro_indicators: Optional[dict] = None
    sectors: Optional[dict] = None
    rate_impact: Optional[dict] = None

    # Error tracking for partial failures
    errors: dict = {}

    class Config:
        from_attributes = True


router = APIRouter()


@router.get("/{ticker}")
async def get_ticker_bundle(
    ticker: str,
    period: str = Query("1y", description="Price history period"),
    db: Session = Depends(get_db),
):
    """
    Fetch ALL ticker page data in a single request.

    This endpoint runs all data fetches in parallel on the backend,
    completely avoiding the browser's 6-connection-per-domain limit.

    Returns partial data if some fetches fail (errors dict contains details).
    """
    ticker = ticker.upper()
    errors: dict[str, str] = {}

    # ═══════════════════════════════════════════════════════════════════════════
    # DEFINE ALL FETCH TASKS
    # ═══════════════════════════════════════════════════════════════════════════

    async def fetch_company():
        try:
            return await get_company_fundamentals(ticker, db)
        except Exception as e:
            errors["company"] = str(e)
            return None

    async def fetch_fundamentals():
        try:
            return await get_company_fundamentals(ticker, db)
        except Exception as e:
            errors["fundamentals"] = str(e)
            return None

    async def fetch_prices():
        try:
            return await get_price_history(ticker, period)
        except Exception as e:
            errors["prices"] = str(e)
            return []

    async def fetch_leadership():
        try:
            result = await get_leadership_data(ticker, db)
            return result or []
        except Exception as e:
            errors["leadership"] = str(e)
            return []

    async def fetch_financials():
        try:
            return await get_financial_statements(ticker)
        except Exception as e:
            errors["financials"] = str(e)
            return None

    async def fetch_comps():
        try:
            return await get_company_fundamentals(ticker, db, fetch_peers=True)
        except Exception as e:
            errors["comps"] = str(e)
            return None

    async def fetch_risk():
        try:
            # Use reasonable defaults for initial load
            return await get_risk_bundle(
                ticker,
                period=period,
                horizon_days=60,
                n_sims=500,
                vol_multiplier=1.0,
                include_earnings_shock=False,
            )
        except Exception as e:
            errors["risk"] = str(e)
            return None

    async def fetch_valuation():
        try:
            # Use smart defaults (no explicit params)
            return await get_valuation_bundle(ticker)
        except Exception as e:
            errors["valuation"] = str(e)
            return None

    async def fetch_institutional_flow():
        try:
            return await get_institutional_flow(ticker)
        except Exception as e:
            errors["institutional_flow"] = str(e)
            return None

    async def fetch_insider_trades():
        try:
            trades = await get_insider_trades(ticker)
            return trades[:50] if trades else []
        except Exception as e:
            errors["insider_trades"] = str(e)
            return []

    async def fetch_insider_summary():
        try:
            return await get_insider_summary(ticker)
        except Exception as e:
            errors["insider_summary"] = str(e)
            return None

    async def fetch_politician_trades():
        try:
            trades = get_company_politician_trades(db, ticker, limit=50)
            results = []
            for t in trades:
                pol = None
                if t.politician:
                    pol = {
                        "id": t.politician.id,
                        "name": t.politician.name,
                        "party": t.politician.party,
                        "chamber": t.politician.chamber,
                        "state": t.politician.state,
                        "district": t.politician.district,
                        "hit_rate": None,
                        "avg_return_pct": None,
                    }
                results.append({
                    "trade": {
                        "id": t.id,
                        "politician_id": t.politician_id,
                        "company_id": t.company_id,
                        "issuer_raw": t.issuer_raw,
                        "ticker_raw": t.ticker_raw,
                        "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
                        "disclosure_date": t.disclosure_date.isoformat() if t.disclosure_date else None,
                        "transaction_type": t.transaction_type,
                        "amount_min": t.amount_min,
                        "amount_max": t.amount_max,
                        "source_url": t.source_url,
                    },
                    "politician": pol,
                })
            return results
        except Exception as e:
            errors["politician_trades"] = str(e)
            return []

    async def fetch_options_overview():
        try:
            return await get_options_overview(ticker)
        except Exception as e:
            errors["options_overview"] = str(e)
            return None

    async def fetch_iv_context():
        try:
            return await get_iv_context(ticker)
        except Exception as e:
            errors["iv_context"] = str(e)
            return None

    async def fetch_earnings():
        try:
            return await get_earnings_calendar(ticker)
        except Exception as e:
            errors["earnings"] = str(e)
            return None

    async def fetch_news():
        try:
            return await get_news_bundle(db, ticker, limit=20)
        except Exception as e:
            errors["news"] = str(e)
            return None

    async def fetch_prediction():
        try:
            result = await train_and_predict(ticker)
            if "error" in result:
                errors["prediction"] = result["error"]
                return None
            return result
        except Exception as e:
            errors["prediction"] = str(e)
            return None

    async def fetch_macro_indicators():
        try:
            indicators = await market_service.get_macro_indicators()
            payload = [ind.model_dump(mode="json") for ind in indicators]
            return {"indicators": payload}
        except Exception as e:
            errors["macro_indicators"] = str(e)
            return None

    async def fetch_sectors():
        try:
            sectors = await market_service.get_sector_performance()
            sorted_sectors = sorted(sectors, key=lambda x: x.performance_1d, reverse=True)
            return {
                "sectors": [s.model_dump(mode="json") for s in sorted_sectors],
                "market_leader": sorted_sectors[0].sector if sorted_sectors else None,
                "market_laggard": sorted_sectors[-1].sector if sorted_sectors else None,
            }
        except Exception as e:
            errors["sectors"] = str(e)
            return None

    async def fetch_rate_impact():
        try:
            analyses = await market_service.get_rate_impact_analysis(None)
            return {
                "analyses": [a.model_dump(mode="json") for a in analyses],
            }
        except Exception as e:
            errors["rate_impact"] = str(e)
            return None

    # ═══════════════════════════════════════════════════════════════════════════
    # RUN ALL FETCHES IN PARALLEL
    # ═══════════════════════════════════════════════════════════════════════════

    results = await asyncio.gather(
        fetch_company(),           # 0
        fetch_fundamentals(),      # 1
        fetch_prices(),            # 2
        fetch_leadership(),        # 3
        fetch_financials(),        # 4
        fetch_comps(),             # 5
        fetch_risk(),              # 6
        fetch_valuation(),         # 7
        fetch_institutional_flow(), # 8
        fetch_insider_trades(),    # 9
        fetch_insider_summary(),   # 10
        fetch_politician_trades(), # 11
        fetch_options_overview(),  # 12
        fetch_iv_context(),        # 13
        fetch_earnings(),          # 14
        fetch_news(),              # 15
        fetch_prediction(),        # 16
        fetch_macro_indicators(),  # 17
        fetch_sectors(),           # 18
        fetch_rate_impact(),       # 19
        return_exceptions=True,
    )

    # Unpack results
    (
        company, fundamentals, prices, leadership, financials, comps,
        risk, valuation, institutional_flow, insider_trades, insider_summary,
        politician_trades, options_overview, iv_context, earnings, news,
        prediction, macro_indicators, sectors, rate_impact
    ) = results

    # Handle any exceptions that weren't caught
    def safe_result(val, key, default=None):
        if isinstance(val, Exception):
            errors[key] = str(val)
            return default
        return val

    company = safe_result(company, "company")
    fundamentals = safe_result(fundamentals, "fundamentals")
    prices = safe_result(prices, "prices", [])
    leadership = safe_result(leadership, "leadership", [])
    financials = safe_result(financials, "financials")
    comps = safe_result(comps, "comps")
    risk = safe_result(risk, "risk")
    valuation = safe_result(valuation, "valuation")
    institutional_flow = safe_result(institutional_flow, "institutional_flow")
    insider_trades = safe_result(insider_trades, "insider_trades", [])
    insider_summary = safe_result(insider_summary, "insider_summary")
    politician_trades = safe_result(politician_trades, "politician_trades", [])
    options_overview = safe_result(options_overview, "options_overview")
    iv_context = safe_result(iv_context, "iv_context")
    earnings = safe_result(earnings, "earnings")
    news = safe_result(news, "news")
    prediction = safe_result(prediction, "prediction")
    macro_indicators = safe_result(macro_indicators, "macro_indicators")
    sectors = safe_result(sectors, "sectors")
    rate_impact = safe_result(rate_impact, "rate_impact")

    # If both company and fundamentals failed, the ticker is probably invalid
    if company is None and fundamentals is None:
        raise HTTPException(status_code=404, detail="Ticker not found")

    return TickerBundleResponse(
        company=company,
        fundamentals=fundamentals,
        prices=prices or [],
        leadership=leadership or [],
        financials=financials,
        comps=comps,
        risk=risk,
        valuation=valuation,
        institutional_flow=institutional_flow,
        insider_trades=insider_trades or [],
        insider_summary=insider_summary,
        politician_trades=politician_trades or [],
        options_overview=options_overview,
        iv_context=iv_context,
        earnings=earnings,
        news=news,
        prediction=prediction,
        macro_indicators=macro_indicators,
        sectors=sectors,
        rate_impact=rate_impact,
        errors=errors,
    )
