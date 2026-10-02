# D05 — Sơ đồ phân rã chức năng & Bản đồ module

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** ISO/IEC/IEEE 13223 (phân rã chức năng) · **Tài liệu trước:** D04 · **Tài liệu sau:** D06

---

## Phần 1 — Sơ đồ phân rã chức năng

### 1.1 Cây phân rã cấp 0

```
                    ┌───────────────────────────────┐
                    │   NỀN TẢNG SAAS               │
                    │   QUẢN LÝ PHẦN MỀM B2B        │
                    │   (Hệ thống được xây dựng)     │
                    └───────────────┬───────────────┘
                                    │
        ┌───────────────┬───────────┴─────┬───────────────┐
        ▼               ▼                 ▼               ▼
┌───────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  F1 QUẢN LÝ  │ │ F2 THƯƠNG    │ │ F3 KIỂM SOÁT │ │ F4 NỀN TẢNG │
│  KHÁCH HÀNG   │ │ MẠI          │ │ QUYỀN SỬ DỤNG│ │ KỸ THUẬT     │
│               │ │              │ │              │ │              │
│ F1.1 Hồ sơ   │ │ F2.1 Danh mục│ │ F3.1 Quyết   │ │ F4.1 Nhật ký│
│ F1.2 Xác thực │ │      sản phẩm│ │     định quyền│ │     kiểm toán│
│ F1.3 Thành viên│ │ F2.2 Định giá│ │ F3.2 Hạn mức │ │ F4.2 Giám sát│
│ F1.4 Kích hoạt│ │ F2.3 Hóa đơn │ │ F3.3 Phê duyệt│ │ F4.3 Sao lưu │
│               │ │ F2.4 Thanh toán│ │              │ │              │
└───────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 1.2 Cây phân rã cấp 2 (chi tiết đầy đủ)

```
F1 — QUẢN LÝ KHÁCH HÀNG
│
├── F1.1 HỒ SƠ DOANH NGHIỆP
│   ├── F1.1.1 Nộp hồ sơ (tên PL, MST, email, HĐ, người ĐD)
│   ├── F1.1.2 Kiểm tra tính hợp lệ (MST trùng, HĐ thiếu)
│   ├── F1.1.3 Duyệt / từ chối kèm lý do bắt buộc
│   ├── F1.1.4 Sửa đổi thông tin → hồ sơ chờ duyệt lại
│   └── F1.1.5 Huỷ hồ sơ
│
├── F1.2 XÁC THỰC
│   ├── F1.2.1 Đăng ký tài khoản người dùng trong tenant
│   ├── F1.2.2 Đăng nhập phiên web (email + mật khẩu)
│   ├── F1.2.3 Xác thực bằng PAT cho tích hợp máy
│   ├── F1.2.4 Quản lý vòng đời PAT (tạo, xem, thu hồi)
│   ├── F1.2.5 Khoá phiên khi đăng nhập sai nhiều lần
│   └── F1.2.6 Chống tự động đăng ký (Turnstile)
│
├── F1.3 THÀNH VIÊN & VAI TRÒ
│   ├── F1.3.1 Thêm / gỡ thành viên
│   ├── F1.3.2 Gán vai trò (Owner / Admin / Member)
│   ├── F1.3.3 Gán quyền cho thành viên
│   ├── F1.3.4 Chuyển quyền sở hữu (Owner)
│   └── F1.3.5 Xem danh sách thành viên
│
└── F1.4 KÍCH HOẠT MÁY
    ├── F1.4.1 Đăng ký máy (PAT + nhãn + địa chỉ)
    ├── F1.4.2 Kiểm tra số slot theo gói
    ├── F1.4.3 Xem danh sách máy đã kích hoạt
    ├── F1.4.4 Thu hồi / xóa slot máy
    └── F1.4.5 Xóa hàng loạt (có xác nhận)

F2 — THƯƠNG MẠI
│
├── F2.1 DANH MỤC SẢN PHẨM
│   ├── F2.1.1 Khai báo sản phẩm (mã, tên, loại giấy phép)
│   ├── F2.1.2 Khai báo tier (mã, tên, giá, chu kỳ)
│   ├── F2.1.3 Gán capability cho tier
│   ├── F2.1.4 Khai báo meter + đơn vị
│   ├── F2.1.5 Gán hạn mức meter cho tier
│   ├── F2.1.6 Cảnh báo giấy phép thương mại thiếu
│   └── F2.1.7 Kích hoạt / ngừng bán sản phẩm
│
├── F2.2 ĐỊNH GIÁ & CHIẾT KHẤU
│   ├── F2.2.1 Đặt giá theo tier
│   ├── F2.2.2 Chiết khấu theo số lượng / cam kết
│   └── F2.2.3 Xem bảng giá công khai
│
├── F2.3 HÓA ĐƠN
│   ├── F2.3.1 Tạo hóa đơn (chi tiết theo sản phẩm)
│   ├── F2.3.2 Áp dụng thuế
│   ├── F2.3.3 Xuất PDF
│   └── F2.3.4 Đối chiếu hóa đơn theo kỳ
│
├── F2.4 THANH TOÁN
│   ├── F2.4.1 Khởi tạo thanh toán (VNPay / Stripe)
│   ├── F2.4.2 Nhận & xác minh webhook
│   ├── F2.4.3 Xử lý thanh toán trùng lặp (idempotent)
│   └── F2.4.4 Gia hạn tự động
│
└── F2.5 QUẢN LÝ GIẤY PHÉP PHẦN MỀM
    ├── F2.5.1 Ghi nhận loại giấy phép
    ├── F2.5.2 Ghi nhận giấy phép thương mại của nhà cung cấp
    └── F2.5.3 Cảnh báo trước khi giấy phép hết hạn

F3 — KIỂM SOÁT QUYỀN SỬ DỤNG  (trái tim hệ thống)
│
├── F3.1 QUYẾT ĐỊNH QUYỀN
│   ├── F3.1.1 Xác thực PAT → tra tenant
│   ├── F3.1.2 Kiểm tra trạng thái tenant
│   ├── F3.1.3 Kiểm tra entitlement còn hiệu lực
│   ├── F3.1.4 Kiểm tra tier đủ chứa capability
│   ├── F3.1.5 Kiểm tra capability đã được cấp
│   ├── F3.1.6 Kiểm tra phê duyệt (nếu rủi ro cao)
│   ├── F3.1.7 Kiểm tra giấy phép phần mềm
│   ├── F3.1.8 Kiểm tra hạn mức meter
│   ├── F3.1.9 Trả quyết định + mã lý do + decision_id
│   └── F3.1.10 Ghi nhật ký quyết định (fail-closed)
│
├── F3.2 HẠN MỨC & ĐỊNH LƯỢNG
│   ├── F3.2.1 Ghi nhận tiêu thụ theo meter
│   ├── F3.2.2 Tính mức dùng theo kỳ
│   ├── F3.2.3 Cảnh báo khi chạm ngưỡng
│   ├── F3.2.4 Chặn cứng khi vượt hạn
│   └── F3.2.5 Đặt lại bộ đếm sang kỳ mới
│
└── F3.3 PHÊ DUYỆT QUYỀN RỦI RO CAO
    ├── F3.3.1 Nhận yêu cầu cấp quyền rủi ro cao
    ├── F3.3.2 Kiểm tra điều kiện bán (giấy phép)
    ├── F3.3.3 Duyệt kèm phiên bản điều khoản
    ├── F3.3.4 Từ chối kèm lý do đã khử nhạy cảm
    └── F3.3.5 Thu hồi quyền đã duyệt

F4 — NỀN TẢNG KỸ THUẬT
│
├── F4.1 NHẬT KÝ KIỂM TOÁN
│   ├── F4.1.1 Ghi thao tác quản trị
│   ├── F4.1.2 Ghi quyết định quyền
│   ├── F4.1.3 Truy vấn theo tenant / thời gian / tác nhân
│   └── F4.1.4 Bất biến: không sửa, không xoá
│
├── F4.2 GIÁM SÁT & CẢNH BÁO
│   ├── F4.2.1 Chỉ số hiệu năng API
│   ├── F4.2.2 Cảnh báo độ trễ
│   ├── F4.2.3 Cảnh báo tỉ lệ lỗi
│   └── F4.2.4 Cảnh báo doanh thu
│
└── F4.3 KHẢ DỤNG & DỰ PHÒNG
    ├── F4.3.1 Sao lưu tự động
    ├── F4.3.2 Kiểm tra khôi phục định kỳ
    ├── F4.3.3 Trình tự triển khai + quay lại
    └── F4.3.4 Định nghĩa SLO
```

### 1.3 Ánh xạ sang yêu cầu D02

| Hạng mục chức năng | User story | FR |
|---|---|---|
| F1.1 | US-001, 002 | FR-01 |
| F1.2 | US-003, 004, 005 | FR-01 |
| F1.3 | — | FR-01 |
| F1.4 | US-016 | FR-08 |
| F2.1 | US-010, 011 | FR-08 |
| F2.2 | — | FR-02 |
| F2.3, F2.4 | US-020, 021 | FR-07, FR-10 |
| F2.5 | — | FR-09 |
| F3.1 | US-012 | FR-02, FR-03 |
| F3.2 | US-015 | FR-05, FR-06 |
| F3.3 | US-014 | FR-09 |
| F4.1 | US-002, 013 | FR-04 |
| F4.2 | US-022 | FR-12 |

**Ba hạng mục chưa có user story:** F1.3 (thành viên), F2.2 (chiết khấu), F2.5 (giấy phép). Ghi nhận, xử lý ở D12.

---

## Phần 2 — Bản đồ module: cắt gì, giữ gì

### 2.1 Số liệu đo được

Đo ngày 2026-10-02 tại `packages/core/backend/src`:

| App | File | LOC | Migration | Test LOC | Phụ thuộc ra ngoài |
|---|---:|---:|---:|---:|---|
| `identity_access` | 113 | 19 466 | 28 | 6 631 | **7 app** |
| `commercial` | 24 | 2 593 | 7 | 222 | **3 app** |
| `tenant_lifecycle` | 12 | 488 | 1 | 146 | 2 app |
| `ops_audit` | 24 | 2 269 | 5 | 441 | 3 app |
| `service_ops` | 115 | 23 830 | 13 | 8 683 | 9 app |
| `user_workspace` | 110 | 22 828 | 23 | 9 401 | 8 app |
| `market_data` | 43 | 13 342 | 6 | 3 891 | 9 app |
| `signal_intelligence` | 41 | 6 483 | 5 | 1 399 | 6 app |
| `market_serving` | 26 | 4 584 | 7 | 570 | 6 app |
| `data_ingest` | 16 | 5 042 | 2 | 1 287 | 8 app |
| `advisory` | 28 | 3 420 | 12 | — | 6 app |
| `support` | 11 | 784 | 1 | — | 2 app |
| `advertising` | 13 | 924 | 2 | — | 2 app |
| `ai_analytics` | 10 | 344 | 1 | 102 | — |
| `ai_agents` | 11 | 277 | 2 | 93 | — |
| `vninvest_core` | 64 | 10 520 | — | 4 212 | 9 app |
| **Tổng** | **663** | **117 327** | **117** | **41 032** | |

### 2.2 Phát hiện quyết định

#### Vòng phụ thuộc lẫn nhau

```
identity_access  ⇄  commercial
        ↕                ↕
tenant_lifecycle ────────┘
```

Cả hai ứng dụng cốt lõi phụ thuộc lẫn nhau. **Không thể cắt rời một trong hai.**

#### Chỉ 6 file trong `identity_access` chạm app ngoài

| File | Số import ra ngoài | Tính chất |
|---|---:|---|
| `register.py` | 2 | Đăng ký — liên quan nghiệp vụ khách mới |
| `middleware.py` | 1 | Hạn mức request |
| `models.py` | 1 | Có thể chỉ là enum trạng thái |
| `password_reset.py` | 1 | Gửi email |
| `test_dnse_credential_integration.py` | 1 | Kiểm thử tích hợp |
| `test_dnse_credential.py` | 1 | Kiểm thử |
| `test_email_tasks.py` | 1 | Kiểm thử |
| `test_register_upgrade.py` | 1 | Kiểm thử |

⇒ **4/8 là file kiểm thử** — không ảnh hưởng mã chạy thật. Phần mã thực sự chạm app ngoài chỉ có **4 file**.

#### `vninvest_core` không sạch

`settings.py` import trực tiếp `signal_intelligence`, `identity_access`; `urls.py` import `advisory`, `consumers`. Cần rà soát khi cắt.

### 2.3 Quyết định cắt

| App | Quyết định | Lý do |
|---|---|---|
| `identity_access` | **GIỮ** | Xác thực, PAT, tenant, thành viên — cốt lõi |
| `commercial` | **GIỮ + SỬA** | Subscription, quota, invoice, VNPay, Stripe |
| `tenant_lifecycle` | **GIỮ** | Rẻ (488 LOC), `commercial` phụ thuộc |
| `ops_audit` | **GIỮ** | Nhật ký kiểm toán là yêu cầu FR-04 |
| `vninvest_core` | **RÀ SOÁT** | Có import trực tiếp module miền tài chính |
| `user_workspace` | **CẮT** | Portfolio, watchlist — thuộc miền tài chính |
| `market_data` | **CẮT** | Thu thập dữ liệu thị trường — không thuộc SaaS quản lý phần mềm |
| `market_serving` | **CẮT** | Phục vụ dữ liệu thị trường |
| `signal_intelligence` | **CẮT** | Tín hiệu giao dịch |
| `data_ingest` | **CẮT** | Nạp dữ liệu |
| `service_ops` | **CẮT** | Tác vụ nền thị trường |
| `advisory` | **CẮT** | Tư vấn AI — ngoài phạm vi, cần giấy phép riêng |
| `support` | **TÙY** | Có thể giữ lại nhỏ (784 LOC) hoặc dùng dịch vụ ngoài |
| `advertising` | **CẮT** | Ngoài phạm vi |
| `ai_analytics` | **CẮT** | Ngoài phạm vi |
| `ai_agents` | **CẮT** | Ngoài phạm vi |

### 2.4 Cân bằng LOC

| Kịch bản | App giữ | File | LOC | Test LOC |
|---|---:|---:|---:|---:|
| **Tối thiểu** | 4 + `vninvest_core` | ~237 | ~35 336 | ~11 650 |
| **Thận trọng** (+`support`) | 5 + `vninvest_core` | ~248 | ~36 120 | ~11 650 |
| **Đầy đủ** (+`service_ops`) | 6 + `vninvest_core` | ~363 | ~59 166 | ~20 333 |

**Khuyến nghị: kịch bản tối thiểu.**

| Lý do | Giải thích |
|---|---|
| Giảm 70% LOC | 117 327 → 35 336 |
| Giữ lại đường liên bảo mật trưởng thành | PAT, tenant, billing, audit đã chạy thật |
| Tách khỏi miền tài chính hoàn toàn | Không còn rủi ro giấy phép từ `advisory` |
| `service_ops` 23 830 LOC + 9 phụ thuộc | Không đáng giữ vì chỉ dùng cho nền tảng kỹ thuật |
| Ước lượng công sức | ~6–10 ngày công cho việc cắt + rà soát |

**Sau khi cắt, 5 app còn lại:**

```
identity_access  (19 466 LOC)  ← giữ
commercial       ( 2 593 LOC)  ← giữ + sửa
tenant_lifecycle (   488 LOC)  ← giữ
ops_audit        ( 2 269 LOC)  ← giữ
vninvest_core    (10 520 LOC)  ← rà soát
                 ─────────────
                 ~35 336 LOC   (từ 117 327 → giảm 70%)
```

### 2.5 Bốn tập tin phải sửa sau khi cắt

| # | Vị trí | Việc | Vì sao |
|---|---|---|---|
| 1 | `identity_access/models.py` | Gỡ import app đã cắt | Còn import 1 app ngoài |
| 2 | `identity_access/middleware.py` | Generalize hạn mức theo meter | Đang gắn cứng theo cách tính cũ |
| 3 | `identity_access/register.py` | Gỡ phần phụ thuộc đã cắt | 2 import ra ngoài |
| 4 | `vninvest_core/settings.py`, `urls.py` | Gỡ URL và app đã cắt | Import trực tiếp module miền |

### 2.6 Những gì KHÔNG được cắt

| Giữ vì | Mục đích |
|---|---|
| `CORE_PAT_PEPPER` cơ chế | Bắt buộc hợp lệ ở production — `settings.py` raise `ImproperlyConfigured` nếu thiếu |
| Cấu hình cứng về `ALLOWED_HOSTS` | Từ chối chạy production nếu còn ký tự đại diện |
| Cấu hình cứng về `SECRET_KEY` | Từ chối chạy production nếu còn giá trị mặc định |
| Tên lạc cơ `CoreTenant`, `CorePATCredential` | Giữ nguyên tên để dễ đối chiếu với mã gốc |
| Migration `identity_access/9000_auth_user_email_ci_unique.py` | Dùng `array_agg` của PostgreSQL — bắt buộc PostgreSQL |

---

## Phần 3 — Bản đồ phụ thuộc sau khi cắt

```
                    ┌──────────────────┐
                    │  vninvest_core   │
                    │  settings · urls │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼─────────┐  ┌───────▼────────┐
│identity_access │  │   commercial     │  │ ops_audit      │
│  19 466 LOC    │  │   2 593 LOC      │  │  2 269 LOC     │
│                │  │                  │  │                 │
│ CoreTenant     │  │ Subscription     │  │ AuditLog        │
│ CoreUser       │  │ QuotaHistory     │  │ (chỉ ghi)       │
│ TenantMember   │  │ Invoice          │  └─────────────────┘
│ CorePATCred.   │  │ PaymentTxn       │
│ (19 466 LOC)   │  │ VNPay · Stripe   │
└───────┬────────┘  └────────┬─────────┘
        │                    │
        └─────────┬──────────┘
                  │
        ┌─────────▼─────────┐
        │ tenant_lifecycle  │
        │    488 LOC        │
        └───────────────────┘
```

**Mục tiêu:** không có mũi tên nào ra ngoài cụm 5 app này. Đó là điều kiện để tách thành repo độc lập.

### 3.1 App mới cần thêm

Ba mô hình nghiệp vụ chưa có bảng:

| Module mới | Chức năng | Nguồn tái dùng |
|---|---|---|
| `catalog` | Product · Tier · Capability · Meter | Mới — `vninvest` là single-product |
| `entitlement` | Quyết định quyền · Hồ sơ duyệt | Mới — không có khái niệm capability |
| `license` | Giấy phép phần mềm · Điều kiện bán | Mới |

**Phát hiện quan trọng:** không có khái niệm "sản phẩm" trong `vninvest`. Đây không phải việc cắt bỏ mà là việc **xây mới**.

---

## Phần 4 — Kế hoạch triển khai mô hình nghiệp vụ

### 4.1 Giai đoạn 1 — Cắt và ổn định

| Bước | Việc | Đầu ra | Tiêu chí hoàn thành |
|---|---|---|---|
| 1.1 | Tạo nhánh cắt | Repo còn 5 app | Ứng dụng khởi động được |
| 1.2 | Gỡ URL đã cắt khỏi `urls.py` | Không còn tham chiếu | Kiểm thử chạy pass |
| 1.3 | Gỡ app khỏi `INSTALLED_APPS` | Danh sách app gọn | `manage.py check` pass |
| 1.4 | Gỡ migration của app đã cắt | Lịch sử migration sạch | Migration áp dụng được trên PostgreSQL |
| 1.5 | Gỡ import còn sót | Không còn import app đã cắt | Kiểm tra phụ thuộc pass |
| 1.6 | Rà soát bảo mật phần kế thừa | Báo cáo | Không còn lỗi nghiêm trọng |

### 4.2 Giai đoạn 2 — Sửa nợ kỹ thuật

| Bước | Việc | Vị trí | Tiêu chí |
|---|---|---|---|
| 2.1 | `Subscription.tenant` → `ForeignKey` | `commercial/models.py:18` | Một tenant có nhiều entitlement |
| 2.2 | Thêm chiều sản phẩm | `commercial/models.py` | Entitlement gắn 1 sản phẩm |
| 2.3 | Bỏ 8 cột cứng của quota | `commercial/models.py:43-50` | Chỉ còn `QuotaHistory` |
| 2.4 | Chuyển bản đồ tính năng ra bảng | `identity_access/views_webhooks.py:196-201` | Không còn hardcode |

### 4.3 Giai đoạn 3 — Xây mô hình đa sản phẩm

| Bước | Việc | Phụ thuộc |
|---|---|---|
| 3.1 | Tạo bảng `Product`, `Tier` | — |
| 3.2 | Tạo bảng `Capability`, `Meter` | 3.1 |
| 3.3 | Tạo bảng `Entitlement` | 3.1 |
| 3.4 | Tạo bảng `CapabilityGrant` | 3.3 |
| 3.5 | Tạo bảng `UsageRecord` | 3.2 |
| 3.6 | Viết quyết định quyền | 3.4, 3.5 |
| 3.7 | Viết cache quyền kèm vô hiệu hoá tức thời | 3.6 |

### 4.4 Thứ tự bắt buộc

> **Không được viết quyết định quyền trước khi có bảng `Entitlement`.**
> **Không được bật cache trước khi có cơ chế vô hiệu hoá đồng thời.**
> **Không được bán sản phẩm thứ hai trước khi có chiều sản phẩm trong `Subscription`.**

Ba quy tắc này suy ra từ lỗi đã gặp thật, không phải lý thuyết.

---

**Cổng chất lượng:** QG-3 — 15 nhóm chức năng phân rã đến cấp 2 · 16 app đã quyết định cắt/giữ · 4 tập tin phải sửa đã định danh.
**Kết quả chính:** cắt từ 117 327 LOC xuống ~35 336 LOC (giảm 70%), giữ toàn bộ đường liên bảo mật và thanh toán.
**Tài liệu sau:** D06 — Sơ đồ quan hệ dữ liệu (ERD)