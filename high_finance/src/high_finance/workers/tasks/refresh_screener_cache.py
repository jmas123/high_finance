"""
Refresh Screener Cache
======================
Updates the screener_cache table with live market data from yfinance.
Designed to be run periodically (e.g., every 15 minutes during market hours).
"""

import time
from datetime import datetime, timedelta
from typing import Optional

import yfinance as yf
from sqlalchemy.orm import Session
from sqlalchemy import text

from high_finance.db.session import SessionLocal
from high_finance.db.models.screener import ScreenerUniverse, ScreenerCache
from high_finance.workers.tasks.base import tracked_job


def clamp(val, lo=None, hi=None):
    """Clamp value to range, return None if outside bounds."""
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


def fetch_ticker_data(ticker: str) -> Optional[dict]:
    """
    Fetch fundamental and price data for a single ticker using yfinance.
    Returns dict with screener cache fields, or None on failure.
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}

        if not info or info.get("quoteType") in ["ETF", "MUTUALFUND", "INDEX"]:
            # Skip non-stocks for the screener
            return None

        # Price data
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev_close = info.get("regularMarketPreviousClose") or info.get("previousClose")

        price_change_1d = None
        if price and prev_close and prev_close > 0:
            price_change_1d = (price - prev_close) / prev_close

        # Valuation metrics
        market_cap = clamp(info.get("marketCap"), lo=1)
        pe_ratio = clamp(info.get("trailingPE"), lo=0.1, hi=2000)
        forward_pe = clamp(info.get("forwardPE"), lo=0.1, hi=2000)
        pb_ratio = clamp(info.get("priceToBook"), lo=0.1, hi=200)
        ev_to_ebitda = clamp(info.get("enterpriseToEbitda"), lo=0.1, hi=1000)

        # Quality & Profitability
        roe = clamp(info.get("returnOnEquity"), lo=-2, hi=5)
        profit_margin = clamp(info.get("profitMargins"), lo=-2, hi=2)
        debt_to_equity = clamp(info.get("debtToEquity"), lo=0, hi=1000)
        # Convert D/E from percentage (yfinance returns 150 for 1.5x) to ratio
        if debt_to_equity is not None:
            debt_to_equity = debt_to_equity / 100.0
        beta_val = clamp(info.get("beta"), lo=-2, hi=10)

        # FCF Yield = Free Cash Flow / Market Cap
        fcf = info.get("freeCashflow")
        fcf_yield_val = None
        if fcf and market_cap and market_cap > 0:
            fcf_yield_val = clamp(fcf / market_cap, lo=-1, hi=1)

        # Growth & Yield
        revenue_growth = clamp(info.get("revenueGrowth"), lo=-1, hi=5)
        dividend_yield = clamp(info.get("dividendYield"), lo=0, hi=0.5)

        # Technical - price vs moving averages
        two_hundred_ma = info.get("twoHundredDayAverage")
        fifty_two_high = info.get("fiftyTwoWeekHigh")

        price_vs_200ma = None
        if price and two_hundred_ma and two_hundred_ma > 0:
            price_vs_200ma = (price - two_hundred_ma) / two_hundred_ma

        price_vs_52w_high = None
        if price and fifty_two_high and fifty_two_high > 0:
            price_vs_52w_high = (price - fifty_two_high) / fifty_two_high

        return {
            "ticker": ticker,
            "market_cap": market_cap,
            "current_price": price,
            "price_change_1d": price_change_1d,
            "pe_ratio": pe_ratio,
            "forward_pe": forward_pe,
            "pb_ratio": pb_ratio,
            "ev_to_ebitda": ev_to_ebitda,
            "roe": roe,
            "profit_margin": profit_margin,
            "debt_to_equity": debt_to_equity,
            "fcf_yield": fcf_yield_val,
            "beta": beta_val,
            "revenue_growth": revenue_growth,
            "dividend_yield": dividend_yield,
            "price_vs_200ma": price_vs_200ma,
            "price_vs_52w_high": price_vs_52w_high,
        }

    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None


def aggregate_insider_activity_yf(ticker: str, days: int = 90) -> dict:
    """
    Aggregate insider trading activity for a ticker over the past N days
    using yfinance insider_transactions data.
    """
    try:
        stock = yf.Ticker(ticker)
        txns = stock.insider_transactions
        if txns is None or txns.empty:
            return {"insider_net_shares_90d": 0, "insider_buys_90d": 0, "insider_sells_90d": 0}

        cutoff = datetime.utcnow() - timedelta(days=days)

        # Filter to recent transactions
        if "Start Date" in txns.columns:
            txns = txns[txns["Start Date"] >= cutoff]
        elif "startDate" in txns.columns:
            txns = txns[txns["startDate"] >= cutoff]

        buy_shares = 0
        sell_shares = 0
        buy_count = 0
        sell_count = 0

        shares_col = "Shares" if "Shares" in txns.columns else "shares"
        text_col = "Text" if "Text" in txns.columns else "text"

        for _, row in txns.iterrows():
            shares = row.get(shares_col, 0) or 0
            text = str(row.get(text_col, "")).lower()
            if "purchase" in text or "buy" in text or "acquisition" in text:
                buy_shares += abs(shares)
                buy_count += 1
            elif "sale" in text or "sell" in text or "disposition" in text:
                sell_shares += abs(shares)
                sell_count += 1
            elif shares > 0:
                buy_shares += shares
                buy_count += 1
            elif shares < 0:
                sell_shares += abs(shares)
                sell_count += 1

        return {
            "insider_net_shares_90d": int(buy_shares - sell_shares),
            "insider_buys_90d": buy_count,
            "insider_sells_90d": sell_count,
        }
    except Exception as e:
        print(f"Error fetching insider data for {ticker}: {e}")
        return {"insider_net_shares_90d": 0, "insider_buys_90d": 0, "insider_sells_90d": 0}


def aggregate_congress_activity(db: Session, ticker: str, days: int = 90) -> dict:
    """
    Aggregate congressional trading activity for a ticker over the past N days.
    """
    try:
        from high_finance.db.models.politician_trade import PoliticianTrade
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Use ORM query to avoid raw SQL issues
        trades = db.query(PoliticianTrade).filter(
            PoliticianTrade.ticker_raw == ticker,
            PoliticianTrade.transaction_date >= cutoff
        ).all()

        buy_value = 0
        sell_value = 0
        buy_count = 0
        sell_count = 0

        for t in trades:
            amount = t.amount_max or t.amount_min or 0
            tx_type = (t.transaction_type or "").lower()
            if "purchase" in tx_type or "buy" in tx_type:
                buy_value += amount
                buy_count += 1
            elif "sale" in tx_type or "sell" in tx_type:
                sell_value += amount
                sell_count += 1

        return {
            "congress_net_value_90d": int(buy_value - sell_value),
            "congress_buys_90d": buy_count,
            "congress_sells_90d": sell_count,
        }
    except Exception:
        pass

    return {
        "congress_net_value_90d": 0,
        "congress_buys_90d": 0,
        "congress_sells_90d": 0,
    }


def refresh_screener_cache_logic(
    db: Session,
    batch_size: int = 50,
    delay_between_batches: float = 1.0,
    tickers: Optional[list[str]] = None,
) -> dict:
    """
    Core logic to refresh screener cache.

    Args:
        db: Database session
        batch_size: Number of tickers to fetch before pausing
        delay_between_batches: Seconds to wait between batches (rate limiting)
        tickers: Optional list of specific tickers to refresh (default: all active)
    """
    # Get tickers to refresh
    if tickers:
        universe = db.query(ScreenerUniverse).filter(
            ScreenerUniverse.ticker.in_(tickers),
            ScreenerUniverse.is_active == True
        ).all()
    else:
        universe = db.query(ScreenerUniverse).filter(
            ScreenerUniverse.is_active == True
        ).all()

    total = len(universe)
    updated = 0
    failed = 0
    skipped = 0

    for i, entry in enumerate(universe):
        ticker = entry.ticker

        # Fetch market data
        data = fetch_ticker_data(ticker)

        if data is None:
            skipped += 1
            continue

        # Aggregate insider/congress activity
        insider = aggregate_insider_activity_yf(ticker)
        congress = aggregate_congress_activity(db, ticker)

        # Merge all data
        cache_data = {
            **data,
            **insider,
            **congress,
            "cached_at": datetime.utcnow(),
        }

        # Upsert into cache
        try:
            existing = db.query(ScreenerCache).filter(
                ScreenerCache.ticker == ticker
            ).first()

            if existing:
                for key, value in cache_data.items():
                    if key != "ticker":
                        setattr(existing, key, value)
            else:
                cache_entry = ScreenerCache(**cache_data)
                db.add(cache_entry)

            updated += 1

        except Exception as e:
            print(f"Error updating cache for {ticker}: {e}")
            db.rollback()  # Rollback on error to reset transaction state
            failed += 1

        # Commit periodically and rate limit
        if (i + 1) % batch_size == 0:
            try:
                db.commit()
            except Exception as e:
                print(f"Error committing batch: {e}")
                db.rollback()
            print(f"Progress: {i + 1}/{total} tickers processed")
            time.sleep(delay_between_batches)

    # Final commit
    db.commit()

    return {
        "status": "ok",
        "total": total,
        "updated": updated,
        "failed": failed,
        "skipped": skipped,
        "cached_at": datetime.utcnow().isoformat(),
    }


@tracked_job("screener_cache")
def refresh_screener_cache_job(
    batch_size: int = 50,
    delay: float = 1.0,
    tickers: Optional[list[str]] = None,
) -> dict:
    """
    RQ job wrapper - creates its own DB session.

    Args:
        batch_size: Number of tickers per batch
        delay: Seconds between batches
        tickers: Optional specific tickers to refresh
    """
    db: Session = SessionLocal()
    try:
        result = refresh_screener_cache_logic(
            db,
            batch_size=batch_size,
            delay_between_batches=delay,
            tickers=tickers,
        )
        return result
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


def refresh_single_ticker_job(ticker: str) -> dict:
    """
    Refresh cache for a single ticker. Useful for on-demand updates.
    """
    return refresh_screener_cache_job(tickers=[ticker], batch_size=1, delay=0)


@tracked_job("screener_cache_market")
def refresh_screener_cache_market_job(
    batch_size: int = 50,
    delay: float = 1.0,
) -> dict:
    """
    RQ job wrapper for market-hours-only screener cache refresh.

    This job checks if it's a trading day before running. If called on a
    non-trading day (weekend, holiday), it returns early without processing.

    Args:
        batch_size: Number of tickers per batch
        delay: Seconds between batches
    """
    import logging
    from high_finance.utils.market_hours import is_trading_day

    logger = logging.getLogger(__name__)

    # Check if it's a trading day
    if not is_trading_day():
        logger.info("Skipping screener cache refresh - not a trading day")
        return {
            "status": "ok",
            "skipped": True,
            "reason": "not_trading_day",
        }

    # Run the actual refresh
    return refresh_screener_cache_job(batch_size=batch_size, delay=delay)


if __name__ == "__main__":
    # Allow running directly for testing
    import sys

    if len(sys.argv) > 1:
        # Refresh specific ticker
        result = refresh_single_ticker_job(sys.argv[1])
    else:
        # Refresh all
        result = refresh_screener_cache_job(batch_size=20, delay=2.0)

    print(result)
