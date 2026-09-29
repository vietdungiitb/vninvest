# HANDOFF MASTER — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Phiên bản**: 1.0  
**Phạm vi**: Nâng cấp toàn bộ SOC Config UI (5 slices) + Decommission legacy admin-ops sau parity gate

---

## 1. Bối cảnh và lý do tạo gói tài liệu này

Hệ thống hiện có **hai surface quản trị tách biệt**, tạo ra duplicate và confuse operator:

| Surface | Route | Trạng thái |
|---------|-------|------------|
| Admin Ops (legacy) | `/admin-ops` | Redirect → SOC nhưng **backend routes còn nguyên** (~35 endpoints) |
| SOC — Service Operations Center | `/operations-center` | 6 tabs hoạt động nhưng **thiếu form config thực sự** |

**Vấn đề cụ thể**:
- `PrefetchPanel.jsx` chỉ hiển thị raw JSON, không có form editable
- `VnbrokerPanel.jsx` dùng JSON textarea thay vì structured fields, không có benchmark tool
- `DataOpsPanel.jsx` không có backfill UI cho intraday, whale, CVD, dark-flow
- `ScreenerPanel.jsx` chỉ read-only, không có Rule CRUD, không phân trang
- Legacy `/api/admin-ops/*` có 35+ endpoints vẫn tồn tại song song với `/api/soc/*`
- `frontend/src/api/client.js` chứa 15+ bridge functions cho legacy admin-ops

**Mục tiêu gói tài liệu này**:
1. Nâng SOC Config UI lên đầy đủ tính năng (5 slices — S1 đến S5)
2. Decommission hoàn toàn legacy admin-ops sau khi SOC đạt parity (3 phases — D1 đến D3)

---

## 2. Kiến trúc mục tiêu

### Hiện tại (legacy tồn tại song song)
```
Operator → /admin-ops → 302 redirect → /operations-center (SOC)
                ↕ (backend vẫn alive)
           /api/admin-ops/* (~35 endpoints, không xóa)
           /api/soc/* (63+ endpoints, đây là canonical)

Frontend client.js: 15 bridge functions cho admin-ops
```

### Sau khi hoàn thành
```
Operator → /operations-center (SOC) — DUY NHẤT
           /api/soc/* (canonical, full featured)
           /api/admin-ops/* → 410 GONE (hoặc 404)

Frontend client.js: Không còn bridge functions admin-ops
SOC Panels: Full config forms, Rule CRUD, backfill UI
```

---

## 3. Phân rã công việc

### Phase 1 — SOC UI Upgrade (Slices S1–S5)

| Slice | Mô tả | Priority | Thời gian ước tính |
|-------|-------|----------|--------------------|
| S1 | PrefetchPanel: Runtime config form đầy đủ | P0 | 3–4h |
| S2 | VnbrokerPanel: Per-provider structured form + benchmark | P1 | 2–3h |
| S3 | DataOps: Comprehensive backfill center (7 data types) | P0 | 3–4h |
| S4 | SOCPage: Thêm tabs vnbroker, runtime-kpi | P2 | 1–2h |
| S5 | ScreenerPanel: Config form + Rule CRUD + pagination | P1 | 3–4h |

**Điều kiện tiên quyết cho S5**: Backend phải có 2 endpoints mới `DELETE/PUT /api/soc/screener/rules/{id}/` (làm trong cùng commit S5, phần backend trước).

### Phase 2 — Admin-Ops Decommission (D1–D3)

| Phase | Mô tả | Gate bắt buộc |
|-------|-------|---------------|
| D1 | Verify SOC parity — chạy smoke test đầy đủ | **Tất cả S1–S5 DONE + PASS** |
| D2 | Backend: Remove admin-ops routes + views (legacy) | D1 PASS |
| D3 | Frontend: Remove bridge functions + App.jsx admin-ops routes | D2 PASS |

---

## 4. Bộ tài liệu trong gói này

### 4.1 Core triad
1. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_HANDOFF_MASTER_20260516.md` ← **file này**
2. `docs/IMPLEMENTATION_PLAN_SOC_CONFIG_UI_20260516.md` — plan chi tiết 5 slices (đã có)
3. `docs/TECH_SPEC_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md` — spec kỹ thuật
4. `docs/TASKBOARD_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md` — atomic task list

### 4.2 Tài liệu audit và thực thi
5. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_TRACEABILITY_MATRIX_20260516.md`
6. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`
7. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_EXECUTION_EVIDENCE_TEMPLATE_20260516.md`
8. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CONFIG_OWNERSHIP_MATRIX_20260516.md`
9. `docs/SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_CODE_QUALITY_CONSTITUTION_20260516.md`
10. `docs/RUN_CODE_REVIEW_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
11. `docs/RUN_INTEGRATION_TESTS_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`
12. `docs/RUN_SPEC_AUDIT_SOC_CONFIG_UI_ADMIN_OPS_DECOMMISSION_20260516.md`

### 4.3 Repo rulebook phải tuân thủ
- `AGENTS.md` — hard constraints dự án
- `quality/QUALITY.md` — quality constitution tổng thể
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` — API design rules

---

## 5. Anchor files

### Frontend targets (cần modify)
- `frontend/src/components/soc/PrefetchPanel.jsx` — S1
- `frontend/src/components/soc/VnbrokerPanel.jsx` — S2
- `frontend/src/components/soc/DataOpsPanel.jsx` — S3
- `frontend/src/pages/SOCPage.jsx` — S4
- `frontend/src/components/soc/SOCDomainTabs.jsx` — S4
- `frontend/src/components/soc/ScreenerPanel.jsx` — S5 (refactor)
- `frontend/src/api/socApi.js` — S5 + D3 (thêm helper, sửa contract mismatch)
- `frontend/src/api/client.js` — D3 (xóa bridge functions)
- `frontend/src/App.jsx` — D3 (xóa admin-ops routes)

### Frontend readonly (reuse, không sửa)
- `frontend/src/components/soc/ConfigPreviewModal.jsx`
- `frontend/src/components/soc/WriteGuardBanner.jsx`
- `frontend/src/components/RuntimeKPIPanel.jsx`

### Backend targets (cần modify)
- `packages/core/backend/src/service_ops/views/screener.py` — S5 backend
- `packages/core/backend/src/service_ops/urls.py` — S5 backend + D2
- `backend/config/urls.py` — D2 (xóa 35 admin-ops routes)
- `backend/portfolio/views.py` (hoặc portfolio_views module) — D2 (có thể giữ logic nhưng xóa URL wiring)

---

## 6. Hard constraints cho gói này

1. **Không decommission admin-ops trước khi tất cả S1–S5 đều PASS smoke test** — gate D1 là blocking.
2. **Screener rule DELETE/PUT endpoint phải là backend-first** — không viết UI trước khi có endpoint.
3. **`socApi.manualScan()` contract mismatch phải sửa trong commit S5** — không để lại sau.
4. **Khi xóa admin-ops routes, phải trả 410 GONE** (hoặc redirect 301 → SOC equivalent) thay vì 404 im lặng — giúp phát hiện consumer còn dùng legacy API.
5. **i18n đầy đủ dấu tiếng Việt** cho mọi label/button/message mới trên UI.
6. **Mỗi slice phải có evidence** (command output + payload snapshot) trước khi đánh dấu DONE.
7. **Không rebuild production** cho đến khi D1 gate hoàn thành trên dev stack.
8. **Build frontend pass không lỗi** là điều kiện cần cho mọi frontend slice.

---

## 7. Thứ tự thực hiện được khuyến nghị

```
[S1] PrefetchPanel form    ──┐
[S3] DataOps backfill      ──┼── P0 — làm trước
                              │
[S5-BE] Screener rule BE   ──┤
[S5-FE] ScreenerPanel CRUD ──┘── P1 — làm sau S1/S3

[S2] VnBroker form                ─── P1, song song S5
[S4] SOCPage tabs                 ─── P2, cuối cùng

[D1] Parity verification   ── Gate: tất cả S1-S5 DONE
[D2] Backend decommission  ── Sau D1
[D3] Frontend cleanup      ── Sau D2
```

---

## 8. Tiêu chí hoàn thành gói (Definition of Done — Package Level)

- [ ] Tất cả 5 SOC slices DONE với evidence
- [ ] `frontend/src/api/socApi.js` manualScan contract đã sửa  
- [ ] Backend screener DELETE/PUT endpoints tồn tại và có test
- [ ] `/api/admin-ops/*` trả 410 GONE cho tất cả legacy endpoints
- [ ] `client.js` không còn bridge functions nào trỏ đến `/admin-ops/*`
- [ ] `App.jsx` không còn import AdminOps pages (nếu có)
- [ ] `frontend npm run build` pass clean
- [ ] `./start_dev.ps1` stack healthy sau decommission
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` cập nhật
- [ ] `PROGRESS_DASHBOARD.md` cập nhật
- [ ] `module_tree_full.md` regenerated
