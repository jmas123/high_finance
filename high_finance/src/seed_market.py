import asyncio
import sys
import os
import time
from pathlib import Path
import pandas as pd
import requests
from io import StringIO
from dotenv import load_dotenv

# --- 🔍 SMART CONFIG 🔍 ---
# 1. Try to load .env file (for local Mac development)
current_dir = Path(__file__).resolve().parent
env_found = False

# Walk up directories looking for .env
check_dir = current_dir
while check_dir != check_dir.parent:
    possible_env = check_dir / ".env"
    if possible_env.exists():
        print(f"✅ Found .env at: {possible_env}")
        load_dotenv(dotenv_path=possible_env)
        env_found = True
        break
    check_dir = check_dir.parent

# 2. Check if DATABASE_URL is set (For Docker)
if not env_found and not os.getenv("DATABASE_URL"):
    print("❌ CRITICAL ERROR: DATABASE_URL not found.")
    print("   (No .env file found, and not running in a configured Docker environment)")
    sys.exit(1)

if os.getenv("DATABASE_URL"):
    print("✅ Database URL configured.")

# Add parent path to sys.path so imports work
script_location = Path(__file__).resolve().parent
sys.path.append(str(script_location))
# ---------------------------

# --- IMPORTS ---
from high_finance.db.session import SessionLocal, engine
from high_finance.db.base import Base  # Ensure this imports your SQLAlchemy Base
from high_finance.services.fundamentals import get_company_fundamentals

# Manual list of Global & Sector ETFs
ETFS = [
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VEA", "VWO",
    "XLK", "XLF", "XLV", "XLE", "GLD", "SLV", "USO", "TLT"
]

def get_sp500_tickers():
    """Scrapes S&P 500 list from Wikipedia with a fake browser header."""
    print("📋 Downloading S&P 500 list from Wikipedia...")
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    
    try:
        # 1. Spoof the User-Agent to bypass 403 Forbidden
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # 2. Parse HTML
        tables = pd.read_html(StringIO(response.text))
        df = tables[0]
        
        # 3. Clean tickers
        tickers = df['Symbol'].str.replace('.', '-', regex=False).tolist()
        print(f"✅ Found {len(tickers)} companies.")
        return tickers
    except Exception as e:
        print(f"❌ Failed to scrape Wikipedia: {e}")
        # Fallback list if scraping fails completely
        return ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"]

async def seed_all():
    # --- 🚨 FIX: CREATE TABLES FIRST 🚨 ---
    print("🛠️  Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created.")
    # ------------------------------------

    db = SessionLocal()
    
    # Get Lists
    sp500 = get_sp500_tickers()
    full_list = ETFS + sp500
    
    total = len(full_list)
    print(f"\n🚀 Starting heavy seed for {total} tickers...")
    print("Press Ctrl+C to stop at any time.\n")

    for i, ticker in enumerate(full_list):
        percent = ((i + 1) / total) * 100
        print(f"[{i+1}/{total}] {ticker.ljust(6)} ...", end=" ", flush=True)

        try:
            await get_company_fundamentals(ticker, db, fetch_peers=False)
            print("✅")
            time.sleep(0.5) # Avoid rate limits
        except Exception as e:
            print(f"❌ Error: {e}")

        # Commit frequently
        if i % 5 == 0:
            try:
                db.commit()
            except:
                db.rollback()

    db.close()
    print("\n✨ Market data seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_all())