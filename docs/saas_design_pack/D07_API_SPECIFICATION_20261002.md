# D07 — Đặc tả API (OpenAPI 3.1)

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** OpenAPI 3.1 · **Sinh tài liệu:** `drf-spectacular` (đã có trong repo nguồn)
**Tài liệu trước:** D06 · **Tài liệu sau:** D08

---

## 1. Nguyên tắc thiết kế API

| # | Nguyên tắc | Lý do |
|---|---|---|
| 1 | Đặt tài nguyên theo danh từ số nhiều | `/entitlements` không phải `/getEntitlement` |
| 2 | Phiên bản trong đường dẫn | `/api/v1/...` — bắt buộc từ ngày đầu (ADR của D04 B.4.1) |
| 3 | Mã lỗi chuẩn, không phải thông báo tự do | Khách tự xử lý theo mã, không phải theo chuỗi |
| 4 | Idempotency-Key cho mọi thao tác tạo | Chống tạo trùng khi khách gọi lại |
| 5 | Không bao giờ trả về lý do từ chối cụ thể khi xác thực thất bại | Chống dò tài khoản |
| 6 | Phân trang bằng khoá con trỏ, không offset | Offset chậm khi dữ liệu lớn |
| 7 | Mọi trường ngày ở ISO 8601 UTC | Không có múi giờ ngầm định |

---

## 2. Kiểu dữ liệu dùng chung

### 2.1 Cấu trúc lỗi thống nhất

```json
{
  "error": {
    "code": "entitlement_missing",
    "message": "Gói sản phẩm này chưa được kích hoạt cho tổ chức của bạn.",
    "details": {
      "product_code": "vnbroker-brokerage",
      "capability_code": "brokerage.place_order"
    },
    "request_id": "req_01H8XQ2M4K7P"
  }
}
```

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| `error.code` | ✔ | Mã ổn định — khách lập trình theo mã này |
| `error.message` | ✔ | Nhằm hiển thị cho người, có thể dịch |
| `error.details` | ✘ | Ngữ cảnh bổ sung |
| `error.request_id` | ✔ | Tra cứu khi báo lỗi |

> **Không bao giờ dịch `code`.** Chỉ dịch `message`. Khách tích hợp theo `code`.

### 2.2 Danh mục mã lỗi

| Mã | HTTP | Nhóm | Ý nghĩa |
|---|:---:|---|---|
| `ok` | 200 | — | Thành công |
| `pat_invalid` | 401 | Xác thực | Định dạng sai |
| `pat_expired` | 401 | Xác thực | Hết hạn |
| `pat_revoked` | 401 | Xác thực | Đã thu hồi |
| `tenant_suspended` | 403 | Xác thực | Tenant bị khoá |
| `email_already_registered` | 409 | Đăng ký | Email đã có tài khoản cá nhân |
| `tax_id_duplicate` | 409 | Đăng ký | MST trùng |
| `contract_required` | 422 | Đăng ký | Thiếu hợp đồng (chỉ doanh nghiệp) |
| `entitlement_missing` | 403 | Quyền | Chưa mua sản phẩm |
| `entitlement_expired` | 403 | Quyền | Hết kỳ thanh toán |
| `tier_insufficient` | 403 | Quyền | Tier không đủ |
| `capability_not_granted` | 403 | Quyền | Tier không có tính năng |
| `approval_pending` | 403 | Quyền | Đang chờ duyệt pháp lý |
| `product_requires_organization` | 403 | Quyền | **Sản phẩm chỉ dành cho doanh nghiệp** |
| `license_expired` | 403 | Quyền | Giấy phép phần mềm hết hạn |
| `product_retired` | 410 | Quyền | Ngừng bán |
| `quota_exceeded` | 429 | Hạn mức | Vượt hạn |
| `activation_limit_reached` | 429 | Kích hoạt | Hết slot máy |
| `validation_error` | 422 | Đầu vào | Sai định dạng trường |
| `forbidden` | 403 | Phân quyền | Không đủ vai trò |
| `not_found` | 404 | Tài nguyên | Không tồn tại trong tenant hiện tại |
| `conflict` | 409 | Đồng thời | Xung đột trạng thái |
| `internal_error` | 500 | Hệ thống | Lỗi không lường trước |

> **`product_requires_organization`** là mã mới, sinh ra từ ADR-007. Đây là lớp phòng thủ cuối cho BR-12 — giao diện không hiển thị sản phẩm đó, nhưng gọi API trực tiếp vẫn bị chặn.

---

## 3. Cổng quyết định quyền — đường nóng

### 3.1 `POST /api/v1/entitlements/verify`

Điểm vào duy nhất cho mọi tích hợp. Yêu cầu ≤ 50 ms p95 (NFR-D01).

**Xác thực:** `Bearer <PAT>`

**Thân yêu cầu**
```json
{
  "product_code": "vnbroker-brokerage",
  "capability_codes": [
    "brokerage.place_order",
    "brokerage.read_balance"
  ]
}
```

| Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|:---:|---|
| `product_code` | string | ✔ | `^[a-z][a-z0-9_]*$` |
| `capability_codes` | array[string] | ✔ | Tối đa 50 phần tử |

**Phản hồi 200 — có quyền**
```json
{
  "allowed": true,
  "decision_id": "01H8XQ2M4K7P9RZ3N5V8T1Y4B6D",
  "tenant": {
    "tenant_id": "01H8X...",
    "tenant_type": "organization"
  },
  "entitlement": {
    "product_code": "vnbroker-brokerage",
    "tier_code": "enterprise",
    "period_start": "2026-10-01",
    "period_end": "2026-10-31"
  },
  "granted_capabilities": [
    "brokerage.place_order",
    "brokerage.read_balance"
  ],
  "denied_capabilities": [],
  "limits": {
    "api_call": { "consumed": 1240, "limit": 100000, "unit": "call", "state": "normal" },
    "seat": { "consumed": 3, "limit": 10, "unit": "seat", "state": "normal" }
  },
  "expires_at": "2026-10-31T23:59:59Z"
}
```

**Phản hồi 403 — từ chối**
```json
{
  "allowed": false,
  "decision_id": "01H8XQ2M4K7P9RZ3N5V8T1Y4B6D",
  "reason_code": "approval_pending",
  "failed_at_step": 10,
  "product_code": "vnbroker-brokerage",
  "denied_capabilities": ["brokerage.place_order"],
  "message": "Yêu cầu cấp quyền này đang chờ phê duyệt pháp lý."
}
```

> **`failed_at_step` là trường quan trọng.** Nó trỏ tới bước 1–12 trong D03 §3.2. Nhờ vậy khi khách khiếu nại, đội vận hành biết chính xác bước nào chặn, thay vì phải đoán.

**Đặc tính**

| Đặc tính | Giá trị |
|---|---|
| Idempotent | ✅ Có thể gọi lại |
| Phân trang | Không |
| Ghi log | Bắt buộc — mọi quyết định đều ghi `entitlement_decision_log` |
| Rủi ro | Cao — yêu cầu limit cao hơn hẳn các cổng khác |

### 3.2 `POST /api/v1/entitlements/verify-batch`

Kiểm tra nhiều sản phẩm trong một lần gọi — tránh N+1 khi SDK khởi động.

```json
{
  "checks": [
    { "product_code": "vninvestcharts", "capability_codes": ["chart.render"] },
    { "product_code": "vnbroker-data",   "capability_codes": ["data.quote"] }
  ]
}
```

Trả về mảng kết quả, **cùng `decision_id` chung** để gom vết chứng minh.

### 3.3 `GET /api/v1/entitlements/current`

Xem toàn bộ quyền hiện tại của tenant — dùng cho giao diện và trang trạng thái.

```json
{
  "tenant_id": "01H8X...",
  "tenant_type": "individual",
  "entitlements": [
    {
      "product_code": "vninvestcharts",
      "product_name": "VNInvest Charts",
      "tier_code": "individual",
      "tier_name": "Cá nhân",
      "status": "active",
      "period_end": "2026-10-31",
      "capabilities": ["chart.render"],
      "limits": []
    }
  ]
}
```

---

## 4. Cổng xác thực

### 4.1 `POST /api/v1/auth/register-individual`

Đăng ký cá nhân — tự phục vụ, không qua duyệt (ADR-007).

```json
{
  "email": "dev@example.com",
  "full_name": "Nguyễn Văn A",
  "password": "...",
  "turnstile_token": "..."
}
```

| Trường | Bắt buộc | Ràng buộc |
|---|:---:|---|
| `email` | ✔ | Định dạng email |
| `full_name` | ✔ | 2–128 ký tự |
| `password` | ✔ | ≥ 10 ký tự, có chữ + số |
| `turnstile_token` | ✔ | Chống tự động |

**Phản hồi 201**
```json
{
  "tenant_id": "01H8X...",
  "tenant_type": "individual",
  "status": "active",
  "access_token": "...",
  "expires_in": 3600
}
```

**Lỗi**

| Mã | Điều kiện |
|---|---|
| `email_already_registered` | Email đã có tài khoản **cá nhân** (BR-14) |
| `validation_error` | Sai định dạng |

> **Không có mã `tax_id_duplicate` hay `contract_required` ở cổng này.** Hai mã đó thuộc cổng đăng ký doanh nghiệp. Người dùng cá nhân không nhìn thấy trường nào liên quan MST.

### 4.2 `POST /api/v1/auth/register-organization`

Đăng ký doanh nghiệp — tạo hồ sơ chờ duyệt.

```json
{
  "legal_name": "Công ty TNHH ABC",
  "tax_id": "0312345678",
  "contact_email": "admin@abc.vn",
  "representative_name": "Nguyễn Văn B",
  "contract_document_url": "https://..."
}
```

**Phản hồi 201**
```json
{
  "registration_id": "01H8X...",
  "status": "pending_review"
}
```

> **Không trả về token.** Tenant chưa `active` nên chưa được đăng nhập. Phải chờ Ops duyệt.

### 4.3 `POST /api/v1/auth/login`

| Trường | Bắt buộc |
|---|:---:|
| `email` | ✔ |
| `password` | ✔ |

**Lỗi — nguyên tắc quan trọng**

| Sai mật khẩu | Trả về |
|---|---|
| Email không tồn tại | `invalid_credentials` — **cùng mã, cùng thông điệp** |

> **Không bao giờ phân biệt "sai mật khẩu" với "không có tài khoản".** Nếu phân biệt, kẻ tấn công dò được danh sách email đã đăng ký.

### 4.4 `POST /api/v1/auth/pat`

Tạo PAT — trả token **đúng một lần duy nhất**.

```json
{
  "name": "ci-pipeline",
  "expires_at": "2027-01-01T00:00:00Z",
  "capability_scope": ["chart.render", "data.quote"]
}
```

**Phản hồi 201**
```json
{
  "pat_id": "01H8X...",
  "token": "vnp_live_xxxxxxxxxxxxxxxxxxxxxxxx",
  "prefix": "vnp_live_a7b3",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

> **Lần gọi thứ hai trả 404.** Hệ thống không lưu bản rõ của token — chỉ lưu băm có hạt. Đây là AC-003.2 và là điều kiện để không thể rò rỉ khi bị xâm nhập.

---

## 5. Cổng thanh toán

### 5.1 `POST /api/v1/billing/checkout`

Khởi tạo thanh toán.

**Doanh nghiệp:**
```json
{
  "product_code": "vninvestcharts",
  "tier_code": "enterprise",
  "billing_cycle": "annual",
  "payment_method": "bank_transfer"
}
```

**Cá nhân:**
```json
{
  "product_code": "vninvestcharts",
  "tier_code": "individual",
  "billing_cycle": "monthly",
  "payment_method": "vnpay_split"
}
```

| `payment_method` | Dành cho | Ghi chú |
|---|---|---|
| `bank_transfer` | Doanh nghiệp | Chuyển khoản, hóa đơn VAT |
| `vnpay_business` | Doanh nghiệp | VNPay doanh nghiệp |
| `vnpay_split` | **Cá nhân** | Trả một phần giữ chỗ gói (ADR-008) |
| `credit_card` | — | **Không dùng v1.0** — xem ghi chú |

> **Phát hiện D-08:** `vnpay_service.py:29` nhận `amount: float`. Tiền Việt phải là số nguyên đồng. Xác định `payment_method: vnpay_split` **không dùng** hạn mức — chỉ trả trước một phần, nên không cần hạ tầng hạn mức.

**Phản hồi 201**
```json
{
  "checkout_id": "01H8X...",
  "payment_url": "https://vnpay.vn/...",
  "amount": 199000,
  "currency": "VND",
  "expires_at": "2026-10-02T12:15:00Z"
}
```

### 5.2 `POST /api/v1/billing/webhooks/vnpay`

Nhận webhook từ VNPay. **Không xác thực người gọi.**

**Xử lý bắt buộc**

| Bước | Hành động | Nếu thất bại |
|---|---|---|
| 1 | Kiểm tra chữ ký IPN | Bỏ qua + cảnh báo |
| 2 | Kiểm tra `txn_ref` đã xử lý chưa | Trả thành công, không xử lý lần hai |
| 3 | Khoá bản ghi (idempotency) | Trả thành công |
| 4 | Đối soát số tiền khớp hóa đơn | **Từ chối cấp quyền** + cảnh báo |
| 5 | Kích hoạt entitlement | — |
| 6 | Trả kết quả | Trong 2 giây |

> **Bước 4 dễ bỏ sót nhất.** Webhook giả có chữ ký hợp lệ nhưng số tiền khác là trường hợp thật. Không đối soát thì kẻ tấn công thanh toán 1 đồng và nhận gói đầy đủ.

### 5.3 `GET /api/v1/billing/invoices`

Phân trang bằng khoá con trỏ.

```
GET /api/v1/billing/invoices?limit=20&cursor=01H8X...
```

**Phản hồi**
```json
{
  "items": [
    {
      "invoice_id": "01H8X...",
      "invoice_number": "INV-2026-10-0001",
      "invoice_kind": "receipt",
      "amount": 199000,
      "currency": "VND",
      "status": "paid",
      "issued_at": "2026-10-02T10:00:00Z",
      "download_url": "https://..."
    }
  ],
  "next_cursor": "01H8Y...",
  "has_more": true
}
```

| `invoice_kind` | Dành cho | Có MST |
|---|---|:---:|
| `vat_invoice` | Doanh nghiệp | ✔ |
| `receipt` | Cá nhân | ✘ |

> Ràng buộc này được cài bằng `CHECK` trên cơ sở dữ liệu (D06 §6.1), không kiểm tra ở giao diện — vì giao diện có thể bị bỏ qua.

---

## 6. Cổng quản trị sản phẩm

### 6.1 `POST /api/v1/admin/products`

| Trường | Bắt buộc | Ràng buộc |
|---|:---:|---|
| `code` | ✔ | `^[a-z][a-z0-9_]*$`, UNIQUE |
| `name` | ✔ | |
| `vendor` | ✔ | |
| `license_type` | ✔ | `MPL-2.0` / `PROPRIETARY` / `COMMERCIAL` |
| `license_reference` | Khi `PROPRIETARY` | Số văn bản cho phép |
| `requires_kyc` | | Mặc định `false` |

**Phản hồi 201**
```json
{
  "product_code": "vnbroker-brokerage",
  "status": "draft",
  "license_warning": null
}
```

**Phản hồi 201 kèm cảnh báo**
```json
{
  "product_code": "vnbroker-data",
  "status": "draft",
  "license_warning": {
    "code": "commercial_license_missing",
    "message": "Sản phẩm PROPRIETARY chưa có giấy phép thương mại được ghi nhận. Không thể kích hoạt bán."
  }
}
```

> **Cảnh báo trả về 201, không trả 403.** Tạo sản phẩm vẫn hợp lệ — nhưng không thể bán. Điều này cho phép chuẩn bị sản phẩm trước khi giấy phép xong.

### 6.2 `PATCH /api/v1/admin/products/{code}`

Không đổi `code` sau khi tạo — vì `code` xuất hiện trong `entitlement_decision_log` như bằng chứng lịch sử.

### 6.3 `POST /api/v1/admin/tiers/{code}/capabilities`

```json
{
  "capability_codes": ["chart.render", "chart.export"]
}
```

**Từ chối nếu** capability đang được cấp cho entitlement nào đó — AC-011.4.

### 6.4 `POST /api/v1/admin/products/{code}/activate`

Chuyển `draft` → `active`. Từ chối nếu `license_status != cleared` và `license_type = PROPRIETARY`.

---

## 7. Cổng phê duyệt pháp lý

### 7.1 `GET /api/v1/compliance/requests`

Chỉ vai trò `Compliance`. Danh sách yêu cầu cấp quyền rủi ro cao đang chờ.

### 7.2 `POST /api/v1/compliance/requests/{id}/approve`

```json
{
  "legal_terms_version": "terms-2026-10-01",
  "note": "Đã kiểm tra hồ sơ pháp nhân, hợp đồng có hiệu lực."
}
```

| Trường | Bắt buộc |
|---|:---:|
| `legal_terms_version` | ✔ |
| `note` | ✔ |

**Từ chối nếu** giấy phép phần mềm chưa `cleared` — BR-04.5.

---

## 8. Cổng quản trị tenant

| Đường dẫn | Phương thức | Vai trò | Mô tả |
|---|---|---|---|
| `/api/v1/admin/registrations` | GET | Ops | Danh sách hồ sơ chờ duyệt |
| `/api/v1/admin/registrations/{id}/approve` | POST | Ops | Duyệt, ghi lý do |
| `/api/v1/admin/registrations/{id}/reject` | POST | Ops | Từ chối — **bắt buộc** `reason` |
| `/api/v1/admin/tenants` | GET | Ops | Danh sách tenant |
| `/api/v1/admin/tenants/{id}/suspend` | POST | Ops | Khoá — bắt buộc `reason` |
| `/api/v1/admin/audit-logs` | GET | Ops, Compliance | Truy vấn nhật ký |

**Bộ lọc danh sách tenant**
```
GET /api/v1/admin/tenants?tenant_type=individual&status=active&ending_soon=true
```

---

## 9. Cổng sản phẩm công khai

### 9.1 `GET /api/v1/public/products`

Danh sách sản phẩm **đã lọc theo loại khách của requester**.

**Không xác thực.** Gọi được không cần PAT.

**Phản hồi**
```json
{
  "items": [
    {
      "code": "vninvestcharts",
      "name": "VNInvest Charts",
      "license_type": "MPL-2.0",
      "tiers": [
        { "code": "individual", "name": "Cá nhân", "price": { "amount": 199000, "currency": "VND", "cycle": "monthly" } },
        { "code": "enterprise", "name": "Doanh nghiệp", "price": { "amount": 3990000, "currency": "VND", "cycle": "annual" } }
      ],
      "capabilities": ["chart.render"]
    }
  ]
}
```

> **Lọc theo `tenant_type` ở phía máy chủ.** Không gửi cho trình duyệt danh sách rồi ẩn bằng CSS — vì ẩn bằng CSS không ngăn được việc gọi API trực tiếp. Đây chính là BC-10.6 trong D03.

### 9.2 `GET /api/v1/public/limits`

Hạn mức của gói, công khai — để khách tự đánh giá trước khi mua.

---

## 10. Cổng đo định lượng

### 10.1 `POST /api/v1/metering/usage`

Ghi nhận tiêu thụ. **Bất đồng bộ** — không chặn đường chính.

```json
{
  "meter_code": "api_call",
  "quantity": 1,
  "decision_id": "01H8X..."
}
```

**Phản hồi 202** (không phải 201 — đã nhận, chưa ghi)

### 10.2 `GET /api/v1/metering/usage/current`

```json
{
  "period_start": "2026-10-01",
  "period_end": "2026-10-31",
  "meters": [
    { "code": "api_call", "consumed": 1240, "limit": 100000, "unit": "call", "state": "normal" },
    { "code": "seat", "consumed": 3, "limit": 10, "unit": "seat", "state": "warning" }
  ]
}
```

| `state` | Điều kiện | Hành động |
|---|---|---|
| `normal` | < 80% | — |
| `warning` | 80–99% | Cảnh báo |
| `critical` | ≥ 100% | Lệnh sau trả 429 |

---

## 11. Cổng kích hoạt máy

### 11.1 `POST /api/v1/activations`

```json
{
  "machine_label": "laptop-work",
  "fingerprint": "sha256:abc123..."
}
```

**Phản hồi 201**
```json
{
  "activation_id": "01H8X...",
  "token": "act_xxxxxxxx",
  "seats_used": 1,
  "seats_limit": 10
}
```

**Phản hồi 429**
```json
{
  "error": {
    "code": "activation_limit_reached",
    "message": "Gói của bạn cho phép 10 máy, hiện đang dùng đủ 10.",
    "details": { "seats_used": 10, "seats_limit": 10 }
  }
}
```

> **Nêu rõ số đang dùng và số tối đa.** Người dùng cần biết phải thu hồi máy nào, không chỉ biết bị từ chối.

### 11.2 `GET /api/v1/activations`

### 11.3 `DELETE /api/v1/activations/{id}`

Bắt buộc `reason` trong thân yêu cầu.

---

## 12. Hợp đồng phân trang

### 12.1 Yêu cầu

```
GET /api/v1/resource?limit=50&cursor=<opaque>
```

| Tham số | Mặc định | Tối đa |
|---|---:|---:|
| `limit` | 20 | 100 |
| `cursor` | — | — |

### 12.2 Phản hồi

```json
{
  "items": [],
  "next_cursor": "01H8Y...",
  "has_more": true
}
```

> **Không dùng `offset`.** Offset phải đếm qua các bản ghi bị bỏ qua — ở bảng nhật ký kiểm toán với hàng triệu dòng, `offset=100000` là một truy vấn chậm. Khoá con trỏ đi thẳng tới vị trí.

---

## 13. Tiêu đề, chuẩn hoá, phiên bản

### 13.1 Tiêu đề yêu cầu bắt buộc

| Tiêu đề | Bắt buộc | Mô tả |
|---|:---:|---|
| `Authorization` | Hầu như luôn | `Bearer <PAT>` hoặc token phiên |
| `X-Request-Id` | ✘ | Nếu không có, hệ thống tự sinh |
| `Idempotency-Key` | Khi tạo | UUID, hạn 24 giờ |
| `X-Client-Version` | ✘ | Phiên bản SDK, để chẩn đoán |

### 13.2 Chuẩn hoá

| Quy tắc | Giá trị |
|---|---|
| Ngày giờ | ISO 8601, **UTC**, kèm `Z` |
| Số tiền | Số nguyên nhỏ nhất, **đơn vị đồng**, không làm tròn |
| Tiền tệ | Mã ISO 4217 viết hoa |
| Mã lỗi | `snake_case`, không đổi sau phát hành |

### 13.3 Chính sách phiên bản

| Loại thay đổi | Tác động | Hành động |
|---|---|---|
| Thêm trường không bắt buộc | An toàn | Dùng được ngay |
| Thêm trường **bắt buộc** | Phá vỡ | Phải tăng phiên bản chính |
| Thêm `reason_code` mới | An toàn | Khách xử lý theo mặc định |
| Bỏ trường | Phá vỡ | Phải tăng phiên bản chính |
| Đổi ý nghĩa trường | **Nguy hiểm** | Không bao giờ được phép |

> **Nguyên tắc đổi ý nghĩa trường** là thứ dễ phá vỡ khách hàng mà không ai nhận ra — vì kiểu dữ liệu không đổi, chỉ cách hiểu thay đổi.

---

## 14. Giới hạn tần suất

| Cổng | Giới hạn | Trả về |
|---|---|---|
| `/entitlements/verify` | 1 000/phút/PAT | 429 `rate_limited` |
| `/auth/login` | 10/phút/IP | 429 `rate_limited` |
| `/auth/register-individual` | 5/ngày/IP | 429 `rate_limited` |
| `/billing/checkout` | 20/phút/tenant | 429 `rate_limited` |
| `/metering/usage` | 5 000/phút/PAT | 429 `rate_limited` |

> **Khác biệt quan trọng:** `/entitlements/verify` có giới hạn **cao nhất** trong toàn hệ thống. Vì đây là đường nóng gọi hàng triệu lần mỗi ngày. Đặt thấp sẽ làm hỏng ứng dụng khách.

---

## 15. Danh mục đầy đủ

| # | Đường dẫn | Phương thức | Xác thực | Vai trò | Mã số |
|:---:|---|:---:|:---:|---|---|
| 1 | `/auth/register-individual` | POST | ✘ | Công khai | 201 |
| 2 | `/auth/register-organization` | POST | ✘ | Công khai | 201 |
| 3 | `/auth/login` | POST | ✘ | Công khai | 200 |
| 4 | `/auth/logout` | POST | ✓ | Mọi | 204 |
| 5 | `/auth/pat` | POST | ✓ | Owner, Admin | 201 |
| 6 | `/auth/pat` | GET | ✓ | Owner, Admin | 200 |
| 7 | `/auth/pat/{id}` | DELETE | ✓ | Owner, Admin | 204 |
| 8 | `/entitlements/verify` | POST | PAT | Tất cả | 200/403 |
| 9 | `/entitlements/verify-batch` | POST | PAT | Tất cả | 200 |
| 10 | `/entitlements/current` | GET | PAT | Tất cả | 200 |
| 11 | `/billing/checkout` | POST | ✓ | Owner | 201 |
| 12 | `/billing/invoices` | GET | ✓ | Owner, Admin | 200 |
| 13 | `/billing/webhooks/vnpay` | POST | Chữ ký | Hệ thống | 200 |
| 14 | `/billing/webhooks/stripe` | POST | Chữ ký | Hệ thống | 200 |
| 15 | `/metering/usage` | POST | PAT | Tất cả | 202 |
| 16 | `/metering/usage/current` | GET | PAT | Tất cả | 200 |
| 17 | `/activations` | POST | PAT | Tất cả | 201/429 |
| 18 | `/activations` | GET | PAT | Owner, Admin | 200 |
| 19 | `/activations/{id}` | DELETE | ✓ | Owner, Admin | 204 |
| 20 | `/admin/products` | GET/POST | ✓ | Product Admin | 200/201 |
| 21 | `/admin/products/{code}` | PATCH | ✓ | Product Admin | 200 |
| 22 | `/admin/products/{code}/activate` | POST | ✓ | Product Admin | 200 |
| 23 | `/admin/tiers/{code}/capabilities` | POST | ✓ | Product Admin | 200 |
| 24 | `/admin/registrations` | GET | ✓ | Ops | 200 |
| 25 | `/admin/registrations/{id}/approve` | POST | ✓ | Ops | 200 |
| 26 | `/admin/registrations/{id}/reject` | POST | ✓ | Ops | 200 |
| 27 | `/admin/tenants` | GET | ✓ | Ops | 200 |
| 28 | `/admin/tenants/{id}/suspend` | POST | ✓ | Ops | 200 |
| 29 | `/admin/audit-logs` | GET | ✓ | Ops, Compliance | 200 |
| 30 | `/compliance/requests` | GET | ✓ | Compliance | 200 |
| 31 | `/compliance/requests/{id}/approve` | POST | ✓ | Compliance | 200 |
| 32 | `/compliance/requests/{id}/reject` | POST | ✓ | Compliance | 200 |
| 33 | `/public/products` | GET | ✘ | Công khai | 200 |
| 34 | `/public/limits` | GET | ✘ | Công khai | 200 |

**Tổng: 34 thao tác trên 19 tài nguyên.**

---

## 16. Sinh tài liệu tự động

`drf-spectacular` đã có sẵn trong repo nguồn (`requirements.txt`).

| Bước | Lệnh |
|---|---|
| Sinh schema | `manage.py spectacular --file schema.yml` |
| Kiểm tra sai lệch | `manage.py spectacular --validate --fail-on-warn` |
| Xuất HTML | `manage.py spectacular --file schema.html` |

> **Quy tắc:** schema phải được sinh trong đường kiểm thử. Nếu tài liệu trong kho khác với schema thực, thì tài liệu đó là sai — và sẽ ảo.

---

**Cổng chất lượng:** QG-3 — 34 thao tác · 24 mã lỗi chuẩn · 10 `reason_code` quyết định quyền · chính sách phiên bản và giới hạn tần suất định nghĩa.
**Tài liệu sau:** D08 — Thiết kế UI/UX