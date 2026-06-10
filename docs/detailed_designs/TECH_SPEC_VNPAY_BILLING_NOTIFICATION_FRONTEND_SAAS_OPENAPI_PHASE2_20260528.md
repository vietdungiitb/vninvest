# Tech Spec — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Contract-first baseline
**Program Name**: `VNPAY_BILLING_NOTIFICATION_FRONTEND_SAAS_OPENAPI_PHASE2`

---

## 1. Scope model

### In scope
1. Billing Center cho end-user/tenant owner trong `packages/web`.
2. Payment create flow từ commercial surface.
3. Payment return page tại `/commercial/payment-return`.
4. Commercial adapter, normalized view model, route/page registration, error mapping, i18n, tests.

### Deferred / conditional scope
1. Notification activity feed cho billing/account events.
2. Notification preferences UI chuyên biệt cho commercial domain.
3. Bất kỳ flow nào cần endpoint `/core/v1/notifications/*` chưa tồn tại hoặc chưa chuẩn hóa OpenAPI.

---

## 2. Invariants bắt buộc

1. Mọi commercial frontend code mới nằm trong `packages/web`; cấm feature mới ở `frontend/` root.
2. Mọi commercial data đến từ `packages/core`; cấm adapter song song dùng legacy endpoints.
3. Browser không bao giờ gọi `/payments/vnpay-ipn/`.
4. Query string từ return URL không phải source of truth cuối cùng.
5. Payment truth phải dựa trên `GET /core/v1/payments/status/{txn_ref}/`.
6. Danh sách invoices phải đi theo pagination semantics, không full-fetch trong client.
7. `ShellMailConfigPage` chỉ là operator surface; không được map thành billing notification settings.
8. Mọi lỗi phải bám error envelope chuẩn: `detail`, `code`, `timestamp`, `request_id`, `field_errors`.
9. Text mới phải qua i18n tiếng Việt đầy đủ dấu.

---

## 3. Route topology đề xuất

| Route ID | Path | Build targets | Capability | Mục đích |
|---|---|---|---|---|
| `commercial-billing` | `/commercial/billing` | `saas`, `vip` | `workspace.billing.read` hoặc capability tương đương | Billing Center self-service |
| `commercial-payment-return` | `/commercial/payment-return` | `saas`, `vip` | authenticated session | Màn hình đối soát kết quả redirect VNPay |
| `commercial-notifications` | `/commercial/notifications` | `saas`, `vip` | gated, chỉ mở khi API sẵn sàng | Notification activity/preferences cho commercial domain |

Quy tắc:
1. `commercial-payment-return` không cần hiển thị trong navigation chính.
2. `commercial-notifications` chỉ được đăng ký route thật khi FE2-COM-08 pass.
3. Route IDs phải được thêm đồng bộ vào `routeCatalog.js`, `pageRegistry.js`, và export surface trong `index.js` nếu page là canonical package-web surface.

---

## 4. Đề xuất module layout

```text
packages/web/src/
  adapters/core/commercial.js
  components/commercial/
    BillingSummaryStrip.js
    SubscriptionCard.js
    QuotaCard.js
    InvoiceTable.js
    PaymentActionPanel.js
    PaymentStatusHero.js
  hooks/
    useCommercialBilling.js
    usePaymentReturnStatus.js
  pages/commercial/
    BillingCenterPage.js
    PaymentReturnPage.js
    NotificationCenterPage.js   # gated / optional
  utils/commercial/
    normalizeCommercialPayload.js
    commercialStatusLabels.js
```

Quy tắc ownership:
1. `commercial.js` chỉ làm IO contract + transport bridging.
2. `normalizeCommercialPayload.js` giữ enum mapping và defaulting logic.
3. Page chỉ orchestration state/UI; business rules payment truth không được nằm rải rác trong component con.

---

## 5. API contract consumption map

### 5.1 Subscription
- Endpoint: `GET /core/v1/billing/subscription`
- Auth: required
- Expected usage:
  - plan code
  - subscription status
  - billing cycle
  - current period
  - next invoice date
  - invoice state

### 5.2 Quota
- Endpoint: `GET /core/v1/billing/quota`
- Auth: required
- Pagination: cursor pagination từ `CoreCursorPagination`
- Expected usage:
  - remaining quota posture
  - risk state / nearing limit / exceeded
  - last period usage blocks

### 5.3 Invoices
- Endpoint: `GET /core/v1/billing/invoices`
- Auth: required
- Pagination: required
- Expected usage:
  - invoice number
  - amount due
  - currency
  - status
  - due date / paid date

### 5.4 Create payment
- Endpoint: `POST /core/v1/payments/create/`
- Auth: required
- Request: `{ amount, plan }`
- Expected response fields:
  - `status`
  - `txn_ref`
  - `pay_url`
  - `amount`
  - `plan`

### 5.5 Payment status
- Endpoint: `GET /core/v1/payments/status/{txn_ref}/`
- Auth: required
- Expected response fields:
  - `txn_ref`
  - `amount`
  - `status`
  - `vnp_transaction_no`
  - `updated_at`

---

## 6. Normalized view model

### 6.1 BillingCenterViewModel
```json
{
  "planCode": "pro",
  "subscriptionStatus": "active",
  "invoiceState": "paid",
  "billingCycle": "monthly",
  "nextInvoiceDate": "2026-06-28",
  "currentPeriodStart": "2026-05-28",
  "currentPeriodEnd": "2026-06-27",
  "quotaItems": [],
  "invoiceCursor": {
    "next": null,
    "previous": null
  },
  "invoices": []
}
```

### 6.2 PaymentReturnViewModel
```json
{
  "txnRef": "TXN-...",
  "status": "pending",
  "amount": 990000,
  "updatedAt": "2026-05-28T09:15:00Z",
  "vnpTransactionNo": null,
  "canRefresh": true,
  "canRetryPayment": false
}
```

---

## 7. UI state machine

### Billing Center
1. `idle`
2. `loading`
3. `ready-with-data`
4. `ready-empty`
5. `error-auth`
6. `error-server`

### Payment Return
1. `missing-txn-ref`
2. `loading-status`
3. `pending`
4. `success`
5. `failed`
6. `not-found`
7. `error-transient`

Quy tắc:
1. `pending` phải có CTA refresh thủ công và thông điệp chờ đối soát.
2. `failed` phải cho phép quay lại Billing Center hoặc tạo payment lại từ invoice.
3. `missing-txn-ref` không được tự suy diễn success/failure từ query params khác.

---

## 8. Notification UX contract boundary

1. Event taxonomy được khóa trước: `payment_created`, `payment_pending`, `payment_success`, `payment_failed`, `invoice_ready`, `quota_warning`, `subscription_changed`.
2. Trước khi có endpoint riêng, frontend chỉ được:
   - hiển thị inline banners theo billing/payment truth hiện có
   - hiển thị copy giải thích email/system notification expectation
3. Frontend không được tự tạo notification history local.
4. Mọi notification activity feed thật phải có backend contract hỗ trợ pagination, read/unread, channel status, event timestamps.

---

## 9. OpenAPI và error semantics

1. Nếu `create payment` trả 400, UI phải map field lỗi về form/action panel.
2. Nếu `payment status` trả 404, UI hiển thị `Không tìm thấy giao dịch`, không hiển thị success fallback.
3. Nếu auth hết hạn, transport refresh token được phép thử 1 lần; sau đó page phải về state re-auth rõ ràng.
4. Mọi error message hiển thị cho user phải xuất phát từ error envelope hoặc fallback text chuẩn hóa, không dump raw JSON.

---

## 10. Accessibility, i18n, performance

1. CTA chính phải có nhãn động rõ nghĩa: `Thanh toán ngay`, `Đang chuyển sang VNPay...`, `Tải lại trạng thái`.
2. Payment status hero phải có `aria-live="polite"` cho thay đổi trạng thái.
3. Mọi số tiền hiển thị theo `vi-VN` và `VND`.
4. Invoices list phải render incremental/paginated; không giữ full dataset lớn trong state.
5. Skeleton/loading UI phải dùng cùng visual language với package-web shell hiện hữu, tránh tạo thiết kế lạc tông.