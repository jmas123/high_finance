"""
Ticker Mega-Bundle API
======================
Returns ALL ticker page data in a single request to eliminate browser connection overhead.
"""

import asyncio
import logging
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from high_finance.db.session import get_db, SessionLocal
from high_finance.core.rate_limit import limiter

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
from high_finance.api.v1.routes.market import _macro_summary


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
@limiter.limit("10/minute")
async def get_ticker_bundle(
    request: Request,
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

    # Dedup: call get_company_fundamentals(fetch_peers=True) ONCE.
    # Split result: full dict for comps, target dict for company/fundamentals.
    async def fetch_comps_full():
        """Single call for company + fundamentals + comps."""
        try:
            return await get_company_fundamentals(ticker, db, fetch_peers=True)
        except Exception:
            logger.exception("Bundle: comps failed for %s", ticker)
            errors["comps"] = "Failed to load"
            return None

    async def fetch_prices():
        try:
            return await get_price_history(ticker, period)
        except Exception:
            logger.exception("Bundle: prices failed for %s", ticker)
            errors["prices"] = "Failed to load"
            return []

    async def fetch_leadership():
        try:
            result = await get_leadership_data(ticker, db)
            return result or []
        except Exception:
            logger.exception("Bundle: leadership failed for %s", ticker)
            errors["leadership"] = "Failed to load"
            return []

    async def fetch_financials():
        try:
            return await get_financial_statements(ticker)
        except Exception:
            logger.exception("Bundle: financials failed for %s", ticker)
            errors["financials"] = "Failed to load"
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
        except Exception:
            logger.exception("Bundle: risk failed for %s", ticker)
            errors["risk"] = "Failed to load"
            return None

    async def fetch_valuation():
        try:
            # Use smart defaults (no explicit params)
            return await get_valuation_bundle(ticker)
        except Exception:
            logger.exception("Bundle: valuation failed for %s", ticker)
            errors["valuation"] = "Failed to load"
            return None

    async def fetch_institutional_flow():
        try:
            return await get_institutional_flow(ticker)
        except Exception:
            logger.exception("Bundle: institutional_flow failed for %s", ticker)
            errors["institutional_flow"] = "Failed to load"
            return None

    async def fetch_insider_trades():
        try:
            trades = await get_insider_trades(ticker)
            return trades[:50] if trades else []
        except Exception:
            logger.exception("Bundle: insider_trades failed for %s", ticker)
            errors["insider_trades"] = "Failed to load"
            return []

    async def fetch_insider_summary():
        try:
            return await get_insider_summary(ticker)
        except Exception:
            logger.exception("Bundle: insider_summary failed for %s", ticker)
            errors["insider_summary"] = "Failed to load"
            return None

    async def fetch_politician_trades():
        # Use a dedicated session — the shared `db` session is used by other
        # concurrent bundle tasks, and get_company_politician_trades may call
        # db.commit() (via _backfill_company_ids), which expires all objects
        # and corrupts the shared session for other tasks.
        local_db = SessionLocal()
        try:
            trades = get_company_politician_trades(local_db, ticker, limit=50)
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
        except Exception:
            logger.exception("Bundle: politician_trades failed for %s", ticker)
            errors["politician_trades"] = "Failed to load"
            return []
        finally:
            local_db.close()

    async def fetch_options_overview():
        try:
            return await get_options_overview(ticker)
        except Exception:
            logger.exception("Bundle: options_overview failed for %s", ticker)
            errors["options_overview"] = "Failed to load"
            return None

    async def fetch_iv_context():
        try:
            return await get_iv_context(ticker)
        except Exception:
            logger.exception("Bundle: iv_context failed for %s", ticker)
            errors["iv_context"] = "Failed to load"
            return None

    async def fetch_earnings():
        try:
            return await get_earnings_calendar(ticker)
        except Exception:
            logger.exception("Bundle: earnings failed for %s", ticker)
            errors["earnings"] = "Failed to load"
            return None

    async def fetch_news():
        try:
            return await get_news_bundle(db, ticker, limit=20)
        except Exception:
            logger.exception("Bundle: news failed for %s", ticker)
            errors["news"] = "Failed to load"
            return None

    async def fetch_prediction():
        try:
            result = await train_and_predict(ticker)
            if "error" in result:
                errors["prediction"] = result["error"]
                return None
            return result
        except Exception:
            logger.exception("Bundle: prediction failed for %s", ticker)
            errors["prediction"] = "Failed to load"
            return None

    async def fetch_macro_indicators():
        try:
            indicators = await market_service.get_macro_indicators()
            payload = [ind.model_dump(mode="json") for ind in indicators]
            return {"indicators": payload, "summary": _macro_summary(payload)}
        except Exception:
            logger.exception("Bundle: macro_indicators failed for %s", ticker)
            errors["macro_indicators"] = "Failed to load"
            return None

    async def fetch_sectors():
        try:
            sectors = await market_service.get_sector_performance()
            sorted_sectors = sorted(sectors, key=lambda x: x.performance_1d, reverse=True)
            return {
                "sectors": [s.model_dump(mode="json") for s in sorted_sectors],
                "market_leader": sorted_sectors[0].sector if sorted_sectors else None,
                "market_laggard": sorted_sectors[-1].sector if sorted_sectors else None,
                "breadth": {
                    "positive": sum(1 for s in sectors if s.performance_1d > 0),
                    "negative": sum(1 for s in sectors if s.performance_1d < 0),
                    "unchanged": sum(1 for s in sectors if s.performance_1d == 0),
                },
            }
        except Exception:
            logger.exception("Bundle: sectors failed for %s", ticker)
            errors["sectors"] = "Failed to load"
            return None

    async def fetch_rate_impact():
        try:
            analyses = await market_service.get_rate_impact_analysis(None)
            return {
                "analyses": [a.model_dump(mode="json") for a in analyses],
                "by_sensitivity": {
                    "high": [a.sector for a in analyses if a.sensitivity == "high"],
                    "medium": [a.sector for a in analyses if a.sensitivity == "medium"],
                    "low": [a.sector for a in analyses if a.sensitivity == "low"],
                },
                "rate_beneficiaries": [
                    a.sector for a in analyses if a.impact_direction == "positive"
                ],
                "rate_sensitive": [
                    a.sector for a in analyses if a.impact_direction == "negative"
                ],
            }
        except Exception:
            logger.exception("Bundle: rate_impact failed for %s", ticker)
            errors["rate_impact"] = "Failed to load"
            return None

    # ═══════════════════════════════════════════════════════════════════════════
    # RUN ALL FETCHES IN PARALLEL (with per-task timeouts)
    # ═══════════════════════════════════════════════════════════════════════════

    async def with_timeout(coro, timeout_s: float, name: str):
        """Wrap a coroutine with a timeout. Returns None on timeout."""
        try:
            return await asyncio.wait_for(coro, timeout=timeout_s)
        except asyncio.TimeoutError:
            errors[name] = f"Timed out after {timeout_s}s"
            logger.warning("Bundle task %s timed out after %ss", name, timeout_s)
            return None

    FAST = 12   # Light tasks: single yfinance call or DB query
    SLOW = 20   # Heavy tasks: multiple API calls, Monte Carlo, ML, peer comps

    results = await asyncio.gather(
        with_timeout(fetch_comps_full(), SLOW, "comps"),             # 0  (peers = many yfinance calls)
        with_timeout(fetch_prices(), FAST, "prices"),                # 1
        with_timeout(fetch_leadership(), FAST, "leadership"),        # 2
        with_timeout(fetch_financials(), SLOW, "financials"),        # 3  (up to 6 yfinance calls)
        with_timeout(fetch_risk(), SLOW, "risk"),                    # 4  (Monte Carlo simulation)
        with_timeout(fetch_valuation(), SLOW, "valuation"),          # 5  (DCF + financial data)
        with_timeout(fetch_institutional_flow(), FAST, "inst_flow"), # 6
        with_timeout(fetch_insider_trades(), FAST, "insider"),       # 7
        with_timeout(fetch_insider_summary(), FAST, "insider_sum"),  # 8
        with_timeout(fetch_politician_trades(), FAST, "pol_trades"), # 9
        with_timeout(fetch_options_overview(), FAST, "options"),     # 10
        with_timeout(fetch_iv_context(), FAST, "iv_context"),        # 11
        with_timeout(fetch_earnings(), FAST, "earnings"),            # 12
        with_timeout(fetch_news(), FAST, "news"),                    # 13
        with_timeout(fetch_prediction(), SLOW, "prediction"),        # 14 (ML training)
        with_timeout(fetch_macro_indicators(), FAST, "macro"),       # 15
        with_timeout(fetch_sectors(), SLOW, "sectors"),              # 16 (11 sector ETF calls)
        with_timeout(fetch_rate_impact(), FAST, "rate_impact"),      # 17
        return_exceptions=True,
    )

    # Unpack results
    (
        comps_full, prices, leadership, financials,
        risk, valuation, institutional_flow, insider_trades, insider_summary,
        politician_trades, options_overview, iv_context, earnings, news,
        prediction, macro_indicators, sectors, rate_impact
    ) = results

    # Handle any exceptions that weren't caught by per-task try/except
    def safe_result(val, key, default=None):
        if isinstance(val, Exception):
            logger.error("Bundle task %s raised uncaught exception: %s", key, val)
            errors[key] = "Failed to load"
            return default
        return val

    comps_full = safe_result(comps_full, "comps")
    prices = safe_result(prices, "prices", [])
    leadership = safe_result(leadership, "leadership", [])
    financials = safe_result(financials, "financials")
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

    # Split the deduped comps_full result:
    # - fetch_peers=True returns {"target": {...}, "peers": [...], ...}
    # - company/fundamentals consumers need the flat "target" dict
    if comps_full and isinstance(comps_full, dict) and "target" in comps_full:
        company = comps_full["target"]
        fundamentals = comps_full["target"]
        comps = comps_full
    else:
        # Fallback: comps_full might be a flat dict (ETF path or error)
        company = comps_full
        fundamentals = comps_full
        comps = None

    # If both company and fundamentals failed, distinguish upstream failure vs invalid ticker
    if company is None and fundamentals is None:
        if "comps" in errors:
            # Upstream data fetch failed — ticker may be valid but data unavailable
            raise HTTPException(
                status_code=503,
                detail="Data temporarily unavailable — please try again",
            )
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
