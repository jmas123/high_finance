import yfinance as yf
from high_finance.db.models import Company

async def get_company_fundamentals(ticker: str, db):
    # Check DB cache first
    company = db.query(Company).filter(Company.ticker == ticker).first()
    
    # Always fetch fresh fundamentals from yfinance
    stock = yf.Ticker(ticker)
    info = stock.info
    
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
        db.refresh(company)
    
    # Return rich fundamentals data
    return {
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
    }