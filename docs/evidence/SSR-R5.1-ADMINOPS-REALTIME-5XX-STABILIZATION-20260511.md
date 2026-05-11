# SSR-R5.1 Admin-Ops/Realtime 5xx Stabilization (2026-05-11)

## Incident
- Browser console reported:
  - `502` on `/api/admin-ops/vnbroker-config/current/`
  - `502` on `/api/admin-ops/vnbroker-config/changelog/`
  - `500` on `/api/admin-ops/signals/config/`
  - `503` on `/api/realtime/tickers/`

## Root Cause
- In `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`, function `_legacy_admin_bridge_response` handled `httpx.ConnectError` with:
  - `logger.warning("Legacy bridge connection failed (fallback to native): %s", exc)`
- But `logger` was never defined in this file.
- Result: fallback path threw `NameError: name 'logger' is not defined`, producing 500 instead of graceful fallback.

## Code Fix
- Added:
  - `import logging`
  - `logger = logging.getLogger(__name__)`

## Runtime Refresh (required)
- Executed:
  - `docker compose -f docker-compose.dev.yml up -d --build frontend core-api core-worker core-beat backend backend-worker backend-beat`

## Validation
- Health endpoint:
  - `GET /api/health/` -> `200`
- Gateway probes for previously failing endpoints:
  - `GET /api/admin-ops/signals/config/` -> `401` (auth-guard expected)
  - `GET /api/admin-ops/vnbroker-config/current/` -> `401` (auth-guard expected)
  - `GET /api/admin-ops/vnbroker-config/changelog/?limit=20&offset=0` -> `401` (auth-guard expected)
  - `GET /api/realtime/tickers/?symbols=TCB,...` -> `401` (auth-guard expected)
- Log regression scan:
  - No new `NameError: name 'logger' is not defined` in post-fix log window.

## Residual Risk
- `backend-legacy` intermittent restarts can still create short-lived bridge disconnect spikes.
- Current fix eliminates 500 caused by code bug in fallback handler; bridge availability still depends on backend legacy uptime.

## Files Changed
- `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`
- `PROGRESS_DASHBOARD.md`
- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `module_tree_full.md` (regenerated)
