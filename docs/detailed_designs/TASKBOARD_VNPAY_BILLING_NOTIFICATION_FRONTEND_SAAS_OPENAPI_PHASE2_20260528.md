# Taskboard — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Planning baseline
**Legend**: PLANNED | IN PROGRESS | DONE | BLOCKED

---

## 1. Phase board

| Phase | Slice | Status | Owner lane | Gate note |
|---|---|---|---|---|
| FP01 | Contract freeze | DONE | FE + Core API | Đã xác nhận các API endpoints trong commercial/urls.py |
| FP02 | Commercial adapter extraction | DONE | Package Web | Không đóng nếu còn `fetch()` trực tiếp ở page/component |
| FP03 | Billing Center read-only | DONE | Package Web | Chỉ đóng khi summary + invoices + quota states đủ loading/empty/error |
| FP04 | Payment create CTA | DONE | Package Web | Chỉ đóng khi double-submit guard pass |
| FP05 | Payment return state machine | DONE | Package Web | Query params không còn là truth cuối |
| FP06 | Route/page registry integration | DONE | Package Web | Route IDs, build targets, capabilities phải đồng bộ |
| FP07 | Notification UX gate | BLOCKED | FE + Core API | Chưa có OpenAPI contract backend -> DEFERRED |
| FP08 | Test, audit, packaging | DONE | FE + QA | `npm --prefix packages/web test -- --runInBand` và `build-community` phải pass |

---

## 2. Slice checklist

### FP01 — Contract freeze
- [x] Xác nhận `/billing/subscription`, `/billing/quota`, `/billing/invoices`, `/payments/create/`, `/payments/status/{txn_ref}/`
- [x] Khóa auth, pagination, error semantics
- [x] Ghi rõ mọi contract gap trong tech spec

### FP02 — Commercial adapter extraction
- [x] Tạo `packages/web/src/adapters/core/commercial.js`
- [x] Nối facade vào `coreApiAdapter.js`
- [x] Không thêm business logic vào facade gốc

### FP03 — Billing Center read-only
- [x] Tạo page canonical trong `packages/web`
- [x] Có summary, quota posture, invoices table
- [x] Có loading/empty/error states hoàn chỉnh

### FP04 — Payment create CTA
- [x] Form action mapping đúng payload `{ amount, plan }`
- [x] Chặn double-submit
- [x] Redirect đúng `pay_url`

### FP05 — Payment return state machine
- [x] Mount route `/commercial/payment-return`
- [x] Parse `txn_ref` an toàn
- [x] Fetch status trước khi hiển thị kết luận

### FP06 — Route/page registry integration
- [x] Cập nhật `routeCatalog.js`
- [x] Cập nhật `pageRegistry.js`
- [x] Export page mới nếu cần canonical package-web surface

### FP07 — Notification UX gate
- [x] Xác nhận backend notification OpenAPI contract (Kết quả: Chưa có)
- [x] Nếu thiếu contract: giữ deferred state, không mở route thật
- [x] Nếu có contract: bổ sung slice riêng cho preferences/activity

### FP08 — Test, audit, packaging
- [x] Test adapter
- [x] Test pages
- [x] `build-community` pass
- [x] Governance docs sync

---

## 3. Block merge conditions

1. Còn route/page mới nhưng không đăng ký trong route catalog hoặc page registry.
2. Billing/payment page vẫn dùng `fetch()` trực tiếp.
3. Payment return render success/failure mà không gọi status endpoint.
4. Notification UI ship khi backend chưa có contract OpenAPI tương ứng.
5. Invoices list không có pagination posture hoặc tự full-fetch không giới hạn.
6. Text mới chưa qua i18n tiếng Việt đầy đủ dấu.

---

## 4. Slice-exit DoD

| Slice | CODE | TEST | AUDIT | DOC-SYNC | COMMIT/PUSH |
|---|---|---|---|---|---|
| FP01 | Contract docs và adapter interface draft xong | N/A | Review path/method/auth | Tech spec + traceability sync | Commit docs slice |
| FP02 | Adapter commercial hoạt động | Adapter tests pass | No direct fetch | Ledger/progress/taskboard | Commit feature slice |
| FP03 | Billing page render đúng states | Page tests pass | No raw payload dump | Evidence template cập nhật | Commit feature slice |
| FP04 | Create payment CTA redirect đúng | Action tests pass | Double-submit blocked | Taskboard sync | Commit feature slice |
| FP05 | Return page bám status endpoint | State-machine tests pass | No query-param truth | Evidence + traceability sync | Commit feature slice |
| FP06 | Route/page registry đầy đủ | Build-community pass | Capability gates review | Progress/ledger sync | Commit feature slice |
| FP07 | Notification decision rõ implement/defer | Contract gate review | No false claims on delivery truth | Spec audit sync | Commit decision slice |
| FP08 | Packaging + tests + docs sạch | Full suite pass | Review gate sạch | Governance synced | Final merge commit |