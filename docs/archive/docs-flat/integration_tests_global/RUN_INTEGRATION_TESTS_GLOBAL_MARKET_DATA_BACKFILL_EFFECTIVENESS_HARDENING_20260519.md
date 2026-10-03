# Run Integration Tests — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Backend focused suites

```powershell
Push-Location ./packages/core/backend
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_scheduler_action --keepdb
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_scheduler_s04 --keepdb
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_soc_api_domain --keepdb
../.venv/Scripts/python.exe manage.py test market_data.tests.test_global_symbol_planner --keepdb
../.venv/Scripts/python.exe manage.py test data_ingest.tests.test_tasks --keepdb
Pop-Location
```

### Test categories phải PASS

| ID | Test area | Kỳ vọng |
|---|---|---|
| IT-01 | scheduler `run_now` truth | queued/running/success/failed transitions đúng |
| IT-02 | history endpoint | backfill jobs có runs thật, pagination đúng |
| IT-03 | progress endpoint | counters/ETA/current batch có mặt |
| IT-04 | planner ranking | hot gap nặng > warm no-gap > cold backlog |
| IT-05 | targeted repair | symbol cụ thể được plan/run đúng |
| IT-06 | repair_missing | chỉ chọn symbols có gap |
| IT-07 | anomaly summary | hot tier breach visible trong API |

---

## 2. Frontend build and smoke

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### UI checks phải PASS

1. SchedulerBoard hiển thị progress và history enriched fields.
2. DataOps panel hiển thị critical gaps và promotion backlog.
3. Không còn trạng thái `ĐANG CHẠY` bị treo sau khi run terminal-state.
4. Strings mới qua i18n.

---

## 3. Runtime smoke

```powershell
Set-Location "c:/Mujoco Projects/vninvest"
./start_dev.ps1
```

### Kỳ vọng
- Core API healthy
- Frontend healthy
- worker queues healthy
- manual scheduler action smoke pass

---

## 4. Suggested API checks

```powershell
# Example only — replace token as needed
Invoke-WebRequest -Uri "http://localhost/core/v1/operator/scraping/dataops/scheduler/jobs/daily-backfill-prices-1700/history/?page=1&page_size=10" -Headers @{Authorization="Bearer <token>"}
Invoke-WebRequest -Uri "http://localhost/core/v1/operator/scraping/dataops/scheduler/jobs/deep-history-bootstrap-weekly/progress/" -Headers @{Authorization="Bearer <token>"}
```

Kỳ vọng: 200 OK, envelope đúng contract, có trường progress/history cần thiết.
