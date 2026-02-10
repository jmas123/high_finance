"""
High Finance API
================
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware

from high_finance.core.config import settings
from high_finance.core.cache import close_redis
from high_finance.core.rate_limit import limiter, rate_limit_exceeded_handler
from high_finance.api.v1.routes import (
    companies, fundamentals, ownership, leadership,
    prices, financials, predictions, search, politicians,
    insider, institutional, earnings, options, news, risk, valuation, notifications, market,
    project, screener, auth, user_data, export, admin, calendar, chart_drawing, portfolio_performance,
    private_companies, ticker_bundle, memo, ai_history, earnings_analysis
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self'"
        )

        # Cache-Control: let browsers cache ticker/market data to avoid redundant round-trips
        path = request.url.path
        if path.startswith("/api/v1/auth/"):
            response.headers["Cache-Control"] = "no-store"
        elif path.startswith("/api/v1/ticker/"):
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        elif path.startswith("/api/v1/market/"):
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        else:
            response.headers["Cache-Control"] = "no-cache"

        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle for the application."""
    # Startup: configure thread pool for blocking yfinance/feedparser calls
    executor = ThreadPoolExecutor(max_workers=40)
    loop = asyncio.get_running_loop()
    loop.set_default_executor(executor)
    logger.info("Thread pool executor configured with max_workers=40")

    # Auto-populate seed data on fresh deploys
    try:
        from high_finance.seeds.runner import run_fast_seeds
        result = run_fast_seeds()
        logger.info(f"Fast seed result: {result}")
    except Exception:
        logger.exception("Fast seeds failed — API will start without seed data")

    yield
    # Shutdown: clean up Redis connection
    try:
        await close_redis()
        logger.info("Redis connection closed")
    except Exception:
        logger.warning("Failed to close Redis connection during shutdown", exc_info=True)


app = FastAPI(
    title="High Finance API",
    description="Research platform for investors and finance students",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS - use explicit origin whitelist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)

# GZip compression — ~50-70% smaller JSON payloads (skip tiny responses <500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Routes
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
app.include_router(project.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(screener.router, prefix="/api/v1/screener", tags=["screener"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(user_data.router, prefix="/api/v1/me", tags=["user-data"])
app.include_router(export.router, prefix="/api/v1", tags=["export"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(calendar.router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(chart_drawing.router, prefix="/api/v1/drawings", tags=["drawings"])
app.include_router(portfolio_performance.router, prefix="/api/v1/portfolio", tags=["portfolio"])
app.include_router(private_companies.router, prefix="/api/v1/private-companies", tags=["private-companies"])
app.include_router(ticker_bundle.router, prefix="/api/v1/ticker", tags=["ticker-bundle"])
app.include_router(memo.router, prefix="/api/v1/memo", tags=["memo"])
app.include_router(ai_history.router, prefix="/api/v1/ai-history", tags=["ai-history"])
app.include_router(earnings_analysis.router, prefix="/api/v1/earnings-analysis", tags=["earnings-analysis"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Prevent leaking internal details in production."""
    logger.exception(f"Unhandled exception: {exc}")

    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "message": str(exc), "type": type(exc).__name__},
        )

    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "An unexpected error occurred."},
    )


@app.get("/")
async def root():
    return {"message": "Welcome to the Finance Research Platform API!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
