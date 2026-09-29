# Anchored Conversation Summary — VNInvest Screener SaaS Native + SSOT Refactor

_Last updated: 2026-07-11 — reflects the S2.0 SSOT refactor._

## OBJECTIVE
Complete VNInvest Screener SaaS Native feature + fix i18n + comply with project SSOT principle (all vnbroker data through canonical adapter).

## SSOT PRINCIPLE (user-enforced, hard rule)
- `packages/core/backend/src/market_data/vnbroker_adapter.py` is THE ONLY vnbroker gateway.
- `fetch_company_financials(symbol, source='KBS')` at line 1033 is the canonical function.
- `StockManagementFinancialsView` (`stock_mgmt_native_views.py`) is the canonical consumer — caches under Django cache key `stock_financials:{symbol}` for 12h.
- NO bespoke vnbroker-data stores/tables/tasks allowed.

## NEW CANONICAL SSOT HELPER
- `get_company_financials_response(symbol, force=False)` added to `vnbroker_adapter.py`.
- Single cached fetch (12h); returns `{symbol, financials:{ratio,income_statement,balance_sheet}, note}`.
- Graceful empty on vnbroker failure (does NOT cache failures).
- Consumed by BOTH `StockManagementFinancialsView` and the screener run (one store, one cache).

## ENVIRONMENTAL NOTE
- vnbroker feed HANGS (times out) in dev stack — environmental, not a code bug.
- The 12h cache avoids repeat fetches in prod.

## WORK STATE — S2.0 SSOT REFACTOR

### REMOVED (SSOT violation fix)
- `StockFundamental` model (`models.py`).
- Migration `0005_add_stock_fundamental` + new `0006_remove_stockfundamental` (both applied).
- `enrich_fundamentals` Celery task (`data_ingest/tasks.py`).
- `populate_fundamentals` management command.
- `'enrich_fundamentals'` entry in `queue_policy.py` `offhours_enrichment.periodic_tasks`.
- Kept pre-existing `enrichment_offhours` queue (used by other backfill jobs).

### REFACTORED
- `StockManagementFinancialsView.get` now just calls `get_company_financials_response(symbol, force=force)`.
- `PortfolioScreenerRuleRunView` (`user_workspace/portfolio_analytics_views.py`) now reads fundamentals via `get_company_financials_response(sym)` + `StockProfile.outstanding_shares` → `_compute_fundamental_metrics` → `_screener_build_technical(fundamental_metrics=...)` (replaced the `StockFundamental` bulk-read).
- `_compute_fundamental_metrics` + `_screener_build_technical` kept (pure computation, SSOT-safe).

### VERIFIED
- `manage.py check` clean.
- Migrations applied (0004/0005/0006 all [X]).
- Unit test cache→metrics→row correct (pe_ratio=12.5, market_cap=26900.0, debt_to_equity=0.5).
- End-to-end `PortfolioScreenerRuleRunView` POST returns STATUS 200, total_scanned=59, matched=59, all 6 fundamental keys present (None when cache empty = graceful). Removed test data after.
- Slice Tracker (`docs/IMPLEMENTATION_PLAN_SCREENER_HANDOFF_20260710.md` S2.0 row) updated to SSOT-compliant approach.

## STILL TRUE (from before)
- i18n fix done (`vi.js`/`en.js` snake_case + logic block; `tsc`/`build` pass).
- S0.x / S1.x / S2.2–S2.4 / S3.1–S3.4 DONE.
- Conventions: pure createElement (no JSX), `t()` nested dot-path, SOC glassmorphism.
- Docker dev stack `core-api` service is the backend container (`manage.py` at `/app/src/manage.py`).
- CorePAT auth.
- `npm run lint` broken repo-wide (use `tsc` + `build`).

## NEXT
- S2.1 / S2.5 unblocked (fundamental fields available in matched row via adapter).
- S2.6 / S2.7 still need Celery vs Redis scheduler decision.
- User may want to confirm the SSOT refactor is acceptable.

## RELEVANT FILES
- `packages/core/backend/src/market_data/vnbroker_adapter.py` (`get_company_financials_response`)
- `packages/core/backend/src/.../stock_mgmt_native_views.py` (`StockManagementFinancialsView`)
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` (`PortfolioScreenerRuleRunView`)
- `packages/core/backend/src/.../models.py` (`StockFundamental` removed)
- `packages/core/backend/src/.../migrations/0006_remove_stockfundamental.py`
- `packages/core/backend/src/data_ingest/tasks.py` (`enrich_fundamentals` removed)
- `packages/core/backend/src/.../queue_policy.py`
- `packages/core/backend/src/user_workspace/screener_helpers.py`
- `docs/IMPLEMENTATION_PLAN_SCREENER_HANDOFF_20260710.md`
