"""
Market Context API Routes
Provides endpoints for macro indicators, sector performance, and rate impact analysis.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from high_finance.services.market import market_service, MarketBreadth


router = APIRouter()


@router.get("/macro-indicators")
async def get_macro_indicators():
    """
    Get key macro economic indicators including Fed rates, Treasury yields,
    inflation metrics, and volatility indices.
    """
    indicators = await market_service.get_macro_indicators()
    payload = [ind.model_dump(mode="json") for ind in indicators]
    return {"indicators": payload, "summary": _macro_summary(payload)}


@router.get("/sectors")
async def get_sector_performance():
    """
    Get performance data for all S&P 500 sectors including
    daily, weekly, monthly, and YTD returns.
    """
    try:
        sectors = await market_service.get_sector_performance()
        
        # Sort by 1-day performance for heatmap
        sorted_sectors = sorted(
            sectors, key=lambda x: x.performance_1d, reverse=True
        )
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rate-impact")
async def get_rate_impact(
    sector: Optional[str] = Query(None, description="Filter by specific sector")
):
    """
    Get analysis of how Fed rate changes impact different market sectors.
    Includes historical performance during rate cycles.
    """
    try:
        analyses = await market_service.get_rate_impact_analysis(sector)
        
        # Group by sensitivity
        high_sensitivity = [a for a in analyses if a.sensitivity == "high"]
        medium_sensitivity = [a for a in analyses if a.sensitivity == "medium"]
        low_sensitivity = [a for a in analyses if a.sensitivity == "low"]
        
        return {
            "analyses": [a.model_dump(mode="json") for a in analyses],
            "by_sensitivity": {
                "high": [a.sector for a in high_sensitivity],
                "medium": [a.sector for a in medium_sensitivity],
                "low": [a.sector for a in low_sensitivity],
            },
            "rate_beneficiaries": [
                a.sector for a in analyses if a.impact_direction == "positive"
            ],
            "rate_sensitive": [
                a.sector for a in analyses if a.impact_direction == "negative"
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rate-impact/{ticker}")
async def get_stock_rate_impact(ticker: str):
    """
    Get rate sensitivity analysis for a specific stock.
    """
    try:
        analysis = await market_service.get_stock_rate_sensitivity(ticker)
        if not analysis:
            raise HTTPException(
                status_code=404,
                detail=f"Rate sensitivity data not available for {ticker}",
            )
        return analysis.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/breadth")
async def get_market_breadth():
    """
    Get market breadth indicators including advance/decline,
    new highs/lows, and technical indicators.
    """
    try:
        breadth = await market_service.get_market_breadth()
        
        # Calculate breadth score (0-100)
        den = breadth.advancing + breadth.declining
        adv_ratio = (breadth.advancing / den) if den else 0.5  # neutral default

        breadth_score = adv_ratio * 30 + (breadth.above_200dma_pct / 100) * 35 + (breadth.above_50dma_pct / 100) * 35

        
        return {
            **breadth.model_dump(),
            "breadth_score": round(breadth_score, 1),
            "breadth_signal": (
                "bullish" if breadth_score > 60
                else "bearish" if breadth_score < 40
                else "neutral"
            ),
            "advance_decline_ratio": round(
                breadth.advancing / max(breadth.declining, 1), 2
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/context/{ticker}")
async def get_market_context_for_stock(ticker: str):
    """
    Get comprehensive market context relevant to a specific stock,
    including sector performance and rate sensitivity.
    """
    try:
        # Get all relevant data
        sectors = await market_service.get_sector_performance()
        rate_analysis = await market_service.get_stock_rate_sensitivity(ticker)
        breadth = await market_service.get_market_breadth()
        macro = await market_service.get_macro_indicators()
        
        # Find stock's sector performance
        stock_sector = rate_analysis.sector if rate_analysis else None
        sector_data = next(
            (s for s in sectors if s.sector == stock_sector), None
        ) if stock_sector else None
        
        return {
            "ticker": ticker.upper(),
            "sector": stock_sector,
            "sector_performance": sector_data.model_dump() if sector_data else None,
            "rate_sensitivity": rate_analysis.model_dump() if rate_analysis else None,
            "market_breadth": {
                "advance_decline_ratio": round(
                    breadth.advancing / max(breadth.declining, 1), 2
                ),
                "above_200dma_pct": breadth.above_200dma_pct,
                "fear_greed_index": breadth.fear_greed_index,
            },
            "key_macro_indicators": {
                ind.name: {
                    "value": ind.value,
                    "trend": ind.trend,
                    "impact": ind.impact_description,
                }
                for ind in macro[:4]  # Top 4 most relevant
            },
            "contextual_insight": _generate_contextual_insight(
                ticker, stock_sector, rate_analysis, sector_data, breadth
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _generate_contextual_insight(
    ticker: str,
    sector: str,
    rate_analysis,
    sector_data,
    breadth,
) -> str:
    """Generate a contextual insight summary for the stock."""
    insights = []
    
    if sector_data:
        if sector_data.performance_1d > 1:
            insights.append(f"{sector} sector showing strong momentum (+{sector_data.performance_1d:.1f}% today)")
        elif sector_data.performance_1d < -1:
            insights.append(f"{sector} sector under pressure ({sector_data.performance_1d:.1f}% today)")
    
    if rate_analysis:
        if rate_analysis.sensitivity == "high":
            if rate_analysis.impact_direction == "negative":
                insights.append("High rate sensitivity - watch Fed commentary closely")
            else:
                insights.append("Could benefit from current rate environment")
    
    if breadth.fear_greed_index > 75:
        insights.append("Elevated market sentiment - consider risk management")
    elif breadth.fear_greed_index < 25:
        insights.append("Depressed sentiment may present opportunity")
    
    return " | ".join(insights) if insights else "Neutral market conditions"

def _macro_summary(indicators: list[dict]) -> dict:
    # Build a name -> indicator map
    by_name = {i["name"]: i for i in indicators}

    fed = by_name.get("Fed Funds Rate")
    cpi = by_name.get("CPI YoY")
    pce = by_name.get("Core PCE")
    vix = by_name.get("VIX")
    curve = by_name.get("Yield Curve (10Y-2Y)")

    # Rate environment (very simple heuristic)
    rate_environment = "neutral"
    if fed and fed["value"] >= 4.0:
        rate_environment = "restrictive"
    elif fed and fed["value"] <= 2.5:
        rate_environment = "accommodative"

    # Inflation trend (use trend flag you already compute)
    inflation_trend = "mixed"
    if cpi and pce:
        if cpi["trend"] == "down" and pce["trend"] == "down":
            inflation_trend = "cooling"
        elif cpi["trend"] == "up" and pce["trend"] == "up":
            inflation_trend = "heating"
        else:
            inflation_trend = "mixed"

    # Yield curve
    yield_curve = "unknown"
    if curve:
        # If you keep curve in pp, inversion is < 0. If you convert to bps, same sign logic.
        yield_curve = "inverted" if curve["value"] < 0 else "normal"

    # Volatility (VIX thresholds are common; adjust to taste)
    market_volatility = "unknown"
    if vix:
        market_volatility = "low" if vix["value"] < 15 else ("elevated" if vix["value"] > 25 else "normal")

    return {
        "rate_environment": rate_environment,
        "inflation_trend": inflation_trend,
        "yield_curve": yield_curve,
        "market_volatility": market_volatility,
    }
