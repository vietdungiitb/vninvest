# Implementation Plan - MDSU Phase 4: Closure

Finalize the Market Data Service Unification (MDSU) by migrating the remaining 10 business read-path call-sites identified in the audit and hardening the automated gate tests.

## User Review Required

> [!IMPORTANT]
> This phase will enforce a **strict no-direct-query** policy for all business logic in the `portfolio` module. Any new features requiring market data must use `MarketDataService`.

## Proposed Changes

### 1. Business Logic Migration (10 Call-sites)

#### [MODIFY] [analytics.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/analytics.py)
- Refactor `load_prices_df` to use `MarketDataService.get_ohlcv_batch`.
- Refactor `compute_holdings` to replace the `DailyPrice` subquery and range query with canonical service calls.
- Refactor `compute_alpha_beta` to fetch benchmark data via `MarketDataService`.

#### [MODIFY] [ai_advisory_helpers.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/ai_advisory_helpers.py)
- Refactor `_build_whale_context_for_prompt` (L957) to use `MarketDataService.get_historical_indicators` for turnover estimation.
- Refactor `_build_technical_context_for_prompt` (L1038) to use the canonical service path.

#### [MODIFY] [ai_context.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/ai_context.py)
- Refactor `build_symbol_ai_context` (L55) to use `MarketDataService.get_historical_indicators`.

#### [MODIFY] [tasks_signal_verification.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/tasks_signal_verification.py)
- Refactor `_get_ipo_trading_day_count` and `_get_close_price` to use `MarketDataService`.

#### [MODIFY] [services.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/services.py)
- Refactor `get_price_changes` (L1705) to use batch indicators from `MarketDataService`.
- Audit and potentially migrate `get_latest_price` and `get_price_series` helper functions.

---

### 2. Guardrail Hardening

#### [MODIFY] [test_mdsu_gate.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/tests/test_mdsu_gate.py)
- Expand `MIGRATED_FILES` to include all 14 business-critical modules.
- Upgrade the regex check to be more comprehensive (catching `.objects.filter`, `.objects.get`, `.objects.count`, etc.).
- Move `services_backfill.py` and `tasks_prefetch.py` from soft-check to hard-check (no direct query).

## Verification Plan

### Automated Tests
- `python manage.py test portfolio.tests.test_market_data_service`
- `python manage.py test portfolio.tests.test_mdsu_gate`

### Manual Verification
- Perform a final repository-wide grep for `DailyPrice.objects.filter` and `DailyPrice.objects.get` in `backend/portfolio/` to confirm only authorized usage remains (MarketDataService, Admin, Management Commands).
- Verify AI Advisory generation still works correctly with the new context builders.
