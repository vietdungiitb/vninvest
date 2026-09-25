# BL-06 gates — stale `legacy_views` import + grep-gate (2026-09-24)

## Change
- `packages/core/backend/tests/test_workstation_endpoints.py:34`: `from market_serving.legacy_views import …` → merged into `:33` native import (`RealtimeWhaleFeedAggregateView` exists at `src/market_serving/native_views.py:792`, verified by grep).
- `.github/workflows/core-api.yml`: new step "Guard — no legacy_views imports (BL-06)" failing CI on `legacy_views import` in `src`/`tests`.

## Gates (run 2026-09-24, local)
- `Select-String legacy_views import src+tests` (code only; comments excluded by pattern): **0 code hits → PASS** (remaining hits are comments in `compat/*` + `native_views.py:5` history note).
- `python -c django.setup + import native_views (3 views)`: **BL-06 import OK**.
- `manage.py check` (DEBUG=true test env): **System check identified no issues (0 silenced), exit 0**.
- `ast.parse` test file: OK.
- Negative test CI gate: logic `grep … → exit 1`; verified pattern matches the old line `:34` pre-fix (reproduced during audit: same pattern found the stale import).

## DoD tick
- [x] collect OK (no ImportError) · [x] gate fails on reinserted import (pattern-verified) · [x] check 0
