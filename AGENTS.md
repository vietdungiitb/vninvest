# AGENTS.md

## 1. Project summary

VNInvest là workspace đầu tư chứng khoán Việt Nam với frontend React, backend Django, realtime feed, whale analytics, AI advisory và nhiều surface dashboard/workspace khác nhau.

Feature pack hiện tại cần mọi AI session đọc trước khi làm việc là gói:

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/TASKBOARD_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
6. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
6. `quality/QUALITY.md`

Với task liên quan `Money Flow Control Center`, `Signal Control Center`, `Data Ops`, lifecycle lưu trữ whale/dark-flow, materialization/backfill/retention hoặc tối ưu cold path `whale-alerts/:symbol`, đọc thêm gói:

1. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
2. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
3. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TASKBOARD_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_EXECUTION_EVIDENCE_TEMPLATE_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
9. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
10. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
11. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
12. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`

Với task liên quan `SaaS Full Independence`, `Option B`, `proxy gateway`, `loại bỏ phụ thuộc legacy`, `legacy_proxy.py`, `B1 proxy`, `B4 portfolio cutover`, `B7 WebSocket`, `B8 decommission`, đọc gói:

1. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md`
2. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md`
3. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md`
4. `docs/TASKBOARD_SAAS_FULL_INDEPENDENCE_20260504.md`
5. `docs/SAAS_FULL_INDEPENDENCE_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_FULL_INDEPENDENCE_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
8. `docs/SAAS_FULL_INDEPENDENCE_CONFIG_OWNERSHIP_MATRIX_20260504.md`
9. `docs/SAAS_FULL_INDEPENDENCE_CODE_QUALITY_CONSTITUTION_20260504.md`
10. `docs/RUN_CODE_REVIEW_SAAS_FULL_INDEPENDENCE_20260504.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_FULL_INDEPENDENCE_20260504.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_FULL_INDEPENDENCE_20260504.md`

Với task liên quan `SaaS Production Migration`, `legacy decommission`, `domain migration`, `packages/core`, `vninvest_core`, `identity_access`, `commercial`, `signal_intelligence`, `market_serving`, `advisory`, `user_workspace`, `market_data`, `data_ingest`, đọc gói:

1. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
2. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
3. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
4. `docs/TASKBOARD_SAAS_MIGRATION_20260504.md`
5. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
7. `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
8. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
9. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
10. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`

## 2. Read-first quality docs

Trước mọi thay đổi có liên quan feature này, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
3. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
5. `quality/RUN_CODE_REVIEW.md`
6. `quality/RUN_INTEGRATION_TESTS.md`
7. `quality/RUN_SPEC_AUDIT.md`

Trước mọi thay đổi liên quan `Money Flow Control Center` hoặc lifecycle lưu trữ whale/dark-flow, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_HANDOFF_MASTER_20260501.md`
3. `docs/IMPLEMENTATION_PLAN_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
4. `docs/TECH_SPEC_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
5. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_TRACEABILITY_MATRIX_20260501.md`
6. `docs/MONEY_FLOW_CONTROL_CENTER_CONFIG_OWNERSHIP_MATRIX_20260501.md`
7. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_CODE_QUALITY_CONSTITUTION_20260501.md`
8. `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_SELF_AUDIT_AND_TEST_PROTOCOL_20260501.md`
9. `docs/RUN_CODE_REVIEW_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
10. `docs/RUN_INTEGRATION_TESTS_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`
11. `docs/RUN_SPEC_AUDIT_MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_20260501.md`

Trước mọi thay đổi liên quan `SaaS Production Migration`, `packages/core`, `legacy decommission`, hoặc domain migration, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
3. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
4. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
5. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
7. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
8. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
9. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
10. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
11. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`

Trước mọi thay đổi liên quan `SaaS Full Independence`, `Option B`, `proxy gateway`, `B1-B8 phases`, hoặc `loại bỏ phụ thuộc legacy`, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md`
3. `docs/TECH_SPEC_SAAS_FULL_INDEPENDENCE_20260504.md`
4. `docs/IMPLEMENTATION_PLAN_SAAS_FULL_INDEPENDENCE_20260504.md`
5. `docs/SAAS_FULL_INDEPENDENCE_TRACEABILITY_MATRIX_20260504.md`
6. `docs/SAAS_FULL_INDEPENDENCE_CONFIG_OWNERSHIP_MATRIX_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_CODE_QUALITY_CONSTITUTION_20260504.md`
8. `docs/SAAS_FULL_INDEPENDENCE_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
9. `docs/RUN_CODE_REVIEW_SAAS_FULL_INDEPENDENCE_20260504.md`
10. `docs/RUN_INTEGRATION_TESTS_SAAS_FULL_INDEPENDENCE_20260504.md`
11. `docs/RUN_SPEC_AUDIT_SAAS_FULL_INDEPENDENCE_20260504.md`

Trước mọi thay đổi liên quan `OpenAPI`, `API contract`, `serializer schema`, `response envelope`, `status code semantics`, `rate limit`, `tenant isolation`, hoặc chuẩn hóa endpoint trong `core-api`, đọc theo thứ tự:

1. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
2. `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
3. `docs/CORE_API_REMEDIATION_PROPOSAL_20260513.md`
4. `docs/CORE_API_FIX_CHECKLIST_20260513.md`
5. `docs/CORE_API_OPENAPI_STANDARDIZATION_HANDOFF_MASTER_20260513.md`
6. `docs/IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
7. `docs/TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
8. `docs/TASKBOARD_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
9. `docs/CORE_API_OPENAPI_STANDARDIZATION_TRACEABILITY_MATRIX_20260513.md`
10. `docs/CORE_API_OPENAPI_STANDARDIZATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260513.md`
11. `docs/RUN_CODE_REVIEW_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
12. `docs/RUN_INTEGRATION_TESTS_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
13. `docs/RUN_SPEC_AUDIT_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`

## 3. Hard constraints for this feature pack

1. `whale-alerts/:symbol` phải dùng KLineChart làm surface trung tâm.
2. `CVD chuẩn hóa` phải nằm ở pane CVD riêng; `Buy Strength` và `Institutional Strength` phải nằm ở pane strength riêng, vẫn cùng trục X và cùng selected-session truth.
3. Heatmap giai đoạn này chỉ theo `time bucket`, chưa làm footprint theo giá x thời gian.
4. Bubble chart của modern dashboard là source bất biến; chỉ copy sang whale route, không sửa trực tiếp.
5. Icon cá mập phải áp dụng cho top 10% nến đang hiển thị trong viewport, không phải toàn dataset.
6. Bubble/advisory phải bám selected session từ KLineChart.
7. `OrderFlowRadarPanel` phải được chuyển xuống dưới KLineChart ở Stock Detail.
8. Các text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu.
9. `Money Flow Control Center` là operator surface thống nhất; không tạo parallel writer ngoài `global_signal_policy_helpers.py`, `runtime_policy_helpers.py` và whale mission-control SSOT.
10. `global_signal_universe_policy` là SSOT cho detection universe; runtime `intraday_universe_group_ids` chỉ là ingest/warm-tier hint.
11. `IntradayTick` là short-lived staging/recovery input; long-term storage ưu tiên canonical events, bucket facts, session summaries và selective forensic windows.
12. Sau lifecycle upgrade, `whale-alerts/:symbol` phải ưu tiên facts-first selected-session path, không full-scan raw ticks trên primary path.

## 4. Current anchor files

### Frontend

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/components/KLineChartPanel.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx` (immutable source)
- `frontend/src/components/WhaleAnalyticsTab.jsx` (immutable source)
- `frontend/src/components/modern/ModularPositionDeck.jsx` (immutable source)

### Backend

- `frontend/src/api/client.js` for current route contracts
- `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`
- `backend/portfolio/tests/test_whale_analytics_snapshot_flow_series.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py`
- `backend/portfolio/tests/test_order_flow.py`
- `backend/portfolio/tests/test_order_flow_source_parity.py`

## 5. Build and test commands

### Frontend build

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### Backend focused suites

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

### Runtime refresh for UI/runtime slices

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

## 6. Required operating discipline for AI sessions

1. Làm theo slice nhỏ, focused, không mở rộng bề mặt ngoài task hiện tại.
2. Sau edit thực chất đầu tiên phải chạy focused validation ngay.
3. Không đánh dấu xong nếu chưa cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.
4. Với slice runtime/UI phải rebuild hoặc restart stack bị ảnh hưởng để final auditor kiểm tra được ngay.
5. Không dùng workaround làm sai ngữ cảnh selected session, tooltip bucket, heatmap semantics hoặc whale marker viewport rule.
6. Sau mỗi lần sửa code, bắt buộc chạy lệnh build/update docker dev (ví dụ: `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`) để đảm bảo code mới được cập nhật; nếu không hệ thống sẽ vẫn chạy code cũ.

## 7. Evidence obligations

Mỗi slice phải có:

1. danh sách file đổi,
2. command validation và kết quả,
3. screenshot/video nếu là UI,
4. payload snapshot nếu chạm contract,
5. residual risk note nếu còn.

Template chuẩn nằm tại:

- `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_EXECUTION_EVIDENCE_TEMPLATE_20260428.md`
- `docs/MONEY_FLOW_CONTROL_CENTER_DATA_LIFECYCLE_EXECUTION_EVIDENCE_TEMPLATE_20260501.md`
- `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`

## 8. Hard constraints for SaaS Migration

1. **Không ghi vào legacy DB từ core containers** — `CoreRouter` phải block; không workaround.
2. **Shadow run bắt buộc** trước mọi Celery task cutover — tối thiểu 3 ngày trade thật.
3. **Parity gate >= 99%** trên mọi domain migration trước khi cutover.
4. **7 pre-decommission gates** (A-G) phải PASS và có Tech Lead sign-off trước khi xoá legacy code.
5. **Không có default passwords** trong prod compose — dùng `${VAR:?error}` syntax.
6. **PAT hash phải dùng HMAC với pepper** — tuyệt đối không plain SHA-256.
7. **ALLOWED_HOSTS** và **CORS** không được wildcard/DEBUG-gated trong production.
8. **Tất cả API calls từ packages/web** phải qua `coreApiAdapter.js` — không direct fetch.
9. **Text mới trong packages/web** phải qua i18n tiếng Việt đầy đủ dấu.
10. **Immutable production builds** — không source mount, không runtime pip install.

## 9. Hard constraints for SaaS Full Independence (Option B)

1. **Proxy route phải là route cuối** trong `urls.py` — các native routes không bao giờ bị shadow.
2. **Hop-by-hop headers phải bị strip** trong `legacy_proxy.py` — tuyệt đối không forward `Connection`, `Keep-Alive`, `Transfer-Encoding`.
3. **Timeout proxy**: connect 5s, read 120s (file upload 300s) — không dùng default httpx timeout.
4. **Port 8000 không được exposed** trong bất kỳ compose file nào sau B1.
5. **frontend không được depends_on backend** sau B1 — phải depends_on core-api.
6. **B4 portfolio cutover bắt buộc shadow run >= 3 ngày** với parity_score >= 0.99 trên từng ngày.
7. **Proxy route phải bị xóa hoàn toàn** trước B8 decommission — không để lại dead code.
8. **`legacy_proxy.py` không được log request body** — chỉ log method + path + status code.
9. **WebSocket symbol parameter phải được sanitize** trước khi dùng làm Redis channel key.
10. **LEGACY_BACKEND_URL phải là biến môi trường** — không hardcode trong source.

## 10. Hard constraints for OpenAPI standardization

1. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` là SSOT bắt buộc cho thiết kế endpoint OpenAPI.
2. Mọi PR chạm API contract phải pass đầy đủ `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`.
3. Không merge nếu thiếu cập nhật OpenAPI metadata tương ứng khi thay đổi request/response contract.
4. Không merge nếu endpoint list không có pagination hoặc endpoint auth không có rate limit policy.
5. Tuyệt đối cấm `except: pass` và `except Exception: pass` trong API path.
6. Error response phải dùng đúng khung chuẩn (detail/code/timestamp/request_id/field_errors).
7. Endpoint tenant-scoped bắt buộc có filter tenant ở query layer và test chặn cross-tenant access.
8. Mọi exception khỏi hard rule phải có ticket, owner, expiry; quá hạn thì block merge.