# VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2 — Handoff Master
**Ngày**: 2026-05-28
**Trạng thái**: Ready for implementation handoff
**Phạm vi lưu trữ**: `docs/detailed_designs/`
**Program Name**: `VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2`

---

## 1. Mục tiêu

1. Bàn giao cho đội frontend một gói tài liệu đủ chi tiết để triển khai Phase 2 cho Billing, VNPay checkout và commercial notifications trong kiến trúc SaaS native.
2. Khóa chặt các quyết định OpenAPI và UI state để frontend không tự suy diễn contract, không tự tạo truth layer song song với `core-api`.
3. Tách rõ phần có thể triển khai ngay từ Phase 1 foundation và phần phải deferred cho đến khi backend notification contract được chuẩn hóa.

---

## 2. Hiện trạng đã xác nhận

1. Toàn bộ phát triển mới phải sống trong `packages/core` và `packages/web`; `backend/` và `frontend/` root chỉ còn giá trị tham khảo.
2. `packages/core/backend/src/commercial/urls.py` hiện đã có các route SaaS native:
   - `/core/v1/billing/subscription`
   - `/core/v1/billing/quota`
   - `/core/v1/billing/invoices`
   - `/core/v1/payments/create/`
   - `/core/v1/payments/vnpay-ipn/`
   - `/core/v1/payments/status/<txn_ref>/`
3. `packages/core/backend/src/commercial/views.py` đã hiện thực create payment, IPN webhook và payment status check.
4. `packages/core/backend/src/commercial/vnpay_service.py` hiện khóa return URL mặc định theo path `/commercial/payment-return`.
5. `packages/web/src/adapters/coreApiAdapter.js` hiện mới gộp `auth`, `market`, `workspace`; chưa có domain adapter riêng cho commercial.
6. `packages/web` đã có route catalog và page registry theo pattern shell/core, nhưng chưa có route/page dành riêng cho billing center hoặc payment-return.
7. `packages/web` đã có `ShellMailConfigPage` cho operator mail config; đây không phải user-facing notification center và không được tái sử dụng làm surface cho billing notifications.
8. `identity_access/views_tenant.py` hiện cho phép đọc/ghi `preferences` trong user profile, nhưng chưa có notification contract riêng đủ chuẩn OpenAPI cho commercial notification domain.

---

## 3. Quyết định đã khóa

1. Phase 2 frontend phải là **SaaS native OpenAPI consumer**: mọi dữ liệu đến từ `core-api`, mọi page mới nằm trong `packages/web`.
2. Route canonical cho callback thanh toán là `/commercial/payment-return`; frontend không được tự đổi path nếu backend chưa đổi `VNPAY_RETURN_URL`.
3. Browser chỉ được gọi `create payment` và `payment status`; route `/payments/vnpay-ipn/` là server-to-server only.
4. Query params từ VNPay return URL chỉ được dùng làm correlation hint; trạng thái cuối cùng phải đọc lại từ `/core/v1/payments/status/{txn_ref}/`.
5. Billing self-service sẽ gom trong một commercial surface thống nhất thay vì tản logic vào `settings`, `workspace`, hoặc shell admin pages hiện có.
6. Domain notification cho billing/account phải là surface riêng và chỉ được mở code khi có backend contract chuẩn OpenAPI; trước đó chỉ được bàn giao ở mức spec + deferred gates.
7. Mọi API consumer mới phải đi qua `packages/web/src/adapters/coreApiAdapter.js` facade và domain module mới `adapters/core/commercial.js`; cấm `fetch()` trực tiếp từ page/component.
8. Toàn bộ text mới phải qua i18n tiếng Việt đầy đủ dấu.

---

## 4. Deliverables của doc pack

1. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_HANDOFF_MASTER_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_HANDOFF_MASTER_20260528.md)
2. [IMPLEMENTATION_PLAN_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/IMPLEMENTATION_PLAN_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
3. [TECH_SPEC_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/TECH_SPEC_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
4. [FRONTEND_DESIGN_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/FRONTEND_DESIGN_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
5. [TASKBOARD_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/TASKBOARD_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
6. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_TRACEABILITY_MATRIX_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_TRACEABILITY_MATRIX_20260528.md)
7. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_CONFIG_OWNERSHIP_MATRIX_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_CONFIG_OWNERSHIP_MATRIX_20260528.md)
8. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_SELF_AUDIT_AND_TEST_PROTOCOL_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_SELF_AUDIT_AND_TEST_PROTOCOL_20260528.md)
9. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_EXECUTION_EVIDENCE_TEMPLATE_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_EXECUTION_EVIDENCE_TEMPLATE_20260528.md)
10. [VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_CODE_QUALITY_CONSTITUTION_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_CODE_QUALITY_CONSTITUTION_20260528.md)
11. [RUN_CODE_REVIEW_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_CODE_REVIEW_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
12. [RUN_INTEGRATION_TESTS_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_INTEGRATION_TESTS_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)
13. [RUN_SPEC_AUDIT_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md](c:/Mujoco%20Projects/vninvest/docs/detailed_designs/RUN_SPEC_AUDIT_VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2_20260528.md)

---

## 5. Đội nhận bàn giao và boundary

1. **Package Web team**: route catalog, page registry, pages, hooks, adapter facade, i18n, UX states.
2. **Core API commercial team**: giữ responsibility cho contract `/billing/*`, `/payments/*`, payment truth và future notification APIs.
3. **QA / audit lane**: kiểm contract parity, route-state truth, duplicate submit guard, deferred gate cho notification domain.

---

## 6. Non-goals và deferred items

1. Không dùng phase này để viết feature mới trong `frontend/` root hoặc `backend/` root.
2. Không cho browser tiêu thụ hoặc mô phỏng IPN.
3. Không reuse operator mail-config pages làm user billing notification center.
4. Không tự suy diễn notification delivery truth từ UI; nếu chưa có `/core/v1/notifications/*` contract chuẩn, phần notification user-facing chỉ dừng ở thiết kế + backlog gates.
5. Không thay đổi commercial backend contract trong pack này; nếu contract drift được phát hiện, phải mở backlog backend trước khi frontend đóng phase.

---

## 7. Định nghĩa thành công

1. Có commercial adapter rõ ownership trong `packages/web` và không còn direct fetch ở commercial pages.
2. Có route SaaS native cho billing center và payment return được đăng ký trong route catalog + page registry.
3. Billing center hiển thị đúng subscription, quota, invoices theo server truth và pagination semantics.
4. Payment return luôn đọc lại trạng thái qua status endpoint trước khi render kết luận cho người dùng.
5. Double-submit payment được chặn ở frontend state machine.
6. Toàn bộ trạng thái loading, empty, pending, failed, auth-expired, server-error được định nghĩa rõ.
7. Notification UX chỉ được bật khi backend contract chuẩn hóa hoàn tất; nếu chưa, pack vẫn bàn giao đủ deferred gates để đội code không đi chệch kiến trúc.

---

## 8. File anchors bắt buộc phải đọc trước khi code

### Backend
- `packages/core/backend/src/commercial/urls.py`
- `packages/core/backend/src/commercial/views.py`
- `packages/core/backend/src/commercial/vnpay_service.py`
- `packages/core/backend/src/identity_access/views_tenant.py`
- `packages/core/backend/src/identity_access/views_operator.py`
- `packages/core/backend/src/vninvest_core/urls.py`

### Frontend
- `packages/web/src/adapters/coreApiAdapter.js`
- `packages/web/src/adapters/core/transport.js`
- `packages/web/src/adapters/core/auth.js`
- `packages/web/src/adapters/core/workspace.js`
- `packages/web/src/app/routeCatalog.js`
- `packages/web/src/pages/pageRegistry.js`
- `packages/web/src/pages/admin/ShellMailConfigPage.js`
- `packages/web/package.json`

### Governance
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- `quality/QUALITY.md`
- `quality/FEATURE_PACK_HANDOVER_SOP.md`

---

## 9. Governance obligations

1. Mọi slice thực thi từ pack này phải cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, và `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`.
2. Sau mỗi vòng thay đổi hoàn chỉnh phải regenerate `module_tree_full.md`.
3. Không được đóng phase nếu chưa có evidence template, runbooks và spec-audit outputs tương ứng.