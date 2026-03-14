# Sentiment Upgrade Study: VADER vs FinBERT vs Anthropic Haiku

## 1. Executive Summary

This study benchmarks four sentiment analysis approaches for financial headline classification: VADER (current production), FinBERT (domain-specific transformer), batched Haiku API calls, and batched DeepSeek API calls. VADER scores **60% accuracy** — systematically misclassifying headlines involving negation, financial jargon, and beat/miss framing. FinBERT jumps to **85%** but introduces ~900MB of dependencies and 571MB RSS that exceeds Railway container limits. Both LLM approaches hit **95-100% accuracy**. DeepSeek matches Haiku on accuracy and is ~10% cheaper per call, but its **29s latency** far exceeds our 15s timeout — disqualifying it for production use. **Haiku is the recommended upgrade** with zero new dependencies, async-native integration, ~7s batched latency (within 15s timeout), and ~$23/month at 100 tickers/day with 4hr TTL. A VADER fallback ensures graceful degradation if the API is unavailable.

## 2. Methodology

### Test Corpus
20 headlines across 5 categories of known VADER weaknesses (4 headlines each):

| Category | Why VADER fails | Example |
|----------|----------------|---------|
| Negation/qualifiers | Misses "despite", "fails to", "barely" | "Tesla misses estimates despite record deliveries" |
| Domain jargon | Lacks "hawkish", "delisting", "margin compression" | "Fed signals hawkish pivot, rate cuts off the table" |
| Beat/miss framing | "beats" reads positive even in negative context | "Apple barely beats as iPhone sales slow" |
| PR boilerplate | Positive-sounding neutral announcements | "Company reaffirms full-year guidance" |
| Numeric context | Ignores magnitude (2% vs 15% estimate) | "Revenue up 2% vs 15% analyst estimate, guidance cut" |

### Ground Truth
Labels assigned from an investor's perspective: does this headline suggest the stock should go up (positive), down (negative), or is it purely informational (neutral)?

### Scripts
- `01_vader_baseline.py` — VADER scores + accuracy tables
- `02_finbert_benchmark.py` — FinBERT accuracy + CPU latency + memory profiling
- `03_anthropic_prototype.py` — Haiku batch classification (async)
- `04_comparison_table.py` — Side-by-side unified comparison

## 3. Accuracy Results

### Overall Accuracy

| Method | Accuracy | Correct / 20 |
|--------|----------|---------------|
| VADER | 60% | 12/20 |
| FinBERT | 85% | 17/20 |
| Haiku | 95% | 19/20 |
| DeepSeek | 100% | 20/20 |

### Per-Category Accuracy

| Category | VADER | FinBERT | Haiku | DeepSeek |
|----------|-------|---------|-------|----------|
| negation | 75% | 100% | 100% | 100% |
| jargon | 50% | 100% | 100% | 100% |
| beat_miss | 50% | 100% | 100% | 100% |
| boilerplate | 50% | 50% | 75% | 100% |
| numeric | 75% | 75% | 100% | 100% |

### Notable Disagreements

**VADER misses that both FinBERT and Haiku get right (5 headlines):**
- #3 "Netflix subscriber growth falls short despite price hikes" — VADER: positive (+0.382), truth: negative. "Growth" overwhelms "falls short"
- #6 "Margin compression accelerates as input costs rise" — VADER: neutral (0.000), truth: negative. Financial jargon invisible to lexicon
- #8 "Short interest surges to 25% of float" — VADER: positive (+0.459), truth: negative. "Surges" scores positive regardless of context
- #9 "Apple barely beats as iPhone sales slow" — VADER: neutral (0.000), truth: negative. "Beats" and "slow" cancel out
- #12 "Microsoft cloud revenue beats but growth rate decelerates sharply" — VADER: positive (+0.527), truth: negative. "Beats" + "growth" dominate

**FinBERT misses that Haiku gets right (2 headlines):**
- #13 "Company reaffirms full-year guidance" — FinBERT: positive (0.78 confidence), truth: neutral. FinBERT reads "reaffirms" as positive signal
- #17 "Revenue up 2% vs 15% analyst estimate, guidance cut" — FinBERT: positive (0.95 confidence!), truth: negative. FinBERT sees "revenue up" but can't compare 2% vs 15%

**Haiku's only miss:**
- #14 "Board of directors approves regular quarterly dividend" — Haiku: positive, truth: neutral. Debatable — dividends are mildly positive but routine. Haiku scored this correctly (neutral) in the standalone run, suggesting temperature=0 still has slight non-determinism

**No headline where all three agree but differ from ground truth** — ground truth labels appear well-calibrated

## 4. Latency Benchmarks

| Metric | VADER | FinBERT | Haiku |
|--------|-------|---------|-------|
| Metric | VADER | FinBERT | Haiku | DeepSeek |
|--------|-------|---------|-------|----------|
| Cold start | 0ms | ~32s (model load) | 0ms (API client) | 0ms (API client) |
| First inference | <1ms | ~2,000ms | N/A (batched) | N/A (batched) |
| Per headline (steady) | <0.03ms | ~18ms | N/A (batched) | N/A (batched) |
| 20 headlines total | 0.5ms | 1,135ms (~1.1s) | 7,021ms (~7s) | 29,071ms (~29s) |

**Impact on 15s timeout in `news.py`:**
- VADER: negligible (<1ms), well within timeout
- FinBERT: adds ~1.1s steady-state, but 32s cold start on first request after deploy is a dealbreaker
- Haiku: adds ~7s network latency — tight but fits within 15s timeout. Use 5s sub-timeout with VADER fallback to be safe
- DeepSeek: **29s latency far exceeds the 15s timeout** — disqualified for production use even with perfect accuracy

## 5. Cost Analysis

### Dependency Size

| Method | New deps | Disk space | RSS memory |
|--------|----------|------------|------------|
| VADER | 0 | 0 MB | ~50 MB |
| FinBERT | transformers + torch | ~900 MB | 571 MB (exceeds 512MB Railway limit) |
| Haiku | 0 (anthropic already installed) | 0 MB | ~0 MB additional |
| DeepSeek | openai SDK | ~5 MB | ~0 MB additional |

### Monthly API Cost (Haiku vs DeepSeek)

| | Haiku | DeepSeek |
|---|---|---|
| Per-call cost | $0.0013 | $0.0012 |
| Input pricing | $0.25/MTok | $0.27/MTok |
| Output pricing | $1.25/MTok | $1.10/MTok |

| Scenario | Calls/day | Haiku/month | DeepSeek/month |
|----------|-----------|-------------|----------------|
| 100 tickers/day, 1hr TTL | 2,400 | ~$90.25 | ~$84.11 |
| 100 tickers/day, 4hr TTL | 600 | ~$22.56 | ~$21.03 |
| 500 tickers/day, 1hr TTL | 12,000 | ~$451.26 | ~$420.56 |
| 500 tickers/day, 4hr TTL | 3,000 | ~$112.81 | ~$105.14 |

DeepSeek is only ~10% cheaper — not enough to justify the 4x worse latency (29s vs 7s).

**Recommendation:** Bump `news_ttl()` from 1hr to 4hr. At 100 tickers/day this keeps Haiku costs at ~$23/month — well within budget and news headlines don't change that frequently.

## 6. Architecture Fit

### VADER (current)

```
_fetch_yfinance_news_sync()     # sync, in thread pool
  └─ _headline_sentiment()      # VADER, per-headline, <1ms
     └─ cached via get_or_compute()
```

- Sync, runs inside `asyncio.to_thread()`, zero cost, zero latency
- No interaction with `cache.py` or `llm.py`
- **Pro:** dead simple, zero failure modes
- **Con:** misclassifies 40% of financial headlines (8/20 in benchmark)

### FinBERT

```
_fetch_yfinance_news_sync()     # sync, in thread pool
  └─ _finbert_sentiment()       # still sync (CPU-bound), same to_thread() pattern
     └─ module-level singleton like _analyzer = SentimentIntensityAnalyzer()
```

- Same `to_thread()` pattern as VADER — drop-in replacement
- Cache unchanged — sentiment computed before caching
- **Conflict: +1.1GB deps** — Docker image bloat, CI time
- **Conflict: 571MB RSS** — exceeds Railway 512MB container limit, OOM risk
- **Conflict: 32s cold start** on first request after deploy (model download + load)
- **Verdict: Not viable for Railway deployment**

### Haiku API (recommended)

```
_fetch_yfinance_news_sync()     # sync, in thread pool (unchanged)
  └─ await _haiku_batch_sentiment()   # async! Can't run inside to_thread()
     └─ uses get_anthropic_client() from core/llm.py
     └─ VADER fallback on API failure
     └─ cached via get_or_compute() (unchanged key/TTL)
```

- **Async** — requires splitting current flow:
  1. Fetch headlines in thread pool (sync, unchanged)
  2. Score via Haiku (async, new)
  3. Cache result (unchanged)
- Reuses `get_anthropic_client()` + `HAIKU_MODEL` from `core/llm.py`
- Cache unchanged structurally; consider bumping `news_ttl()` from 1hr to 4hr to reduce API calls
- **Risk:** API failure needs VADER fallback (graceful degradation pattern from `dcf_suggest.py`)
- **Pro:** Zero new deps, async-native, investor-perspective reasoning
- **Pro:** Can explain *why* sentiment is positive/negative (reasoning field)

### DeepSeek API

```
_fetch_yfinance_news_sync()     # sync, in thread pool (unchanged)
  └─ await _deepseek_batch_sentiment()  # async, OpenAI-compatible SDK
     └─ VADER fallback on API failure
```

- Same integration pattern as Haiku — async batch call + VADER fallback
- Uses `openai` SDK pointed at `api.deepseek.com` (not the Anthropic client)
- **Disqualified: 29s latency** exceeds 15s timeout. Even with a generous sub-timeout, this would make news loads unacceptably slow
- Cost savings over Haiku are only ~10% — not enough to justify adding a second AI provider
- Would require adding `openai` SDK as a dependency (small, but unnecessary complexity)

## 7. Recommendation

**Upgrade to Haiku with VADER fallback.**

### Implementation Diff for `services/news.py`

```python
# Add imports
import json
import re
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL

# Add Haiku sentiment function
_SENTIMENT_SYSTEM = """You are a financial sentiment classifier. For each headline,
determine sentiment FROM AN INVESTOR'S PERSPECTIVE: positive (stock should go up),
negative (stock should go down), or neutral (purely informational).
Return ONLY a JSON array: [{"index": 1, "label": "positive"|"negative"|"neutral"}]"""

async def _haiku_batch_sentiment(headlines: list[dict]) -> list[dict]:
    """Score headlines via single batched Haiku call."""
    client = get_anthropic_client()
    numbered = "\n".join(f"{i}. {h['title']}" for i, h in enumerate(headlines, 1))

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=1000,
        temperature=0.0,
        system=_SENTIMENT_SYSTEM,
        messages=[{"role": "user", "content": numbered}],
    )

    raw = response.content[0].text
    # Extract JSON array (same pattern as earnings_analysis.py)
    start, end = raw.find("["), raw.rfind("]")
    results = json.loads(raw[start:end+1]) if start != -1 and end > start else []

    scored = []
    for h, r in zip(headlines, results):
        scored.append({
            **h,
            "sentiment": {
                "label": r.get("label", "neutral"),
                "source": "haiku",
                "compound": {"positive": 0.5, "negative": -0.5, "neutral": 0.0}.get(r.get("label"), 0),
            },
        })
    return scored

# Modify _compute() in get_news_bundle:
async def _compute():
    raw = await asyncio.wait_for(
        asyncio.to_thread(_fetch_yfinance_news_sync, ticker, limit),
        timeout=15,
    )
    # Try Haiku batch (async, 5s timeout)
    try:
        scored = await asyncio.wait_for(_haiku_batch_sentiment(raw), timeout=5)
    except Exception:
        logger.warning("Haiku sentiment failed for %s, falling back to VADER", ticker)
        scored = raw  # already has VADER sentiment from _fetch_yfinance_news_sync

    comps = [h["sentiment"]["compound"] for h in scored if h.get("sentiment")]
    avg = round(sum(comps) / len(comps), 3) if comps else None
    return {
        "ticker": ticker,
        "avg_headline_sentiment": avg,
        "headlines": scored,
        "filings": [],
        "x_posts": [],
    }
```

### Migration Steps
1. Bump `news_ttl()` from 1hr to 4hr (reduces Haiku calls 4x)
2. Add `_haiku_batch_sentiment()` with 5s timeout
3. Keep VADER as fallback — zero risk of degradation
4. Monitor via logging: track `"source": "haiku"` vs `"source": "vader"` in cached responses
5. After 1 week of production data, evaluate if accuracy improvement is noticeable

### What We're NOT Doing
- FinBERT — too heavy for Railway containers (571MB RSS > 512MB limit, +900MB deps, 32s cold start)
- DeepSeek — 100% accurate but 29s latency exceeds 15s timeout; only 10% cheaper than Haiku
- Removing VADER — it stays as a fallback for API failures
- Per-headline API calls — always batch to minimize cost/latency

## 8. Appendix

### Running the Study

```bash
cd high_finance/studies

# Step 1: VADER baseline (no extra deps)
python 01_vader_baseline.py

# Step 2: FinBERT (install study deps first)
pip install -r requirements-study.txt
python 02_finbert_benchmark.py

# Step 3: Haiku (requires API key)
ANTHROPIC_API_KEY=sk-... python 03_anthropic_prototype.py

# Step 4: Combined comparison
ANTHROPIC_API_KEY=sk-... python 04_comparison_table.py
```

### File Inventory

| File | Purpose | Deps |
|------|---------|------|
| `headlines.py` | 20-headline test corpus + scoring helpers | none |
| `01_vader_baseline.py` | VADER accuracy table | vaderSentiment (existing) |
| `02_finbert_benchmark.py` | FinBERT accuracy + latency + memory | transformers, torch |
| `03_anthropic_prototype.py` | Haiku batch classification | anthropic (existing) |
| `03b_deepseek_prototype.py` | DeepSeek batch classification | openai |
| `04_comparison_table.py` | Unified comparison tables | imports from above |
| `requirements-study.txt` | FinBERT-only deps | - |
| `sentiment_upgrade.md` | This report | - |

### Full Score Table (from `04_comparison_table.py`)

| # | Headline | Expected | VADER | FinBERT | Haiku | DeepSeek |
|---|----------|----------|-------|---------|-------|----------|
| 1 | Tesla misses estimates despite record deliveries | negative | negative | negative | negative | negative |
| 2 | Amazon fails to meet revenue expectations for Q3 | negative | negative | negative | negative | negative |
| 3 | Netflix subscriber growth falls short despite price hikes | negative | **positive** | negative | negative | negative |
| 4 | Nvidia guidance disappoints even as AI demand surges | negative | negative | negative | negative | negative |
| 5 | Fed signals hawkish pivot, rate cuts off the table | negative | negative | negative | negative | negative |
| 6 | Margin compression accelerates as input costs rise | negative | **neutral** | negative | negative | negative |
| 7 | Company faces delisting risk after audit failures | negative | negative | negative | negative | negative |
| 8 | Short interest surges to 25% of float amid accounting concerns | negative | **positive** | negative | negative | negative |
| 9 | Apple barely beats as iPhone sales slow for third quarter | negative | **neutral** | negative | negative | negative |
| 10 | Meta beats on earnings but issues weak forward guidance | negative | negative | negative | negative | negative |
| 11 | Google misses on revenue, beats on EPS by one cent | negative | negative | negative | negative | negative |
| 12 | Microsoft cloud revenue beats but growth rate decelerates sharply | negative | **positive** | negative | negative | negative |
| 13 | Company reaffirms full-year guidance in line with expectations | neutral | neutral | **positive** | neutral | neutral |
| 14 | Board of directors approves regular quarterly dividend | neutral | **positive** | neutral | **positive** | neutral |
| 15 | CEO expresses confidence in long-term strategic vision | neutral | **positive** | **positive** | neutral | neutral |
| 16 | Company announces leadership transition, CFO to retire in Q2 | neutral | neutral | neutral | neutral | neutral |
| 17 | Revenue up 2% vs 15% analyst estimate, guidance cut | negative | negative | **positive** | negative | negative |
| 18 | Profit margins expand 50bps to 12.3%, above Street consensus | positive | positive | positive | positive | positive |
| 19 | Earnings fall 40% year-over-year on restructuring charges | negative | negative | negative | negative | negative |
| 20 | Same-store sales decline 0.5%, slightly below flat estimate | negative | **neutral** | negative | negative | negative |

**Bold** = misclassification. VADER: 8 misses. FinBERT: 3 misses. Haiku: 1 miss. DeepSeek: 0 misses.

### Raw Benchmark Data

**VADER confusion matrix:**
| Actual \ Pred | positive | negative | neutral |
|---------------|----------|----------|---------|
| positive | 1 | 0 | 0 |
| negative | 3 | 9 | 3 |
| neutral | 2 | 0 | 2 |

**FinBERT confusion matrix:**
| Actual \ Pred | positive | negative | neutral |
|---------------|----------|----------|---------|
| positive | 1 | 0 | 0 |
| negative | 1 | 14 | 0 |
| neutral | 2 | 0 | 2 |

**Haiku confusion matrix:**
| Actual \ Pred | positive | negative | neutral |
|---------------|----------|----------|---------|
| positive | 1 | 0 | 0 |
| negative | 0 | 15 | 0 |
| neutral | 1 | 0 | 3 |

**FinBERT latency profile:**
- Cold start (import + model load): 31.85s
- First inference: 1,988ms
- Steady state per headline: 18.2ms
- Peak RSS: 571MB
- Model size on disk: ~900MB

**Haiku token usage:**
- Input: 414 tokens (system prompt + 20 numbered headlines)
- Output: 920 tokens (JSON array with reasoning)
- Cost per call: $0.0013

**DeepSeek token usage:**
- Input: 383 tokens
- Output: 968 tokens
- Cost per call: $0.0012
- Latency: 29,071ms (disqualifying for 15s timeout)
