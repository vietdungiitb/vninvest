# TASKBOARD — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Mục tiêu**: Điều phối thực hiện từng task atomic để SOC đạt full parity, sau đó decommission legacy admin-ops.

**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Slice S5-BE — Backend Screener Rule Endpoints ⚡ PHẢI XONG TRƯỚC S5-FE

> **Gate**: Không viết S5 frontend trước khi S5-BE PASS unit test.

---

- [ ] `SCD-S5-BE.1` **Thêm ScreenerRuleUpdateView vào screener.py**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - Class `ScreenerRuleUpdateView(SOCBaseView)` tồn tại  
  - `PUT /api/soc/screener/rules/<rule_id>/` nhận `{name, conditions, enabled}` payload  
  - Tìm rule trong `ServiceConfig.config_payload.rules` list theo `id`  
  - Trả 404 nếu không tìm thấy rule  
  - Patch rule, save ServiceConfig mới với `is_current=True`, set `applied_by`, `applied_at`  
  - `@extend_schema` decorator có summary tiếng Anh  
  Files: `packages/core/backend/src/service_ops/views/screener.py`  
  Req: SCD-REQ-18

---

- [ ] `SCD-S5-BE.2` **Thêm ScreenerRuleDeleteView vào screener.py**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - Class `ScreenerRuleDeleteView(SOCBaseView)` tồn tại  
  - `DELETE /api/soc/screener/rules/<rule_id>/delete/` trả 204 khi thành công  
  - Trả 404 nếu rule không tồn tại  
  - Remove rule khỏi list, save config  
  - `@extend_schema` decorator  
  Files: `packages/core/backend/src/service_ops/views/screener.py`  
  Req: SCD-REQ-19

---

- [ ] `SCD-S5-BE.3` **Đăng ký 2 URL mới trong urls.py**  
  Owner: Backend Dev  
  Estimate: 15 phút  
  DoD:  
  - `path('screener/rules/<str:rule_id>/', ScreenerRuleUpdateView.as_view())`  
  - `path('screener/rules/<str:rule_id>/delete/', ScreenerRuleDeleteView.as_view())`  
  - Không gây conflict với route `screener/rules/` (POST)  
  Files: `packages/core/backend/src/service_ops/urls.py`  
  Req: SCD-REQ-18, SCD-REQ-19

---

- [ ] `SCD-S5-BE.4` **Unit test cho DELETE + PUT screener rule**  
  Owner: Backend Dev  
  Estimate: 1.5h  
  DoD:  
  - Test: PUT rule id tồn tại → 200 với updated rule  
  - Test: PUT rule id không tồn tại → 404  
  - Test: DELETE rule id tồn tại → 204  
  - Test: DELETE rule id không tồn tại → 404  
  - Test: DELETE sau đó GET rules không còn rule đó  
  Files: `packages/core/backend/src/service_ops/tests/test_screener_rule_crud.py` (new)  
  Gate: Tất cả 5 tests PASS trước khi bắt đầu S5-FE

---

## Slice S1 — PrefetchPanel: Runtime Config Form

> **Gate**: S1 có thể bắt đầu song song với S5-BE.

---

- [ ] `SCD-S1.1` **Verify API response contract**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Gọi `GET /api/soc/prefetch/config/` thực tế và ghi lại response shape  
  - Ghi lại `GET /api/soc/prefetch/universe-groups/` response shape  
  - Xác nhận field names khớp với TECH_SPEC section 2.4  
  - Note: nếu có field nào thiếu, mở issue và điều chỉnh form  
  Files: (không modify code — chỉ observation)

---

- [ ] `SCD-S1.2` **Refactor PrefetchPanel: xóa raw JSON, thêm form Section A**  
  Owner: Frontend Dev  
  Estimate: 2h  
  DoD:  
  - Raw JSON `<pre>` dump bị xóa  
  - Section A "Cài đặt Runtime" có 11 number inputs với label tiếng Việt  
  - Giá trị load từ `socApi.getPrefetchConfig()` khi mount  
  - Validation: min/max per field  
  - [Xem trước & Lưu] → `ConfigPreviewModal` → `socApi.applyPrefetchConfig(payload)`  
  Files: `frontend/src/components/soc/PrefetchPanel.jsx`  
  Req: SCD-REQ-01

---

- [ ] `SCD-S1.3` **Thêm Universe Groups multiselect (Section B)**  
  Owner: Frontend Dev  
  Estimate: 45 phút  
  DoD:  
  - Gọi `socApi.getPrefetchUniverseGroups()` khi mount  
  - Hiển thị multiselect với group_id + label  
  - Selected groups included trong payload save  
  Files: `frontend/src/components/soc/PrefetchPanel.jsx`  
  Req: SCD-REQ-02

---

- [ ] `SCD-S1.4` **Thêm Time Policy editable inputs (Section C)**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:  
  - 6 profile interval inputs: pre_open, market_open, lunch_break, pre_close, post_close, offhours  
  - Giá trị load từ profiles trong config response  
  - Included trong payload save  
  Files: `frontend/src/components/soc/PrefetchPanel.jsx`  
  Req: SCD-REQ-03

---

- [ ] `SCD-S1.5` **Thêm Warm Now buttons (Section D)**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - [Warm Now (Async)] và [Warm Now (Sync)] buttons  
  - Gọi `socApi.warmPrefetchNow('async')` / `warmPrefetchNow('sync')`  
  - Hiển thị task_id hoặc status sau trigger  
  Files: `frontend/src/components/soc/PrefetchPanel.jsx`  
  Req: SCD-REQ-04

---

- [ ] `SCD-S1.6` **i18n keys PrefetchPanel + build test**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Tất cả labels/buttons có key trong `vi.js` và `en.js`  
  - `npm run build` pass clean  
  Files: `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js`  
  Req: SCD-REQ-20

---

## Slice S3 — DataOps: Comprehensive Backfill Center

> **Gate**: Bắt đầu sau hoặc song song S1.

---

- [ ] `SCD-S3.1` **Verify DataOps planner supported datasets**  
  Owner: Backend/Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Gọi `GET /api/soc/dataops/runtime-config/` và ghi lại supported datasets  
  - Xác nhận dataset keys: `daily_prices`, `intraday_bars`, `session_facts` có hay không  
  - Đánh dấu `whale_events`, `order_flow`, `dark_flow` là "sắp ra mắt" nếu chưa support

---

- [ ] `SCD-S3.2` **Thêm BackfillCenterSection vào DataOpsPanel**  
  Owner: Frontend Dev  
  Estimate: 2.5h  
  DoD:  
  - Collapsible section "Trung tâm Backfill Dữ liệu" hiện phía trên Coverage  
  - 7 dataset checkboxes (disabled + badge "Sắp ra mắt" nếu backend chưa support)  
  - Symbol group radio: VN30 / VN100 / Tất cả / Tùy chỉnh  
  - Date range pickers (date_from, date_to)  
  - Mode: missing_only / force_refresh  
  - Execution mode: async / sync  
  Files: `frontend/src/components/soc/DataOpsPanel.jsx`  
  Req: SCD-REQ-05

---

- [ ] `SCD-S3.3` **Nút Xem trước (Dry-run)**  
  Owner: Frontend Dev  
  Estimate: 45 phút  
  DoD:  
  - [Xem trước (Dry-run)] → `socApi.previewDataOpsPlanner(payload)`  
  - Hiển thị preview: số symbols, datasets, ước tính  
  - Không trigger actual task  
  Files: `frontend/src/components/soc/DataOpsPanel.jsx`  
  Req: SCD-REQ-06

---

- [ ] `SCD-S3.4` **Nút Chạy Backfill + confirm dialog**  
  Owner: Frontend Dev  
  Estimate: 45 phút  
  DoD:  
  - [Chạy Backfill] → confirm dialog với summary  
  - Sau confirm → `socApi.runDataOpsPlanner(payload)`  
  - Hiển thị task_id + status sau dispatch  
  - Intraday Tick dùng `adminIntradaySideBackfillApply()` bridge thay vì DataOps planner  
  Files: `frontend/src/components/soc/DataOpsPanel.jsx`  
  Req: SCD-REQ-05, SCD-REQ-07

---

- [ ] `SCD-S3.5` **i18n keys DataOps backfill + build test**  
  Owner: Frontend Dev  
  Estimate: 20 phút  
  DoD:  
  - Keys cho tất cả labels backfill section  
  - `npm run build` pass  
  Files: `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js`  
  Req: SCD-REQ-20

---

## Slice S5-FE — ScreenerPanel: Config Form + Rule CRUD

> **Gate**: S5-BE.4 tất cả tests PASS.

---

- [ ] `SCD-S5-FE.1` **Sửa contract mismatch `socApi.manualScan()`**  
  Owner: Frontend Dev  
  Estimate: 15 phút  
  DoD:  
  - `manualScan(symbols = [])` gửi `{ symbols }` (không phải `rule_ids`)  
  - Comment giải thích contract thay đổi  
  Files: `frontend/src/api/socApi.js`  
  Req: SCD-REQ-14  
  **Làm TRƯỚC mọi việc khác trong S5-FE**

---

- [ ] `SCD-S5-FE.2` **Thêm createScreenerRule / updateScreenerRule / deleteScreenerRule vào socApi.js**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - `createScreenerRule(payload)` → POST /api/soc/screener/rules/  
  - `updateScreenerRule(ruleId, payload)` → PUT /api/soc/screener/rules/{ruleId}/  
  - `deleteScreenerRule(ruleId)` → DELETE /api/soc/screener/rules/{ruleId}/delete/  
  Files: `frontend/src/api/socApi.js`  
  Req: SCD-REQ-15, SCD-REQ-16, SCD-REQ-17

---

- [ ] `SCD-S5-FE.3` **Refactor ScreenerPanel: Section A — Config Form**  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  DoD:  
  - Xóa raw JSON `<pre>` dump  
  - Form với 7 editable fields (enabled toggle, scan_interval_seconds, max_symbols, alert_cooldown, max_alerts/symbol/h, retention hours, publish_to_redis)  
  - Load từ `socApi.getScreenerConfig()`  
  - [Xem trước & Lưu] → ConfigPreviewModal → `socApi.applyScreenerConfig()`  
  Files: `frontend/src/components/soc/ScreenerPanel.jsx`  
  Req: SCD-REQ-08

---

- [ ] `SCD-S5-FE.4` **Section B — Manual Scan với symbol filter**  
  Owner: Frontend Dev  
  Estimate: 45 phút  
  DoD:  
  - Input nhập symbols (comma-separated, optional)  
  - [Gửi lệnh quét nền] → parse symbols → `socApi.manualScan(symbolsArray)`  
  - Hiển thị scan_id + status + symbols_count  
  Files: `frontend/src/components/soc/ScreenerPanel.jsx`  
  Req: SCD-REQ-09

---

- [ ] `SCD-S5-FE.5` **Section C — Rule CRUD form + table**  
  Owner: Frontend Dev  
  Estimate: 2h  
  DoD:  
  - Form: tên luật (text) + loại (select 9 types) + điều kiện (JSON textarea) + kích hoạt (checkbox)  
  - JSON textarea validation: JSON.parse() với inline error  
  - [Tạo luật mới] expand form, [Sửa] load rule vào form (edit mode), [Hủy] close form  
  - [Lưu luật] → createScreenerRule hoặc updateScreenerRule tùy mode  
  - [Xóa] → confirm dialog → deleteScreenerRule  
  - Table: Tên luật / Loại / Trạng thái / Cập nhật / Thao tác  
  - Toggle bật/tắt inline → updateScreenerRule với `enabled: !current`  
  Files: `frontend/src/components/soc/ScreenerPanel.jsx`  
  Req: SCD-REQ-10, SCD-REQ-11, SCD-REQ-12

---

- [ ] `SCD-S5-FE.6` **Pagination cho rules list và alert history**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:  
  - Rules list: `[< Trước] [Trang X/Y] [Sau >]` → gọi `socApi.getScreenerRules(page)`  
  - Alert history: tương tự → `socApi.getScreenerAlerts(page)`  
  - Kết quả quét giữ nguyên (không phân trang)  
  Files: `frontend/src/components/soc/ScreenerPanel.jsx`  
  Req: SCD-REQ-13

---

- [ ] `SCD-S5-FE.7` **i18n keys ScreenerPanel + WriteGuardBanner + build test**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Keys cho config form labels, rule CRUD, pagination, manual scan  
  - `WriteGuardBanner` hiển thị nếu `can_apply = False`  
  - `npm run build` pass  
  Files: `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js`, `ScreenerPanel.jsx`  
  Req: SCD-REQ-20

---

## Slice S2 — VnbrokerPanel: Structured Form + Benchmark

> **Gate**: Bắt đầu sau S1 hoặc song song S5-FE.

---

- [ ] `SCD-S2.1` **Thay JSON textarea bằng structured form**  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  DoD:  
  - Fields: data_source (select), max_workers, request_delay_ms, max_retries, batch_size, connect_timeout, read_timeout, backoff_factor  
  - Load từ `socApi.getVnbrokerConfig()`  
  - [Xem trước & Lưu] → ConfigPreviewModal → `socApi.applyVnbrokerConfig()`  
  Files: `frontend/src/components/soc/VnbrokerPanel.jsx`  
  Req: SCD-REQ-21

---

- [ ] `SCD-S2.2` **Thêm DNSE credential status display**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Gọi `GET /api/soc/vnbroker/providers/` để lấy `env_configured` status  
  - Hiển thị: `DNSE API ID: ✓ Đã cấu hình` hoặc `✗ Chưa cấu hình`  
  - Không có input field cho credential (không lưu key trong DB/client)  
  Files: `frontend/src/components/soc/VnbrokerPanel.jsx`  
  Req: SCD-REQ-22

---

- [ ] `SCD-S2.3` **Thêm benchmark tool section**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:  
  - Provider selector: KBS / VCI / DNSE / Tất cả  
  - [Chạy Benchmark] → `runAdminVnbrokerBenchmark({provider})` (client.js bridge)  
  - Loading spinner, disable button khi đang chạy  
  - Bảng kết quả: Provider / Latency (ms) / Success Rate / Rate Limit Hits / Timestamp  
  Files: `frontend/src/components/soc/VnbrokerPanel.jsx`  
  Req: SCD-REQ-23

---

- [ ] `SCD-S2.4` **Thêm Reset về mặc định + i18n + build test**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - [Reset về mặc định] → confirm → `resetAdminVnbrokerConfig()` (bridge)  
  - Keys i18n  
  - `npm run build` pass  
  Files: `frontend/src/components/soc/VnbrokerPanel.jsx`, i18n files  
  Req: SCD-REQ-24

---

## Slice S4 — SOCPage: Tabs Navigation

---

- [ ] `SCD-S4.1` **Thêm tab vnbroker và runtime-kpi vào SOCDomainTabs + SOCPage**  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:  
  - 2 tabs mới hiển thị trong tab bar  
  - `?tab=vnbroker` → render `VnbrokerPanel`  
  - `?tab=runtime-kpi` → render `RuntimeKPIPanel`  
  - `VALID_DOMAINS` updated  
  - Labels tiếng Việt: "Cấu hình VnBroker", "Runtime KPI"  
  - `npm run build` pass  
  Files: `frontend/src/pages/SOCPage.jsx`, `frontend/src/components/soc/SOCDomainTabs.jsx`  
  Req: SCD-REQ-25

---

## Gate D1 — Parity Verification

> **Gate**: Tất cả S1–S5 DONE. Không bắt đầu D2 trước khi tất cả checks pass.

---

- [ ] `SCD-D1.1` **Chạy đầy đủ D1 smoke test suite**  
  Owner: Tech Lead  
  Estimate: 2h  
  DoD:  
  - Tất cả 15 checks trong SELF_AUDIT_AND_TEST_PROTOCOL Phase D1 PASS  
  - Screenshot terminal output được lưu  
  - Không còn lỗi console trong browser  
  - `./start_dev.ps1` stack healthy  
  Evidence: file `docs/evidence/D1_parity_check_YYYYMMDD.md`

---

## Phase D2 — Backend Admin-Ops Decommission

> **Gate**: D1 PASS.

---

- [ ] `SCD-D2.1` **Thêm admin_ops_gone view vào backend**  
  Owner: Backend Dev  
  Estimate: 30 phút  
  DoD:  
  - `admin_ops_gone()` view trả 410 JSON với `migrate_to` hint  
  Files: `backend/config/views.py` hoặc inline trong `urls.py`  
  Req: SCD-REQ-26

---

- [ ] `SCD-D2.2` **Replace tất cả /api/admin-ops/* routes với 410 handler**  
  Owner: Backend Dev  
  Estimate: 1h  
  DoD:  
  - Tất cả 35 `api/admin-ops/*` paths đều trả 410 (không phải 200 hay 404)  
  - `path('api/admin-ops/', admin_ops_gone)` và `path('api/admin-ops/<path:remaining>/', admin_ops_gone)`  
  - Không xóa view functions trong portfolio/views.py chưa (chỉ xóa URL wiring)  
  Files: `backend/config/urls.py`  
  Req: SCD-REQ-26

---

- [ ] `SCD-D2.3` **Verify 410 cho 5 endpoints admin-ops đại diện**  
  Owner: Backend Dev  
  Estimate: 30 phút  
  DoD: Tất cả 5 curl commands sau trả 410:  
  ```
  curl /api/admin-ops/stats/
  curl /api/admin-ops/runtime-kpi/
  curl /api/admin-ops/vnbroker-config/current/
  curl /api/admin-ops/prefetch/config/
  curl /api/admin-ops/signals/config/
  ```
  Evidence: terminal output

---

## Phase D3 — Frontend Admin-Ops Cleanup

> **Gate**: D2 PASS.

---

- [ ] `SCD-D3.1` **Grep usage của bridge functions trước khi xóa**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Grep toàn bộ `frontend/src/**` cho từng bridge function name  
  - Liệt kê tất cả consumers còn tồn tại  
  - Nếu còn consumer → migrate sang socApi trước khi xóa  
  Files: (observation, không modify)  
  Req: SCD-REQ-27

---

- [ ] `SCD-D3.2` **Xóa bridge functions trong client.js**  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  DoD:  
  - 15 bridge functions admin-ops bị xóa (xem danh sách TECH_SPEC section 9.1)  
  - `npm run build` pass clean (không còn import lỗi)  
  Files: `frontend/src/api/client.js`  
  Req: SCD-REQ-27

---

- [ ] `SCD-D3.3` **Xóa/refactor App.jsx admin-ops routes**  
  Owner: Frontend Dev  
  Estimate: 30 phút  
  DoD:  
  - Xóa ProtectedRoute entries cho admin-ops pages  
  - Giữ redirect: `/admin-ops` → `/operations-center` (backward compat)  
  - `npm run build` pass  
  Files: `frontend/src/App.jsx`  
  Req: SCD-REQ-28

---

- [ ] `SCD-D3.4` **Final full build + smoke test + audit ledger update**  
  Owner: Tech Lead  
  Estimate: 1h  
  DoD:  
  - `npm run build` pass clean  
  - `./start_dev.ps1` stack healthy  
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật với tất cả files thay đổi  
  - `PROGRESS_DASHBOARD.md` cập nhật status package hoàn thành  
  - `module_tree_full.md` regenerated  

---

## Tổng kết tiến độ

| Slice | Tasks | Done | %  |
|-------|-------|------|----|
| S5-BE | 4 | 0 | 0% |
| S1 | 6 | 0 | 0% |
| S3 | 5 | 0 | 0% |
| S5-FE | 7 | 0 | 0% |
| S2 | 4 | 0 | 0% |
| S4 | 1 | 0 | 0% |
| D1 | 1 | 0 | 0% |
| D2 | 3 | 0 | 0% |
| D3 | 4 | 0 | 0% |
| **Total** | **35** | **0** | **0%** |
