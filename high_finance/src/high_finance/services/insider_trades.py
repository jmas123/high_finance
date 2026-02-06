import asyncio

import yfinance as yf
from typing import List, Dict, Any

from high_finance.core.cache import get_or_compute, trades_ttl


def _fetch_insider_trades_sync(ticker: str) -> List[Dict[str, Any]]:
    """Blocking yfinance call — runs in thread pool."""
    stock = yf.Ticker(ticker)

    insider_df = stock.insider_transactions

    if insider_df is None or insider_df.empty:
        return []

    results = []
    for _, row in insider_df.iterrows():
        shares = row.get('Shares', row.get('shares', 0))
        value = row.get('Value', row.get('value', 0))

        transaction = str(row.get('Text', row.get('Transaction', row.get('transaction', '')))).lower()

        if 'sale' in transaction or 'sell' in transaction or 'sold' in transaction:
            transaction_type = 'SELL'
        elif 'purchase' in transaction or 'buy' in transaction or 'bought' in transaction or 'acquisition' in transaction:
            transaction_type = 'BUY'
        elif 'option' in transaction or 'exercise' in transaction:
            transaction_type = 'OPTION EXERCISE'
        elif 'gift' in transaction:
            transaction_type = 'GIFT'
        elif 'conversion' in transaction:
            transaction_type = 'CONVERSION'
        elif transaction:
            transaction_type = transaction.upper()[:20]
        else:
            transaction_type = 'UNKNOWN'

        start_date = row.get('Start Date', row.get('startDate', row.get('Date', None)))
        if start_date is not None:
            try:
                date_str = start_date.strftime('%Y-%m-%d') if hasattr(start_date, 'strftime') else str(start_date)[:10]
            except:
                date_str = str(start_date)[:10]
        else:
            date_str = None

        insider_name = row.get('Insider Trading', row.get('Insider', row.get('insider', row.get('Name', 'Unknown'))))
        position = row.get('Position', row.get('position', row.get('Title', row.get('title', ''))))

        results.append({
            "insider": insider_name,
            "position": position,
            "transaction_type": transaction_type,
            "shares": int(shares) if shares and shares == shares else 0,
            "value": float(value) if value and value == value else None,
            "date": date_str,
            "url": row.get('URL', row.get('url', None)),
        })

    return results


async def get_insider_trades(ticker: str) -> List[Dict[str, Any]]:
    """Fetch insider trading data for a ticker."""
    cache_key = f"hf:insider:{ticker}"

    async def _compute():
        return await asyncio.to_thread(_fetch_insider_trades_sync, ticker)

    return await get_or_compute(cache_key, trades_ttl(), _compute)


async def get_insider_summary(ticker: str) -> Dict[str, Any]:
    """Get summary of insider activity."""
    trades = await get_insider_trades(ticker)
    
    if not trades:
        return {
            "total_trades": 0,
            "buys": 0,
            "sells": 0,
            "buy_shares": 0,
            "sell_shares": 0,
            "net_shares": 0,
            "buy_value": 0,
            "sell_value": 0,
            "net_value": 0,
            "recent_trades": [],
        }
    
    buys = [t for t in trades if t['transaction_type'] == 'BUY']
    sells = [t for t in trades if t['transaction_type'] == 'SELL']
    
    buy_shares = sum(t['shares'] for t in buys)
    sell_shares = sum(t['shares'] for t in sells)
    buy_value = sum(t['value'] or 0 for t in buys)
    sell_value = sum(t['value'] or 0 for t in sells)
    
    return {
        "total_trades": len(trades),
        "buys": len(buys),
        "sells": len(sells),
        "buy_shares": buy_shares,
        "sell_shares": sell_shares,
        "net_shares": buy_shares - sell_shares,
        "buy_value": buy_value,
        "sell_value": sell_value,
        "net_value": buy_value - sell_value,
        "recent_trades": trades[:20],
    }