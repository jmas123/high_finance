import os
import asyncio
import logging
import time
from datetime import datetime, timedelta, date
from typing import Optional

import pandas as pd
import yfinance as yf
from pydantic import BaseModel

try:
    from fredapi import Fred

    _FRED_OK = True
except ImportError:
    _FRED_OK = False

logger = logging.getLogger(__name__)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Models
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MacroIndicator(BaseModel):
    name: str
    value: float
    previous_value: float
    change: float
    change_pct: float
    unit: str
    last_updated: datetime
    trend: str  # "up" | "down" | "stable"
    impact_description: str


class SectorPerformance(BaseModel):
    sector: str
    ticker: str
    performance_1d: float
    performance_1w: float
    performance_1m: float
    performance_ytd: float
    volume_vs_avg: float
    market_cap_billions: float
    top_movers: list[dict]


class RateImpactAnalysis(BaseModel):
    sector: str
    sensitivity: str  # "high" | "medium" | "low"
    correlation_to_rates: float
    impact_direction: str  # "positive" | "negative" | "neutral"
    explanation: str
    historical_performance_rising_rates: float
    historical_performance_falling_rates: float


class MarketBreadth(BaseModel):
    advancing: int
    declining: int
    unchanged: int
    new_highs: int
    new_lows: int
    above_200dma_pct: float
    above_50dma_pct: float
    mcclellan_oscillator: float
    fear_greed_index: int


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TTL cache
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class _TTLCache:
    def __init__(self):
        self._store: dict[str, tuple[float, object]] = {}

    def get(self, key: str):
        entry = self._store.get(key)
        if entry and time.time() < entry[0]:
            return entry[1]
        return None

    def set(self, key: str, value: object, ttl: int):
        self._store[key] = (time.time() + ttl, value)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Constants
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTOR_ETFS = {
    "Technology": "XLK",
    "Healthcare": "XLV",
    "Financials": "XLF",
    "Consumer Discretionary": "XLY",
    "Consumer Staples": "XLP",
    "Energy": "XLE",
    "Utilities": "XLU",
    "Real Estate": "XLRE",
    "Materials": "XLB",
    "Industrials": "XLI",
    "Communication Services": "XLC",
}

# Top 3 holdings per sector — used for the "movers" column.
# Update occasionally; these don't change often.
SECTOR_HOLDINGS = {
    "Technology": ["AAPL", "MSFT", "NVDA"],
    "Healthcare": ["LLY", "UNH", "JNJ"],
    "Financials": ["JPM", "BAC", "GS"],
    "Consumer Discretionary": ["AMZN", "TSLA", "HD"],
    "Consumer Staples": ["PG", "KO", "PEP"],
    "Energy": ["XOM", "CVX", "SLB"],
    "Utilities": ["NEE", "DUK", "SO"],
    "Real Estate": ["PLD", "AMT", "EQIX"],
    "Materials": ["LIN", "APD", "SHW"],
    "Industrials": ["CAT", "RTX", "UNP"],
    "Communication Services": ["META", "GOOGL", "NFLX"],
}

# Qualitative metadata per sector.
# The sensitivity tier and direction label are editorial judgments.
# Correlation + historical returns are COMPUTED from real price data.
SECTOR_META = {
    "Technology": {
        "sensitivity": "high",
        "direction": "negative",
        "explanation": "Growth stocks with future cash flows are discounted more heavily when rates rise, reducing present values.",
    },
    "Financials": {
        "sensitivity": "high",
        "direction": "positive",
        "explanation": "Banks benefit from wider net interest margins when rates increase.",
    },
    "Real Estate": {
        "sensitivity": "high",
        "direction": "negative",
        "explanation": "Higher rates increase borrowing costs and reduce property valuations.",
    },
    "Utilities": {
        "sensitivity": "high",
        "direction": "negative",
        "explanation": "Capital-intensive with high debt loads; dividend yields become less attractive vs bonds.",
    },
    "Consumer Discretionary": {
        "sensitivity": "medium",
        "direction": "negative",
        "explanation": "Higher rates reduce consumer borrowing and spending capacity.",
    },
    "Healthcare": {
        "sensitivity": "low",
        "direction": "neutral",
        "explanation": "Defensive sector with inelastic demand; less sensitive to rate changes.",
    },
    "Consumer Staples": {
        "sensitivity": "low",
        "direction": "neutral",
        "explanation": "Essential goods demand remains stable regardless of rate environment.",
    },
    "Energy": {
        "sensitivity": "medium",
        "direction": "positive",
        "explanation": "Rates often rise with economic growth, which increases energy demand.",
    },
    "Materials": {
        "sensitivity": "medium",
        "direction": "positive",
        "explanation": "Commodity prices and demand often correlate with economic cycles.",
    },
    "Industrials": {
        "sensitivity": "medium",
        "direction": "positive",
        "explanation": "Benefits from economic expansion that often accompanies rate increases.",
    },
    "Communication Services": {
        "sensitivity": "medium",
        "direction": "negative",
        "explanation": "Mix of growth (streaming) and value (telecom) creates moderate sensitivity.",
    },
}

# Fed rate-cycle windows for computing actual sector returns
HIKING_WINDOWS = [
    ("2015-12-16", "2018-12-19"),  # Yellen / Powell gradual hikes
    ("2022-03-16", "2023-07-26"),  # Powell aggressive hikes
]
CUTTING_WINDOWS = [
    ("2019-07-31", "2020-01-29"),  # Mid-cycle insurance cuts (pre-COVID)
    ("2024-09-18", "2025-01-29"),  # Current easing cycle
]

# Yahoo Finance tickers for the macro dashboard
YF_MACRO = {
    "^TNX": {"name": "10-Year Treasury", "unit": "%",
             "desc": "Key benchmark for mortgage rates and long-term discount rates."},
    "^VIX": {"name": "VIX", "unit": "",
             "desc": "Market fear gauge; low values indicate complacency, spikes signal stress."},
    "DX-Y.NYB": {"name": "DXY (Dollar Index)", "unit": "",
                  "desc": "Strong dollar pressures multinational earnings and emerging markets."},
}

# FRED series (only used when FRED_API_KEY is set)
FRED_SERIES = {
    "FEDFUNDS": {"name": "Fed Funds Rate", "unit": "%",
                  "desc": "The Fed's benchmark rate; changes ripple through all borrowing costs.",
                  "yoy": False},
    "DGS2":     {"name": "2-Year Treasury", "unit": "%",
                  "desc": "Reflects near-term rate expectations; watch vs 10Y for curve signal.",
                  "yoy": False},
    "CPIAUCSL": {"name": "CPI YoY", "unit": "%",
                  "desc": "Headline inflation gauge; drives Fed policy expectations.",
                  "yoy": True},
    "PCEPILFE": {"name": "Core PCE", "unit": "%",
                  "desc": "The Fed's preferred inflation measure; key input to rate decisions.",
                  "yoy": True},
}

MACRO_DISPLAY_ORDER = [
    "Fed Funds Rate", "10-Year Treasury", "2-Year Treasury",
    "Yield Curve (10Y-2Y)", "CPI YoY", "Core PCE",
    "VIX", "DXY (Dollar Index)",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Service
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MarketService:

    def __init__(self, fred_api_key: Optional[str] = None):
        key = fred_api_key or os.environ.get("FRED_API_KEY")
        self._fred: Optional["Fred"] = None
        if key and _FRED_OK:
            try:
                self._fred = Fred(api_key=key)
            except Exception as exc:
                logger.warning("FRED init failed: %s", exc)
        self._cache = _TTLCache()

    # ──────────────────────────────────────────────────────────
    # Macro Indicators
    # ──────────────────────────────────────────────────────────

    async def get_macro_indicators(self) -> list[MacroIndicator]:
        cached = self._cache.get("macro")
        if cached is not None:
            return cached
        result = await asyncio.to_thread(self._build_macro)
        self._cache.set("macro", result, ttl=900)  # 15 min
        return result

    def _build_macro(self) -> list[MacroIndicator]:
        now = datetime.utcnow()
        out: list[MacroIndicator] = []

        # ── Yahoo Finance: VIX, 10Y, DXY ────────────────────
        try:
            tickers = list(YF_MACRO.keys())
            df = yf.download(tickers, period="5d", progress=False, threads=True)
            if not df.empty:
                for yt, meta in YF_MACRO.items():
                    try:
                        closes = df["Close"][yt].dropna()
                        if len(closes) >= 2:
                            out.append(self._indicator(
                                meta["name"],
                                float(closes.iloc[-1]),
                                float(closes.iloc[-2]),
                                meta["unit"], now, meta["desc"],
                            ))
                    except Exception as exc:
                        logger.debug("YF %s: %s", yt, exc)
        except Exception as exc:
            logger.error("YF macro download: %s", exc)

        # ── FRED: Fed Funds, 2Y, CPI YoY, Core PCE ──────────
        if self._fred:
            for sid, meta in FRED_SERIES.items():
                try:
                    lookback = 500 if meta["yoy"] else 90
                    raw = self._fred.get_series(
                        sid, now - timedelta(days=lookback), now,
                    ).dropna()

                    if meta["yoy"] and len(raw) >= 14:
                        cur = ((float(raw.iloc[-1]) / float(raw.iloc[-13])) - 1) * 100
                        prev = ((float(raw.iloc[-2]) / float(raw.iloc[-14])) - 1) * 100
                    elif not meta["yoy"] and len(raw) >= 2:
                        cur, prev = float(raw.iloc[-1]), float(raw.iloc[-2])
                    else:
                        continue

                    out.append(self._indicator(
                        meta["name"], cur, prev,
                        meta["unit"], now, meta["desc"],
                    ))
                except Exception as exc:
                    logger.debug("FRED %s: %s", sid, exc)

       # ── Derived: Yield Curve (10Y − 2Y) ─────────────────
        ten = next((i for i in out if i.name == "10-Year Treasury"), None)
        two = next((i for i in out if i.name == "2-Year Treasury"), None)
        if ten and two:
            spread_bps = round((ten.value - two.value) * 100, 1)        # bps
            prev_spread_bps = round((ten.previous_value - two.previous_value) * 100, 1)

            out.append(self._indicator(
                "Yield Curve (10Y-2Y)",
                spread_bps,
                prev_spread_bps,
                "bps",
                now,
                "Inversion historically signals recession risk; steepening signals recovery.",
            ))

        # Sort into preferred order
        order = {n: i for i, n in enumerate(MACRO_DISPLAY_ORDER)}
        out.sort(key=lambda x: order.get(x.name, 99))
        return out

    @staticmethod
    def _indicator(name: str, cur: float, prev: float, unit: str, now: datetime, desc: str) -> MacroIndicator:
        cur = round(cur, 2)
        prev = round(prev, 2)
        change = round(cur - prev, 2)

        # % change is useful for rates/indices, but not for spreads in bps
        if unit == "bps":
            pct = 0.0
            # bps shouldn't use the same threshold as %; use 1bp
            trend = "up" if change >= 1 else ("down" if change <= -1 else "stable")
        else:
            pct = round((change / abs(prev)) * 100, 2) if prev else 0.0
            trend = "up" if change > 0.005 else ("down" if change < -0.005 else "stable")

        return MacroIndicator(
            name=name,
            value=cur,
            previous_value=prev,
            change=change,
            change_pct=pct,
            unit=unit,
            last_updated=now,
            trend=trend,
            impact_description=desc,
        )


    # ──────────────────────────────────────────────────────────
    # Sector Performance
    # ──────────────────────────────────────────────────────────

    async def get_sector_performance(self) -> list[SectorPerformance]:
        cached = self._cache.get("sectors")
        if cached is not None:
            return cached
        result = await asyncio.to_thread(self._build_sectors)
        self._cache.set("sectors", result, ttl=300)  # 5 min
        return result

    def _build_sectors(self) -> list[SectorPerformance]:
        etfs = list(SECTOR_ETFS.values())
        movers = list({t for hld in SECTOR_HOLDINGS.values() for t in hld})
        all_tickers = list(set(etfs + movers))

        today = date.today()
        start = date(today.year - 1, 12, 20)

        try:
            df = yf.download(
                all_tickers, start=start.isoformat(),
                progress=False, threads=True,
            )
        except Exception as exc:
            logger.error("Sector download: %s", exc)
            return []

        if df.empty:
            return []

        rev = {v: k for k, v in SECTOR_ETFS.items()}
        out: list[SectorPerformance] = []

        for etf in etfs:
            name = rev[etf]
            try:
                closes = df["Close"][etf].dropna()
                vols = df["Volume"][etf].dropna()
                if len(closes) < 2:
                    continue

                last = float(closes.iloc[-1])

                def ret(n: int) -> float:
                    i = max(0, len(closes) - n - 1)
                    ref = float(closes.iloc[i])
                    return round(((last / ref) - 1) * 100, 2) if ref else 0.0

                # YTD
                prev_yr = closes[closes.index.year < today.year]
                ytd_ref = float(prev_yr.iloc[-1]) if len(prev_yr) else last
                perf_ytd = round(((last / ytd_ref) - 1) * 100, 2)

                # Volume vs 20-day avg
                vol_r = 1.0
                if len(vols) >= 21:
                    avg = float(vols.iloc[-21:-1].mean())
                    vol_r = round(float(vols.iloc[-1]) / avg, 2) if avg else 1.0

                # Top movers
                top = []
                for stk in SECTOR_HOLDINGS.get(name, []):
                    try:
                        sc = df["Close"][stk].dropna()
                        if len(sc) >= 2:
                            chg = round(((float(sc.iloc[-1]) / float(sc.iloc[-2])) - 1) * 100, 2)
                            top.append({"symbol": stk, "change": chg})
                    except Exception:
                        pass
                top.sort(key=lambda x: abs(x["change"]), reverse=True)

                out.append(SectorPerformance(
                    sector=name, ticker=etf,
                    performance_1d=ret(1), performance_1w=ret(5),
                    performance_1m=ret(21), performance_ytd=perf_ytd,
                    volume_vs_avg=vol_r,
                    market_cap_billions=self._mcap(etf),
                    top_movers=top[:3],
                ))
            except Exception as exc:
                logger.warning("Sector %s: %s", name, exc)

        return out

    def _mcap(self, ticker: str) -> float:
        ck = f"mcap:{ticker}"
        cached = self._cache.get(ck)
        if cached is not None:
            return cached
        try:
            info = yf.Ticker(ticker).info
            raw = info.get("totalAssets") or info.get("marketCap") or 0
            val = round(raw / 1e9, 2)
        except Exception:
            val = 0.0
        self._cache.set(ck, val, ttl=86400)
        return val

    # ──────────────────────────────────────────────────────────
    # Rate Impact Analysis  (computed from real price data)
    # ──────────────────────────────────────────────────────────

    async def get_rate_impact_analysis(
        self, sector: Optional[str] = None,
    ) -> list[RateImpactAnalysis]:
        cached = self._cache.get("rate_impact")
        if cached is None:
            cached = await asyncio.to_thread(self._build_rate_impact)
            self._cache.set("rate_impact", cached, ttl=86400)  # 24 h
        if sector:
            return [a for a in cached if a.sector == sector]
        return cached

    def _build_rate_impact(self) -> list[RateImpactAnalysis]:
        """
        For each sector ETF, compute:
          1. Average total return during Fed hiking windows
          2. Average total return during Fed cutting windows
          3. 1-year rolling correlation of daily returns vs 10Y yield changes
        """
        etfs = list(SECTOR_ETFS.values())
        try:
            df = yf.download(
                etfs + ["^TNX"],
                start="2015-01-01",
                progress=False, threads=True,
            )
            closes = df["Close"]
        except Exception as exc:
            logger.error("Rate impact download: %s", exc)
            return []

        rates = closes.get("^TNX")
        if rates is not None:
            rates = rates.dropna()

        out: list[RateImpactAnalysis] = []

        for sector_name, etf in SECTOR_ETFS.items():
            meta = SECTOR_META.get(sector_name)
            if not meta:
                continue
            try:
                prices = closes[etf].dropna()

                hiking = self._avg_return(prices, HIKING_WINDOWS)
                cutting = self._avg_return(prices, CUTTING_WINDOWS)
                corr = self._corr(prices, rates)

                out.append(RateImpactAnalysis(
                    sector=sector_name,
                    sensitivity=meta["sensitivity"],
                    correlation_to_rates=corr,
                    impact_direction=meta["direction"],
                    explanation=meta["explanation"],
                    historical_performance_rising_rates=hiking,
                    historical_performance_falling_rates=cutting,
                ))
            except Exception as exc:
                logger.warning("Rate impact %s: %s", sector_name, exc)

        return out

    @staticmethod
    def _avg_return(prices: pd.Series, windows: list[tuple[str, str]]) -> float:
        """Average total return (%) across date windows."""
        rets: list[float] = []
        for s, e in windows:
            try:
                s_ts, e_ts = pd.Timestamp(s), pd.Timestamp(e)
                chunk = prices[
                    (prices.index >= s_ts - pd.Timedelta(days=7))
                    & (prices.index <= e_ts + pd.Timedelta(days=7))
                ]
                if len(chunk) < 10:
                    continue  # ETF may not have existed yet
                tr = ((float(chunk.iloc[-1]) / float(chunk.iloc[0])) - 1) * 100
                rets.append(tr)
            except Exception:
                continue
        return round(sum(rets) / len(rets), 1) if rets else 0.0

    @staticmethod
    def _corr(
        etf: pd.Series,
        rates: Optional[pd.Series],
        lookback: int = 252,
    ) -> float:
        """1-year correlation: daily ETF return vs daily yield change."""
        if rates is None or rates.empty:
            return 0.0
        try:
            common = etf.index.intersection(rates.index)
            if len(common) < lookback // 2:
                return 0.0
            common = common[-lookback:]
            er = etf[common].pct_change().dropna()
            rc = rates[common].diff().dropna()
            aligned = er.index.intersection(rc.index)
            if len(aligned) < 50:
                return 0.0
            c = er[aligned].corr(rc[aligned])
            return round(c, 2) if pd.notna(c) else 0.0
        except Exception:
            return 0.0

    # ──────────────────────────────────────────────────────────
    # Market Breadth  (approximated from sample)
    # ──────────────────────────────────────────────────────────

    async def get_market_breadth(self) -> MarketBreadth:
        cached = self._cache.get("breadth")
        if cached is not None:
            return cached
        result = await asyncio.to_thread(self._build_breadth)
        self._cache.set("breadth", result, ttl=300)
        return result

    def _build_breadth(self) -> MarketBreadth:
        """
        Estimates market breadth from a 30-stock S&P 500 sample.
        For production accuracy, use a real market data feed.
        """
        sample = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "BRK-B",
            "JPM", "V", "UNH", "XOM", "JNJ", "PG", "HD", "MA",
            "ABBV", "MRK", "PFE", "KO", "PEP", "AVGO", "COST",
            "TMO", "WMT", "MCD", "CRM", "ACN", "ABT", "LIN", "DHR",
        ]
        try:
            df = yf.download(sample, period="1y", progress=False, threads=True)
            closes = df["Close"].dropna(how="all")
            if closes.empty or len(closes) < 2:
                return self._no_breadth()

            last, prev = closes.iloc[-1], closes.iloc[-2]
            chg = last - prev
            n = len(sample)
            adv = int((chg > 0).sum())
            dec = int((chg < 0).sum())
            scale = 3400 / n

            sma50 = closes.iloc[-50:].mean() if len(closes) >= 50 else last
            sma200 = closes.iloc[-200:].mean() if len(closes) >= 200 else last
            a50 = round(float((last > sma50).mean()) * 100, 1)
            a200 = round(float((last > sma200).mean()) * 100, 1)

            nh = nl = 0
            if len(closes) >= 252:
                h52 = closes.iloc[-252:].max()
                l52 = closes.iloc[-252:].min()
                nh = int((last >= h52 * 0.99).sum())
                nl = int((last <= l52 * 1.01).sum())

            return MarketBreadth(
                advancing=int(adv * scale), declining=int(dec * scale),
                unchanged=int((n - adv - dec) * scale),
                new_highs=int(nh * scale), new_lows=int(nl * scale),
                above_200dma_pct=a200, above_50dma_pct=a50,
                mcclellan_oscillator=0.0,
                fear_greed_index=0,
            )
        except Exception as exc:
            logger.error("Breadth: %s", exc)
            return self._no_breadth()

    @staticmethod
    def _no_breadth() -> MarketBreadth:
        return MarketBreadth(
            advancing=0, declining=0, unchanged=0,
            new_highs=0, new_lows=0,
            above_200dma_pct=0, above_50dma_pct=0,
            mcclellan_oscillator=0, fear_greed_index=0,
        )

    # ──────────────────────────────────────────────────────────
    # Stock-specific rate sensitivity
    # ──────────────────────────────────────────────────────────

    async def get_stock_rate_sensitivity(
        self, ticker: str,
    ) -> Optional[RateImpactAnalysis]:
        """Look up rate impact for a stock's sector."""
        try:
            info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
            sector = info.get("sector")
        except Exception:
            sector = None

        if not sector:
            return None

        analyses = await self.get_rate_impact_analysis()

        # Exact match
        hit = next((a for a in analyses if a.sector == sector), None)
        if hit:
            return hit

        # Fuzzy (Yahoo ↔ GICS naming)
        aliases = {
            "consumercyclical": "consumerdiscretionary",
            "consumerdefensive": "consumerstaples",
            "informationtechnology": "technology",
        }
        norm = lambda s: s.lower().replace(" ", "").replace("-", "")
        needle = aliases.get(norm(sector), norm(sector))

        for a in analyses:
            if needle in norm(a.sector) or norm(a.sector) in needle:
                return a
        return None


# ─── Singleton ───────────────────────────────────────────────
market_service = MarketService()