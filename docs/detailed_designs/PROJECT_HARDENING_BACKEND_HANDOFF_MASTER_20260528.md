# Project Hardening Backend — Handoff Master
**Ngày**: 2026-05-28  
**Status**: Approved — Ready for execution  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_ACTION_PLAN_20260528.md

---

## 1. Mục tiêu

1. Chuyển action plan hiện tại thành một gói bàn giao có thể giao thẳng cho đội code và đội audit mà không cần hỏi lại context.
2. Khóa chặt scope hardening backend theo đúng thực trạng codebase, không làm lệch roadmap SSOT của hệ thống.
3. Chuẩn hóa gates cho migration tenant isolation, security throttling, fat-file refactor và handoff governance.
4. Làm rõ boundary giữa phần hardening bắt buộc ở Giai đoạn 1 và phần greenfield ở Giai đoạn 2.

---

## 2. Vấn đề đã xác nhận

1. `user_workspace` còn 6 thực thể có tenant nullable và cần migration có quarantine safety thay vì fallback về `system_tenant`.
2. Auth rate limiting ở cấp app đã tồn tại, nhưng gateway-level throttling trong Nginx chưa được thêm.
3. QG-1 chỉ an toàn khi dùng đúng `manage.py` path và bootstrap đúng dependency set của `packages/core/backend`.
4. `packages/web` không có script `build`; gate đóng gói hợp lệ hiện tại là `build-community`.
5. `commercial/` không phải greenfield hoàn toàn; nền tảng `Subscription`, `QuotaRecord`, `Invoice` đã tồn tại, còn phần greenfield thực sự là VNPay/IPN.
6. Bộ tài liệu hiện tại mới dừng ở action plan, chưa có pack triển khai đầy đủ để đội code follow theo task, requirement, gate và evidence.

---

## 3. Quyết định đã khóa

1. Tài liệu này là sub-plan nằm dưới `SAAS_ARCHITECTURE_AUDIT_AND_CUTOVER_ROADMAP_20260522.md`; không thay thế roadmap SSOT.
2. Mọi thay đổi thực thi mới phải nằm trong `packages/core` và `packages/web`; không mở feature mới ở `backend/` hoặc `frontend/` legacy.
3. Cấm tuyệt đối auto-map orphan records về tenant mặc định; chỉ được quarantine và reject migration nếu dữ liệu chưa sạch.
4. Giai đoạn 1 khóa scope vào hardening migration, throttling, refactor và QG-1 closeout; không trộn business feature mới vào cùng sprint.
5. Giai đoạn 2 được xem là greenfield theo workstream, nhưng phải reuse foundation hiện có của `commercial/` và `signal_intelligence/` thay vì viết lại domain từ đầu.
6. QG-1 phải bao phủ cả backend test gate lẫn `packages/web` packaging gate.

---

## 4. Deliverables doc-pack

| # | Tài liệu | Đường dẫn |
|---|---|---|
| 1 | Handoff Master | docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md |
| 2 | Implementation Plan | docs/detailed_designs/IMPLEMENTATION_PLAN_PROJECT_HARDENING_BACKEND_20260528.md |
| 3 | Technical Spec | docs/detailed_designs/TECH_SPEC_PROJECT_HARDENING_BACKEND_20260528.md |
| 4 | Taskboard | docs/detailed_designs/TASKBOARD_PROJECT_HARDENING_BACKEND_20260528.md |
| 5 | Traceability Matrix | docs/detailed_designs/PROJECT_HARDENING_BACKEND_TRACEABILITY_MATRIX_20260528.md |
| 6 | Self Audit and Test Protocol | docs/detailed_designs/PROJECT_HARDENING_BACKEND_SELF_AUDIT_AND_TEST_PROTOCOL_20260528.md |
| 7 | Execution Evidence Template | docs/detailed_designs/PROJECT_HARDENING_BACKEND_EXECUTION_EVIDENCE_TEMPLATE_20260528.md |
| 8 | Config Ownership Matrix | docs/detailed_designs/PROJECT_HARDENING_BACKEND_CONFIG_OWNERSHIP_MATRIX_20260528.md |
| 9 | Code Quality Constitution | docs/detailed_designs/PROJECT_HARDENING_BACKEND_CODE_QUALITY_CONSTITUTION_20260528.md |
| 10 | Run Code Review | docs/detailed_designs/RUN_CODE_REVIEW_PROJECT_HARDENING_BACKEND_20260528.md |
| 11 | Run Integration Tests | docs/detailed_designs/RUN_INTEGRATION_TESTS_PROJECT_HARDENING_BACKEND_20260528.md |
| 12 | Run Spec Audit | docs/detailed_designs/RUN_SPEC_AUDIT_PROJECT_HARDENING_BACKEND_20260528.md |
| 13 | Technical Audit Report | docs/detailed_designs/TECHNICAL_AUDIT_REPORT_20260528.md |


---

## 5. Kiến trúc mục tiêu

```text
Roadmap SSOT
  SAAS_ARCHITECTURE_AUDIT_AND_CUTOVER_ROADMAP_20260522
        |
        +--> Project Hardening Backend Sub-plan
                |
                +--> Giai đoạn 1
                |     - Core env bootstrap
                |     - Tenant isolation migration + quarantine
                |     - App + gateway throttling hardening
                |     - Fat-file refactor backend/web
                |     - QG-1 closeout
                |
                +--> Giai đoạn 2
                      - VNPay/IPN foundation
                      - Outbound notification pipeline
                      - AI advisory cost control
```

---

## 6. Scope boundary

### In scope

1. `packages/core/backend/src/user_workspace/*`
2. `packages/core/backend/src/identity_access/*`
3. `packages/core/backend/src/commercial/*`
4. `packages/core/backend/src/signal_intelligence/*`
5. `packages/core/backend/src/service_ops/*`
6. `packages/web/src/adapters/*`
7. `packages/web/src/pages/*`
8. `frontend/docker/nginx.conf` và `packages/opencore/distribution/nginx-opencore.conf` cho gateway throttling

### Out of scope

1. Không thay thế roadmap cutover tổng thể.
2. Không decommission `frontend/` hoặc `backend/` legacy chỉ dựa trên sub-plan này.
3. Không đổi ownership build/deploy tổng thể của `packages/web` ngoài phạm vi refactor và packaging gate đã chốt.
4. Không thiết kế silo market data hoặc notification silo theo user.

---

## 7. Success criteria

1. Bộ 12 tài liệu tồn tại đầy đủ trong `docs/detailed_designs/` với naming đồng nhất.
2. Scope tenant isolation của Giai đoạn 1 khớp đúng 6 thực thể trong `user_workspace`.
3. Không còn ambiguity về test runner path, env bootstrap hay build command trong QG-1.
4. Phase 2 được mô tả đúng là greenfield theo capability, không xóa nhòa các foundation hiện có.
5. Đội code có thể bắt đầu từ taskboard và runbooks mà không cần truy lại toàn bộ chuỗi audit chat.

---

## 8. Prerequisites vận hành

1. Đọc `quality/QUALITY.md` trước khi code.
2. Đọc `docs/detailed_designs/PROJECT_HARDENING_ACTION_PLAN_20260528.md` làm source plan.
3. Dùng Python env đã sync `packages/core/backend/requirements.txt` cho core backend tests.
4. Dùng build lane có sẵn sibling source `stockchart` hoặc image/build environment tương đương khi chạy `npm --prefix packages/web run build-community`.
5. Sau mỗi slice code, cập nhật ledger/progress/modified-files và regenerate `module_tree_full.md`.

---

## 9. Files neo hiện tại

### Backend
- `packages/core/backend/src/user_workspace/models.py`
- `packages/core/backend/src/identity_access/views_auth.py`
- `packages/core/backend/src/commercial/models.py`
- `packages/core/backend/src/commercial/urls.py`
- `packages/core/backend/src/service_ops/views/dataops.py`
- `packages/core/backend/manage.py`

### Web / Frontend
- `packages/web/src/adapters/coreApiAdapter.js`
- `packages/web/src/pages/AlertCenterPage.js`
- `packages/web/package.json`
- `packages/web/scripts/build-community.mjs`
- `frontend/package.json`
- `frontend/docker/nginx.conf`
- `packages/opencore/distribution/nginx-opencore.conf`

---

## 10. Governance obligations

1. Mọi slice phải có evidence theo template.
2. Mọi gate thất bại phải ghi residual risk, không được che bằng wording “100% ready”.
3. Cập nhật bắt buộc:
   - `CODE_CHANGE_AUDIT_LEDGER.md`
   - `PROGRESS_DASHBOARD.md`
   - `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`
   - `module_tree_full.md`
