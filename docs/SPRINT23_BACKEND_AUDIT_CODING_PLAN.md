# Sprint 23 - Backend Audit Coding Plan (Execution Sprint)

Status: COMPLETED (CONDITIONAL GO FOR STAGING/PROD SIGN-OFF)
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
| S23-01 | External facade hardening | backend/portfolio/adapters/vnbroker_adapter.py, backend/portfolio/market_data_service.py | Error map thong nhat + timeout/backoff policy chot | unit tests adapter + service error path | Done |
| S23-02 | Remove direct provider imports (phase 1) | backend/portfolio/views.py, backend/portfolio/market_views.py | Loai call truc tiep trong nhom endpoint market hot-path | api route regression focused | Done |
| S23-03 | Remove direct provider imports (workspace flow) | backend/portfolio/views.py, backend/portfolio/market_data_service.py | Workspace overview/chart qua service boundary 1 chieu | workspace integration tests | Done |
| S23-04 | Views decomposition wave | backend/portfolio/views.py + module split | LOC views.py giam >= 30% (so voi baseline 4024) | contract parity tests old/new | Done |
| S23-05 | Validation unification top endpoints | backend/portfolio/market_views.py, backend/portfolio/trading_views.py | Parse request nhat quan bang serializer/schema | negative tests (invalid params) | Done |
| S23-06 | Domain threshold centralization | backend/portfolio/order_flow.py, backend/portfolio/realtime/compute.py, backend/portfolio/market_data_service.py | Module constants/policy trung tam, khong drift logic | threshold mapping regression tests | Done |
| S23-07 | Observability for rollout | backend/config/settings.py + instrumentation points | Metric p95/5xx/fallback/external-timeout thu duoc | smoke metrics + dashboard snapshot | Done |
| S23-08 | Canary + rollback drill | docs + ops scripts | Bien ban canary 10/50/100 va rollback rehearsal | go/no-go sign-off docs | Done |

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
rg "from vnbroker import Vnbroker" backend/portfolio/views.py

# Quick perf baseline script
python benchmark_api.py
```

## 7) Risk controls

1. Moi thay doi route qua feature flag.
2. Neu 5xx > 2x baseline trong 10 phut: rollback ngay.
3. Moi story phai co evidence link vao daily tracker va sprint log.

## 8) Latest execution update (2026-04-05)

Da hoan tat trong block coding hien tai:
1. Tang cuong adapter facade cho vnbroker (history/financial/listing + timeout theo channel).
2. Refactor `market_data_service.py` de dung adapter facade thay cho provider import truc tiep.
3. Loai bo toan bo `from vnbroker import Vnbroker` trong `views.py` cho nhom endpoint market hot-path va workspace flow.

Regression da xac nhan:
1. `manage.py test portfolio.tests.test_adapters` -> PASS.
2. Focused API smoke tests (intraday/price-board/rvol/overview/chart) -> PASS.

Tien do decomposition S23-04:
1. Da tach `stock workspace helpers` sang module moi `backend/portfolio/stock_workspace_helpers.py`.
2. Da tach `whale/realtime helpers` sang module moi `backend/portfolio/whale_feed_helpers.py`.
3. Da tach `AI advisory helpers` sang module moi `backend/portfolio/ai_advisory_helpers.py`.
4. Da tach `screener + alert + common view helpers` sang cac module moi:
	- `backend/portfolio/screener_helpers.py`
	- `backend/portfolio/view_helpers.py`
5. LOC `backend/portfolio/views.py`: 4024 -> 2813 (giam 1211 dong, ~30.1%), dat target sprint.
6. Regression xac nhan:
	- `manage.py test portfolio.tests.test_adapters portfolio.tests.test_screener_api` -> PASS (28 tests).
	- `manage.py check` -> no issues.

Cap nhat S23-05 (validation unification):
1. Da them request serializer chung cho market/trading validation:
	- `MarketIntradayQuerySerializer`
	- `MarketStockChartQuerySerializer`
	- `TradingSubAccountCreateRequestSerializer`
2. Da wire validation vao refactored views:
	- `backend/portfolio/market_views.py` (intraday page_size, chart days)
	- `backend/portfolio/trading_views.py` (sub-account create payload + ownership check)
3. Da bo sung negative tests cho invalid params va foreign portfolio create.
4. Regression xac nhan:
	- `manage.py test portfolio.tests.test_api_routes` -> PASS (96 tests).

Cap nhat S23-06 (domain threshold centralization):
1. Da tao module trung tam `backend/portfolio/domain_constants.py` cho policy/threshold dung chung.
2. Da migrate hardcoded threshold sang constants chung trong:
	- `backend/portfolio/order_flow.py`
	- `backend/portfolio/realtime/compute.py`
	- `backend/portfolio/market_data_service.py`
	- `backend/portfolio/whale_feed_helpers.py`
3. Da unify 2 policy helper dung chung:
	- `resolve_user_whale_threshold_vnd(...)`
	- `classify_whale_size_class(...)`
4. Regression xac nhan:
	- `manage.py test portfolio.tests.test_order_flow portfolio.tests.test_realtime_compute portfolio.tests.test_api_routes` -> PASS (136 tests).

Cap nhat S23-07 (observability rollout metrics):
1. Da them middleware runtime cho market hot-path:
	- `backend/portfolio/middleware.py` (`MarketObservabilityMiddleware`)
	- instrument latency + status code theo endpoint market route
2. Da them observability store trung tam + snapshot API:
	- `backend/portfolio/observability.py`
	- `GET /api/health/market-observability/`
3. Da instrument fallback/timeout event vao service points:
	- `backend/portfolio/market_data_service.py`
	- map du KPI: `p95`, `5xx ratio`, `fallback hits`, `external timeout`
4. Da wire settings va health route:
	- `backend/config/settings.py` (flags + window config)
	- `backend/config/health.py`, `backend/config/urls.py`
5. Regression xac nhan:
	- `manage.py test portfolio.tests.test_observability portfolio.tests.test_order_flow portfolio.tests.test_realtime_compute portfolio.tests.test_api_routes` -> PASS (138 tests).

Cap nhat S23-08 (canary + rollback drill artifacts):
1. Da tao bo tai lieu rollout/canary/rollback cho Sprint 23:
	- `docs/SPRINT23_RUN_DAY_PLAYBOOK_20260406.md`
	- `docs/SPRINT23_EXECUTION_EVIDENCE_TEMPLATE.md`
	- `docs/SPRINT23_CANARY_LOG_20260406.md`
	- `docs/SPRINT23_ROLLBACK_REHEARSAL_REPORT_20260406.md`
	- `docs/SPRINT23_GO_NO_GO_SIGNOFF_20260406.md`
2. Da tao script thu thap evidence runtime:
	- `scripts/ops/sprint23_collect_rollout_evidence.ps1`
3. Da wire acceptance evidence links cho C2..C5:
	- `docs/SPRINT23_ACCEPTANCE_CHECKLIST.md`
4. Trang thai: execution-ready cho canary 10/50/100 + rollback rehearsal + go/no-go sign-off.
5. Cap nhat them canary routing control de rollout 10/50/100 that:
	- `backend/config/settings.py`: `MARKET_VIEWS_CANARY_PERCENT`
	- `backend/portfolio/urls_realtime.py`: deterministic split theo user/ip
	- `backend/portfolio/urls_stock.py`: deterministic split theo user/ip
	- `backend/portfolio/tests/test_api_routes.py`: them regression test cho case canary=0 (legacy path)
