# Phase 2: Prefetch Hardening - Task List

- [x] [backend/portfolio/tasks_prefetch.py] Delete `prefetch_ticker_price_board` task
- [x] [backend/portfolio/views_admin_runtime.py] Remove legacy bridge and refactor imports
- [x] [backend/portfolio/tests/test_ticker_prefetch_task.py] Clean up obsolete tests
- [x] [backend/portfolio/tests/test_legacy_purge_gate.py] Implement gate test
- [x] [docs/PREFETCH_INCIDENT_REPORT_20260421.md] Update P1 status
- [x] [docs/CODE_CHANGE_AUDIT_LEDGER.md] Log audit entry
- [x] [PROGRESS_DASHBOARD.md] Sync mandatory audit file list
- [x] Run verification tests (`test_ticker_prefetch_task`, `test_admin_ops`, `test_legacy_purge_gate`, `test_celery_task_names`)
