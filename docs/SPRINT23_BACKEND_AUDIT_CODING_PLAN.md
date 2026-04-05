# Sprint 23 - Backend Audit Coding Plan (Execution Sprint)

Status: READY TO START
Timebox: 10 ngay lam viec
Focus: dong no ky thuat theo audit v2 va chuan bi rollout production an toan

## 1) Scope

In scope:
1. Dong external IO boundary cho market data HTTP path.
2. Giam do phuc tap legacy views theo strangler pattern.
3. Chuan hoa validation contract cho endpoint uu tien cao.
4. Gop domain constants/threshold policy ve 1 module trung tam.
5. Bo sung metric + canary gate + rollback criteria.

Out of scope:
1. Rewrite toan bo views.py trong mot sprint.
2. Mo rong tinh nang product moi (chi hardening va architecture).

## 2) Input artifacts bat buoc

1. docs/BACKEND_CODE_AUDIT_$(date +%Y%m%d).md
2. docs/BACKEND_AUDIT_EXECUTION_BOARD_20260405.md
3. docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md
4. docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md
5. docs/BACKEND_AUDIT_OWNER_ASSIGNMENT_20260405.md
6. docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md

## 3) Sprint backlog (code-level)

| Story ID | Muc tieu | Code area du kien | Output bat buoc | Test bat buoc | Status |
|---|---|---|---|---|---|
| S23-01 | External facade hardening | backend/portfolio/adapters/vnstock_adapter.py, backend/portfolio/market_data_service.py | Error map thong nhat + timeout/backoff policy chot | unit tests adapter + service error path | In Progress |
| S23-02 | Remove direct provider imports (phase 1) | backend/portfolio/views.py, backend/portfolio/market_views.py | Loai call truc tiep trong nhom endpoint market hot-path | api route regression focused | Todo |
| S23-03 | Remove direct provider imports (workspace flow) | backend/portfolio/views.py, backend/portfolio/market_data_service.py | Workspace overview/chart qua service boundary 1 chieu | workspace integration tests | Todo |
| S23-04 | Views decomposition wave | backend/portfolio/views.py + module split | LOC views.py giam >= 30% (so voi baseline 4024) | contract parity tests old/new | Todo |
| S23-05 | Validation unification top endpoints | backend/portfolio/market_views.py, backend/portfolio/trading_views.py | Parse request nhat quan bang serializer/schema | negative tests (invalid params) | Todo |
| S23-06 | Domain threshold centralization | backend/portfolio/order_flow.py, backend/portfolio/realtime/compute.py, backend/portfolio/market_data_service.py | Module constants/policy trung tam, khong drift logic | threshold mapping regression tests | Todo |
| S23-07 | Observability for rollout | backend/config/settings.py + instrumentation points | Metric p95/5xx/fallback/external-timeout thu duoc | smoke metrics + dashboard snapshot | Todo |
| S23-08 | Canary + rollback drill | docs + ops scripts | Bien ban canary 10/50/100 va rollback rehearsal | go/no-go sign-off docs | Todo |

## 4) Milestones

1. M1 (Day 1-2): S23-01 done.
2. M2 (Day 3-4): S23-02 + S23-03 done.
3. M3 (Day 5-6): S23-04 + S23-05 done.
4. M4 (Day 7): S23-06 done.
5. M5 (Day 8-9): S23-07 done.
6. M6 (Day 10): S23-08 + sprint sign-off.

## 5) Definition of Done for Sprint 23

1. views.py LOC giam >= 30% hoac co ly do accepted neu gioi han blast-radius.
2. Khong con direct provider import trong flow endpoint da scope.
3. Contract tests old/new pass cho endpoint da migrate.
4. Co baseline metric va post-change metric cho endpoint hot-path.
5. Co canary log + rollback rehearsal + go/no-go bien ban.

## 6) Mandatory commands checklist

```powershell
# Backend tests
cd backend
python manage.py test portfolio.tests.test_adapters
python manage.py test portfolio.tests.test_api_routes

# Direct provider import scan
rg "from vnstock import Vnstock" backend/portfolio/views.py

# Quick perf baseline script
python benchmark_api.py
```

## 7) Risk controls

1. Moi thay doi route qua feature flag.
2. Neu 5xx > 2x baseline trong 10 phut: rollback ngay.
3. Moi story phai co evidence link vao daily tracker va sprint log.
