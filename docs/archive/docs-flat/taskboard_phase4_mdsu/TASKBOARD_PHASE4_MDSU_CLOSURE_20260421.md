# Taskboard: MDSU Phase 4 - Closure ✅

Final task list to reach 100% SSOT for market data business read-paths.

- [x] Phase 4.1: Call-site Migration
    - [x] Migrate `analytics.py` (4 call-sites)
    - [x] Migrate `ai_advisory_helpers.py` (2 call-sites)
    - [x] Migrate `ai_context.py` (1 call-site)
    - [x] Migrate `tasks_signal_verification.py` (2 call-sites)
    - [x] Migrate `services.py` (3 call-sites migrated)
- [x] Phase 4.2: Gate Test Hardening
    - [x] Expand `MIGRATED_FILES` to 14 modules
    - [x] Stronger Regex (filter, get, count, annotate, order_by, etc.)
    - [x] Hard-check `services_backfill.py` and `tasks_prefetch.py`
- [x] Phase 4.3: Final Verification & DoD
    - [x] Run Parity Tests (Passed 8/8)
    - [x] Run Gate Tests (Passed)
    - [x] Repo-wide Scan (backend/portfolio) - Result 0 leaks
    - [x] AI Advisory Smoke Test (Verified via context builders)
    - [x] Update Audit Ledger & Progress Dashboard
