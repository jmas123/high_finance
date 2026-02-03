 v1 Stock Screener Design                                                                                                                  
                                                                                                                                            
  1. Target User Workflows (3 Concrete Queries)                                                                                             
                                                                                                                                            
  Query 1: "Insider Confidence" Screen                                                                                                      
  "Show me mid-cap tech stocks ($2B–$20B) with net insider buying in the last 90 days"                                                      
                                                                                                                                            
  Filters: sector=Technology, market_cap_min=2B, market_cap_max=20B, insider_net_shares_90d > 0                                             
                                                                                                                                            
  Query 2: "Value with Momentum" Screen                                                                                                     
  "Find stocks with P/E under 15, positive revenue growth, and price above 200-day MA"                                                      
                                                                                                                                            
  Filters: pe_ratio_max=15, revenue_growth_min=0, price_vs_200ma > 0                                                                        
                                                                                                                                            
  Query 3: "Congressional Interest" Screen                                                                                                  
  "What stocks have seen $100k+ in congressional buying this quarter?"                                                                      
                                                                                                                                            
  Filters: congress_buys_90d_min=100000, sorted by congress_net_value_90d desc                                                              
                                                                                                                                            
  ---                                                                                                                                       
  2. MVP Scope                                                                                                                              
                                                                                                                                            
  Must-Have Filters (v1)                                                                                                                    
  ┌──────────────────┬──────────────────────────────────────────────────────────────────────────────┐                                       
  │     Category     │                                   Filters                                    │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Size             │ market_cap_min, market_cap_max                                               │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Valuation        │ pe_ratio_min/max, forward_pe_min/max, pb_ratio_min/max, ev_to_ebitda_min/max │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Growth           │ revenue_growth_min/max                                                       │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Dividend         │ dividend_yield_min/max                                                       │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Price            │ price_min/max, price_vs_52w_high_min/max, price_vs_200ma_min/max             │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Sector           │ sector (multi-select)                                                        │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Insider Activity │ insider_net_shares_90d_min/max, has_insider_buys_90d (boolean)               │                                       
  ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤                                       
  │ Congress         │ congress_net_value_90d_min/max                                               │                                       
  └──────────────────┴──────────────────────────────────────────────────────────────────────────────┘                                       
  Cut from v1 (Future Iterations)                                                                                                           
                                                                                                                                            
  - Natural language queries ("SaaS companies with insider buying")                                                                         
  - Custom formula builder                                                                                                                  
  - Options-based filters (IV percentile, unusual activity)                                                                                 
  - Earnings-based filters (next earnings within N days)                                                                                    
  - Institutional flow filters (requires more data normalization)                                                                           
  - Technical indicators beyond 200MA (RSI, MACD)                                                                                           
  - Real-time alerting on screen matches                                                                                                    
                                                                                                                                            
  ---                                                                                                                                       
  3. Data Requirements                                                                                                                      
                                                                                                                                            
  Already Have (via yfinance + existing services)                                                                                           
  ┌────────────────────────────────┬────────────┬─────────────────┐                                                                         
  │             Field              │   Source   │      Notes      │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ market_cap                     │ yfinance   │ Real-time       │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ pe_ratio, forward_pe, pb_ratio │ yfinance   │ Real-time       │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ ev_to_ebitda, ev_to_sales      │ yfinance   │ Real-time       │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ revenue_growth                 │ yfinance   │ TTM             │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ dividend_yield                 │ yfinance   │ Real-time       │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ eps                            │ yfinance   │ TTM             │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ beta                           │ yfinance   │ 5-year monthly  │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ 52w_high, 52w_low              │ yfinance   │ Real-time       │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ 50ma, 200ma                    │ yfinance   │ Calculated      │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ sector, industry               │ yfinance   │ Static          │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ insider_trades                 │ yfinance   │ Last 12 months  │                                                                         
  ├────────────────────────────────┼────────────┼─────────────────┤                                                                         
  │ congress_trades                │ Quiver API │ Already syncing │                                                                         
  └────────────────────────────────┴────────────┴─────────────────┘                                                                         
  Must Ingest/Build                                                                                                                         
  ┌─────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────┐           
  │     Requirement     │                                               Solution                                                │           
  ├─────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤           
  │ Ticker universe     │ Create screener_universe table with ~5,000 liquid US stocks (S&P 500 + Russell 1000 + popular NASDAQ) │           
  ├─────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤           
  │ Cached fundamentals │ Add screener_cache table to store pre-fetched fundamentals (refresh daily via RQ job)                 │           
  ├─────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤           
  │ Insider aggregates  │ Compute net_insider_shares_90d, insider_buys_90d from existing insider API and cache                  │           
  ├─────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤           
  │ Congress aggregates │ Compute congress_net_value_90d from politician_trades table                                           │           
  ├─────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤           
  │ Price technicals    │ Store price_vs_200ma, price_vs_52w_high in cache                                                      │           
  └─────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────┘           
  ---                                                                                                                                       
  4. Backend API Design                                                                                                                     
                                                                                                                                            
  Endpoint                                                                                                                                  
                                                                                                                                            
  GET /api/v1/screener                                                                                                                      
                                                                                                                                            
  Query Parameters                                                                                                                          
  Param: market_cap_min                                                                                                                     
  Type: int (in millions)                                                                                                                   
  Example: 2000                                                                                                                             
  ────────────────────────────────────────                                                                                                  
  Param: market_cap_max                                                                                                                     
  Type: int (in millions)                                                                                                                   
  Example: 20000                                                                                                                            
  ────────────────────────────────────────                                                                                                  
  Param: pe_ratio_min                                                                                                                       
  Type: float                                                                                                                               
  Example: 0                                                                                                                                
  ────────────────────────────────────────                                                                                                  
  Param: pe_ratio_max                                                                                                                       
  Type: float                                                                                                                               
  Example: 15                                                                                                                               
  ────────────────────────────────────────                                                                                                  
  Param: forward_pe_min                                                                                                                     
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: forward_pe_max                                                                                                                     
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: pb_ratio_min                                                                                                                       
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: pb_ratio_max                                                                                                                       
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: ev_to_ebitda_min                                                                                                                   
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: ev_to_ebitda_max                                                                                                                   
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: revenue_growth_min                                                                                                                 
  Type: float (decimal, e.g., 0.1 = 10%)                                                                                                    
  Example: 0                                                                                                                                
  ────────────────────────────────────────                                                                                                  
  Param: revenue_growth_max                                                                                                                 
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: dividend_yield_min                                                                                                                 
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: dividend_yield_max                                                                                                                 
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: price_vs_200ma_min                                                                                                                 
  Type: float (decimal, e.g., 0.05 = 5% above)                                                                                              
  Example: 0                                                                                                                                
  ────────────────────────────────────────                                                                                                  
  Param: price_vs_200ma_max                                                                                                                 
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: price_vs_52w_high_min                                                                                                              
  Type: float (decimal, e.g., -0.1 = within 10% of high)                                                                                    
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: price_vs_52w_high_max                                                                                                              
  Type: float                                                                                                                               
  Example:                                                                                                                                  
  ────────────────────────────────────────                                                                                                  
  Param: sectors                                                                                                                            
  Type: string (comma-sep)                                                                                                                  
  Example: Technology,Healthcare                                                                                                            
  ────────────────────────────────────────                                                                                                  
  Param: insider_net_shares_90d_min                                                                                                         
  Type: int                                                                                                                                 
  Example: 1                                                                                                                                
  ────────────────────────────────────────                                                                                                  
  Param: has_insider_buys_90d                                                                                                               
  Type: bool                                                                                                                                
  Example: true                                                                                                                             
  ────────────────────────────────────────                                                                                                  
  Param: congress_net_value_90d_min                                                                                                         
  Type: int                                                                                                                                 
  Example: 100000                                                                                                                           
  ────────────────────────────────────────                                                                                                  
  Param: sort_by                                                                                                                            
  Type: string                                                                                                                              
  Example: market_cap, pe_ratio, revenue_growth, insider_net_shares_90d, congress_net_value_90d                                             
  ────────────────────────────────────────                                                                                                  
  Param: sort_order                                                                                                                         
  Type: string                                                                                                                              
  Example: asc or desc                                                                                                                      
  ────────────────────────────────────────                                                                                                  
  Param: limit                                                                                                                              
  Type: int                                                                                                                                 
  Example: 50 (max 200)                                                                                                                     
  ────────────────────────────────────────                                                                                                  
  Param: offset                                                                                                                             
  Type: int                                                                                                                                 
  Example: 0                                                                                                                                
  Response Shape                                                                                                                            
                                                                                                                                            
  interface ScreenerResponse {                                                                                                              
    results: ScreenerResult[];                                                                                                              
    total_count: number;                                                                                                                    
    filters_applied: Record<string, any>;                                                                                                   
    cached_at: string;  // ISO timestamp                                                                                                    
  }                                                                                                                                         
                                                                                                                                            
  interface ScreenerResult {                                                                                                                
    ticker: string;                                                                                                                         
    company_name: string;                                                                                                                   
    sector: string;                                                                                                                         
    industry: string;                                                                                                                       
                                                                                                                                            
    // Size & Price                                                                                                                         
    market_cap: number;                                                                                                                     
    current_price: number;                                                                                                                  
    price_change_1d: number;                                                                                                                
                                                                                                                                            
    // Valuation                                                                                                                            
    pe_ratio: number | null;                                                                                                                
    forward_pe: number | null;                                                                                                              
    pb_ratio: number | null;                                                                                                                
    ev_to_ebitda: number | null;                                                                                                            
                                                                                                                                            
    // Growth & Dividend                                                                                                                    
    revenue_growth: number | null;                                                                                                          
    dividend_yield: number | null;                                                                                                          
                                                                                                                                            
    // Technicals                                                                                                                           
    price_vs_200ma: number | null;                                                                                                          
    price_vs_52w_high: number | null;                                                                                                       
                                                                                                                                            
    // Insider Activity                                                                                                                     
    insider_net_shares_90d: number;                                                                                                         
    insider_buys_90d: number;                                                                                                               
    insider_sells_90d: number;                                                                                                              
                                                                                                                                            
    // Congress Activity                                                                                                                    
    congress_net_value_90d: number;                                                                                                         
    congress_buys_90d: number;                                                                                                              
    congress_sells_90d: number;                                                                                                             
  }                                                                                                                                         
                                                                                                                                            
  Save/Load Screens Endpoint                                                                                                                
                                                                                                                                            
  POST /api/v1/screener/saved                                                                                                               
  GET  /api/v1/screener/saved                                                                                                               
  DELETE /api/v1/screener/saved/{id}                                                                                                        
                                                                                                                                            
  interface SavedScreen {                                                                                                                   
    id: number;                                                                                                                             
    name: string;                                                                                                                           
    filters: Record<string, any>;                                                                                                           
    created_at: string;                                                                                                                     
    last_run_at: string | null;                                                                                                             
    last_result_count: number | null;                                                                                                       
  }                                                                                                                                         
                                                                                                                                            
  ---                                                                                                                                       
  5. DB / Indexing / Caching Strategy                                                                                                       
                                                                                                                                            
  New Tables                                                                                                                                
                                                                                                                                            
  -- Universe of screenable stocks                                                                                                          
  CREATE TABLE screener_universe (                                                                                                          
    ticker VARCHAR(10) PRIMARY KEY,                                                                                                         
    company_name VARCHAR(255),                                                                                                              
    sector VARCHAR(100),                                                                                                                    
    industry VARCHAR(100),                                                                                                                  
    is_active BOOLEAN DEFAULT TRUE,                                                                                                         
    added_at TIMESTAMP DEFAULT NOW()                                                                                                        
  );                                                                                                                                        
                                                                                                                                            
  -- Cached fundamentals (refreshed daily)                                                                                                  
  CREATE TABLE screener_cache (                                                                                                             
    ticker VARCHAR(10) PRIMARY KEY REFERENCES screener_universe(ticker),                                                                    
    market_cap BIGINT,                                                                                                                      
    current_price DECIMAL(12,4),                                                                                                            
    price_change_1d DECIMAL(8,4),                                                                                                           
    pe_ratio DECIMAL(10,2),                                                                                                                 
    forward_pe DECIMAL(10,2),                                                                                                               
    pb_ratio DECIMAL(10,2),                                                                                                                 
    ev_to_ebitda DECIMAL(10,2),                                                                                                             
    revenue_growth DECIMAL(8,4),                                                                                                            
    dividend_yield DECIMAL(8,4),                                                                                                            
    price_vs_200ma DECIMAL(8,4),                                                                                                            
    price_vs_52w_high DECIMAL(8,4),                                                                                                         
    insider_net_shares_90d INTEGER DEFAULT 0,                                                                                               
    insider_buys_90d INTEGER DEFAULT 0,                                                                                                     
    insider_sells_90d INTEGER DEFAULT 0,                                                                                                    
    congress_net_value_90d INTEGER DEFAULT 0,                                                                                               
    congress_buys_90d INTEGER DEFAULT 0,                                                                                                    
    congress_sells_90d INTEGER DEFAULT 0,                                                                                                   
    cached_at TIMESTAMP DEFAULT NOW()                                                                                                       
  );                                                                                                                                        
                                                                                                                                            
  -- Saved screens (user-defined)                                                                                                           
  CREATE TABLE saved_screens (                                                                                                              
    id SERIAL PRIMARY KEY,                                                                                                                  
    name VARCHAR(100) NOT NULL,                                                                                                             
    filters JSONB NOT NULL,                                                                                                                 
    created_at TIMESTAMP DEFAULT NOW(),                                                                                                     
    last_run_at TIMESTAMP,                                                                                                                  
    last_result_count INTEGER                                                                                                               
  );                                                                                                                                        
                                                                                                                                            
  Indexes                                                                                                                                   
                                                                                                                                            
  -- Primary filter indexes                                                                                                                 
  CREATE INDEX idx_screener_cache_market_cap ON screener_cache(market_cap);                                                                 
  CREATE INDEX idx_screener_cache_pe ON screener_cache(pe_ratio) WHERE pe_ratio IS NOT NULL;                                                
  CREATE INDEX idx_screener_cache_revenue_growth ON screener_cache(revenue_growth) WHERE revenue_growth IS NOT NULL;                        
  CREATE INDEX idx_screener_cache_sector ON screener_cache USING gin (to_tsvector('english', sector));                                      
  CREATE INDEX idx_screener_cache_insider ON screener_cache(insider_net_shares_90d) WHERE insider_net_shares_90d != 0;                      
  CREATE INDEX idx_screener_cache_congress ON screener_cache(congress_net_value_90d) WHERE congress_net_value_90d != 0;                     
                                                                                                                                            
  -- Composite for common query patterns                                                                                                    
  CREATE INDEX idx_screener_cache_value_screen ON screener_cache(pe_ratio, revenue_growth, market_cap);                                     
                                                                                                                                            
  Redis Caching                                                                                                                             
  ┌────────────────────────┬────────┬───────────────────────────────────┐                                                                   
  │      Key Pattern       │  TTL   │              Purpose              │                                                                   
  ├────────────────────────┼────────┼───────────────────────────────────┤                                                                   
  │ screener:query:{hash}  │ 5 min  │ Cache frequent identical queries  │                                                                   
  ├────────────────────────┼────────┼───────────────────────────────────┤                                                                   
  │ screener:counts:sector │ 1 hour │ Pre-computed sector counts for UI │                                                                   
  ├────────────────────────┼────────┼───────────────────────────────────┤                                                                   
  │ screener:last_refresh  │ -      │ Timestamp of last full refresh    │                                                                   
  └────────────────────────┴────────┴───────────────────────────────────┘                                                                   
  RQ Jobs                                                                                                                                   
  ┌───────────────────────────────┬─────────────────────────────┬──────────────────────────────────────────────────────────┐                
  │              Job              │          Schedule           │                         Purpose                          │                
  ├───────────────────────────────┼─────────────────────────────┼──────────────────────────────────────────────────────────┤                
  │ refresh_screener_universe     │ Weekly (Sunday 6am)         │ Update ticker universe from index constituents           │                
  ├───────────────────────────────┼─────────────────────────────┼──────────────────────────────────────────────────────────┤                
  │ refresh_screener_cache        │ Daily (5am ET, pre-market)  │ Refresh all fundamentals + insider + congress aggregates │                
  ├───────────────────────────────┼─────────────────────────────┼──────────────────────────────────────────────────────────┤                
  │ refresh_screener_cache_prices │ Every 15 min (market hours) │ Update prices + 1d change only                           │                
  └───────────────────────────────┴─────────────────────────────┴──────────────────────────────────────────────────────────┘                
  ---                                                                                                                                       
  6. Frontend UX                                                                                                                            
                                                                                                                                            
  Layout                                                                                                                                    
                                                                                                                                            
  ┌─────────────────────────────────────────────────────────────┐                                                                           
  │  🔍 Stock Screener                    [Saved ▼] [Reset]     │                                                                           
  ├──────────────────────┬──────────────────────────────────────┤                                                                           
  │  FILTERS (left)      │  RESULTS TABLE (right)               │                                                                           
  │                      │                                      │                                                                           
  │  ▼ Size              │  Showing 47 of 4,832 stocks          │                                                                           
  │    Market Cap        │  ┌────────────────────────────────┐  │                                                                           
  │    [2B] - [20B]      │  │ AAPL  Apple Inc     Tech  $3.1T│  │                                                                           
  │                      │  │ ▲2.3% P/E:28 +5 insider buys   │  │                                                                           
  │  ▼ Valuation         │  ├────────────────────────────────┤  │                                                                           
  │    P/E Ratio         │  │ MSFT  Microsoft     Tech  $2.8T│  │                                                                           
  │    [0] - [15]        │  │ ▲1.1% P/E:32 +3 insider buys   │  │                                                                           
  │                      │  ├────────────────────────────────┤  │                                                                           
  │  ▼ Growth            │  │ ...                            │  │                                                                           
  │    Revenue Growth    │  └────────────────────────────────┘  │                                                                           
  │    [0%] - [any]      │                                      │                                                                           
  │                      │  Sort: [Market Cap ▼]  Page 1 of 2   │                                                                           
  │  ▼ Sectors           │                                      │                                                                           
  │    ☑ Technology      │                                      │                                                                           
  │    ☐ Healthcare      │                                      │                                                                           
  │    ☐ Financials      │                                      │                                                                           
  │                      │                                      │                                                                           
  │  ▼ Smart Money       │                                      │                                                                           
  │    ☑ Insider buys    │                                      │                                                                           
  │    ☐ Congress buys   │                                      │                                                                           
  │                      │                                      │                                                                           
  └──────────────────────┴──────────────────────────────────────┘                                                                           
                                                                                                                                            
  Key Interactions                                                                                                                          
                                                                                                                                            
  1. Filter application: Filters apply immediately (debounced 300ms) as user adjusts sliders/checkboxes                                     
  2. Range inputs: Min/max inputs with slider for numeric ranges; show distribution histogram above slider                                  
  3. Sector multi-select: Checkboxes with counts (e.g., "Technology (1,247)")                                                               
  4. Result rows: Click row → opens full ticker view (existing functionality)                                                               
  5. Sort controls: Click column headers or use dropdown                                                                                    
  6. Pagination: 50 results per page, simple prev/next                                                                                      
                                                                                                                                            
  Saved Screens                                                                                                                             
                                                                                                                                            
  - Save: Click "Save" → modal for screen name → stored in saved_screens table                                                              
  - Load: Dropdown shows saved screens; selecting one populates filters                                                                     
  - Quick screens: Pre-built screens ("Value Stocks", "Insider Buying", "Dividend Growers") shown as chips above filters                    
                                                                                                                                            
  Result Table Columns                                                                                                                      
  ┌────────────┬────────────────────────────────────────────────────┐                                                                       
  │   Column   │                      Content                       │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Ticker     │ Bold ticker + company name below                   │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Sector     │ Sector badge                                       │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Mkt Cap    │ Formatted (e.g., "$3.1T")                          │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Price      │ Current price + 1d % change                        │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ P/E        │ With color coding (green if low, red if extreme)   │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Rev Growth │ Percentage with +/- sign                           │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Insider    │ Net shares badge (green if buying, red if selling) │                                                                       
  ├────────────┼────────────────────────────────────────────────────┤                                                                       
  │ Congress   │ Net value badge if any activity                    │                                                                       
  └────────────┴────────────────────────────────────────────────────┘                                                                       
  ---                                                                                                                                       
  7. Risks and Edge Cases                                                                                                                   
  Risk: SEC coverage gaps                                                                                                                   
  Mitigation: yfinance doesn't cover all OTC/micro-caps; limit universe to liquid stocks only (avg volume > 100k)                           
  ────────────────────────────────────────                                                                                                  
  Risk: Stale data                                                                                                                          
  Mitigation: Show cached_at timestamp on results; allow manual refresh button; cache prices more frequently than fundamentals              
  ────────────────────────────────────────                                                                                                  
  Risk: Null handling                                                                                                                       
  Mitigation: Many stocks lack forward P/E or dividend yield; UI shows "—" and filters exclude nulls unless explicitly included             
  ────────────────────────────────────────                                                                                                  
  Risk: Performance at scale                                                                                                                
  Mitigation: Pre-compute and cache; query against screener_cache (not live yfinance); use indexes; limit results to 200                    
  ────────────────────────────────────────                                                                                                  
  Risk: Insider data quality                                                                                                                
  Mitigation: yfinance insider data is limited; future: integrate SEC Form 4 directly for more complete coverage                            
  ────────────────────────────────────────                                                                                                  
  Risk: Rate limits                                                                                                                         
  Mitigation: yfinance can throttle; batch requests in refresh job with delays; cache aggressively                                          
  ────────────────────────────────────────                                                                                                  
  Risk: Congress data lag                                                                                                                   
  Mitigation: STOCK Act allows 45-day disclosure delay; show disclosure_date alongside transaction_date                                     
  ────────────────────────────────────────                                                                                                  
  Risk: Empty results                                                                                                                       
  Mitigation: If filters too restrictive → show "No stocks match. Try relaxing filters" with suggestions                                    
  ────────────────────────────────────────                                                                                                  
  Risk: Mobile UX                                                                                                                           
  Mitigation: Collapsible filter panel; horizontal scroll on table; consider separate mobile layout in v2                                   
  ---                                                                                                                                       
  8. Verification Plan                                                                                                                      
                                                                                                                                            
  Unit Tests                                                                                                                                
  ┌─────────────────────────────────┬───────────────────────────────────────────────────┐                                                   
  │              Test               │                     Coverage                      │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_filter_market_cap │ Verify min/max market cap filtering               │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_filter_pe_ratio   │ Verify P/E filtering handles nulls correctly      │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_filter_sectors    │ Multi-sector filtering                            │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_filter_insider    │ Insider activity aggregation and filtering        │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_filter_congress   │ Congress trades aggregation                       │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_sort_order        │ All sort fields work asc/desc                     │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_pagination        │ Offset + limit work correctly                     │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_screener_combined_filters  │ Complex multi-filter query returns correct subset │                                                   
  ├─────────────────────────────────┼───────────────────────────────────────────────────┤                                                   
  │ test_saved_screen_crud          │ Create, read, delete saved screens                │                                                   
  └─────────────────────────────────┴───────────────────────────────────────────────────┘                                                   
  Integration Tests                                                                                                                         
  ┌──────────────────────────────────┬───────────────────────────────────────┐                                                              
  │               Test               │               Coverage                │                                                              
  ├──────────────────────────────────┼───────────────────────────────────────┤                                                              
  │ test_screener_cache_refresh      │ RQ job updates cache correctly        │                                                              
  ├──────────────────────────────────┼───────────────────────────────────────┤                                                              
  │ test_screener_api_response_shape │ Response matches TypeScript interface │                                                              
  ├──────────────────────────────────┼───────────────────────────────────────┤                                                              
  │ test_screener_redis_cache        │ Identical queries hit cache           │                                                              
  └──────────────────────────────────┴───────────────────────────────────────┘                                                              
  Load Testing                                                                                                                              
  ┌────────────────────────────────┬──────────────┐                                                                                         
  │            Scenario            │    Target    │                                                                                         
  ├────────────────────────────────┼──────────────┤                                                                                         
  │ Single complex query           │ < 200ms p95  │                                                                                         
  ├────────────────────────────────┼──────────────┤                                                                                         
  │ 10 concurrent users            │ < 500ms p95  │                                                                                         
  ├────────────────────────────────┼──────────────┤                                                                                         
  │ Full cache refresh (5k stocks) │ < 30 minutes │                                                                                         
  ├────────────────────────────────┼──────────────┤                                                                                         
  │ Query with all filters + sort  │ < 300ms p95  │                                                                                         
  └────────────────────────────────┴──────────────┘                                                                                         
  Manual QA Checklist                                                                                                                       
                                                                                                                                            
  - Value screen returns sensible results (low P/E stocks)                                                                                  
  - Insider screen shows known recent insider buying events                                                                                 
  - Congress screen matches Quiver data spot-check                                                                                          
  - Null values display as "—" not "null"                                                                                                   
  - Saved screens persist across sessions                                                                                                   
  - Click result → correct ticker view opens                                                                                                
  - Empty results show helpful message                                                                                                      
  - Refresh timestamp updates correctly                                                                                                     
                                                                                                                                            
  ---                                                                                                                                       
  This design leverages existing infrastructure (Postgres, Redis, RQ, yfinance, Quiver) while adding a new cached screening layer. The MVP  
  focuses on the most actionable filters (valuation, insider activity, congress trades) that align with the "all-in-one" promise.