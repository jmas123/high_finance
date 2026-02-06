# High Finance - AI Teammate Handbook

## Project Overview
A research platform for investors and finance students to access public company data including fundamentals, price history, institutional ownership (13F), and leadership information.

## Tech Stack
- **Backend:** FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis, RQ
- **Frontend:** Web app in `high_finance/web/`
- **Data Source:** SEC EDGAR API
- **Testing:** pytest

## Directory Structure
```
high_finance/
├── src/           # FastAPI backend
├── web/           # Frontend application
├── alembic/       # Database migrations
├── tests/         # Test suite
├── scripts/       # Dev/deployment scripts
├── docker/        # Container configs
└── infra/         # Infrastructure as code
```

## Development Commands
```bash
# Install dependencies
pip install -r high_finance/requirements.txt

# Run dev server
./high_finance/scripts/run_dev.sh

# Run tests
pytest high_finance/tests/

# Database migrations
alembic upgrade head
```

## Code Standards
- Use type hints for all function signatures
- Pydantic models for request/response validation
- Keep API endpoints in `src/` organized by domain
- Write tests for non-trivial business logic
- Prefer minimal diffs - don't refactor unrelated code

## Key Patterns
- SQLAlchemy 2.0 async sessions
- Dependency injection via FastAPI
- Redis for caching expensive SEC API calls
- RQ for background data ingestion jobs

## Known Bugs Fixed (Feb 2025)

### Division by Zero / NaN Issues

| Location | Bug | Fix |
|----------|-----|-----|
| `options_decay.py:105` | `get_moneyness_label` crashes if stock price = 0 | Added `S <= 0` guard, returns "OTM" |
| `options_flow.py:212` | Expected move % fails if `current_price` is 0 | Explicit `is not None and > 0` check |
| `risk.py:28-33` | `_max_drawdown` returns Inf with zero in price array | Filter non-positive values, use `np.errstate` |
| `institutional_flow.py:25,70` | `pct_held` crashes if `shares_outstanding = 0` | Added `> 0` check |
| `market.py:293-294` | YoY macro calculation fails with zero baseline | Skip if baseline <= 0 |
| `market.py:534` | Sector total return crashes with zero start price | Skip if start_price <= 0 |
| `ml_predictor.py:67` | RSI = NaN when all days are up (down = 0) | Replace 0 with epsilon (1e-10) |
| `ml_predictor.py:80` | Volume ratio = NaN if rolling mean = 0 | Replace 0 with epsilon |
| `ml_predictor.py:83,86` | HL spread / target return fail if Close = 0 | Use safe denominator |
| `ml_predictor.py:156` | Win rate crashes if `total_days = 0` | Added `if total_days > 0` guard |

### Utils Added

- `src/high_finance/utils/safe_math.py` - `safe_div()`, `safe_pct_change()`, `safe_return()`, `safe_round()`, `is_valid_price()`

### Frontend Edge Cases

| Issue | Location Pattern | Fix |
|-------|------------------|-----|
| Empty array spread | `Math.min(...arr)` / `Math.max(...arr)` | Guard with `arr.length > 0` check, else return fallback |
| Index-only React keys | `rows.map((r, i) => <Row key={i} />)` | Use compound keys: `key={\`${r.id}-${r.date}\`}` |
| Falsy zero checks | `if (value)` where value can be 0 | Use explicit `if (value != null)` |
| Native title tooltips | `<th title="...">` | Users often miss these; add visible disclaimer text instead |
| SVG attrs don't cascade | `<svg stroke="#888"><rect />` | SVG attrs on parent don't inherit to children in React. Set on each element or use emoji |

### DCF / Valuation Bugs (Feb 2025)

| Issue | Location | Fix |
|-------|----------|-----|
| WACC floor too low | `DivergenceExplainer.tsx:61` | Floor was 5% (unrealistic with 4.2% RFR). Changed to 8% min (implies ~4% ERP) |
| "NOW" marker text collision | `FairValueRangeBar.tsx:127` | Added `zIndex: 20`, `border: "2px solid #333"`, `boxShadow` for contrast |
| Ambiguous empty state | `NotificationsCard.tsx:94` | "Nothing new" → "No new alerts for your holdings in the last 7 days" |
| Market-implied oscillation | `DCFCard.tsx` | Clicking "Use Market-Implied" twice oscillated between values. Fixed by capturing implied values on first divergence detection |
| "Keep My Assumptions" doesn't restore | `DivergenceExplainer.tsx` | Button just collapsed banner, didn't undo changes. Fixed by storing pre-market values and restoring on click |
| Target Price slider no refetch | `RiskCard.tsx:65` | `targetPriceOffset` missing from useEffect deps. Slider changes didn't trigger API call |
| Fixed column grids on mobile | `RiskCard.tsx:294,452` | `repeat(5, 1fr)` and `repeat(6, 1fr)` cramped on mobile. Use `repeat(auto-fit, minmax(Xpx, 1fr))` |
| Slider `onPointerUp` unreliable | `SliderAndToggle.tsx:57` | `onPointerUp` doesn't fire on all browsers. Add `onMouseUp` + `onTouchEnd` fallbacks |
| Risk sliders missing stepper buttons | `SliderAndToggle.tsx` | Native range inputs hard to use on mobile. Added `−`/`+` buttons like DCF sliders |
| Null price in ScenarioCard calcs | `RiskCard.tsx:302-327` | `data.as_of_close * (1 + return)` produces NaN if null. Added `calcPriceTarget()` helper with guard |
| Unused `currentPrice` prop | `DistributionChart.tsx` | Prop accepted but never rendered. Added "NOW" marker line at 0% return position |
| Empty array `Math.max/min` | `FanChart.tsx`, `DistributionChart.tsx` | `Math.max(...[])` returns `-Infinity`. Added length guards with fallback values |

**WACC Floor Rule:** Market-implied WACC should never go below `riskFreeRate + 4%`. If math suggests lower, the market expects higher growth, not lower risk.

**Market-Implied Oscillation Bug:** When user clicks "Use Market-Implied Assumptions":
1. Sliders update → API refetches → divergence flips direction
2. NEW implied values point back to original defaults
3. Clicking again reverts to original → infinite oscillation

**Fix pattern:** Capture implied assumptions on first divergence detection, store in state, reset only when ticker changes:
```tsx
const [capturedImplied, setCapturedImplied] = useState<{...} | null>(null);

useEffect(() => {
  if (divergence && divergence.tier !== "normal" && !capturedImplied) {
    setCapturedImplied(divergence.implied_assumptions);
  }
}, [divergence, capturedImplied]);

useEffect(() => { setCapturedImplied(null); }, [ticker]); // Reset on ticker change
```

**"Undo" Pattern for Apply/Restore Actions:** When a button applies values that user might want to undo:
```tsx
const [preActionValues, setPreActionValues] = useState<{...} | null>(null);

const handleApply = () => {
  setPreActionValues({ ...currentValues }); // Save before applying
  applyNewValues();
};

const handleRestore = () => {
  if (preActionValues) {
    restoreValues(preActionValues);
    setPreActionValues(null);
  }
};

// UI: disable "Apply" after applied, change "Keep" to "Restore" with visual highlight
<button disabled={hasPreActionValues}>
  {hasPreActionValues ? "✓ Applied" : "Apply"}
</button>
<button onClick={hasPreActionValues ? handleRestore : handleDismiss}>
  {hasPreActionValues ? "↩ Restore" : "Dismiss"}
</button>
```

**Responsive Grid Pattern:** Never use fixed column counts for card grids:
```tsx
// ❌ Bad - cramped on mobile
gridTemplateColumns: "repeat(5, 1fr)"

// ✅ Good - wraps responsively
gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
```

**Slider Event Pattern:** `onPointerUp` alone is unreliable. Always add fallbacks:
```tsx
<input
  type="range"
  onChange={(e) => setDraft(Number(e.target.value))}
  onMouseUp={() => setValue(draft)}
  onTouchEnd={() => setValue(draft)}
  onPointerUp={() => setValue(draft)}
  onKeyUp={() => setValue(draft)}
/>
```

**Safe Price Calculation Pattern:** When multiplying prices by returns, guard against null/zero:
```tsx
const closePrice = data?.as_of_close ?? 0;
const calcPriceTarget = (returnPct: number) =>
  closePrice > 0 ? closePrice * (1 + returnPct) : 0;

// Usage
priceTarget={calcPriceTarget(s.stress_p5)}
```

**Safe Array Math Pattern:** `Math.max(...[])` returns `-Infinity`, `Math.min(...[])` returns `Infinity`:
```tsx
// ❌ Bad - crashes on empty array
const max = Math.max(...arr);

// ✅ Good - guard with fallback
const max = arr.length > 0 ? Math.max(...arr) : fallbackValue;
```

### React Router Refactoring Pitfalls

| Issue | Example | Fix |
|-------|---------|-----|
| State lost across routes | DCF sliders reset when navigating Project → Ticker → Project | Use `sessionStorage` for cross-route state that must survive navigation |
| Using undefined functions after refactor | `setCurrentDCFState(null)` called in TickerView but only exists in ProjectView | After splitting components into routes, verify all state setters exist in their new scope |
| Forgetting to clear sessionStorage | Imported DCF reappears after navigating away and back | Clear sessionStorage after consuming: `onDCFImported={() => { setState(null); sessionStorage.removeItem(key); }}` |
| localStorage vs sessionStorage confusion | User preferences vs temporary navigation state | **localStorage**: persists forever (DCF inputs per ticker). **sessionStorage**: current tab only (return-to-project flow) |

### Toggle Filter Pattern

When filter buttons should deselect on second click:
```tsx
// ❌ Wrong - can't deselect
onClick={() => setFilter(value)}

// ✅ Correct - click again to clear
onClick={() => setFilter(filter === value ? defaultValue : value)}
```

### Mobile Slider UX

Native `<input type="range">` is hard to use on mobile. Add stepper buttons:
```tsx
<button onClick={() => setValue(Math.max(min, value - step))}>−</button>
<input type="range" ... />
<button onClick={() => setValue(Math.min(max, value + step))}>+</button>
```

### Market Hours Detection

Always convert to Eastern Time for US market hours:
```tsx
const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
const hours = etTime.getHours();
const isOpen = hours >= 9.5 && hours < 16 && ![0, 6].includes(etTime.getDay());
```

### SVG Icons in React

SVG attributes like `stroke`, `strokeWidth`, `fill` on the parent `<svg>` element do NOT cascade to child elements in React. This codebase uses emoji for icons instead.

```tsx
// ❌ Bad - stroke won't apply to children
<svg stroke="#888" strokeWidth="2">
  <rect x="3" y="4" width="18" height="18" />
  <line x1="3" y1="10" x2="21" y2="10" />
</svg>

// ✅ Option 1 - set attrs on each child (verbose)
<svg>
  <rect stroke="#888" strokeWidth="2" ... />
  <line stroke="#888" strokeWidth="2" ... />
</svg>

// ✅ Option 2 - use emoji (preferred in this codebase)
<span style={{ fontSize: 16 }}>📅</span>
```

### Duplicate/Ambiguous Files

| Component | Correct Path | Wrong Path |
|-----------|--------------|------------|
| PoliticianTradesCard | `components/politicians/PoliticianTradesCard.tsx` | `components/PoliticianTradesCard.tsx` |

**Tip:** Always check App.tsx imports to verify which file is actually used.

### Backend Gotchas

| Issue | Example | Fix |
|-------|---------|-----|
| SQLAlchemy 2.0 raw SQL | `db.execute("SELECT ...")` | Wrap in `text()`: `db.execute(text("SELECT ..."))` |
| Missing price data | Win rate returns null | Run `scripts/ingest_prices.py` to populate prices table |
| API response nesting | `{trade: {...}, politician: {...}}` | Frontend may need to flatten or access nested fields |

### Data Dependencies

| Feature | Requires |
|---------|----------|
| Politician win rate | Price data in `prices` table for companies with trades |
| Trade context/relevance | Politician committee assignments |

### API Update Checklist

When adding new fields to API responses:
1. Update Pydantic schema (e.g., `schemas/politician.py`)
2. Update route to compute/include the field
3. Update frontend TypeScript types
4. Update frontend component to display the field

---

## Environment Setup

- **Virtual env:** `high_finance/.venv` (activate: `source .venv/bin/activate`)
- **Docker:** Run from `infra/` directory (`cd infra && docker compose ...`)
- **Frontend:** `cd web && npm run dev` (runs on port 5173)
- **Database:** PostgreSQL via Docker, local connection: `postgresql://user:jude2000@localhost:5432/high_finance`

## Common Commands

```bash
# Run migrations (from high_finance/ dir)
source .venv/bin/activate && DATABASE_URL="postgresql://user:jude2000@localhost:5432/high_finance" alembic upgrade head

# Rebuild & restart API
cd infra && docker compose build --no-cache api && docker compose up -d api

# Type check frontend
cd web && npx tsc --noEmit

# Check Python syntax
python3 -m py_compile <file.py>
```

## File Patterns

When creating new files, follow these patterns:

| Type | Location | Also Update |
|------|----------|-------------|
| API route | `src/high_finance/api/v1/routes/<name>.py` | Register in `src/main.py` |
| DB model | `src/high_finance/db/models/<name>.py` | Export in `models/__init__.py` |
| Pydantic schema | `src/high_finance/api/v1/schemas/<name>.py` | - |
| Service | `src/high_finance/services/<name>.py` | - |
| Migration | `alembic/versions/XXX_<description>.py` | Increment XXX (e.g., 001, 002, 003) |
| Frontend context | `web/src/lib/<name>.tsx` | Wrap app in `main.tsx` |
| React component | `web/src/components/<feature>/<Name>.tsx` | - |

## Known Issues & Gotchas

| Issue | Solution |
|-------|----------|
| `bcrypt` version conflict with passlib | Pin `bcrypt==4.0.1` in requirements.txt |
| `EmailStr` import error | Add `email-validator` to requirements.txt |
| Docker doesn't pick up code changes | Must rebuild: `docker compose build --no-cache api` |
| alembic "revision not found" error | Check `alembic_version` table matches migration files |
| Frontend auth not working | Ensure `AuthProvider` wraps app before `UserDataProvider` |
| Docker path confusion | Infra is at `high_finance/high_finance/infra/`, not `high_finance/infra/` |
| React Router hooks error | `useNavigate` / `useParams` must be inside `<BrowserRouter>`. Wrap app in `main.tsx` |
| Cross-route state lost | Each route component has isolated state. Use sessionStorage or context for shared state |

## Pre-Commit Checklist

Before committing changes, verify:

- [ ] `cd web && npx tsc --noEmit` — no TypeScript errors
- [ ] `python3 -m py_compile <new_files>` — Python syntax OK
- [ ] `curl http://localhost:8000/health` — API responding
- [ ] New DB models exported in `models/__init__.py`
- [ ] New routes registered in `src/main.py`
- [ ] Migration created if schema changed
