import yfinance as yf
from typing import List, Dict, Any

async def get_insider_trades(ticker: str) -> List[Dict[str, Any]]:
    """Fetch insider trading data for a ticker."""
    stock = yf.Ticker(ticker)
    
    # Get insider transactions
    insider_df = stock.insider_transactions
    
    if insider_df is None or insider_df.empty:
        return []
    
    # Debug: print columns to see what's available
    print(f"Insider columns: {insider_df.columns.tolist()}")
    if len(insider_df) > 0:
        print(f"First row: {insider_df.iloc[0].to_dict()}")
    
    results = []
    for _, row in insider_df.iterrows():
        # Parse the data - try different column names
        shares = row.get('Shares', row.get('shares', 0))
        value = row.get('Value', row.get('value', 0))
        
        # Try different column names for transaction type
        transaction = str(row.get('Text', row.get('Transaction', row.get('transaction', '')))).lower()
        
        # Better transaction type detection
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
            transaction_type = transaction.upper()[:20]  # Use raw value if we can't categorize
        else:
            transaction_type = 'UNKNOWN'
        
        # Get date - try different column names
        start_date = row.get('Start Date', row.get('startDate', row.get('Date', None)))
        if start_date is not None:
            try:
                date_str = start_date.strftime('%Y-%m-%d') if hasattr(start_date, 'strftime') else str(start_date)[:10]
            except:
                date_str = str(start_date)[:10]
        else:
            date_str = None
        
        # Get insider name - try different column names
        insider_name = row.get('Insider Trading', row.get('Insider', row.get('insider', row.get('Name', 'Unknown'))))
        position = row.get('Position', row.get('position', row.get('Title', row.get('title', ''))))
        
        results.append({
            "insider": insider_name,
            "position": position,
            "transaction_type": transaction_type,
            "shares": int(shares) if shares and shares == shares else 0,  # NaN check
            "value": float(value) if value and value == value else None,
            "date": date_str,
            "url": row.get('URL', row.get('url', None)),
        })
    
    return results


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