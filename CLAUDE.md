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
