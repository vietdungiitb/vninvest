# AGENTS.md

## 1. Project summary

VNInvest là workspace đầu tư chứng khoán Việt Nam với frontend React, backend Django, realtime feed, whale analytics, AI advisory và nhiều surface dashboard/workspace khác nhau.

Feature pack hiện tại cần mọi AI session đọc trước khi làm việc là gói:

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_HANDOFF_MASTER_20260427.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_PLAN_20260427.md`
3. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_TASKBOARD_20260427.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md`
6. `quality/QUALITY.md`

## 2. Read-first quality docs

Trước mọi thay đổi có liên quan feature này, đọc theo thứ tự:

1. `quality/QUALITY.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_HANDOFF_MASTER_20260427.md`
3. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_PLAN_20260427.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
5. `quality/RUN_CODE_REVIEW.md`
6. `quality/RUN_INTEGRATION_TESTS.md`
7. `quality/RUN_SPEC_AUDIT.md`

## 3. Hard constraints for this feature pack

1. `whale-alerts/:symbol` phải dùng KlineChart làm surface trung tâm.
2. Bubble chart của modern dashboard là source bất biến; chỉ copy sang whale route, không sửa trực tiếp.
3. Icon cá mập phải áp dụng cho top 10% nến đang hiển thị trong viewport, không phải toàn dataset.
4. Bubble/advisory phải bám selected session từ KlineChart.
5. `OrderFlowRadarPanel` phải được chuyển xuống dưới KlineChart ở Stock Detail.
6. Các text mới trên UI phải qua i18n tiếng Việt đầy đủ dấu.

## 4. Current anchor files

### Frontend

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/pages/StockDetail.jsx`
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
5. Không dùng workaround làm sai ngữ cảnh selected session hoặc tooltip bucket.

## 7. Evidence obligations

Mỗi slice phải có:

1. danh sách file đổi,
2. command validation và kết quả,
3. screenshot/video nếu là UI,
4. payload snapshot nếu chạm contract,
5. residual risk note nếu còn.

Template chuẩn nằm tại:

- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_EVIDENCE_TEMPLATE_20260427.md`