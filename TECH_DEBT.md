# Tech Debt Tracker

> Non-critical issues worth fixing. Nothing here is on fire — but each one makes the codebase a little harder to maintain, a little less reliable, or a little more fragile over time.
>
> Last updated: 2025-02-07

---

## How to Use This File

- **Pick items when you have slack time** between features
- **Bundle related fixes** (e.g., do all yfinance hardening in one PR)
- **Delete items** as you fix them — this is a living document
- Priority: `P1` = next sprint, `P2` = this quarter, `P3` = when convenient

---

## Backend

### ~~P1 — Centralize yfinance Field Mapping~~ ✅ DONE

Created `utils/yf_fields.py` with centralized alias constants. Updated `ai_analysis.py` and `valuation.py` to use `get_field()` and constants instead of inline alias lists.

---

### ~~P1 — Pin Dependencies~~ ✅ DONE

Removed duplicate `lxml`, merged duplicate `httpx` → `httpx[http2]`, split dev deps into `requirements-dev.txt`. Full version pinning deferred to when CI/CD exists.

---

### ~~P1 — Duplicate Safe Math Helpers~~ ✅ DONE

Replaced `_safe_div` in `ai_analysis.py` with import from `utils/safe_math.py`. `valuation.py`'s `_safe()` is a different pattern (Optional→float coercion) — intentionally kept separate.

---

### P2 — Retry/Timeout Consistency for yfinance

**Files:** `services/yf_cache.py`, `services/financials.py`, `services/ml_predictor.py`, `services/news.py`

`yf_cache.py` has retry logic for 401 errors, but only for `.info` calls. Other services (`ml_predictor.py:526` bare `.history(period="5y")`, `news.py:25` bare `.news`) have no retry or timeout. Yahoo Finance is notoriously flaky.

**Fix:** Extract retry logic from `yf_cache.py` into a reusable decorator `@retry_on_yf_failure`. Apply to all yfinance call sites. Add timeouts to `.history()` and `.news` calls. Consider adding a semaphore (max 5-10 concurrent yfinance calls) to avoid IP bans.

---

### P2 — Duplicate Anthropic Pricing Logic

**Files:** `services/memo.py:492`, `routes/ai_history.py:140`

Identical formula `(input * 0.80 / 1M) + (output * 4.0 / 1M)` in two files. When Anthropic changes pricing, both need updating.

**Fix:** Extract to `core/ai_costs.py`:
```python
def calculate_cost(input_tokens: int, output_tokens: int, model: str = "haiku") -> float:
    ...
```

---

### P2 — Missing Database Indexes

**Files:** `routes/memo.py`, `routes/ai_history.py`, `routes/companies.py`

As data grows, these queries will slow down:
- `investment_memos` queried by `(user_id, ticker, created_at)` — no composite index
- `investment_memos` filtered by `(user_id, analysis_type)` — no index
- `politician_trades` queried by `(ticker_raw, transaction_date)` — no composite index

**Fix:** Add migration `012_add_query_indexes.py` with composite indexes for the above.

---

### P2 — Inconsistent Type Hints

**Files:** Throughout backend

Mix of `Optional[X]` (old style) and `X | None` (Python 3.10+). Also `from typing import Dict, List` instead of built-in `dict`, `list`.

**Fix:** Standardize on modern syntax (`X | None`, `dict[str, Any]`). Run `ruff --select UP` to auto-upgrade. Add to pre-commit.

---

### P2 — Add Cache Key Versioning

**Files:** `services/yf_cache.py:55`, `services/financials.py:61`, `services/valuation.py:956`, `services/ml_predictor.py:643`

Cache keys use simple prefixes like `hf:financials:AAPL`. If a service changes its data structure, stale cache entries will cause bugs.

**Fix:** Add version numbers: `hf:v1:financials:{ticker}`. Document the namespace registry in `core/cache.py`.

---

### P2 — Ticker Input Validation

**Files:** Most route files

Routes uppercase tickers but don't validate format. While SQLAlchemy prevents SQL injection, raw SQL in `ai_history.py:117-122` could be vulnerable.

**Fix:** Extract the validation from `portfolio_performance.py` to `utils/validators.py`. Apply as FastAPI path dependency: `ticker: str = Path(..., pattern=r'^[A-Z]{1,5}(-USD)?$')`.

---

### P3 — Scattered Timeout Configuration

**Files:** `services/financials.py:71` (15s), `services/yf_cache.py:59` (15s), `services/memo.py:33` (8s), `routes/ticker_bundle.py:341` (12s/20s)

Timeout values are magic numbers scattered across files.

**Fix:** Centralize in `core/config.py` as settings.

---

### P3 — No Cache Hit Rate Telemetry

**File:** `core/cache.py`

Redis caching is used extensively but there's no visibility into hit rates. Can't optimize TTLs without data.

**Fix:** Add counters (`cache_hits`, `cache_misses`) to `get_or_compute()`. Log to structured logger.

---

### P3 — Missing Pagination

**Files:** `routes/companies.py:184`, `routes/memo.py:122`

Some list endpoints have `limit` but no `offset`. Users can't page through historical data.

**Fix:** Add `offset: int = 0` query parameter.

---

### P3 — Dead File: `routes/options_decay.py`

**File:** `routes/options_decay.py`

Duplicate of endpoints already in `routes/options.py`. Not registered in `main.py`.

**Fix:** Delete it.

---

### P3 — Memo Prompt Builder Too Large

**File:** `services/memo.py:137-419`

`build_memo_prompt()` is 320 lines of string formatting with 89+ `.get()` calls. When data schema changes, sections silently degrade to "N/A".

**Fix:** Break into `_build_company_section()`, `_build_valuation_section()`, etc. Add tests that flag when prompt sections are entirely "N/A".

---

## Frontend

### ~~P1 — Replace `any` Types~~ ✅ DONE

Added proper types (`PriceEntry`, `LeadershipMember`, `OwnershipEntry`, `InsiderTrade`, `InsiderSummary`, `InstitutionalFlow`, `OptionsOverview`, `EarningsData`) to `types.ts`. Updated `TickerBundleResponse`, `TickerState`, `TickerAction`, and API functions. Replaced `catch (e: any)` with `catch (e)` + `e instanceof Error` guards. Updated props in `BroaderMarketContextCard`, `OptionsDecaySimulator`, `PoliticianTradesCard`, `NewsCard`, `ETFFundamentalsCard`.

---

### P2 — Split Large Components

| File | Lines | What to extract |
|------|-------|-----------------|
| `App.tsx` | 1,446 | Each view function to `components/views/` |
| `OptionsDecaySimulator.tsx` | 1,090 | Sub-components to `components/options/decay/` |
| `PriceChartWithDrawings.tsx` | 1,047 | Drawing toolbar + overlay logic |
| `DCFCard.tsx` | 836 | Scenario panel, export logic |
| `PredictionCard.tsx` | 733 | Walk-forward, robustness, factor attribution sections |

**Why:** Hard to navigate, hard to test, hard to review PRs that touch these files. Downgraded from P1 — should be done incrementally, one component per PR, with manual browser testing.

---

### P2 — Add Per-Section Error Boundaries

**File:** `App.tsx`

Only one ErrorBoundary at root level. One error in any component crashes the entire app.

**Fix:** Wrap each major section (Chart, DCF, Risk, Options) in its own ErrorBoundary with a fallback UI.

---

### P2 — Fix Index-Only React Keys

**Files:** `earnings/EarningsCard.tsx`, `risk/DistributionChart.tsx`, `risk/FanChart.tsx`, `options/OptionsFlowCard.tsx`, `notifications/NotificationsCard.tsx`, `valuation/SliderWithReference.tsx`

Using array index as React key causes incorrect re-renders when list order changes.

**Fix:** Use stable compound keys: `key={\`${item.ticker}-${item.date}\`}`.

---

### P2 — Accessibility

**Files:** Throughout frontend

Almost no ARIA labels or semantic HTML. Buttons with emoji-only text, modals without `role="dialog"`, form inputs without labels.

**Fix:** Incremental — start with interactive elements (buttons, modals, forms).

---

### P2 — Extract Shared Constants

**Files:** Throughout frontend

Colors (`#3b82f6`, `#22c55e`), timeouts (120000ms), period options, and formatting functions are duplicated across components.

**Fix:** Create `lib/constants.ts` for colors/timeouts/periods. Create `lib/formatters.ts` for shared formatting functions.

---

### P3 — Remove Console Statements

**Files:** `App.tsx`, `SearchBar.tsx`, chart hooks, `ScreenerCard.tsx`, `PortfolioBenchmarkTable.tsx` (11 files)

Console.log/warn/error left in production code.

**Fix:** Remove or gate with `import.meta.env.DEV`.

---

### P3 — Lazy-Load Heavy Utilities

**Files:** Excel export, Recharts imports

Excel export libraries and Recharts are bundled eagerly. Could be loaded on demand.

**Fix:** Dynamic import on user action:
```tsx
const handleExport = async () => {
  const { exportToExcel } = await import('./exportUtils');
  await exportToExcel(data);
};
```

---

## Infrastructure

### ~~P1 — Hardcoded DB Credentials in Script~~ ✅ DONE

Removed hardcoded password from `ingest_prices.py`. Now requires `DATABASE_URL` env var, exits with helpful error message if missing.

---

### P2 — Multi-Stage Docker Build

**File:** `docker/Dockerfile`

Single-stage build includes build tools (gcc) in final image. Adds ~200-300MB.

**Fix:** Builder stage for dependencies, slim runtime stage for app.

---

### P2 — Docker Compose Resource Limits

**File:** `infra/docker-compose.yml`

No CPU/memory limits on any service. A runaway yfinance call or ML prediction can starve the API.

**Fix:** Add `deploy.resources.limits` per service.

---

### P2 — Worker/Scheduler Health Checks

**File:** `infra/docker-compose.yml:82-108`

Both health checks only verify Redis is reachable, not that the RQ worker/scheduler is actually running.

**Fix:** Check RQ worker status: `rq info --url $REDIS_URL | grep -q workers`.

---

### P2 — Missing .env.example Entries

**File:** `infra/.env.example`

`ADMIN_API_KEY`, `ANTHROPIC_API_KEY`, and `AI_MONTHLY_BUDGET_USD` are used in `config.py` but not listed in `.env.example`.

**Fix:** Add all three with placeholder values and comments.

---

### P2 — No CI/CD Pipeline

No `.github/workflows/`, `.gitlab-ci.yml`, or equivalent.

**Fix:** Add GitHub Actions workflow: lint, type-check, test, build, deploy.

---

### P2 — No Database Backup Script

**File:** `scripts/`

No automated backup mechanism.

**Fix:** Add `scripts/backup_db.sh` using `pg_dump`.

---

### P3 — Docker Compose Log Rotation

**File:** `infra/docker-compose.yml`

No logging driver configured. Logs can fill disk.

**Fix:** Add `logging: {driver: "json-file", options: {max-size: "10m", max-file: "3"}}`.

---

### P3 — K8s Deployment Incomplete

**File:** `infra/deployment.yaml`

Placeholder image tag (`your-docker-image:latest`), no liveness probe (only readiness), no worker/scheduler deployments, no HPA.

**Fix:** Flesh out when ready for production k8s deployment.

---

### P3 — Timezone Mismatch Between Containers

**Files:** `docker/Dockerfile`, `docker/Dockerfile.worker`

Worker sets `TZ=America/New_York`, API container doesn't. Could cause subtle time-based bugs.

**Fix:** Set `TZ` consistently in both Dockerfiles.

---

### P3 — Makefile Clean Target Broken

**File:** `Makefile:21`

`find . -type __pycache__` — should be `find . -type d -name '__pycache__'`.

---

## Quick Wins (< 30 min each)

1. Delete `routes/options_decay.py` (dead file)
2. Fix Makefile clean target syntax
3. ~~Remove duplicate `lxml` and merge `httpx` lines in `requirements.txt`~~ ✅
4. Add missing env vars to `.env.example`
5. ~~Remove hardcoded DB password from `ingest_prices.py`~~ ✅
6. Set `TZ` in main Dockerfile
7. Add log rotation to docker-compose
