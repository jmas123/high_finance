import yfinance as yf
from sqlalchemy import func
from high_finance.db.models import Company

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
            "metrics": ["market_cap", "pe_ratio", "pb_ratio", "roe", "revenue_growth"]
        }

    # Utilities
    if "utilities" in s:
        return {
            "label": "Utilities",
            "metrics": ["market_cap", "pe_ratio", "ev_to_ebitda", "dividend_yield", "revenue_growth"]
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
            "metrics": ["market_cap", "ev_to_sales", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Healthcare sometimes has loss-makers too; keep EV/Sales available
    if "healthcare" in s:
        return {
            "label": "Healthcare",
            "metrics": ["market_cap", "ev_to_sales", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Industrials / Energy / Materials / Consumer
    if any(x in s for x in ["industrials", "energy", "materials", "consumer discretionary", "consumer staples"]):
        return {
            "label": "Corporates",
            "metrics": ["market_cap", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
        }

    # Default
    return {
        "label": "Corporates",
        "metrics": ["market_cap", "ev_to_ebitda", "pe_ratio", "revenue_growth"]
    }

async def get_company_fundamentals(ticker: str, db, fetch_peers: bool = False):
    stock = yf.Ticker(ticker)
    info = stock.info or {}

    sector = info.get("sector")
    industry = info.get("industry")

    # Market cap
    market_cap = info.get("marketCap") or info.get("regularMarketCap")
    market_cap = clamp(market_cap, lo=1)

    # Price (needed for manual P/E)
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    price = clamp(price, lo=0.01)

    # EPS TTM (yfinance: trailingEps is usually TTM EPS)
    eps_ttm = clamp(info.get("trailingEps"), lo=0.000001)

    # Manual P/E (reliable)
    pe_ratio = (price / eps_ttm) if (price and eps_ttm) else None
    pe_ratio = clamp(pe_ratio, lo=2, hi=80)

    # Forward PE fallback if we couldn't compute
    if pe_ratio is None:
        pe_ratio = clamp(info.get("forwardPE"), lo=2, hi=80)

    # Profitability signal
    is_profitable = None
    if eps_ttm is not None:
        is_profitable = eps_ttm > 0

    # P/B (important for Financials + RE)
    pb_ratio = clamp(info.get("priceToBook"), lo=0.1, hi=20)

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

    # EV/EBITDA: skip financials
    ev_to_ebitda = None
    if not is_financial:
        ev_to_ebitda = info.get("enterpriseToEbitda")
        ev_to_ebitda = clamp(ev_to_ebitda, lo=1, hi=80)
        if ev_to_ebitda is None and ev and ebitda:
            ev_to_ebitda = clamp(ev / ebitda, lo=1, hi=80)

    # EV/Sales: useful for Tech/Comm/HC or loss-makers
    ev_to_sales = info.get("enterpriseToRevenue")
    ev_to_sales = clamp(ev_to_sales, lo=0.1, hi=80)
    if ev_to_sales is None and ev and total_revenue:
        ev_to_sales = clamp(ev / total_revenue, lo=0.1, hi=80)

    # Choose template
    comp_template = pick_comp_template(sector, industry, is_profitable)

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

    data = {
        "ticker": ticker,
        "name": info.get("longName"),
        "sector": sector,
        "industry": industry,
        "market_cap": market_cap,
        "pe_ratio": pe_ratio,
        "pb_ratio": pb_ratio,
        "roe": roe,
        "ev_to_ebitda": ev_to_ebitda,
        "ev_to_sales": ev_to_sales,
        "dividend_yield": dividend_yield,
        "revenue_growth": revenue_growth,
        "gross_margins": gross_margins,
        "comp_template": comp_template,
    }

    if not fetch_peers:
        return data

    # Peer selection (same as you had)
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

    peers_data = []
    for peer in peers_list:
        try:
            peers_data.append(await get_company_fundamentals(peer.ticker, db, fetch_peers=False))
        except:
            continue

    # Averages for whatever the template asks for
    metrics = comp_template["metrics"]

    def avg(metric):
        vals = [p.get(metric) for p in peers_data if isinstance(p.get(metric), (int, float))]
        return (sum(vals) / len(vals)) if vals else None

    averages = {m: avg(m) for m in metrics}

    return {
        "target": data,
        "peers": peers_data,
        "template": comp_template,
        "averages": averages,
    }
