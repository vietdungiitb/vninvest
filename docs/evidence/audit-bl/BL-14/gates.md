# BL-14 gates — sunset compat + deprecate proxy (PARTIAL; traffic 7d follow-up) (2026-09-24)

## Change
- Deleted (0 code importers, grep-verified): `market_data/legacy_views.py` (7.7KB), `user_workspace/legacy_views.py` (10.9KB), whole `src/compat/` package (empty urls/commands, unwired from root urls/settings).
- Proxy deprecation (`legacy_proxy.py`): `Deprecation: true` + `Sunset: Thu, 31 Dec 2026` + `X-Legacy-Proxy-Deprecated` on 200 + 502 responses. **Removal only after traffic clean** — header advertises intent, not removal.
- Proxy tests extended: deprecation assertions on both paths (5 tests OK).

## Gates
- Grep `legacy_views` in `packages/core/backend/**/*.py`: **1 hit = history comment** (`native_views.py:5`).
- `manage.py test vninvest_core.tests.test_legacy_proxy_scope`: **Ran 5 OK**.
- URL imports (`market_data`, `user_workspace`, `market_serving`, `vninvest_core`): **OK**. `manage.py check`: **0**.
- Dev log scan `PROXY` 24h: 0 hits (debug-level; mechanism works, volume TBD).

## Traffic measurement (follow-up, exact method)
- Prod nginx access log 7d: count `/api/*` hits NOT matching `^/api/(health|soc|v1|public|admin-ops|core/v1)/` → true proxy candidates. Plus `LEGACY_BACKEND_DOWN` 502 rate from api logs.
- Removal ticket opens only when 7d candidates = 0.

## DoD tick
- [x] 0 importers · [x] files deleted · [x] notice headers · [x] tests green · [ ] 7d traffic clean (follow-up).
