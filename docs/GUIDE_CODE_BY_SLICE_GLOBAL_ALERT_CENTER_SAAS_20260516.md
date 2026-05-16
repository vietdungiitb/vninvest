# Guide Code By Slice — Global Alert Center SaaS OpenAPI Cutover

Ngày: 2026-05-16
Mục tiêu: hướng dẫn đội code triển khai đúng hướng theo từng slice, không lệch kiến trúc SaaS native.

---

## 1. Cách dùng tài liệu này

1. Chọn đúng slice trong bảng dưới.
2. Đọc phần Scope In/Out trước khi sửa code.
3. Chỉ sửa file trong File Map của slice (trừ khi có RFC/approval).
4. Chạy đầy đủ Validation Commands của slice.
5. Điền checklist ở tài liệu companion: docs/CHECKLIST_SLICE_EXECUTION_GLOBAL_ALERT_CENTER_SAAS_20260516.md.
6. Nếu vi phạm bất kỳ Hard Stop nào, block merge ngay.

---

## 2. Hard Stop áp dụng cho mọi slice

1. Không dùng browser làm source of truth cho price_shock, stale_quote, audience truth.
2. Không thêm compat route business logic mới.
3. Không thêm writer song song ngoài SSOT đã chỉ định.
4. Không bỏ qua shadow/parity/soak gate.
5. Không merge endpoint list nếu thiếu pagination, error envelope, auth/rate-limit semantics.

---

## 3. Slice Playbook

### F01 — Lock Global Matrix Contract

Mục tiêu
- Khóa global matrix làm foundation duy nhất cho detection universe.

Scope In
- market_data registry contract, constraints, invariants.

Scope Out
- UI rendering, compat bridge logic.

File Map ưu tiên
- packages/core/backend/src/market_data/models.py
- packages/core/backend/src/market_data/global_symbol_registry.py

Validation Commands
- manage.py test market_data.tests.test_global_symbol_registry --keepdb

Definition of Done
- Một symbol có một canonical row.
- Không còn universe truth rời rạc ngoài registry boundary.

---

### F02 — Complete Demand Ledger Wiring

Mục tiêu
- Tất cả demand source hợp lệ cùng đi qua registry service boundary.

Scope In
- watchlist/tracked/holding/alert/admin/system_default promotion.

Scope Out
- planner scheduling policy.

File Map ưu tiên
- packages/core/backend/src/user_workspace/signals.py
- packages/core/backend/src/market_data/global_symbol_registry.py

Validation Commands
- manage.py test market_data.tests.test_global_symbol_registry --keepdb

Definition of Done
- Không còn mutation path nào ghi demand ngoài boundary chuẩn.

---

### F03 — Operator Read Path + Reconciliation

Mục tiêu
- Operator nhìn được matrix truth và reconcile preview.

File Map ưu tiên
- packages/core/backend/src/service_ops/views/dataops.py
- packages/core/backend/src/service_ops/tests/test_soc_api_domain.py

Validation Commands
- manage.py test service_ops.tests.test_soc_api_domain service_ops.tests.test_soc_tasks --keepdb

Definition of Done
- Có summary/detail/reconcile-preview chạy được, test pass.

---

### A01 — Coverage/Freshness Hardening

Mục tiêu
- Coverage/freshness đủ thông tin để planner và detection không chạy ad-hoc.

File Map ưu tiên
- packages/core/backend/src/market_data/global_symbol_coverage.py

Validation Commands
- manage.py test market_data.tests.test_global_symbol_coverage --keepdb

Definition of Done
- daily_prices, price_board_snapshot, intraday_bars, intraday_ticks, session_facts có freshness/next_action đúng.

---

### A02 — Missing-Only Planner Completion

Mục tiêu
- Planner mặc định missing_only, force_refresh phải explicit và audited.

File Map ưu tiên
- packages/core/backend/src/market_data/global_symbol_planner.py
- packages/core/backend/src/data_ingest/**

Validation Commands
- manage.py test market_data.tests.test_global_symbol_planner --keepdb

Definition of Done
- Không full-scan mặc định, session_facts là first-class dataset.

---

### A03 — Queue Tier / Runtime Policy Cutover

Mục tiêu
- Queue/runtimes bám matrix tier thay vì universe riêng.

File Map ưu tiên
- packages/core/backend/src/service_ops/**
- packages/core/backend/src/vninvest_core/settings.py

Validation Commands
- manage.py test service_ops.tests.test_soc_tasks --keepdb

Definition of Done
- Runtime scheduling bám priority tier + ownership audit.

---

### B01 — Alert Taxonomy + Canonical Fact Models

Mục tiêu
- Khóa family semantics: whale, dark_flow, price_shock, stale_quote, system, ai_alert, ai_suggest.

File Map ưu tiên
- packages/core/backend/src/signal_intelligence/models.py
- packages/core/backend/src/signal_intelligence/serializers.py
- packages/core/backend/src/signal_intelligence/materializers.py

Validation Commands
- manage.py test signal_intelligence.tests.test_materializers --keepdb

Definition of Done
- Payload có alert_family + summary nhất quán.
- Family filter hoạt động đúng.

---

### B02 — Producer Plane Completion

Mục tiêu
- Producer path đầy đủ server-side cho whale/dark/price_shock/stale_quote/AI.

File Map ưu tiên
- packages/core/backend/src/signal_intelligence/materializers.py
- packages/core/backend/src/signal_intelligence/tasks.py

Validation Commands
- manage.py test signal_intelligence.tests.test_materializers --keepdb
- manage.py test signal_intelligence.tests.test_market_anomaly_events --keepdb
- manage.py test signal_intelligence.tests.test_ai_signal_lane --keepdb

Definition of Done
- Không còn business-truth nằm ở browser.

---

### B03 — OpenAPI Alert-Center Contracts

Mục tiêu
- Chuẩn hóa endpoint family /core/v1/signals/alert-center/* và /core/v1/signals/ai-alerts/*.

File Map ưu tiên
- packages/core/backend/src/signal_intelligence/views.py
- packages/core/backend/src/signal_intelligence/urls.py
- packages/core/backend/src/signal_intelligence/api_urls.py

Validation Commands
- manage.py test signal_intelligence.tests.test_alert_center_api --keepdb
- manage.py test signal_intelligence.tests.test_materializers --keepdb

Definition of Done
- Endpoint list đầy đủ, pagination chuẩn, error envelope chuẩn.

---

### C01 — Per-User Delivery Projection

Mục tiêu
- Delivery state machine + preference policy + tenant isolation.

File Map ưu tiên
- packages/core/backend/src/signal_intelligence/delivery_service.py
- packages/core/backend/src/signal_intelligence/views.py
- packages/core/backend/src/signal_intelligence/models.py

Validation Commands
- manage.py test signal_intelligence.tests.test_user_alert_delivery --keepdb
- manage.py test signal_intelligence.tests.test_delivery_service --keepdb

Definition of Done
- new -> seen -> acknowledged -> muted/suppressed hợp lệ.
- mute/snooze không xóa canonical event.

---

### C02 — packages/web Alert Hub

Mục tiêu
- packages/web dùng thuần native contract qua coreApiAdapter.

File Map ưu tiên
- packages/web/src/adapters/coreApiAdapter.js
- packages/web/src/pages/AlertCenterPage.js
- packages/web/src/pages/WhaleAlertsPage.js

Validation Commands
- npm test -- --runInBand --watch=false src/adapters/coreApiAdapter.test.js

Definition of Done
- Main lane + AI lane + summary + actions (ack/mute/context) dùng native endpoint.

---

### D01 — frontend Bridge Sunset

Mục tiêu
- frontend/src chỉ bridge sang server truth, bỏ legacy naming/flow theo lộ trình.

File Map ưu tiên
- frontend/src/api/client.js
- frontend/src/hooks/useUnifiedAlerts.js
- frontend/src/components/DashboardRealtimePanel.jsx

Validation Commands
- npm test -- --runInBand src/api/client.unifiedAlerts.test.js src/components/DashboardRealtimePanel.test.jsx --watch=false

Definition of Done
- Không còn call route legacy.
- Không còn browser-side synthesis nghiệp vụ.

---

### D02 — Parity/Shadow Gates + Legacy Sunset Docs

Mục tiêu
- Khóa governance trước khi sunset compat/legacy.

File Map ưu tiên
- docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_SHADOW_EVIDENCE_20260516.md
- docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md
- docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md

Validation Commands
- ./start_dev.ps1
- Chạy lại smoke + parity report

Definition of Done
- Có bằng chứng shadow/parity và rollback path.
- Không còn claim overstate trong self-audit.

---

## 4. Quick anti-drift checks trước khi mở PR

1. rg -n "realtime/unified-alerts|/core/v1/unified-alert" frontend/src packages/web/src packages/mobile/src
2. rg -n "except: pass|except Exception: pass" packages/core/backend/src
3. rg -n "alert_family|price_shock|stale_quote" packages/core/backend/src/signal_intelligence
4. Chạy checklist PR: docs/CHECKLIST_SELF_AUDIT_PR_GLOBAL_ALERT_CENTER_SAAS_20260516.md
