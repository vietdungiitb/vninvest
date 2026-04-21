# Phase 2: Legacy Path Removal and SSOT Hardening

This plan handles the complete removal of the legacy single-scan prefetch path and hardens the system towards a single source of truth (SSOT) using the canonical shard flow.

## User Review Required

> [!IMPORTANT]
> This phase will delete the `prefetch_ticker_price_board` task entirely. Any external scripts or manual triggers still relying on this task name will fail. All admin operations have already been moved to the canonical flow in Phase 1.

## Proposed Changes

### [Backend] Task & Logic Cleanup

#### [MODIFY] [backend/portfolio/tasks_prefetch.py](backend/portfolio/tasks_prefetch.py)
- Delete the legacy `prefetch_ticker_price_board` Celery task.
- Ensure all helper functions (like `_cache_ticker_rows_from_dataframe`) remain available for the canonical `prefetch_realtime_ticker_shard` and `warmup_cache.py`.

#### [MODIFY] [backend/portfolio/views_admin_runtime.py](backend/portfolio/views_admin_runtime.py)
- Remove `_legacy_views_module` bridge.
- Import runtime policy helpers directly from `portfolio.runtime_policy_helpers`.
- Refactor `admin_system_ai_settings_api` to use direct imports.

---

### [Testing] Regression & Gate Protection

#### [MODIFY] [backend/portfolio/tests/test_ticker_prefetch_task.py](backend/portfolio/tests/test_ticker_prefetch_task.py)
- Remove all tests targeting `prefetch_ticker_price_board`.
- Keep canonical shard and scheduler regression coverage as the SSOT contract.

#### [NEW] [backend/portfolio/tests/test_legacy_purge_gate.py](backend/portfolio/tests/test_legacy_purge_gate.py)
- Add a gate test that scans `tasks.py`, `tasks_prefetch.py`, `views_admin_runtime.py`, and `settings.py` for legacy prefetch symbols to prevent regressions.

---

### [Documentation] Audit & Tracking

#### [MODIFY] [docs/PREFETCH_INCIDENT_REPORT_20260421.md](docs/PREFETCH_INCIDENT_REPORT_20260421.md)
- Update Corrective Actions status for P1 (Legacy removal).

#### [MODIFY] [docs/CODE_CHANGE_AUDIT_LEDGER.md](docs/CODE_CHANGE_AUDIT_LEDGER.md)
- Log the removal of legacy prefetch artifacts.
- Sync `PROGRESS_DASHBOARD.md` audit file list.

## Verification Plan

### Automated Tests
- `python manage.py test portfolio.tests.test_ticker_prefetch_task`
- `python manage.py test portfolio.tests.test_admin_ops`
- `python manage.py test portfolio.tests.test_legacy_purge_gate`
- `python manage.py test portfolio.tests.test_celery_task_names`

### Manual Verification
- Check Admin Ops "Warmup" button in UI (via `warm_ticker_prefetch_api` call logs) to ensure it triggers the canonical flow.
