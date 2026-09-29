# Traceability Matrix — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Active

---

| Requirement ID | Requirement | Source | Planned slices | Validation |
|---|---|---|---|---|
| R01 | Toàn bộ implementation mới phải nằm trong `packages/web` và `packages/core` | AGENTS.md | FP02-FP08 | Code review + grep import paths |
| R02 | Billing Center phải dùng đúng `/core/v1/billing/*` contract hiện có | commercial urls/views | FP01-FP03 | Adapter review + page integration tests |
| R03 | Payment create chỉ gọi `/core/v1/payments/create/` | commercial urls/views | FP01, FP04 | Adapter tests + request snapshot |
| R04 | Payment return phải dùng `/commercial/payment-return` | `vnpay_service.py` | FP01, FP05, FP06 | Route review + manual flow check |
| R05 | Payment truth cuối cùng phải lấy từ `/core/v1/payments/status/{txn_ref}/` | commercial views | FP01, FP05 | Page state-machine tests |
| R06 | Browser không được gọi `/payments/vnpay-ipn/` | commercial urls/views | FP01, FP04-FP05 | Code review + grep gate |
| R07 | Invoices list phải theo pagination posture, không full-fetch client-side | OpenAPI constitution | FP01, FP03 | Adapter review + page tests |
| R08 | Không dùng `ShellMailConfigPage` làm user notification center | current frontend anchors | FP01, FP07 | Frontend design review + code review |
| R09 | Notification UI chỉ mở khi backend OpenAPI contract đã sẵn sàng | User request + OpenAPI rules | FP07 | Spec audit |
| R10 | Error path phải map chuẩn error envelope | OpenAPI constitution | FP02-FP05 | Adapter tests + UI error assertions |
| R11 | Text mới phải qua i18n tiếng Việt đầy đủ dấu | user memory + repo rule | FP03-FP08 | Copy review + UI review |
| R12 | Route IDs mới phải đồng bộ route catalog + page registry | package-web structure | FP06 | Route audit + build-community |
| R13 | Không hardcode core base URL, callback URL, merchant secrets ở frontend | security/openapi rules | FP02-FP06 | Grep gate + code review |
| R14 | Governance artifacts và evidence phải được cập nhật mỗi slice | repo workflow | FP01-FP08 | Ledger/progress/modified-files + evidence template |

---

## Residual gaps cần theo dõi

1. Backend notification contract chưa có evidence đầy đủ trong current anchors.
2. Capability name cho route billing có thể cần backend bootstrap cập nhật trước khi FE cutover.
3. Nếu invoices endpoint chưa expose cursor metadata đúng nhu cầu UX, phải mở backlog backend trước khi đóng FP03.