# TRACEABILITY MATRIX — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: SOC UI 5 slices + admin-ops decommission

---

## 1. Requirements

| ID | Requirement | Priority | Slice |
|----|-------------|----------|-------|
| SCD-REQ-01 | PrefetchPanel có form editable với 11 runtime config fields | P0 | S1 |
| SCD-REQ-02 | Universe Groups multiselect hoạt động và included trong save payload | P0 | S1 |
| SCD-REQ-03 | 6 time policy profile intervals editable trên UI | P0 | S1 |
| SCD-REQ-04 | Warm Now async và sync buttons gọi đúng endpoint | P1 | S1 |
| SCD-REQ-05 | DataOps backfill UI hỗ trợ tối thiểu 4 dataset types | P0 | S3 |
| SCD-REQ-06 | Dry-run preview hiển thị ước tính symbols và datasets | P1 | S3 |
| SCD-REQ-07 | Intraday Tick backfill dùng đúng task `run_intraday_side_backfill_apply` | P1 | S3 |
| SCD-REQ-08 | ScreenerPanel config form có 7 editable fields với load/save | P1 | S5 |
| SCD-REQ-09 | Manual scan gửi `{symbols}` (không phải `rule_ids`) | P0 | S5 |
| SCD-REQ-10 | Rule create form: name + type select + JSON conditions + enabled | P1 | S5 |
| SCD-REQ-11 | Rule edit: load rule vào form, save với PUT endpoint | P1 | S5 |
| SCD-REQ-12 | Rule delete: confirm dialog + DELETE endpoint + list refresh | P1 | S5 |
| SCD-REQ-13 | Pagination cho rules list và alert history | P1 | S5 |
| SCD-REQ-14 | `socApi.manualScan()` contract mismatch được sửa | P0 | S5 |
| SCD-REQ-15 | `socApi.createScreenerRule()` tồn tại và gọi đúng endpoint | P1 | S5 |
| SCD-REQ-16 | `socApi.updateScreenerRule(id, payload)` tồn tại | P1 | S5 |
| SCD-REQ-17 | `socApi.deleteScreenerRule(id)` tồn tại | P1 | S5 |
| SCD-REQ-18 | Backend `PUT /api/soc/screener/rules/<id>/` tồn tại và có unit test | P0 | S5-BE |
| SCD-REQ-19 | Backend `DELETE /api/soc/screener/rules/<id>/delete/` tồn tại và có unit test | P0 | S5-BE |
| SCD-REQ-20 | Tất cả text mới trên UI đều qua i18n tiếng Việt đầy đủ dấu | P0 | ALL |
| SCD-REQ-21 | VnbrokerPanel có structured form thay JSON textarea | P1 | S2 |
| SCD-REQ-22 | DNSE credential status hiển thị từ env, không có input field | P1 | S2 |
| SCD-REQ-23 | Benchmark tool gọi được `runAdminVnbrokerBenchmark` và hiển thị kết quả | P1 | S2 |
| SCD-REQ-24 | Reset về mặc định button có confirm dialog | P2 | S2 |
| SCD-REQ-25 | SOCPage có tabs `vnbroker` và `runtime-kpi` routing đúng | P2 | S4 |
| SCD-REQ-26 | `/api/admin-ops/*` trả 410 GONE với migrate_to hint sau D2 | P0 | D2 |
| SCD-REQ-27 | `client.js` không còn bridge functions trỏ đến `/admin-ops/*` sau D3 | P0 | D3 |
| SCD-REQ-28 | `App.jsx` không còn admin-ops page routes sau D3 | P1 | D3 |
| SCD-REQ-29 | `npm run build` pass clean sau mọi slice | P0 | ALL |
| SCD-REQ-30 | `./start_dev.ps1` stack healthy sau D3 | P0 | D3 |

---

## 2. Requirement → Slice mapping

| Req ID | Slice | Task ID | Verification method |
|--------|-------|---------|---------------------|
| SCD-REQ-01 | S1 | SCD-S1.2 | Form load đúng từ API, save thành công |
| SCD-REQ-02 | S1 | SCD-S1.3 | Groups multiselect hiển thị và payload có `universe_group_ids` |
| SCD-REQ-03 | S1 | SCD-S1.4 | 6 inputs hiển thị đúng giá trị từ config |
| SCD-REQ-04 | S1 | SCD-S1.5 | Warm Now → API response có task_id hoặc status |
| SCD-REQ-05 | S3 | SCD-S3.2 | Checkboxes hiện, run dispatch task_id |
| SCD-REQ-06 | S3 | SCD-S3.3 | Dry-run hiển thị preview JSON |
| SCD-REQ-07 | S3 | SCD-S3.4 | Intraday Tick → admin bridge endpoint called |
| SCD-REQ-08 | S5 | SCD-S5-FE.3 | Form load + save screener config thành công |
| SCD-REQ-09 | S5 | SCD-S5-FE.1 | Network tab: payload có `symbols` field |
| SCD-REQ-10 | S5 | SCD-S5-FE.5 | Rule create: POST /screener/rules/ trả 201 |
| SCD-REQ-11 | S5 | SCD-S5-FE.5 | Rule edit: PUT /screener/rules/{id}/ trả 200 |
| SCD-REQ-12 | S5 | SCD-S5-FE.5 | Rule delete: DELETE ... trả 204, list refresh |
| SCD-REQ-13 | S5 | SCD-S5-FE.6 | Page 2 load đúng rules |
| SCD-REQ-14 | S5 | SCD-S5-FE.1 | Code review: không còn `rule_ids` trong manualScan |
| SCD-REQ-15–17 | S5 | SCD-S5-FE.2 | Functions tồn tại trong socApi.js |
| SCD-REQ-18 | S5-BE | SCD-S5-BE.1, .4 | Unit test PASS |
| SCD-REQ-19 | S5-BE | SCD-S5-BE.2, .4 | Unit test PASS |
| SCD-REQ-20 | ALL | Per slice .6/.7 | No hardcoded text trong JSX |
| SCD-REQ-21 | S2 | SCD-S2.1 | Structured form load/save từ API |
| SCD-REQ-22 | S2 | SCD-S2.2 | UI hiển thị trạng thái env var, không có input |
| SCD-REQ-23 | S2 | SCD-S2.3 | Benchmark button → result table hiện |
| SCD-REQ-24 | S2 | SCD-S2.4 | Confirm dialog hiện trước reset |
| SCD-REQ-25 | S4 | SCD-S4.1 | URL ?tab=vnbroker và ?tab=runtime-kpi load đúng panel |
| SCD-REQ-26 | D2 | SCD-D2.2 | `curl /api/admin-ops/stats/` → 410 |
| SCD-REQ-27 | D3 | SCD-D3.2 | Grep: không còn `/admin-ops/` trong client.js |
| SCD-REQ-28 | D3 | SCD-D3.3 | Grep: không còn admin-ops page import trong App.jsx |
| SCD-REQ-29 | ALL | Per slice build task | `npm run build` exit 0 |
| SCD-REQ-30 | D3 | SCD-D3.4 | `./start_dev.ps1` → all containers healthy |

---

## 3. Slice → Files mapping

| Slice | Files thay đổi |
|-------|---------------|
| S5-BE | `packages/core/backend/src/service_ops/views/screener.py` (add 2 views) |
| S5-BE | `packages/core/backend/src/service_ops/urls.py` (add 2 paths) |
| S5-BE | `packages/core/backend/src/service_ops/tests/test_screener_rule_crud.py` (new) |
| S1 | `frontend/src/components/soc/PrefetchPanel.jsx` (refactor) |
| S1 | `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js` |
| S3 | `frontend/src/components/soc/DataOpsPanel.jsx` (add BackfillCenterSection) |
| S3 | `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js` |
| S5-FE | `frontend/src/components/soc/ScreenerPanel.jsx` (refactor toàn bộ) |
| S5-FE | `frontend/src/api/socApi.js` (fix manualScan + add 3 functions) |
| S5-FE | `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js` |
| S2 | `frontend/src/components/soc/VnbrokerPanel.jsx` (add structured form + benchmark) |
| S2 | `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js` |
| S4 | `frontend/src/pages/SOCPage.jsx` (add 2 tab cases) |
| S4 | `frontend/src/components/soc/SOCDomainTabs.jsx` (add 2 tabs) |
| D2 | `backend/config/urls.py` (replace 35 routes with 410 handler) |
| D2 | `backend/config/views.py` hoặc inline (add admin_ops_gone view) |
| D3 | `frontend/src/api/client.js` (remove 15 bridge functions) |
| D3 | `frontend/src/App.jsx` (remove admin-ops page routes) |

---

## 4. Test coverage matrix

| Requirement | Unit test | Integration test | Manual smoke |
|-------------|-----------|-----------------|--------------|
| SCD-REQ-18 (PUT rule) | ✅ S5-BE.4 | ✅ RUN_INTEGRATION_TESTS | — |
| SCD-REQ-19 (DELETE rule) | ✅ S5-BE.4 | ✅ RUN_INTEGRATION_TESTS | — |
| SCD-REQ-09 (manualScan contract) | Code review | — | ✅ Network tab check |
| SCD-REQ-26 (410 GONE) | — | ✅ | ✅ curl test D2.3 |
| SCD-REQ-01–04 (Prefetch form) | — | — | ✅ SELF_AUDIT Phase S1 |
| SCD-REQ-05–07 (DataOps backfill) | — | ✅ | ✅ SELF_AUDIT Phase S3 |
| SCD-REQ-08–13 (Screener CRUD) | ✅ (BE) | ✅ | ✅ SELF_AUDIT Phase S5 |
| SCD-REQ-29 (build pass) | — | — | ✅ Per slice build step |
| SCD-REQ-30 (stack healthy) | — | — | ✅ D3.4 |
