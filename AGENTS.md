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