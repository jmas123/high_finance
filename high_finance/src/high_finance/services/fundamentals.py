import asyncio
import statistics
from datetime import datetime, timezone
from sqlalchemy import func
from high_finance.db.models import Company
from high_finance.core.cache import get_or_compute, fundamentals_ttl
from high_finance.services.yf_cache import get_yf_info

# ── Extreme-value thresholds ────────────────────────────────────────────────
# Values above these are legitimate but unusual — the frontend can dim / warn.
# The hard upper bounds in clamp() are now set much higher to only reject
# genuinely broken data from yfinance.
EXTREME_THRESHOLDS = {
    "pe_ratio": 100,
    "forward_pe": 100,
    "ev_to_ebitda": 50,
    "ev_to_sales": 30,
    "pb_ratio": 15,
}


def clamp(val, lo=None, hi=None):
    if val is None:
        return None
    try:
        v = float(val)
    except:
        return None
    if lo is not None and v < lo:
        return None
    if hi is not None and v > hi:
        return None
    return v


def is_extreme(val, metric: str) -> bool:
    """Return True if val exceeds the 'unusual but real' threshold for metric."""
    if val is None:
        return False
    threshold = EXTREME_THRESHOLDS.get(metric)
    if threshold is None:
        return False
    return val > threshold


def normalize_return(val):
    if val is None:
        return None
    try:
        v = float(val)
    except:
        return None

    # If value looks like "17.8" instead of "0.178", normalize
    if abs(v) > 1:
        return v / 100

    return v

def pick_comp_template(sector: str | None, industry: str | None, is_profitable: bool | None):
    s = (sector or "").lower()
    i = (industry or "").lower()

    # REIT / Real estate nuance
    if "real estate" in s or "reit" in i:
        return {
            "label": "Real Estate",
            "metrics": ["market_cap", "pb_ratio", "dividend_yield", "revenue_growth"]
        }

    # Financials (banks, brokers, insurance)
    if "financial" in s or "bank" in i or "capital markets" in i or "insurance" in i:
        return {
            "label": "Financials",
            "metrics": ["market_cap", "forward_pe", "pe_ratio", "pb_ratio", "roe", "revenue_growth"]
        }

    # Utilities
    if "utilities" in s:
        return {
            "label": "Utilities",
            "metrics": ["market_cap", "forward_pe", "pe_ratio", "ev_to_ebitda", "dividend_yield", "revenue_growth"]
        }

    # Tech / Comm Services: if not profitable, EV/Sales is often better than P/E
    if "technology" in s or "communication services" in s:
        if is_profitable is False:
            return {
                "label": "Growth (Unprofitable)",
                "metrics": ["market_cap", "ev_to_sales", "revenue_growth", "gross_margins"]
            }
        return {
            "label": "Tech / Comm Services",
            "metrics": ["market_cap", "forward_pe", "ev_to_sales", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Healthcare sometimes has loss-makers too; keep EV/Sales available
    if "healthcare" in s:
        return {
            "label": "Healthcare",
            "metrics": ["market_cap", "forward_pe", "ev_to_sales", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Industrials / Energy / Materials / Consumer
    if any(x in s for x in ["industrials", "energy", "materials", "consumer discretionary", "consumer staples"]):
        return {
            "label": "Corporates",
            "metrics": ["market_cap", "forward_pe", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Default
    return {
        "label": "Corporates",
        "metrics": ["market_cap", "forward_pe", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
    }


def get_etf_fundamentals(info: dict) -> dict:
    """Extract ETF-specific metrics from yfinance info."""
    return {
        # Basic ETF info
        "total_assets": info.get("totalAssets"),  # AUM
        "nav_price": info.get("navPrice"),
        "expense_ratio": info.get("annualReportExpenseRatio"),  # e.g., 0.0003 = 0.03%
        "yield": info.get("yield"),  # Distribution yield
        "ytd_return":normalize_return(info.get("ytdReturn")),
        "three_year_return": info.get("threeYearAverageReturn"),
        "five_year_return": info.get("fiveYearAverageReturn"),
        
        # Category info
        "category": info.get("category"),  # e.g., "Large Blend"
        "fund_family": info.get("fundFamily"),  # e.g., "Vanguard"
        
        # Holdings info (if available)
        "holdings_count": info.get("holdingsCount"),
    }


async def get_company_fundamentals(
    ticker: str,
    db,
    fetch_peers: bool = False,
    peer_tickers: list[str] | None = None,
):
    info = await get_yf_info(ticker)

    # ==========================================
    # ASSET TYPE DETECTION
    # ==========================================
    quote_type = info.get("quoteType", "EQUITY")
    is_etf = quote_type == "ETF"
    is_mutual_fund = quote_type == "MUTUALFUND"
    is_index = quote_type == "INDEX"

    sector = info.get("sector")
    industry = info.get("industry")

    # Market cap
    market_cap = info.get("marketCap") or info.get("regularMarketCap")
    market_cap = clamp(market_cap, lo=1)

    # Price (needed for manual P/E)
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    price = clamp(price, lo=0.01)
    previous_close = clamp(info.get("regularMarketPreviousClose") or info.get("previousClose"), lo=0.01)
    price_change = None
    price_change_pct = None
    if price and previous_close:
        price_change = round(price - previous_close, 4)
        price_change_pct = round((price_change / previous_close) * 100, 4)


    # ==========================================
    # ETF-SPECIFIC HANDLING
    # ==========================================
    if is_etf or is_mutual_fund:
        etf_data = get_etf_fundamentals(info)
        
        return {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName"),
            "sector": sector,
            "industry": industry,
            "market_cap": market_cap,
            "current_price": price,
            "price_change": price_change,
            "price_change_pct": price_change_pct,
            
            # Asset type flags
            "quote_type": quote_type,
            "is_etf": is_etf,
            "is_mutual_fund": is_mutual_fund,
            "is_index": is_index,
            
            # ETF-specific fields
            "total_assets": etf_data["total_assets"],
            "nav_price": etf_data["nav_price"],
            "expense_ratio": etf_data["expense_ratio"],
            "yield": etf_data["yield"],
            "ytd_return": etf_data["ytd_return"],
            "three_year_return": etf_data["three_year_return"],
            "five_year_return": etf_data["five_year_return"],
            "category": etf_data["category"],
            "fund_family": etf_data["fund_family"],
            "holdings_count": etf_data["holdings_count"],
            
            # These will be None for ETFs but included for type consistency
            "pe_ratio": None,
            "pb_ratio": None,
            "roe": None,
            "ev_to_ebitda": None,
            "ev_to_sales": None,
            "dividend_yield": etf_data["yield"],  # Use ETF yield
            "revenue_growth": None,
            "gross_margins": None,
            "comp_template": None,
            "forward_pe": None,
            "eps": None,
            "profit_margin": None,
            "beta": clamp(info.get("beta"), lo=-5, hi=5),
            "revenue": None,
            "fifty_two_week_high": clamp(info.get("fiftyTwoWeekHigh"), lo=0.01),
            "fifty_two_week_low": clamp(info.get("fiftyTwoWeekLow"), lo=0.01),
            "fifty_day_avg": clamp(info.get("fiftyDayAverage"), lo=0.01),
            "two_hundred_day_avg": clamp(info.get("twoHundredDayAverage"), lo=0.01),

            # Extreme flags (all False for ETFs)
            "pe_extreme": False,
            "forward_pe_extreme": False,
            "ev_to_ebitda_extreme": False,
            "ev_to_sales_extreme": False,
            "pb_extreme": False,
        }

    # ==========================================
    # REGULAR STOCK HANDLING (existing code)
    # ==========================================
    
    # EPS TTM (yfinance: trailingEps is usually TTM EPS)
    eps_ttm = clamp(info.get("trailingEps"), lo=0.000001)

    # Manual P/E (reliable) — hi raised to 2000 as garbage filter only
    pe_ratio = (price / eps_ttm) if (price and eps_ttm) else None
    pe_ratio = clamp(pe_ratio, lo=2, hi=2000)

    # Forward PE fallback if we couldn't compute
    if pe_ratio is None:
        pe_ratio = clamp(info.get("forwardPE"), lo=2, hi=2000)

    # Profitability signal
    is_profitable = None
    if eps_ttm is not None:
        is_profitable = eps_ttm > 0

    # P/B (important for Financials + RE) — hi raised to 200
    pb_ratio = clamp(info.get("priceToBook"), lo=0.1, hi=200)

    # ROE (Financials)
    roe = clamp(info.get("returnOnEquity"), lo=-1, hi=2)  # roe is often a fraction (0.15 = 15%)

    # Dividend yield
    dividend_yield = clamp(info.get("dividendYield"), lo=0, hi=0.2)  # 0.03 = 3%

    # Revenue growth
    revenue_growth = clamp(info.get("revenueGrowth"), lo=-1, hi=2)  # 0.10 = 10%

    # Margins (good for Tech/HC)
    gross_margins = clamp(info.get("grossMargins"), lo=-1, hi=1)

    # EV, EBITDA, Revenue
    ev = clamp(info.get("enterpriseValue"), lo=1)
    ebitda = clamp(info.get("ebitda"), lo=1)
    total_revenue = clamp(info.get("totalRevenue"), lo=1)

    s_lower = (sector or "").lower()
    i_lower = (industry or "").lower()
    is_financial = ("financial" in s_lower) or ("bank" in i_lower) or ("insurance" in i_lower) or ("capital markets" in i_lower)

    # EV/EBITDA: skip financials — hi raised to 1000
    ev_to_ebitda = None
    if not is_financial:
        ev_to_ebitda = info.get("enterpriseToEbitda")
        ev_to_ebitda = clamp(ev_to_ebitda, lo=1, hi=1000)
        if ev_to_ebitda is None and ev and ebitda:
            ev_to_ebitda = clamp(ev / ebitda, lo=1, hi=1000)

    # EV/Sales: useful for Tech/Comm/HC or loss-makers — hi raised to 500
    ev_to_sales = info.get("enterpriseToRevenue")
    ev_to_sales = clamp(ev_to_sales, lo=0.1, hi=500)
    if ev_to_sales is None and ev and total_revenue:
        ev_to_sales = clamp(ev / total_revenue, lo=0.1, hi=500)

    forward_pe = clamp(info.get("forwardPE"), lo=0.1, hi=2000)

    # EPS: keep your eps_ttm, but consider allowing negative EPS for display
    eps = info.get("trailingEps")
    try:
        eps = float(eps) if eps is not None else None
    except:
        eps = None

    profit_margin = clamp(info.get("profitMargins"), lo=-1, hi=1)  # fraction
    beta = clamp(info.get("beta"), lo=-5, hi=5)

    fifty_two_week_high = clamp(info.get("fiftyTwoWeekHigh"), lo=0.01)
    fifty_two_week_low = clamp(info.get("fiftyTwoWeekLow"), lo=0.01)

    fifty_day_avg = clamp(info.get("fiftyDayAverage"), lo=0.01)
    two_hundred_day_avg = clamp(info.get("twoHundredDayAverage"), lo=0.01)

    revenue = clamp(info.get("totalRevenue"), lo=1)

    # Net debt calculation (needed for EV-based implied prices)
    total_debt = clamp(info.get("totalDebt"), lo=0) or 0
    cash_and_equiv = clamp(info.get("totalCash"), lo=0) or 0
    net_debt_est = total_debt - cash_and_equiv

    # Choose template
    comp_template = pick_comp_template(sector, industry, is_profitable)

    # Data freshness timestamp
    fetched_at = datetime.now(timezone.utc).isoformat()

    # DB update (keep your existing behavior)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        company = Company(
            name=info.get("longName"),
            ticker=ticker,
            sector=sector,
            industry=industry,
            market_cap=market_cap,
        )
        db.add(company)
    else:
        if market_cap:
            company.market_cap = market_cap
        if industry:
            company.industry = industry
        if sector:
            company.sector = sector

    db.commit()
    db.refresh(company)

    # Opportunistic SIC code fetch — lazy-load on first view
    if not company.sic_code:
        try:
            from high_finance.services.sec_sic import fetch_sic_code
            sic = await asyncio.to_thread(fetch_sic_code, ticker)
            if sic:
                company.sic_code = sic
                db.commit()
        except Exception:
            pass  # Non-critical; backfill script handles bulk population

    data = {
        "ticker": ticker,
        "name": info.get("longName"),
        "sector": sector,
        "industry": industry,
        "market_cap": market_cap,
        "current_price": price,
        "price_change": price_change,
        "price_change_pct": price_change_pct,
        
        # Asset type flags
        "quote_type": quote_type,
        "is_etf": False,
        "is_mutual_fund": False,
        "is_index": False,
        
        # Stock-specific fields
        "pe_ratio": pe_ratio,
        "pb_ratio": pb_ratio,
        "roe": roe,
        "ev_to_ebitda": ev_to_ebitda,
        "ev_to_sales": ev_to_sales,
        "dividend_yield": dividend_yield,
        "revenue_growth": revenue_growth,
        "gross_margins": gross_margins,
        "comp_template": comp_template,
        "forward_pe": forward_pe,
        "eps": eps,
        "profit_margin": profit_margin,
        "beta": beta,
        "revenue": revenue,
        "fifty_two_week_high": fifty_two_week_high,
        "fifty_two_week_low": fifty_two_week_low,
        "fifty_day_avg": fifty_day_avg,
        "two_hundred_day_avg": two_hundred_day_avg,
        "net_debt_est": net_debt_est,
        "fetched_at": fetched_at,

        # Extreme-value flags
        "pe_extreme": is_extreme(pe_ratio, "pe_ratio"),
        "forward_pe_extreme": is_extreme(forward_pe, "forward_pe"),
        "ev_to_ebitda_extreme": is_extreme(ev_to_ebitda, "ev_to_ebitda"),
        "ev_to_sales_extreme": is_extreme(ev_to_sales, "ev_to_sales"),
        "pb_extreme": is_extreme(pb_ratio, "pb_ratio"),

        # ETF fields (null for stocks)
        "total_assets": None,
        "nav_price": None,
        "expense_ratio": None,
        "yield": None,
        "ytd_return": None,
        "three_year_return": None,
        "five_year_return": None,
        "category": None,
        "fund_family": None,
        "holdings_count": None,
    }

    if not fetch_peers:
        return data

    # Peer selection: Use custom peers if provided, otherwise auto-select
    peers_data = []

    if peer_tickers:
        # Custom peer list provided - fetch all in parallel
        filtered = [t.upper() for t in peer_tickers if t.upper() != ticker.upper()]
        peer_tasks = [get_company_fundamentals(t, db, fetch_peers=False) for t in filtered]
        peer_results = await asyncio.gather(*peer_tasks, return_exceptions=True)
        for i, r in enumerate(peer_results):
            if isinstance(r, Exception) or r is None:
                peers_data.append({
                    "ticker": filtered[i],
                    "name": None,
                    "status": "not_found",
                    "market_cap": None,
                    "pe_ratio": None,
                    "ev_to_ebitda": None,
                    "ev_to_sales": None,
                    "revenue_growth": None,
                })
            else:
                peers_data.append(r)
    else:
        # Auto-select peers by industry/sector proximity
        current_mcap = market_cap or 0
        peers_query = db.query(Company).filter(
            Company.industry == industry,
            Company.ticker != ticker,
            Company.market_cap.isnot(None)
        ).order_by(func.abs(Company.market_cap - current_mcap)).limit(5)
        peers_list = peers_query.all()

        if len(peers_list) < 5:
            existing = [p.ticker for p in peers_list] + [ticker]
            needed = 5 - len(peers_list)
            sector_peers = db.query(Company).filter(
                Company.sector == sector,
                Company.ticker.notin_(existing),
                Company.market_cap.isnot(None)
            ).order_by(func.abs(Company.market_cap - current_mcap)).limit(needed).all()
            peers_list.extend(sector_peers)

        peer_tasks = [
            get_company_fundamentals(peer.ticker, db, fetch_peers=False)
            for peer in peers_list
        ]
        peer_results = await asyncio.gather(*peer_tasks, return_exceptions=True)
        for r in peer_results:
            if isinstance(r, Exception):
                continue
            if r:
                peers_data.append(r)

    # Averages for whatever the template asks for
    metrics = comp_template["metrics"]

    def avg(metric):
        vals = [p.get(metric) for p in peers_data if isinstance(p.get(metric), (int, float))]
        return (sum(vals) / len(vals)) if vals else None

    averages = {m: avg(m) for m in metrics}

    # ── NEW: Compute full statistics (mean, median, p25, p75, min, max) ──
    def compute_stats(metric: str) -> dict:
        vals = [p.get(metric) for p in peers_data if isinstance(p.get(metric), (int, float))]
        if not vals:
            return {"mean": None, "median": None, "p25": None, "p75": None, "min": None, "max": None}
        sorted_vals = sorted(vals)
        n = len(sorted_vals)
        return {
            "mean": sum(vals) / n,
            "median": statistics.median(vals),
            "p25": sorted_vals[n // 4] if n >= 4 else sorted_vals[0],
            "p75": sorted_vals[(3 * n) // 4] if n >= 4 else sorted_vals[-1],
            "min": sorted_vals[0],
            "max": sorted_vals[-1],
        }

    stats = {m: compute_stats(m) for m in metrics}

    # ── NEW: Compute implied prices based on peer median multiples ──
    def compute_implied_price(metric: str, peer_median: float | None, target_data: dict) -> float | None:
        """Given peer median multiple, what would target be worth?"""
        if peer_median is None or peer_median <= 0:
            return None

        shares = target_data.get("shares_outstanding")
        if shares is None:
            mcap = target_data.get("market_cap") or 0
            curr_price = target_data.get("current_price") or 0
            shares = mcap / curr_price if curr_price > 0 else None

        if metric == "pe_ratio":
            eps_val = target_data.get("eps")
            if eps_val and eps_val > 0:
                return peer_median * eps_val

        if metric == "forward_pe":
            # Forward EPS = current price / forward PE
            fwd_pe = target_data.get("forward_pe")
            curr_price = target_data.get("current_price")
            if fwd_pe and fwd_pe > 0 and curr_price and curr_price > 0:
                forward_eps = curr_price / fwd_pe
                return peer_median * forward_eps

        if metric == "ev_to_ebitda":
            ebitda_val = target_data.get("ebitda")
            if ebitda_val and ebitda_val > 0 and shares:
                implied_ev = peer_median * ebitda_val
                net_debt = target_data.get("net_debt_est", 0) or 0
                return (implied_ev - net_debt) / shares if shares > 0 else None

        if metric == "ev_to_sales":
            revenue_val = target_data.get("revenue")
            if revenue_val and revenue_val > 0 and shares:
                implied_ev = peer_median * revenue_val
                net_debt = target_data.get("net_debt_est", 0) or 0
                return (implied_ev - net_debt) / shares if shares > 0 else None

        return None

    # Need EBITDA, shares_outstanding for implied calculations
    # (net_debt_est is already in data dict)
    target_ebitda = clamp(info.get("ebitda"), lo=1)
    target_shares = clamp(info.get("sharesOutstanding"), lo=1)

    # Add extras to data for implied price calculation
    target_with_extras = {
        **data,
        "ebitda": target_ebitda,
        "shares_outstanding": target_shares,
    }

    implied_prices = {}
    valuation_metrics = ["pe_ratio", "forward_pe", "ev_to_ebitda", "ev_to_sales"]
    for m in valuation_metrics:
        if m in stats:
            implied_prices[m] = compute_implied_price(m, stats[m].get("median"), target_with_extras)

    return {
        "target": data,
        "peers": peers_data,
        "template": comp_template,
        "averages": averages,
        "statistics": stats,
        "implied_prices": implied_prices,
    }