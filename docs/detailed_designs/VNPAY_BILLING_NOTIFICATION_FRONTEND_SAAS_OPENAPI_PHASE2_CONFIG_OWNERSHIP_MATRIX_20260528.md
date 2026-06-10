# Config Ownership Matrix — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Active

---

| Concern | Canonical owner | Current anchor | Frontend responsibility | Anti-pattern cấm |
|---|---|---|---|---|
| Core API base URL | Package Web transport | `packages/web/src/adapters/core/transport.js` | Chỉ đọc qua `resolveCoreApiBase()` | Hardcode `/core/v1` trong page code nếu transport đã tồn tại |
| Public API base URL | Package Web transport | `packages/web/src/adapters/core/transport.js` | Chỉ dùng cho public auth endpoints | Trộn public base với commercial private endpoints |
| VNPay return URL | Core API commercial | `packages/core/backend/src/commercial/vnpay_service.py` | Frontend chỉ consume path `/commercial/payment-return` | Frontend tự đổi callback path |
| Payment truth | Core API commercial | `packages/core/backend/src/commercial/views.py` | Gọi `payment status` và render đúng state | Tin query params là trạng thái cuối |
| Billing contracts | Core API commercial | `packages/core/backend/src/commercial/urls.py` | Map vào commercial adapter | Direct fetch từ page/component |
| Route registration | Package Web app shell | `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js` | Thêm route IDs, pages và build targets đúng chuẩn | Mount page mới ngoài route registry |
| User profile preferences | Core API identity access | `packages/core/backend/src/identity_access/views_tenant.py` | Chỉ dùng nếu contract notification được xác nhận phù hợp | Dùng `preferences` như excuse để ship notification UI mơ hồ |
| Operator mail provider config | Core API operator | `packages/core/backend/src/identity_access/views_operator.py` | Không dùng làm end-user notification settings | Reuse `ShellMailConfigPage` cho commercial users |
| i18n copy | Package Web | future commercial i18n bundle under `packages/web/src` | Tạo key/domain riêng cho commercial | Reuse text admin/operator gây sai ngữ cảnh |
| Feature flag / rollout note | Product + Package Web | route/taskboard governance | Chốt rõ route nào mở và route nào defer | Ship notification route khi contract chưa sẵn sàng |

---

## Ownership transitions

1. `commercial adapter` từ trạng thái chưa tồn tại sang owner chính là Package Web.
2. `notification UX commercial` chỉ chuyển sang owner frontend khi backend OpenAPI contract đã qua gate.
3. `payment-return route` là shared contract: backend khóa path, frontend khóa rendering/state machine.