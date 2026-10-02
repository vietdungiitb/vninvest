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

> **Đã xác minh 2026-10-02.** Danh sách dưới đây là kết quả đọc mã thật, không còn là suy luận.

| # | Vị trí | Việc | Bằng chứng |
|---|---|---|---|
| 1 | `identity_access/models.py` | Gỡ import app đã cắt | 1 import ra ngoài |
| 2 | `identity_access/middleware.py` | **Generalize hạn mức theo meter** | `:488, :518` — chỉ đọc `QuotaRecord` |
| 3 | `identity_access/register.py` | Gỡ phần phụ thuộc đã cắt | 2 import ra ngoài |
| 4 | `vninvest_core/settings.py`, `urls.py` | Gỡ URL và app đã cắt | Import trực tiếp module miền |

---

## 2.6 Kết quả xác minh 5 mục còn treo

> Bổ sung 2026-10-02. Trước đây các mục này là suy luận; giờ đã đọc mã thật.

### I-01 — `TenantQuotaMiddleware` đọc gì

**Vị trí:** `identity_access/middleware.py:323-534`

| Nội dung | Vị trí |
|---|---|
| Lớp `TenantQuotaMiddleware` | `:323` |
| Danh sách đường miễn phí | `:326-336` |
| TTL bộ đếm Redis = 48 giờ | `:339` |
| Bỏ qua superuser | `:366-367` |
| Đếm ngày + đếm tháng | `:382-383` |
| So với `api_calls_limit` | `:396` |
| Nhánh enterprise cho qua + cảnh báo | `:404-409` |
| Đọc hạn mức (fallback) | `:485-513` — `QuotaRecord:488,502,511` |
| Đọc hạn mức (chính) | `:515-534` — `QuotaRecord:518,522,531` |

**Kết luận quan trọng:** middleware **chỉ đọc `QuotaRecord`**, cụ thể là trường `api_calls_limit`. **Không đọc `QuotaHistory`.**

⇒ Khi bỏ 8 cột cứng của `QuotaRecord` theo D06 §6, **middleware sẽ hỏng**. Đây là phụ thuộc bắt buộc phải sửa cùng lúc, không phải việc làm sau.

**Ba vấn đề thiết kế phát hiện được:**

| # | Vấn đề | Vị trí | Tác động |
|---|---|---|---|
| Q-1 | Chỉ có một hạn mức (`api_calls`), không nhiều meter | `:511, :531` | Không mở rộng được sang hạn mức theo loại sản phẩm |
| Q-2 | `QuotaRecord` lấy theo `period_start__lte / period_end__gte` rồi `.first()` | `:504-508` | Nhiều bản ghi chồng nhau → lấy sai bản ghi |
| Q-3 | Nhánh enterprise cho qua khi vượt hạn | `:404-409` | Trả 200 khi đã vượt — trái với AC-023.6 và FR-06 |

> **Q-3 là mâu thuẫn với thiết kế mới.** D01 FR-06 yêu cầu chặn cứng khi vượt hạn. Nhưng mã hiện tại cho `enterprise` đi tiếp và chỉ gắn header cảnh báo. Cần chốt: giữ hành vi cảnh báo mềm, hay chuyển sang chặn cứng? Đây là quyết định chưa có trong bộ hồ sơ.

### I-02 — `features_map` thật ở đâu

**Phát hiện lỗi trích dẫn trong chính bộ hồ sơ này.**

Bản nháp trước đây trích `features_map` tại `views_webhooks.py:196-201`, dựa trên comment ở `commercial/plan_catalog.py:52`. Đọc thật thì:

| Nguồn | Nội dung |
|---|---|
| `commercial/plan_catalog.py:52` | Comment ghi `views_webhooks.py:196-201` — **sai** |
| `commercial/plan_catalog.py:11` | Cũng ghi `:196` — **sai** |
| `identity_access/views_webhooks.py:240-245` | **Nơi thật** |

⇒ **Comment trong `plan_catalog.py` sai cả hai lần.** Vì sao: file `views_webhooks.py` đã bị thêm/bớt dòng nhiều lần, comment không cập nhật theo.

**Nội dung thật tại `:240-245`:**

```python
features_map = {
    'free':       {'api_calls': 1000,   'members': 3,  'sso': False, 'webhooks': False, 'audit_days': 7},
    'starter':    {'api_calls': 10000,  'members': 5,  'sso': False, 'webhooks': False, 'audit_days': 7},
    'pro':        {'api_calls': 50000,  'members': 25, 'sso': True,  'webhooks': True,  'audit_days': 30},
    'enterprise': {'api_calls': None,    'members': None,'sso': True,  'webhooks': True,  'audit_days': 90},
}
```

**Phân tích:**

| # | Vấn đề | Tác động |
|---|---|---|
| F-1 | Chỉ có 4 plan, thiếu `custom` và `internal` | `:247-248` rơi về mặc định `free`/`pro` — **sai số** cho 2 plan đó |
| F-2 | Cứng trong thân hàm xử lý | Muốn thêm sản phẩm/tier phải sửa mã |
| F-3 | Nằm trong module `identity_access` | Vi phạm chính quy tắc ở D04 §8 — backend không nên biết tên sản phẩm |
| F-4 | `prorated_amount: 0` cố định | `:259-260` — chưa tính tiền khi đổi gói giữa kỳ. Đây chính là Q-08 trong D02 |

⇒ Xác nhận nợ kỹ thuật **D-03** là có thật, và mức độ nặng hơn đánh giá ban đầu: có **lỗi số liệu** chứ không chỉ khó mở rộng.

### I-03 — `commercial/tasks.py` phụ thuộc gì

**Vị trí:** `commercial/tasks.py` — 35 KB

| Nhập vào | Số lần | Đã cắt? |
|---|---:|---|
| `commercial` (nội bộ) | 4 | Giữ |
| `django` | 4 | — |
| `identity_access` | 3 | Giữ |
| `tenant_lifecycle` | 2 | Giữ |
| `celery` | 1 | — |
| `datetime`, `decimal`, `__future__` | 3 | — |

⇒ **Không phụ thuộc app nào sẽ bị cắt.** Đây là kết quả tốt nhất trong 5 mục — `tasks.py` có thể giữ nguyên.

**7 tác vụ nền đã có sẵn** — khớp với D11 §11:

| Tác vụ | Dòng | Đáp ứng tác vụ nền nào trong D11 |
|---|---:|---|
| `flush_quota_counters` | `:143` | Ghi số liệu định lượng theo lô |
| `generate_monthly_invoices` | `:218` | Đối soát / báo cáo doanh thu |
| `check_overdue_invoices` | `:254` | Kiểm tra chứng từ |
| `send_quota_warning` | `:291` | Gửi cảnh báo hạn mức |
| `manage_subscriptions_lifecycle` | `:373` | Dọn entitlement hết hạn |
| `snapshot_quota_history` | `:457` | Chốt số liệu định lượng |
| `check_usage_thresholds` | `:570` | Cảnh báo ngưỡng 80/95 |
| `backfill_quota_entitlements` | `:757` | Nhập dữ liệu quota lịch sử |

⇒ **D11 §11 có thể rút từ 8 tác vụ xuống 3 tác vụ mới:** cảnh báo hết hạn (chưa có), dọn phiên hết hạn (chưa có), dọn kích hoạt cũ (chưa có).

### I-04 — Adapter có hardcode endpoint không

**Kết quả: KHÔNG. Đây là tin tốt.**

| Vị trí | Nội dung |
|---|---|
| `packages/web/src/adapters/core/coreAdapter.js:8` | `resolveCoreBaseUrl(env)` — đọc từ biến môi trường |
| `:12-13` | `resolvePortfolioApiBaseUrl` — đọc `REACT_APP_API_BASE_URL` / `VNINVEST_API_BASE_URL`, mặc định `/api` |
| `:95` | Xuất hàm ra ngoài |
| `:101` | `baseUrl: resolveCoreBaseUrl(env)` |
| `:105` | `${baseUrl}/access/capabilities` |
| `:108` | `${baseUrl}/auth/me` |
| `:111` | `${baseUrl}/health` |
| `:115, :126` | Dựng URL từ `coreBase` |
| `packages/web/src/adapters/core/transport.js:54` | Ưu tiên `CORE_API_BASE_URL` |
| `packages/web/src/adapters/core/dnse.js:4,8,12` | Đường dẫn tương đối `/api/core/v1/dnse-credential/` |

⇒ **Không có URL tuyệt đối nào bị hardcode.** Tất cả đi qua biến môi trường, mặc định là đường dẫn tương đối. Chuyển sang SaaS mới **không cần sửa adapter**.

**Ghi chú:** `coreAdapter.js:105` dùng `/access/capabilities` — cần kiểm tra xem khớp với cổng quyền mới trong D07 không. Hiện D07 thiết kế `/api/v1/entitlements/verify`. Nếu giữ tên `capabilities` thì giảm bớt công đổi tên, nhưng phải cập nhật D07.

**Chưa xác minh:** nội dung hàm `resolveCoreBaseUrl` (đọc 8 dòng đầu chưa đủ). Ghi nhận là việc cần làm.

### I-05 — 57 route thuộc miền nào

**Vị trí:** `packages/web/src/app/routeCatalog.js` — 16 192 byte, `Object.freeze` tại `:5`, 57 route dùng `id`/`path`/`titleKey`.

| Nhóm | Số route | Miền |
|---|---:|---|
| `tenant-*` | 18 | Quản trị tenant |
| `admin-*` | 14 | Quản trị vận hành |
| `auth-*` | 4 | Xác thực |
| `commercial-*` | 2 | Thương mại |
| `operations-*` | 2 | Vận hành |
| `ai-*` | 4 | AI · **cắt** |
| `core-*` | 1 | Lõi |
| `upgrade-*` | 1 | Nâng cấp |
| `support-*` | 1 | Hỗ trợ |
| `vip-*` | 1 | · **cắt** |
| `transactions-*` | 1 | Giao dịch · **cắt** |
| `settings-*` | 1 | Cài đặt |
| `portfolios-*` | 1 | Danh mục · **cắt** |
| `watchlist-*` | 1 | Theo dõi · **cắt** |
| `dashboard-*` | 1 | Bảng điều khiển |
| `alert-*` | 1 | Cảnh báo |
| `advertising-*` | 1 | Quảng cáo · **cắt** |
| `screener-*` | 1 | Bộ lọc · **cắt** |
| `whale-*` | 1 | Tín hiệu · **cắt** |

**Kết luận:**

| Loại | Số route |
|---|---:|
| **Giữ lại** | 48 |
| **Cắt** | 9 |

⇒ Phía giao diện **nhẹ hơn nhiều** so với phía máy chủ. Chỉ 9/57 route thuộc miền tài chính.

**Ước lượng sửa:** bỏ 9 route + mục điều hướng · ≈ 1–2 ngày công, thấp hơn nhiều so với cắt 82 app Python.

**Chưa xác minh:** nội dung cụ thể từng route `tenant-*` và `admin-*` — có route nào lẫn miền tài chính không. Ghi nhận là việc cần làm.

### 2.7 Điều chỉnh kế hoạch sau xác minh

| Hạng mục | Trước xác minh | Sau xác minh |
|---|---|---|
| Tập tin cần sửa phía máy chủ | 4 (ước lượng) | **4 (đã xác nhận)** |
| Phụ thuộc cụt chặn | Không biết | **`QuotaRecord` là cụt chặn với middleware** |
| `commercial/tasks.py` | Nghi ngờ phụ thuộc | **Sạch — giữ nguyên** |
| Adapter giao diện | Nghi ngờ hardcode | **Sạch — không sửa** |
| Route cần cắt | Không biết | **9 / 57** |
| Trích dẫn `features_map` | `:196-201` | **`:240-245` — bản nháp sai** |

**Ước lượng cắt sau xác minh**

| Kịch bản | Trước | Sau |
|---|---|---:|
| Tối thiểu (máy chủ) | 6–10 ngày | **5–8 ngày** |
| Cộng giao diện | chưa tính | **+1–2 ngày** |

Không giảm nhiều, nhưng **rủi ro đã giảm mạnh** vì `tasks.py` và adapter đều sạch, và đã biết chính xác điểm cụt chặn.

### 2.8 Câu hỏi mới phát sinh sau xác minh

| # | Câu hỏi | Vì sao |
|---|---|---|
| NQ-01 | Doanh nghiệp vượt hạn thì chặn cứng hay chỉ cảnh báo? | `middleware.py:404-409` cho qua, FR-06 yêu cầu chặn |
| NQ-02 | `custom` và `internal` có giá trị hạn mức không? | `:247-248` rơi về mặc định — đang sai |
| NQ-03 | Giữ tên cổng `/access/capabilities` hay đổi theo D07? | `coreAdapter.js:105` |
| NQ-04 | Q-08 (tính tiền khi đổi gói giữa kỳ) xử lý khi nào? | `:259-260` đang trả 0 |

---

## 2.9 Những gì KHÔNG được cắt

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