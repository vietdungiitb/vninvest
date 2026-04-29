# EXECUTION EVIDENCE - Global Signal Services Control Center (2026-04-28w)

## A. Metadata

- Date: 2026-04-28
- Environment: dev
- Slice ID: 2026-04-28w
- Req IDs: GSC-02, GSC-03, GSC-05, GSC-06, GSC-07, GSC-08, GSC-09, GSC-10, GOV-02, GOV-03
- Slice type: backend + frontend + ops + docs sync
- Required AI skill used: Expert React Frontend Engineer, react19-source-patterns, quality-playbook
- Evidence owner: GitHub Copilot (GPT-5.4)
- Reviewer nội bộ: pending final auditor

## B. Scope slice

- Mục tiêu slice:
  - Sync các backend slices global-signal đã validate nhưng chưa ghi ledger/taskboard (`BE-2.2`, `BE-3.1`, `BE-3.2`, aggregate path của `BE-3.3`, `BE-4.1`, `BE-4.2`, `BE-5.1`, `BE-5.2`, `BE-5.3`).
  - Land `SignalControlCenter` trong `AdminOps` cho `FE-6.1` đến `FE-6.5`.
  - Chạy QA bundle, runtime refresh, module-tree regen và sync governance docs.
- File thay đổi thực tế:
  1. backend/portfolio/market_data_service.py
  2. backend/portfolio/services_global_signal_distribution.py
  3. backend/portfolio/services_global_whale_alerts.py
  4. backend/portfolio/services_signal_run_registry.py
  5. backend/portfolio/tasks_whale_service.py
  6. backend/portfolio/tasks_order_flow.py
  7. backend/portfolio/tasks.py
  8. backend/portfolio/models.py
  9. backend/portfolio/migrations/0063_signalservicerun.py
  10. backend/portfolio/serializers.py
  11. backend/portfolio/views_signal_admin.py
  12. backend/config/urls.py
  13. backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py
  14. backend/portfolio/tests/test_global_signal_distribution_service.py
  15. backend/portfolio/tests/test_global_whale_alerts_service.py
  16. backend/portfolio/tests/test_signal_service_run_registry.py
  17. backend/portfolio/tests/test_signal_admin_api.py
  18. backend/portfolio/tests/test_global_signal_universe.py
  19. frontend/src/api/client.js
  20. frontend/src/components/adminops/SignalControlCenter.jsx
  21. frontend/src/components/adminops/SignalControlCenter.test.jsx
  22. frontend/src/pages/AdminOps.jsx
  23. frontend/src/i18n/vi.js
  24. frontend/src/i18n/en.js
  25. docs/TASKBOARD_GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_20260428.md
  26. docs/GLOBAL_SIGNAL_SERVICES_CONTROL_CENTER_EXECUTION_EVIDENCE_20260428w.md
  27. docs/CODE_CHANGE_AUDIT_LEDGER.md
  28. PROGRESS_DASHBOARD.md
  29. module_tree_full.md

## C. Validation commands

| Command | Kết quả | Ghi chú |
|---|---|---|
| `Push-Location ./backend; & "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test portfolio.tests.test_global_signal_universe portfolio.tests.test_global_signal_policy_helpers portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements portfolio.tests.test_api_routes_stock_workspace_realtime_bulk.ApiRouteStockWorkspaceRealtimeBulkTests.test_whale_feed_aggregate_prefers_canonical_whale_event_store_when_available portfolio.tests.test_global_signal_distribution_service portfolio.tests.test_global_whale_alerts_service portfolio.tests.test_signal_service_run_registry portfolio.tests.test_signal_admin_api --keepdb; Pop-Location` | PASS | 36/36 PASS sau khi ổn định hai test flaky theo thời gian và isolation setting cache. |
| `Push-Location ./frontend; $env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/components/adminops/SignalControlCenter.test.jsx; Pop-Location` | PASS | 2/2 PASS; cover render/load path, config preview, universe apply guard. |
| `Push-Location ./frontend; npm run build; Pop-Location` | PASS | Build pass sau khi land control center và sau khi hạ cấp Whale Ops thành legacy. |
| `& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" .\scripts\ops\generate_module_tree.py` | PASS | Regenerate `module_tree_full.md` thành công (518 modules). |
| `docker compose -f .\docker-compose.dev.yml up -d --build frontend backend celery_worker celery_beat` | PASS | Rebuild/restart runtime slices bị ảnh hưởng. |
| `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health/` | PASS | Trả `200` và payload `{"status": "ok", "service": "vninvest-backend"}`. |

## D. Model / Canonical data evidence

- Canonical store impacted: both
- Event ID or primary key proof:
  - Whale canonical event fixture: `whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream`
  - Dark-flow canonical signal fixture: `dark_flow:VCB:2026-04-28T09:16:00+00:00:iceberg`
- Deterministic / dedupe check: PASS
- Sample payload path: inline fixtures and assertions in `backend/portfolio/tests/test_global_whale_alerts_service.py` and `backend/portfolio/tests/test_signal_admin_api.py`

## E. Admin API / Payload evidence

- Endpoint: `/api/admin-ops/signals/summary/`, `/api/admin-ops/signals/config/preview/`, `/api/admin-ops/signals/universe/apply/`, `/api/admin-ops/signals/jobs/run/`, `/api/admin-ops/signals/events/recent/`, `/api/admin-ops/signals/retention/preview/`
- Request params/body:
  - config preview body with `services_config`, `universe_policy`, `retention_policy`
  - universe apply body `{ "confirm": true, "policy": { ... } }`
  - jobs run body `{ "service_domain": "whale", "symbol": "FPT" }`
- Key fields verified:
  1. summary trả whale/dark-flow counts, latest runs, cache freshness, universe counts và celery state
  2. preview/apply normalize config và universe policy trước khi persist
  3. jobs/events/retention endpoints trả đúng list/preview shapes cho control center mới
- Payload snapshot path: assertions in `backend/portfolio/tests/test_signal_admin_api.py`

## F. UI / Runtime evidence

- Screenshot path: N/A - browser session trong terminal không có staff auth sẵn, route `/admin-ops` redirect về `/login`
- Video path: N/A
- Dev stack rebuild command: `docker compose -f .\docker-compose.dev.yml up -d --build frontend backend celery_worker celery_beat`
- Runtime smoke result: PASS
- PaginationBar used where needed: N/A - jobs/events operator view đang cap 10 rows, chưa mở server pagination
- i18n text verified: PASS

## G. Retention / Performance evidence

- Response time / render time: build/test gates pass; runtime smoke backend health `200`
- Cache key family checked: `global_signal:whale:latest_by_symbol:{symbol}`, `global_signal:dark_flow:latest_by_symbol:{symbol}`, universe snapshot/config caches through helper tests
- Retention preview checked: PASS
- Raw-to-canonical safety gate checked: PASS WITH NOTES - preview-safe path có sẵn; destructive purge path chưa mở cho operator

## H. Governance checklist

- [x] Slice đã map đúng SSOT domain
- [x] Detection không phụ thuộc user-specific threshold
- [x] Preview-before-apply đã được kiểm nếu slice có write action
- [x] Nếu là frontend list lớn, đã dùng `PaginationBar`
- [x] Text UI mới đã qua i18n tiếng Việt
- [ ] Nếu là docs change: đã có audit report doc riêng
- [x] Đã có explicit consent record nếu slice là coding slice

## I. Self-audit checklist

- [x] Đã đối chiếu slice với Req ID trong traceability matrix
- [x] Đã chạy focused validation ngay sau hoàn tất slice
- [x] Đã thu đúng loại evidence cần thiết cho slice này
- [x] Đã cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [x] Đã cập nhật `PROGRESS_DASHBOARD.md`
- [x] Đã ghi residual risk nếu còn

## J. Verdict nội bộ

- Verdict: PASS WITH NOTES
- Rationale:
  - Backend global-signal control plane, frontend control center, runtime refresh và governance sync đều đã có executable evidence.
  - Còn ba residual notes không nên che giấu: single-symbol whale feed chưa canonicalized hoàn toàn, jobs/events UI mới đang cap 10 rows thay vì server pagination, và screenshot authenticated UI chưa capture được do thiếu staff session trong browser agent.

## K. Residual risks and follow-up

1. Risk: `get_whale_feed(...)` single-symbol path vẫn đọc raw source, chưa tận dụng hoàn toàn `WhaleAlertEvent`.
   - Owner: Backend Lead
   - ETA: follow-up nếu product muốn canonical hóa mọi whale consumer path
2. Risk: jobs/events operator lists chưa dùng server pagination + `PaginationBar` vì page size đang cap 10 rows.
   - Owner: Frontend Lead
   - ETA: mở khi backend hỗ trợ paged contracts hoặc operator cần page size lớn hơn
3. Risk: authenticated screenshot/video của AdminOps `Signals` chưa được capture trong terminal session này.
   - Owner: Final auditor / session with staff credentials
   - ETA: during final audit walkthrough

## L. Sign-off

- Slice owner: GitHub Copilot (GPT-5.4)  Date/Time: 2026-04-28
- Internal reviewer: pending  Date/Time: ____
- QA reviewer: pending  Date/Time: ____