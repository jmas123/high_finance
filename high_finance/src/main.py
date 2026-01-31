from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from high_finance.api.v1.routes import (
    companies, fundamentals, ownership, leadership, 
    prices, financials, predictions, search, politicians,
    insider, institutional, earnings, options, news, risk, valuation, notifications, market
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/api/v1/companies", tags=["companies"])
app.include_router(fundamentals.router, prefix="/api/v1/fundamentals", tags=["fundamentals"])
app.include_router(ownership.router, prefix="/api/v1/ownership", tags=["ownership"])
app.include_router(leadership.router, prefix="/api/v1/leadership", tags=["leadership"])
app.include_router(prices.router, prefix="/api/v1/prices", tags=["prices"])
app.include_router(financials.router, prefix="/api/v1/financials", tags=["financials"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(politicians.router, prefix="/api/v1/politicians", tags=["politicians"])
app.include_router(insider.router, prefix="/api/v1/insider", tags=["insider"])
app.include_router(institutional.router, prefix="/api/v1/institutional", tags=["institutional"])
app.include_router(earnings.router, prefix="/api/v1/earnings", tags=["earnings"])
app.include_router(options.router, prefix="/api/v1/options", tags=["options"])
app.include_router(news.router, prefix="/api/v1/news", tags=["news"])
app.include_router(risk.router, prefix="/api/v1/risk", tags=["risk"])
app.include_router(valuation.router, prefix="/api/v1/valuation", tags=["valuation"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(market.router, prefix="/api/v1/market", tags=["market"])





@app.get("/")
async def root():
    return {"message": "Welcome to the Finance Research Platform API!"}