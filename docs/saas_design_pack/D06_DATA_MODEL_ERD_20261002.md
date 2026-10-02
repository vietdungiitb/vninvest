# D06 — Sơ đồ quan hệ dữ liệu (ERD) & Mô hình dữ liệu

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** Crow's Foot · **Cơ sở dữ liệu:** PostgreSQL (bắt buộc) · **Tài liệu trước:** D05 · **Tài liệu sau:** D07

---

## 1. Vì sao bắt buộc PostgreSQL

`identity_access/9000_auth_user_email_ci_unique.py:60` dùng `array_agg` — hàm riêng của PostgreSQL.

⇒ Dùng SQLite sẽ hỏng ngay lúc chạy migration. Đây không phải lựa chọn, đây là ràng buộc.

---

## 2. ERD tổng thể — 5 cụm

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  CỤM 1:        │   │  CỤM 2:        │   │  CỤM 3:        │
│  DANH MỤC      │   │  KHÁCH HÀNG     │   │  QUYỀN          │
│  (toàn cục)    │   │  (theo tenant)  │   │  (theo tenant)  │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ Product        │   │ CoreTenant      │   │ Entitlement ───┼──► ProductTier ──► Product
│ ProductTier    │   │ CoreUser        │   │ CapabilityGrant├──► Capability ──► Product
│ Capability     │   │ TenantMember    │   │ UsageRecord   │   │
│ Meter          │   │ CoreServiceAcct │   │ QuotaHistory   │   │
│ SoftwareLicense│   │ CorePATCredential│  │               │   │
└─────────────────┘   │ Activation      │   └───────────────┘   │
        │              └─────────────────┘           │           │
        │                        │                   │           │
        ▼                        ▼                   ▼           │
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐  │
│  CỤM 4:        │   │  CỤM 5:        │   │  CỤM 6:        │  │
│  THƯƠNG MẠI    │   │  KIỂM TOÁN      │   │  KÍCH HOẠT     │◄─┘
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ Subscription    │   │ AuditLog        │   │ Activation     │
│ ──► Product     │   │ DecisionLog     │   │                │
│ Invoice         │   │ LegalTermsLog   │   └─────────────────┘
│ PaymentTxn      │   └─────────────────┘
│ VNPayIPNLog     │
└─────────────────┘
```

**Đặc điểm quan trọng:** Cụm 1 là **dữ liệu toàn cục** — không có `tenant_id`. Cụm 2–6 đều mang `tenant_id`.

---

## 3. Cụm 1 — Danh mục (toàn cục)

### 3.1 `catalog_product`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | bigint | PK, tự tăng | |
| `code` | varchar(64) | UNIQUE, NOT NULL, `^[a-z][a-z0-9_]*$` | Mã sản phẩm, dùng làm khoá logic |
| `name` | varchar(128) | NOT NULL | Tên hiển thị |
| `description` | text | | |
| `vendor` | varchar(64) | NOT NULL | `internal` / đối tác ngoài |
| `source_repo` | varchar(512) | | |
| `license_type` | varchar(32) | NOT NULL | `MPL-2.0` / `PROPRIETARY` / `COMMERCIAL` |
| `license_status` | varchar(16) | NOT NULL, mặc định `pending` | `pending` / `cleared` / `blocked` |
| `license_note` | text | | |
| `requires_kyc` | boolean | mặc định false | Sản phẩm cần xác minh pháp nhân |
| `is_active` | boolean | mặc định false | Cho phép bán |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |

**Chỉ mục:** `UNIQUE(code)`, `INDEX(is_active, license_status)`

> **Không có `tenant_id`.** Sản phẩm thuộc nhà cung cấp, không thuộc khách hàng. Đây là điểm khác biệt cốt lõi so với mô hình đa khách hàng thông thường.

### 3.2 `catalog_product_tier`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `product_id` | bigint | FK → `catalog_product.id`, `ON DELETE RESTRICT` |
| `code` | varchar(32) | NOT NULL, `^[a-z][a-z0-9_]*$` |
| `display_name` | varchar(128) | NOT NULL |
| `price_amount` | numeric(18,2) | NOT NULL, ≥ 0 |
| `billing_period` | varchar(16) | NOT NULL: `monthly` / `quarterly` / `annual` |
| `max_seats` | integer | mặc định -1 (không giới hạn) |
| `sort_order` | integer | mặc định 0 |
| `is_active` | boolean | mặc định true |

**Ràng buộc:** `UNIQUE(product_id, code)`

### 3.3 `catalog_capability`

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | bigint | PK | |
| `product_id` | bigint | FK → `catalog_product.id`, `ON DELETE CASCADE` | |
| `code` | varchar(64) | NOT NULL | Mẫu `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` |
| `display_name` | varchar(128) | NOT NULL | |
| `description` | text | | Cho khách đọc |
| `requires_approval` | boolean | mặc định false | **Cờ pháp lý** — cần Compliance duyệt |
| `is_write_capability` | boolean | mặc định false | Cảnh báo cho khách |
| `is_active` | boolean | mặc định true | |

**Ràng buộc:** `UNIQUE(code)` — mã capability là toàn cục, không trùng giữa các sản phẩm.

> **Vì sao `UNIQUE(code)` toàn cục chứ không phải `UNIQUE(product_id, code)`?** Vì capability được tra cứu bằng chuỗi đơn lẻ từ SDK. Nếu cho phép trùng thì phải tra cứu theo cặp, và mọi nơi dễ quên lọc theo sản phẩm. Chi phí của tính duy nhất toàn cục rất nhỏ; lợi ích là loại bỏ một nhóm lỗi.

### 3.4 `catalog_meter`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `product_id` | bigint | FK → `catalog_product.id`, `ON DELETE CASCADE` |
| `code` | varchar(64) | NOT NULL, `^[a-z][a-z0-9_]*$` |
| `display_name` | varchar(128) | NOT NULL |
| `unit` | varchar(32) | NOT NULL: `call` / `mb` / `seat` / `symbol` |
| `is_billable` | boolean | mặc định false |
| `aggregation` | varchar(16) | `sum` / `max` — cách gộp trong kỳ |

**Ràng buộc:** `UNIQUE(product_id, code)`

> **Đây là bảng khắc phục nợ kỹ thuật D-01.** `commercial/models.py:43-50` có 4 cột cứng (`api_calls`, `symbols`, `users`, `storage_mb`) — thêm metric mới phải viết migration. `catalog_meter` biến metric thành dữ liệu.

### 3.5 `catalog_software_license`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `product_id` | bigint | FK → `catalog_product.id`, `ON DELETE CASCADE` |
| `license_reference` | varchar(128) | NOT NULL — số văn bản cho phép |
| `licensed_to` | varchar(128) | Chủ sở hữu giấy phép |
| `valid_from` | date | |
| `valid_until` | date | NULL = không xác định |
| `scope_notes` | text | |
| `is_cleared` | boolean | mặc định false |

> **Ràng buộc nghiệp vụ gắn cứng:** `catalog_product.license_status = 'cleared'` khi có ít nhất một bản ghi `is_cleared = true` còn hiệu lực. Không có ngoại lệ. Đây là điều kiện để bán `vnbroker` (C-01 trong D01).

---

## 4. Cụm 2 — Khách hàng

**Tái dùng nguyên văn** từ `identity_access/models.py` — không viết lại:

| Model | Vị trí | Dùng cho |
|---|---|---|
| `CoreTenant` | `:44` | Khách hàng |
| `CoreUser` | | Người dùng |
| `TenantMember` | `:596` | Thành viên + vai trò |
| `CoreServiceAccount` | `:180` | Tài khoản dịch vụ |
| `CorePATCredential` | `:254` | Khóa truy cập tích hợp |

**Không cần sửa schema.** Chỉ cần thêm chỉ mục phục vụ truy vấn của hệ thống mới.

### 4.1 Bảng bổ sung

#### `core_tenant` — bổ sung cột phân loại

> Theo ADR-007. Cột này **phải có trong migration đầu tiên**, không thêm sau.

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `tenant_type` | varchar(16) | NOT NULL, mặc định `organization`, `db_index` | `organization` / `individual` |

**Ràng buộc liên bảng:**

```
-- Cá nhân không được mua sản phẩm yêu cầu xác minh pháp nhân
-- Cài bằng DỮ LIỆU, không kiểm tra trong code
```

Cơ chế: `catalog_product.requires_kyc = true` khiến sản phẩm đó **không xuất hiện** trong danh mục của tenant cá nhân. Xem §3.1.

#### `tenant_billing_profile`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `tenant_id` | bigint | FK → `CoreTenant.id`, UNIQUE, `ON DELETE CASCADE` |
| `tax_id` | varchar(32) | **NULL khi `tenant_type = 'individual'`** |
| `legal_name` | varchar(256) | NOT NULL |
| `billing_email` | varchar(254) | NOT NULL |
| `billing_address` | text | |
| `payment_terms` | varchar(16) | `prepaid` / `postpaid` |
| `created_at` / `updated_at` | timestamptz | |

**Ràng buộc toàn vẹn:**
```
UNIQUE(tax_id) WHERE tax_id IS NOT NULL
CHECK (tax_id IS NOT NULL OR tenant_type = 'individual')
```

> **`UNIQUE` có điều kiện** thay vì `UNIQUE` thuần — vì nhiềi tenant cá nhân có `tax_id = NULL`, và PostgreSQL coi nhiều `NULL` là không trùng nhau. Nhưng cần `WHERE` để chắc chắn MST thật không trùng.

#### `customer_registration`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `tenant_id` | bigint | FK, NULL khi chưa duyệt |
| `tenant_type` | varchar(16) | NOT NULL — `organization` / `individual` |
| `legal_name` | varchar(256) | NOT NULL |
| `tax_id` | varchar(32) | **NULL khi `tenant_type = 'individual'`** |
| `contact_email` | varchar(254) | **NOT NULL — UNIQUE khi `individual`** |
| `representative_name` | varchar(128) | NOT NULL khi `organization`, NULL khi `individual` |
| `contract_document_url` | varchar(512) | **NULL khi `tenant_type = 'individual'`** |
| `status` | varchar(16) | `pending_review` / `active` / `rejected` / `cancelled` |
| `reviewed_by` | bigint | FK → `CoreUser.id`, NULL |
| `reviewed_at` | timestamptz | NULL |
| `review_reason` | text | BẮT BUỘC khi từ chối |
| `created_at` | timestamptz | |

**Ràng buộc toàn vẹn:**
```
CHECK (
  (status = 'rejected' AND review_reason IS NOT NULL AND reviewed_by IS NOT NULL)
  OR status NOT IN ('rejected', 'active')
)

-- Hợp đồng bắt buộc với doanh nghiệp, không bắt buộc với cá nhân
CHECK (tenant_type = 'individual' OR contract_document_url IS NOT NULL)

-- Mỗi email chỉ một tài khoản cá nhân (ADR-009)
UNIQUE(contact_email) WHERE tenant_type = 'individual'
```

#### Luồng đăng ký cá nhân

| Bước | Xử lý | Khác doanh nghiệp |
|---|---|---|
| 1. Nhập email + tên | Không cần MST, HĐ | ✅ |
| 2. Xác minh email | Bắt buộc | ✅ |
| 3. Kiểm tra email đã dùng chưa | Trả lỗi nếu trùng (ADR-009) | ✅ |
| 4. Tạo tenant | `status = active` **ngay** | **Bỏ qua bước duyệt Ops** |
| 5. Khởi tạo hồ sơ billing | Không MST | ✅ |
| 6. Chọn gói + thanh toán trước | `prepaid`, theo tháng (ADR-008) | ✅ |

> **Khác biệt then chốt:** cá nhân **không** qua bước Ops duyệt. Đây là điều kiện để mô hình tự phục vụ chạy được ở quy mô lớn — nếu cá nhân cũng phải chờ duyệt thì nhân lực vận hành không đủ.

#### Chống lạm dụng (ADR-009)

| Biện pháp | Cơ chế |
|---|---|
| 1 email = 1 tài khoản | `UNIQUE(contact_email) WHERE tenant_type = 'individual'` |
| Giới hạn theo IP | Bộ đếm `tenant` tạo / IP / 24 giờ, ngưỡng **cao** |

> **Cảnh báo:** nhiều người dùng chung IP ở văn phòng và mạng di động. Ngưỡng thấp sẽ chặn nhầm. Ưu tiên tín hiệu email hơn tín hiệu IP.

---

## 5. Cụm 3 — Quyền (trái tim hệ thống)

### 5.1 `entitlement`

**Sửa từ `Subscription` (`commercial/models.py:11`)** — thay vì viết mới, để giữ liên kết với mã gốc.

| Cột | Kiểu | Ràng buộc | Thay đổi |
|---|---|---|---|
| `id` | bigint | PK | |
| `tenant_id` | bigint | FK → `CoreTenant.id`, `ON DELETE CASCADE` | **ĐỔI TỪ `OneToOneField`** |
| `product_id` | bigint | FK → `catalog_product.id`, `ON DELETE RESTRICT` | **THÊM** |
| `tier_id` | bigint | FK → `catalog_product_tier.id`, `ON DELETE RESTRICT` | **THAY `plan` varchar** |
| `status` | varchar(16) | `pending_payment` / `active` / `expired` / `revoked` | **MỞ RỘNG** |
| `current_period_start` | date | NOT NULL | giữ |
| `current_period_end` | date | NOT NULL | giữ |
| `cancel_at_period_end` | boolean | mặc định false | giữ |
| `granted_by` | bigint | FK → `CoreUser.id`, NULL | **THÊM** |
| `granted_at` | timestamptz | | **THÊM** |
| `legal_terms_version` | varchar(32) | NOT NULL | **THÊM** |
| `approved_by` | bigint | FK → `CoreUser.id`, NULL | **THÊM** |
| `approved_at` | timestamptz | NULL | **THÊM** |
| `revocation_reason` | text | | **THÊM** |
| `created_at` / `updated_at` | timestamptz | | giữ |

**Ràng buộc:**
```
UNIQUE(tenant_id, product_id) WHERE status = 'active'      -- một sản phẩm, một quyền đang hoạt động
CHECK (status != 'revoked' OR revocation_reason IS NOT NULL)
CHECK (current_period_end >= current_period_start)
```

**Chỉ mục:**
```
INDEX(tenant_id, status)
INDEX(product_id, status)
INDEX(current_period_end) WHERE status = 'active'          -- quét quyền sắp hết hạn
```

> **Điểm then chốt:** ràng buộc `UNIQUE ... WHERE status = 'active'` cho phép lịch sử (entitlement cũ `expired`/`revoked` vẫn còn) mà vẫn đảm bảo không có hai quyền đang hoạt động cho cùng một sản phẩm. Nếu dùng `UNIQUE(tenant_id, product_id)` thuần, lịch sử gia hạn sẽ không lưu được.

### 5.2 `catalog_tier_capability`

Bảng nối giữa tier và capability.

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `tier_id` | bigint | FK → `catalog_product_tier.id`, `ON DELETE CASCADE` |
| `capability_id` | bigint | FK → `catalog_capability.id`, `ON DELETE RESTRICT` |
| `is_included` | boolean | mặc định true |

**Ràng buộc:** `UNIQUE(tier_id, capability_id)`

### 5.3 `catalog_tier_meter_limit`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `tier_id` | bigint | FK → `catalog_product_tier.id`, `ON DELETE CASCADE` |
| `meter_id` | bigint | FK → `catalog_meter.id`, `ON DELETE CASCADE` |
| `limit_amount` | bigint | **-1 = không giới hạn** |
| `warn_threshold_pct` | smallint | mặc định 80 |

**Ràng buộc:** `UNIQUE(tier_id, meter_id)` · `CHECK(limit_amount >= -1)`

### 5.4 `entitlement_capability_grant`

**Quyền được cấp thêm ngoài tier** — đây là bảng sinh ra khi phát hiện thiết kế: `Entitlement` và quyền cấp từng capability phải tách biệt, vì chúng có vòng đời khác nhau (tier mở rộng theo thời gian; quyền duyệt có thể bị thu hồi độc lập).

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `entitlement_id` | bigint | FK → `entitlement.id`, `ON DELETE CASCADE` |
| `capability_id` | bigint | FK → `catalog_capability.id`, `ON DELETE RESTRICT` |
| `status` | varchar(16) | `requested` / `approved` / `rejected` / `revoked` |
| `granted_by` | bigint | FK → `CoreUser.id`, NULL |
| `granted_at` | timestamptz | NULL |
| `decision_reason` | text | BẮT BUỘC khi `rejected` hoặc `revoked` |
| `legal_terms_version` | varchar(32) | BẮT BUỘC khi `approved` |

**Ràng buộc toàn vẹn:**
```
UNIQUE(entitlement_id, capability_id) WHERE status <> 'revoked'
CHECK (status != 'rejected' OR decision_reason IS NOT NULL)
CHECK (status != 'approved'  OR granted_by IS NOT NULL
                          AND granted_at IS NOT NULL
                          AND legal_terms_version IS NOT NULL)
```

### 5.5 `entitlement_usage_record`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `entitlement_id` | bigint | FK → `entitlement.id`, `ON DELETE CASCADE` |
| `meter_id` | bigint | FK → `catalog_meter.id`, `ON DELETE RESTRICT` |
| `period_start` | date | NOT NULL |
| `period_end` | date | NOT NULL |
| `consumed` | bigint | mặc định 0, ≥ 0 |
| `decision_id` | uuid | Liên kết vết chứng minh |
| `updated_at` | timestamptz | |

**Ràng buộc:** `UNIQUE(entitlement_id, meter_id, period_start)`

> **Vì sao tham chiếu `entitlement` chứ không tham chiếu `tenant` trực tiếp?** Vì phải trả lời được câu hỏi "khách dùng hết hạn mức của **gói nào**". Nếu chỉ lưu theo tenant, khi khách đổi gói sẽ không biết phần tiêu thụ thuộc gói cũ hay mới.

> **Phát hiện từ xác minh I-01 (2026-10-02) — cần cột `meter_code`.**
> Mã hiện tại đọc hạn mức bằng **tên cột**, không phải khoá ngoại: `middleware.py:511` trả `int(quota_record.api_calls_limit)`.
> Nếu bảng mới chỉ có `meter_id`, mọi truy vấn hạn mức đều phải nối thêm một bảng — trên đường nóng, mỗi lần gọi.
> ⇒ Bổ sung **`meter_code` varchar(64)** để đọc trực tiếp không cần nối. Đây cũng là nguyên tắc đã dùng cho `entitlement_decision_log` và `quota_history:163` — nhất quán với toàn hệ thống.
>
> Hệ quả: phải bảo đảm `meter_code` khớp với `catalog_meter.code`. Kiểm tra bằng kiểm thử, không khai báo bằng `CHECK` xuyên bảng.

### 5.6 `quota_history` — giữ nguyên

Tái dùng `commercial/models.py:159-185`. Đã đúng chuẩn meter-driven.

**Bổ sung cột:** `entitlement_id bigint NULL` để truy ngược gói.

---

## 6. Cụm 4 — Thương mại

| Bảng | Nguồn | Thay đổi |
|---|---|---|
| `commercial_invoice` | `commercial/models.py:61` | **Bổ sung trường thuế** |
| `commercial_payment_txn` | `:91` | Không đổi |
| `commercial_vnpay_ipn_log` | `:118` | Không đổi |
| `commercial_quota_record` | `:38` | **BỎ 8 cột cứng** |
| `entitlement` | `:11` | Sửa như §5.1 |

### 6.1 `commercial_invoice` — bổ sung trường thuế (D-07)

Kiểm tra mã cho thấy `Invoice` hiện chỉ có `amount_due:73` và `currency:74` — **không có trường thuế nào**. Đây là gap có sẵn trong `vninvest`, không phải do mô hình cá nhân tạo ra.

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `buyer_tax_id` | varchar(32) | NULL | MST của người mua |
| `buyer_name` | varchar(256) | NULL | Tên pháp lý người mua |
| `invoice_kind` | varchar(16) | NOT NULL | `vat_invoice` / `receipt` |
| `tax_code` | varchar(8) | NULL | Mã số thuế suất |
| `tax_amount` | numeric(18,2) | NULL | Tiền thuế |

**Ràng buộc toàn vẹn:**
```
CHECK (
  invoice_kind <> 'vat_invoice'
  OR (buyer_tax_id IS NOT NULL AND buyer_name IS NOT NULL)
)

-- Hoá đơn VAT chỉ dành cho doanh nghiệp
CHECK (invoice_kind <> 'vat_invoice' OR tenant_type = 'organization')
```

**Hai loại chứng từ:**

| `invoice_kind` | Dùng cho | Bắt buộc MST |
|---|---|---|
| `vat_invoice` | Doanh nghiệp | ✅ Có |
| `receipt` | Cá nhân | ❌ Không |

> **Đây là cách hiện thực hoá ADR-007 ở tầng chứng từ.** Cá nhân nhận biên nhận, doanh nghiệp nhận hoá đơn VAT. Cùng một bảng, hai loại tài liệu.

### 6.2 Quan hệ hóa đơn ↔ entitlement

```
tenant_billing_profile (1) ──< (N) commercial_invoice
                                    │
                                    ├── line_items JSON: chi tiết sản phẩm + tier + giá
                                    └── (N) entitlement được kích hoạt khi thanh toán
```

**Vì sao dùng `line_items` JSON thay vì bảng con?**
Vì hóa đơn là **bản chụp bất biến** tại thời điểm phát hành. Đổi cấu trúc sản phẩm sau này không được làm thay đổi hóa đơn cũ. JSON đơn giản hơn và bảo đảm tính bất biến đó. Đã có sẵn tại `commercial/models.py:79`.

### 6.3 Chu kỳ thanh toán theo loại khách (ADR-007, ADR-008)

| Đặc tính | Doanh nghiệp | Cá nhân |
|---|---|---|
| Chu kỳ | Năm / quý | **Tháng** |
| Hình thức | Chuyển khoản, VNPay doanh nghiệp | **Tiền tr�� trước** |
| Chứng từ | `vat_invoice` | `receipt` |
| Gia hạn tự động | Không | Không (ADR-008) |
| Hạn mức tín dụng | Có thể | Không |

**Lưu ý kỹ thuật**
`vnpay_service.py:29` nhận `amount: float` — là số thực. Tiền Việt Nam phải là số nguyên đồng. Khi chuyển sang thanh toán cá nhân, cần sửa thành `amount: int` hoặc chuyển đổi có kiểm soát. Đây là chi tiết dễ gây sai số tiền, cần kiểm thử biên.

### 6.4 Mã hoá thông tin thanh toán

Tái dùng mẫu Fernet đã có sẵn tại `identity_access/models.py:879-897`:

```python
def _get_fernet():
    """Get Fernet instance from env var. Raise if missing key."""
    key = os.environ.get('BILLING_INFO_FERNET_KEY', '').strip()
    if not key:
        raise RuntimeError('BILLING_INFO_FERNET_KEY is required but not set')
    return Fernet(key.encode())
```

> **Không lưu số thẻ tín dụng.** Nếu sau này dùng thẻ, chỉ lưu **token** của cổng thanh toán. Số thẻ không bao giờ đi qua hệ thống này — đó là yêu cầu PCI-DSS và giảm bề mặt tấn công.

### 6.5 Khung giá gợi ý cho cá nhân (ADR-007)

Chưa ấn định giá (Q-17). Khung cấu trúc:

| Gói | Hạn mức | Mục đích |
|---|---|---|
| Miễn phí | Thấp, không sản phẩm `requires_kyc` | Khách tự đánh giá trước khi trả |
| Cá nhân | Nhiều hơn, gia hạn tháng | Nhóm trả tiền chính |
| Nhóm | Hạn mức cao, nhiều thành viên | Bước lên từ cá nhân |
| Doanh nghiệp | Hợp đồng năm, hạn mức riêng | Kênh hiện tại, không đổi |

**Quy tắc thiết kế gói:** gói miễn phí phải **đủ dùng** để khách hiểu giá trị, nhưng không đủ để thay thế bản trả phí. Đừng làm cho gói miễn phí quá yếu.

---

## 7. Cụm 5 — Kiểm toán

### 7.1 `audit_log`

Tái dùng `PATAuditLog` (`identity_access/models.py:423`). Yêu cầu FR-04.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint | PK |
| `tenant_id` | bigint | FK, NULL cho sự kiện toàn cục |
| `actor_id` | bigint | FK → `CoreUser.id`, NULL cho hệ thống |
| `action` | varchar(64) | Mã hành động |
| `entity_type` / `entity_id` | varchar(64) / bigint | Đối tượng bị tác động |
| `before_state` / `after_state` | jsonb | **Phục vụ yêu cầu BR-02.3** |
| `ip_address` | inet | |
| `created_at` | timestamptz | |

**Chỉ mục:** `INDEX(tenant_id, created_at DESC)`, `INDEX(action, created_at DESC)`

### 7.2 `entitlement_decision_log`

**Bảng riêng cho vết chứng minh quyết định quyền.**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | PK — chính là `decision_id` trả về cho SDK |
| `tenant_id` | bigint | FK |
| `product_code` | varchar(64) | Lưu bản chuỗi để tra cứu ngay |
| `capability_code` | varchar(64) | Lưu bản chuỗi |
| `allowed` | boolean | |
| `reason_code` | varchar(32) | NULL khi cho phép |
| `failed_at_step` | smallint | Bước dừng (1–12 theo D03) |
| `meter_consumed` | bigint | Số đã trừ, NULL nếu không tiêu thụ |
| `latency_ms` | smallint | |
| `created_at` | timestamptz | |

**Chỉ mục:** `INDEX(tenant_id, created_at DESC)`, `INDEX(product_code, allowed, created_at DESC)`

> **Vì sao lưu bản chuỗi thay vì khoá ngoại?** Vì đây là **vết chứng minh lịch sử**. Sau này sản phẩm có thể bị gỡ, tên có thể đổi — nhưng vết chứng minh phải phản ánh đúng trạng thái tại thời điểm quyết định.

### 7.3 `legal_terms_snapshot`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint | PK |
| `version` | varchar(32) | UNIQUE |
| `effective_from` | timestamptz | |
| `document_url` | varchar(512) | |
| `content_hash` | varchar(64) | SHA-256 |
| `summary` | text | |

**Bất biến:** không sửa, không xoá. Mỗi `entitlement` và `capability_grant` tham chiếu `version`.

---

## 8. Cụm 6 — Kích hoạt máy

### 8.1 `tenant_activation`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | bigint | PK |
| `tenant_id` | bigint | FK → `CoreTenant.id`, `ON DELETE CASCADE` |
| `entitlement_id` | bigint | FK → `entitlement.id`, `ON DELETE CASCADE` |
| `machine_label` | varchar(128) | NOT NULL — khách tự đặt |
| `fingerprint` | varchar(64) | NOT NULL — băm đặc trưng máy |
| `ip_address` | inet | |
| `last_seen_at` | timestamptz | |
| `status` | varchar(16) | `active` / `revoked` |
| `revoked_by` / `revoked_at` / `revoke_reason` | | BẮT BUỘC khi thu hồi |
| `created_at` | timestamptz | |

**Ràng buộc:**
```
UNIQUE(entitlement_id, fingerprint) WHERE status = 'active'
CHECK (status != 'revoked' OR revoke_reason IS NOT NULL)
```

---

## 9. Danh mục bảng đầy đủ

### 9.1 Giữ lại từ `vninvest`

| Bảng / Model | Vị trí gốc | Xử lý |
|---|---|---|
| `CoreTenant` | `identity_access/models.py:44` | Giữ nguyên |
| `CoreUser` | | Giữ nguyên |
| `TenantMember` | `:596` | Giữ nguyên |
| `CoreServiceAccount` | `:180` | Giữ nguyên |
| `CorePATCredential` | `:254` | Giữ nguyên |
| `PATAuditLog` | `:423` | Giữ + bổ sung cột |
| `Subscription` | `commercial/models.py:11` | **Sửa thành `entitlement`** |
| `QuotaHistory` | `:159` | Giữ + bổ sung cột |
| `QuotaRecord` | `:38` | **Bỏ 8 cột cứng** |
| `Invoice` | `:61` | Giữ nguyên |
| `PaymentTransaction` | `:91` | Giữ nguyên |
| `VNPayIPNLog` | `:118` | Giữ nguyên |

### 9.2 Tạo mới — 12 bảng

| # | Bảng | Mục đích |
|---|---|---|
| 1 | `catalog_product` | Sản phẩm |
| 2 | `catalog_product_tier` | Bậc giá |
| 3 | `catalog_capability` | Tính năng |
| 4 | `catalog_meter` | Đơn vị đo |
| 5 | `catalog_software_license` | Giấy phép phần mềm |
| 6 | `catalog_tier_capability` | Tier ↔ capability |
| 7 | `catalog_tier_meter_limit` | Tier ↔ hạn mức |
| 8 | `entitlement_capability_grant` | Quyền cấp thêm có duyệt |
| 9 | `entitlement_usage_record` | Tiêu thụ theo gói |
| 10 | `entitlement_decision_log` | Vết chứng minh quyết định |
| 11 | `tenant_billing_profile` | Hồ sơ thuế |
| 12 | `tenant_activation` | Slot máy |
| 13 | `customer_registration` | Hồ sơ đăng ký |
| 14 | `legal_terms_snapshot` | Điều khoản phiên bản |

**Tổng: 14 bảng mới + 12 bảng giữ lại = 26 bảng.**

---

## 10. Trình tự migration

> **Không tự đặt số migration.** Đọc đầu chuỗi thật hoặc để `makemigrations` sinh. Đặt tay đã gây ra xung đột lá chùy ở đợt trước (2026-09-26).

| Bước | Nội dung | Phụ thuộc |
|---|---|---|
| 1 | Tạo 5 bảng danh mục | — |
| 2 | Tạo 2 bảng nối tier | 1 |
| 3 | Tạo `customer_registration` | — |
| 4 | Tạo `tenant_billing_profile` | — |
| 5 | Tạo `entitlement_usage_record` | 1, 5 |
| 6 | Tạo `entitlement_capability_grant` | 3, 5 |
| 7 | Tạo `legal_terms_snapshot` | — |
| 8 | Tạo `tenant_activation` | 5 |
| 9 | **Thêm cột vào `Subscription`** | 1 |
| 10 | **Đổi `OneToOneField` → `ForeignKey`** | 9 |
| 11 | **Chuyển dữ liệu `plan` → `tier_id`** | 10 |
| 12 | **Đổi tên bảng `Subscription` → `entitlement`** | 11 |
| 13 | Tạo `entitlement_decision_log` | 5 |
| 14 | Bỏ 8 cột của `QuotaRecord` | — |
| 15 | Bổ sung cột vào `QuotaHistory`, `PATAuditLog` | — |

### 10.1 Migration bắt buộc phải viết tay

| Bước | Vì sao không để `makemigrations` sinh |
|---|---|
| 10 | Đổi `OneToOneField` → `ForeignKey` là thay đổi phụ thuộc |
| 11 | `plan` (chuỗi) → `tier_id` (khoá ngoại) cần ánh xạ giá trị |
| 12 | Đổi tên bảng |
| 14 | Bỏ cột — cần chắc chắn không còn dữ liệu nào phụ thuộc |

### 10.2 Yêu cầu an toàn cho mỗi migration

| Yêu cầu | Lý do |
|---|---|
| Có `RunPython` để sao lưu dữ liệu cũ | Cho phép quay lại |
| Không `RunPython` xoá dữ liệu trong cùng migration | Tách: chuyển dữ liệu trước, xoá cột sau |
| Chạy được trên PostgreSQL | Bắt buộc — `array_agg` |
| Có kiểm thử migration lên/từ cơ sở dữ liệu thật | Chỉ `makemigrations` không đủ |

---

## 11. Truy vấn quan trọng

### 11.1 Quyết định quyền (đường nóng)

```sql
-- Bước: kiểm tra entitlement đang hoạt động và đủ tier
SELECT e.id, e.tier_id, e.current_period_end,
       tc.capability_id
FROM   entitlement e
JOIN   catalog_tier_capability tc ON tc.tier_id = e.tier_id
WHERE  e.tenant_id = %(tenant_id)s
  AND  e.product_id = %(product_id)s
  AND  e.status = 'active'
  AND  e.current_period_end >= CURRENT_DATE
  AND  tc.capability_id = %(capability_id)s
  AND  tc.is_included = true
LIMIT 1;
```

**Chỉ mục phục vụ:** `INDEX(tenant_id, product_id, status)` trên `entitlement`

### 11.2 Kiểm tra hạn mức

```sql
SELECT ur.consumed, l.limit_amount
FROM   entitlement_usage_record ur
JOIN   catalog_tier_meter_limit l
       ON l.tier_id = %(tier_id)s
JOIN   catalog_meter m ON m.id = l.meter_id
WHERE  ur.entitlement_id = %(entitlement_id)s
  AND  m.code = %(meter_code)s
  AND  ur.period_start = %(period_start)s;
```

### 11.3 Quét quyền sắp hết hạn

```sql
SELECT e.id, e.tenant_id, e.current_period_end
FROM   entitlement e
WHERE  e.status = 'active'
  AND  e.current_period_end <= CURRENT_DATE + INTERVAL '14 days'
ORDER BY e.current_period_end;
```

Dùng chỉ mục một phần `INDEX(current_period_end) WHERE status = 'active'`.

---

## 12. Kiểm soát toàn vẹn dữ liệu

### 12.1 Ràng buộc liên bảng không thể khai báo bằng `CHECK`

| # | Quy tắc | Cơ chế thực thi |
|---|---|---|
| 1 | Tier phải thuộc cùng sản phẩm với entitlement | Kiểm tra trong tầng ứng dụng + kiểm thử |
| 2 | Meter thuộc cùng sản phẩm với entitlement | Kiểm tra trong tầng ứng dụng + kiểm thử |
| 3 | Mọi bảng cụm 2–6 phải có `tenant_id` | Kiểm tra tự động khi review + kiểm thử |
| 4 | Không sửa `quota_history` đã đóng kỳ | Chính sách `UPDATE` mức ứng dụng |
| 5 | Bản ghi `audit_log` không được xoá | Chỉ cấp `INSERT`/`SELECT` cho vai trò ứng dụng |

> **Điểm mấu chốt:** ràng buộc #1 và #2 **không** thể kiểm soát bằng khoá ngoại. Nếu không có kiểm thử chủ động, một lỗi đơn lẻ sẽ cho phép khách dùng hạn mức của sản phẩm khác. Đây là loại lỗi im lặng — không nổ, không chết, chỉ hiện ra khi báo cáo doanh thu sai.

---

**Cổng chất lượng:** QG-3 — 26 bảng · 11 ràng buộc `CHECK` · 5 ràng buộc không thể khai báo bằng `CHECK` đã định danh · 15 bước migration với thứ tự phụ thuộc rõ ràng.
**Tài liệu sau:** D07 — Đặc tả API (OpenAPI 3.1)