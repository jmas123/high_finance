import yfinance as yf
from sqlalchemy import func
from high_finance.db.models import Company

async def get_company_fundamentals(ticker: str, db, fetch_peers: bool = False):
    # 1. Fetch Target Data (Existing Logic + New Metrics)
    stock = yf.Ticker(ticker)
    info = stock.info
    
    # Check/Create DB Entry (Preserving your existing logic)
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        company = Company(
            name=info.get('longName'),
            ticker=ticker,
            sector=info.get('sector'),
            industry=info.get('industry'),
            market_cap=info.get('marketCap'),
        )
        db.add(company)
        db.commit()
    
    # Map to Schema
    data = {
        "ticker": ticker,
        "name": info.get('longName'),
        "sector": info.get('sector'),
        "industry": info.get('industry'),
        "market_cap": info.get('marketCap'),
        "pe_ratio": info.get('trailingPE'),
        "forward_pe": info.get('forwardPE'),
        "eps": info.get('trailingEps'),
        "dividend_yield": info.get('dividendYield'),
        "fifty_two_week_high": info.get('fiftyTwoWeekHigh'),
        "fifty_two_week_low": info.get('fiftyTwoWeekLow'),
        "fifty_day_avg": info.get('fiftyDayAverage'),
        "two_hundred_day_avg": info.get('twoHundredDayAverage'),
        "revenue": info.get('totalRevenue'),
        "profit_margin": info.get('profitMargins'),
        "beta": info.get('beta'),
        # NEW KEYS
        "ev_to_ebitda": info.get('enterpriseToEbitda'),
        "revenue_growth": info.get('revenueGrowth'),
    }

    if not fetch_peers:
        return data

    # 2. Peer Selection Logic
    # Find companies in same industry, closest market cap
    # Note: This assumes your DB has other companies populated. 
    current_mcap = data['market_cap'] or 0
    
    peers_query = db.query(Company).filter(
        Company.industry == data['industry'],
        Company.ticker != ticker,
        Company.market_cap.isnot(None)
    ).order_by(
        func.abs(Company.market_cap - current_mcap)
    ).limit(5)
    
    peers_list = peers_query.all()
    
    # 3. Fetch Peer Data (In a loop for MVP, should be async gather in Prod)
    peers_data = []
    for peer in peers_list:
        try:
            # Recursive call but without fetching peers for the peer
            p_data = await get_company_fundamentals(peer.ticker, db, fetch_peers=False)
            peers_data.append(p_data)
        except Exception:
            continue # Skip if data fetch fails

    # 4. Calculate Averages
    valid_pe = [p['pe_ratio'] for p in peers_data if p['pe_ratio']]
    valid_ev = [p['ev_to_ebitda'] for p in peers_data if p['ev_to_ebitda']]

    return {
        "target": data,
        "peers": peers_data,
        "average_pe": sum(valid_pe) / len(valid_pe) if valid_pe else None,
        "average_ev_ebitda": sum(valid_ev) / len(valid_ev) if valid_ev else None
    }