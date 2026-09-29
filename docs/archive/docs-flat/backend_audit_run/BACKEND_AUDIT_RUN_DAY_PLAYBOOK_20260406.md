# Backend Audit Run-Day Playbook 2026-04-06

Status: READY TO EXECUTE
Related docs:
- docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md
- docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md
- docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md
- docs/BACKEND_AUDIT_OWNER_ASSIGNMENT_20260405.md

## 1) Muc tieu ngay 2026-04-06

1. Day A1 toi trang thai Done.
2. Chot baseline KPI toi thieu cho Intraday/PriceBoard/Whale Aggregate.
3. Dong bo checklist endpoint va gom evidence test.

## 2) Timeline

| Time | Task | Owner | Expected output | Evidence file |
|---|---|---|---|---|
| 09:00 | Pre-flight backend health + feature flags | Ops-Lead-1 | Health 200, flag snapshot | preflight-0900.txt |
| 09:30 | Daily tracker update #1 | PM-1 | Cap nhat status/plans/blocker | daily-0930.txt |
| 10:00 | A1 implementation review | BE-Lead-1 | Facade boundary checklist pass | a1-review.txt |
| 11:00 | Focused route regression run | QA-1 | Test run PASS/FAIL + log | route-regression-1100.txt |
| 13:30 | Daily tracker update #2 | PM-1 | Cap nhat blocker + owner action | daily-1330.txt |
| 14:00 | Baseline KPI capture window | Ops-1 | p95 + 5xx + fallback baseline | baseline-1400.txt |
| 15:30 | Endpoint checklist sync MKT-01..MKT-11 | BE-1 + QA-Lead-1 | Status + evidence links cap nhat | endpoint-checklist-1530.txt |
| 17:30 | Daily tracker update #3 + gate note | PM-1 + Ops-Lead-1 | GO/NO-GO recommendation | daily-1730-gate.txt |

## 3) Command blocks

```powershell
# Pre-flight
Invoke-WebRequest http://127.0.0.1:8000/api/health/ -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:8000/api/health/realtime/ -UseBasicParsing | Select-Object StatusCode

# Feature flags snapshot
cd backend
python manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS})"

# Focused regression
python manage.py test portfolio.tests.test_adapters portfolio.tests.test_api_routes

# Evidence scan for direct provider import in legacy file
rg "from vnbroker import Vnbroker" portfolio/views.py
```

## 4) Pass criteria trong ngay

1. A1 co evidence unit test + code review note.
2. Baseline KPI co so lieu that (khong de TBD).
3. MKT checklist co it nhat 3 endpoint dau tien duoc cap nhat evidence moi.
4. Daily tracker co du 3 moc update.

## 5) End-of-day outputs can commit

1. docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md
2. docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md
3. docs/SPRINT_EXECUTION_LOG.md
4. docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md
