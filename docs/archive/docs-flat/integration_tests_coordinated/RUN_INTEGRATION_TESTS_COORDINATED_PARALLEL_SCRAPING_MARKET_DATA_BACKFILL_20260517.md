# Run Integration Tests - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17

---

## 1. Backend focused suites

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py test market_data.tests.test_global_symbol_coverage --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test market_data.tests.test_global_symbol_planner --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test service_ops.tests.test_soc_tasks --keepdb
..\..\..\.venv\Scripts\python.exe manage.py test data_ingest.tests.test_tasks --keepdb
Pop-Location
```

## 2. Frontend focused suites

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

## 3. Runtime smoke

```powershell
./start_dev.ps1
```

Smoke expectations:
1. Core API health OK.
2. Frontend health OK.
3. DataOps endpoints return valid payload shape.

## 4. CPS gate metrics

1. backlog_delta hot tier < 0 over rolling window.
2. failed_count ratio under configured threshold.
3. no tier starvation alert in monitoring window.
