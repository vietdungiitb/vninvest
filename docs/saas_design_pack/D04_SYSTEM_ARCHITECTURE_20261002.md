# D04 — Kiến trúc hệ thống & Quyết định kiến trúc

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Mô hình:** C4 Model · **Chuẩn:** ISO/IEC 25010 · **Tài liệu sau:** D05

---

# PHẦN A — QUYẾT ĐỊNH KIẾN TRÚC (ADR)

## ADR-001 — Tái sử dụng codebase `vninvest` thay vì viết mới

**Trạng thái:** Đề xuất · **Ngày:** 2026-10-02

**Bối cảnh**
Repo `vninvest` đã có hệ thống SaaS multi-tenant hoàn chỉnh: 663 file Python / 117 327 LOC, gồm `identity_access` (PAT, tenant, thành viên), `commercial` (subscription, quota, invoice, VNPay, Stripe), `ops_audit`, `tenant_lifecycle`. Có 41 032 LOC kiểm thử.

**Quyết định**
Cắt từ `vninvest`, không viết mới từ đầu.

**Lý do**

| Tiêu chí | Cắt từ vninvest | Viết mới |
|---|---|---|
| Thời gian ra thị trường | Nhanh | Chậm |
| Billing VNPay/Stripe + webhook IPN | Đã có, đã kiểm thử | Phải viết lại + kiểm thử lại |
| Xác thực PAT + hạt pepper | Đã có | Phải viết lại |
| Nợ kỹ thuật kế thừa | Có | Không |
| Rủi ro bảo mật kế thừa | Cần rà soát | Tự kiểm soát |

**Hệ quả**
- Chấp nhận nợ kỹ thuật, đổi lấy tiết kiệm 3–4 tháng công sức
- **Bắt buộc** phải rà soát bảo mật phần kế thừa — không giả định "đã chạy được là an toàn"
- Bắt buộc phải xử lý P0-SEC-01 (secret trong kho mã) trước khi đẩy lên remote

**Phương án bị loại**
- *Viết mới:* tốn công viết lại billing/PAT đã hoạt động
- *Dùng nguyên `vninvest`:* không đáp ứng mô hình đa sản phẩm, kéo theo toàn bộ miền tài chính

---

## ADR-002 — Cơ sở dữ liệu dùng chung với ràng buộc tenant, không tách DB mỗi khách

**Trạng thái:** Đề xuất

**Quyết định**
Một cơ sở dữ liệu PostgreSQL chung. Mọi bảng nghiệp vụ có `tenant_id`. Truy vấn luôn lọc theo tenant.

**Lý do**

| Tiêu chí | DB chung | DB riêng mỗi khách |
|---|---|---|
| Chi phí vận hành | Thấp | Cao (1 000 DB) |
| Độ trễ kết nối | Thấp | Trung bình |
| Truy vấn xuyên tenant (đối soát, thống kê) | Dễ | Rất khó |
| Khả năng rò rỉ dữ liệu | **Rủi ro cao hơn** | Thấp hơn |

**Đánh đổi được chấp nhận**
Rủi ro rò rỉ dữ liệu giảm bằng: bắt buộc `tenant_id` ở mọi bảng nghiệp vụ · kiểm thử chéo tenant bắt buộc mỗi release · kiểm thử tự động phát hiện truy vấn thiếu lọc tenant.

**Phương án bị loại**
*DB riêng mỗi khách:* không khả thi ở quy mô ≥ 1 000 tenant với nhân lực hiện có.

---

## ADR-003 — Ràng buộc tenant ở tầng truy vấn, không chỉ ở tầng ứng dụng

**Trạng thái:** Đề xuất

**Vấn đề**
Chỉ lọc tenant trong view là **không đủ**. Một truy vấn viết mới hoặc một câu lệnh quản trị có thể vô tình bỏ sót — và đây là loại lỗi không tự lộ ra cho tới khi xảy ra sự cố dữ liệu.

**Quyết định**
1. Bắt buộc `tenant_id` ở **mọi** bảng nghiệp vụ
2. Manager/truy vấn mặc định đã lọc tenant
3. Bộ lọc tenant áp dụng **tự động**, không tuỳ chọn
4. Truy vấn không lọc phải khai báo tường minh và được ghi log cảnh báo
5. Kiểm thử tự động mỗi release phải phát hiện được truy vấn không lọc tenant

**Hệ quả**
Mọi truy vấn tổng hợp xuyên tenant (báo cáo doanh thu cho nhà cung cấp) phải đi qua đường dẫn riêng, được kiểm toán.

---

## ADR-004 — Cache quyền kèm vô hiệu hoá tức thời

**Trạng thái:** Đề xuất

**Vấn đề**
Quyết định quyền cần ≤ 50 ms — không thể đọc cơ sở dữ liệu mỗi lần. Nhưng cache tạo ra khoảng thời gian mà quyền đã thu hồi vẫn còn hiệu lực.

**Quyết định**
Cache có thời hạn ngắn, và **mọi thao tác thay đổi quyền phải vô hiệu hoá cache đồng thời** trong cùng giao dịch.

**Nguyên tắc:** Không để trạng thái phân kỳ giữa cơ sở dữ liệu và cache.

**Hệ quả**
- Bước thu hồi phải là giao dịch bao gồm: cập nhật cơ sở dữ liệu + phát tín hiệu vô hiệu hoá cache
- Nếu không làm được, hệ thống **không được** dùng cache
- Kiểm thử bắt buộc TC-ENT-09 (thu hồi → gọi lại ngay → phải bị từ chối)

---

## ADR-005 — Cấp quyền theo `capability` dạng chuỗi, không dùng `Enum`

**Trạng thái:** Đề xuất

**Quyết định**
Tên tính năng là chuỗi trong cơ sở dữ liệu (`brokerage.place_order`), không phải hằng số trong mã.

**Lý do**
Nếu dùng `Enum` trong mã, mỗi tính năng mới phải sửa mã và triển khai lại. Điều này phá vỡ mục tiêu "thêm sản phẩm mà không cần triển khai".

**Hệ quả**
- Mất kiểm tra kiểu lúc biên dịch — đánh đổi lấy khả năng mở rộng
- Bù lại bằng: ràng buộc `code` theo mẫu `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`
- Tham chiếu chéo tính năng phải được kiểm thử

---

## ADR-006 — Không tách thư viện, kiểm soát quyền ở tầng dịch vụ

**Trạng thái:** Đã phân tích · **Nguồn:** `SAAS_PLATFORM_DESIGN_20261002.md` §QĐ-1

**Quyết định**
Giao thư viện cho khách nguyên trạng. Kiểm soát quyền lúc chạy bằng quyết định entitlement từ dịch vụ.

**Lý do**
Gỡ khả năng đặt lệnh khỏi thư viện **không làm giảm rủi ro pháp lý**. Rủi ro nằm ở việc *có cấp quyền hay không*, không nằm ở việc mã có mặt trong gói hay không. Còn phương án tách thì tốn công sửa 8 file + tách 1 file, và vẫn không thu được lợi ích pháp lý tương ứng.

**Phát hiện hỗ trợ**
Thư viện `vnbroker` đã có module `brokerage` với chú thích *"bypass Gateway/PAT entirely… No vninvest SaaS dependency"* (`vnbroker/brokerage/base.py:1-9`) — tác giả đã tách sẵn lớp brokerage khỏi phụ thuộc dịch vụ.

**Hệ quả**
Khách kỹ thuật có thể bỏ qua kiểm tra quyền. Giảm thiểu bằng giấy phép phía máy khách (chữ ký số), không phải bằng việc làm mã khó sao chép.

---

# PHẦN B — KIẾN TRÚC HỆ THỐNG

## B.1 Mức C1 — Bối cảnh hệ thống

```
                    ┌──────────────────────────────┐
                    │   Khách hàng doanh nghiệp    │
                    │   (pháp nhân)                 │
                    └───────┬──────────────┬───────┘
                            │              │
              (1) Trình      │              │ (2) Mã nguồn sản phẩm
              duyệt quản trị│              │      của nhà cung cấp
                            ▼              ▼
        ┌────────────────────────────────────┐
        │      NỀN TẢNG SAAS QUẢN LÝ         │
        │      PHẦN MỀM                       │
        │                                     │
        │  • Cấp quyền                        │
        │  • Định lượng                       │
        │  • Thanh toán                        │
        │  • Kích hoạt                         │
        │  • Nhật ký kiểm toán                │
        │                                     │
        │  ★ KHÔNG thực hiện giao dịch       │
        │  ★ KHÔNG nắm giữ tài sản            │
        │  ★ KHÔNG thực thi lệnh              │
        └────────────────────────────────────┘
                            │
                            │ (3) API quyết định quyền
                            │     (điểm vào duy nhất
                            │      của tích hợp)
                            ▼
        ┌────────────────────────────────────┐
        │   Hệ thống của khách hàng           │
        │   (chạy tại hạ tầng khách)          │
        │                                     │
        │  • Ứng dụng khách tích hợp SDK     │
        │  • Phần mềm của nhà cung cấp        │
        │  • Dữ liệu của khách                │
        │                                     │
        │  ★ GIỮ CREDENTIAL BROKER            │
        │  ★ GIỮ TOÀN BỘ DỮ LIỆU             │
        └────────────────────────────────────┘

   Không tồn tại luồng: khách hàng → dịch vụ → thị trường tài chính
```

**Điểm kiến trúc quan trọng nhất:** Dịch vụ **không** có đường ra thị trường tài chính. Nó chỉ trả lời "khách có quyền không". Toàn bộ phần thực thi nằm ở hạ tầng khách.

---

## B.2 Mức C2 — Hệ thống chứa thành phần nào

```
┌─────────────────────────────────────────────────────────────────┐
│                      SÀN DỊCH VỤ (SaaS)                          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Cổng      │  │  Cổng quản │  │  Cổng quyết│  │  Cổng      │ │
│  │  đăng ký   │  │  trị sản   │  │  định quyền│  │  thanh toán│ │
│  │            │  │  phẩm      │  │  (nội bộ)  │  │            │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │
│        │               │               │               │        │
│  ┌─────▼───────────────▼───────────────▼───────────────▼─────┐  │
│  │                   TẦNG ỨNG DỤNG                           │  │
│  │   Đăng ký · Xác thực · Quyền · Định lượng · Thanh toán   │  │
│  │   Kích hoạt · Sản phẩm · Nhật ký kiểm toán               │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │              TẦNG MIỀN (nghiệp vụ)                         │  │
│  │  identity_access · commercial · entitlement · quota        │  │
│  │  activation · catalog · audit · license                  │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │          TẦNG TRUY CẬP DỮ LIỆU                            │  │
│  │  Bộ lọc tenant (bắt buộc) · Truy vấn đặc biệt có kiểm toán│  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼──────────────┐  ┌────────────┐  │
│  │   PostgreSQL (chung, ràng buộc tenant)     │  │ Redis      │  │
│  └───────────────────────────────────────────┘  │ (cache     │  │
│                                                  │  quyền)    │  │
│  ┌───────────────────────────────────────────┐  └────────────┘  │
│  │   Hàng đợi tác vụ nền                      │                 │
│  └───────────────────────────────────────────┘                 │
│                                                                  │
│  ┌───────────────────────────────────────────┐                 │
│  │   Kho kiểm toán (chỉ ghi, không sửa/xoá)   │                 │
│  └───────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Danh mục thành phần

| # | Thành phần | Trách nhiệm | Có chạy vận hành? |
|---|---|---|---|
| 1 | Cổng đăng ký | Nộp hồ sơ tenant | Theo đợt |
| 2 | Cổng quản trị sản phẩm | Khai báo product/tier/capability | Theo đợt |
| 3 | Cổng quyết định quyền | Trả quyết định + ghi vết | **Liên tục** |
| 4 | Cổng thanh toán | Nhận webhook | Theo đợt |
| 5 | Tầng ứng dụng | Điều phối | — |
| 6 | Tầng miền | Quy tắc nghiệp vụ | — |
| 7 | Tầng truy cập dữ liệu | Ràng buộc tenant | — |
| 8 | PostgreSQL | Lưu trữ | — |
| 9 | Redis | Cache quyền | — |
| 10 | Hàng đợi | Tác vụ nền | — |
| 11 | Kho kiểm toán | Vết chứng minh | — |

---

## B.3 Mức C3 — Thành phần bên trong tầng miền

```
┌──────────────────┬───────────────────────────────────────────┐
│ Module           │ Trách nhiệm                               │
├──────────────────┼───────────────────────────────────────────┤
│ identity_access  │ Tenant · Người dùng · Thành viên · PAT    │
│                  │ Xác thực · Khoá phiên                      │
├──────────────────┼───────────────────────────────────────────┤
│ catalog          │ Product · Tier · Capability · Meter       │
│                  │ Nguồn sự thật cho "bán được gì"            │
├──────────────────┼───────────────────────────────────────────┤
│ entitlement      │ Quyết định quyền · Hồ sơ duyệt capability  │
│                  │ Đây là trách tim của hệ thống               │
├──────────────────┼───────────────────────────────────────────┤
│ quota            │ Meter · Hạn mức · Tiêu thụ · Ngưỡng       │
├──────────────────┼───────────────────────────────────────────┤
│ commercial       │ Hóa đơn · Thanh toán · Chu kỳ · Gia hạn    │
├──────────────────┼───────────────────────────────────────────┤
│ activation       │ Slot máy · Gán nhãn · Thu hồi             │
├──────────────────┼───────────────────────────────────────────┤
│ license          │ Giấy phép phần mềm · Ngày hết hạn        │
│                  │ Kiểm tra điều kiện bán                     │
├──────────────────┼───────────────────────────────────────────┤
│ audit            │ Ghi vết mọi thao tác · Truy vấn           │
└──────────────────┴───────────────────────────────────────────┘
```

---

## B.4 Lựa chọn công nghệ

### B.4.1 Nền tảng đã có trong `vninvest` — dùng lại

| Thành phần | Công nghệ | Trạng thái |
|---|---|---|
| Ngôn ngữ máy chủ | Python 3.x | Đã có |
| Khung web | Django + Django REST Framework | Đã có |
| Cơ sở dữ liệu | PostgreSQL | Đã có — **bắt buộc**, không dùng SQLite (migration dùng `array_agg`) |
| Chính thức tài liệu API | `drf-spectacular` (OpenAPI) | Đã có |
| Bất đối xứng mật mã | `cryptography` | Đã có |
| Thanh toán | `stripe`, `vnpay_service.py` | Đã có |
| Cache + hàng đợi | Redis | Đã có |
| Giao diện | React + Vite | Có trong `packages/web` |

### B.4.2 Quyết định giữ lại

| Giữ | Vì sao |
|---|---|
| Django + DRF | Đã có, đã kiểm thử, phù hợp CRUD nghiệp vụ |
| PostgreSQL | Bắt buộc — không phải lựa chọn |
| `drf-spectacular` | Sinh tài liệu API tự động, giảm sai lệch hợp đồng |
| Redis | Cần cho cache quyền và hàng đợi |
| `cryptography` | Cần cho băm PAT với hạt pepper |

### B.4.3 Bỏ khỏi phạm vi

| Bỏ | Lý do |
|---|---|
| Celery đa hàng đợi phức tạp | Chưa cần v1.0 — tác vụ nền đơn giản |
| Dịch vụ vi mô riêng | Quy mô v1.0 không cần — một ứng dụng là đủ |
| Cơ sở dữ liệu vector | Không có yêu cầu tìm kiếm ngữ nghĩa |
| Kubernetes | Quá nặng v1.0 — triển khai ứng dụng hóa đơn đơn giản |
| Trình duyệt nhúng | Khách tự tích hợp |

**Nguyên tắc:** không thêm công nghệ mới trừ khi có yêu cầu đã được xác nhận. Mỗi công nghệ thêm vào là một phần vận hành phải học và bảo trì.

---

## B.5 Phân bổ tải và độ trễ

### B.5.1 Yêu cầu

| Đường | Tần suất p95 | Yêu cầu p95 | Kỹ thuật đạt |
|---|---|---|---|
| Quyết định quyền | Rất cao | ≤ 50 ms | Cache + truy vấn chỉ mục |
| Đăng nhập | Trung bình | ≤ 300 ms | Băm + so sánh |
| Lấy hạn mức | Cao | ≤ 100 ms | Cache đếm + ghi bất đồng bộ |
| Tạo PAT | Thấp | ≤ 200 ms | — |
| Webhook thanh toán | Thấp, dịch loại | ≤ 2 s | Xác minh chữ ký |

### B.5.2 Chiến lược theo đường

| Đường | Chiến lược | Lý do |
|---|---|---|
| Quyết định quyền | Cache quyền ngắn hạn, vô hiệu hoá tức thời khi thay đổi | Độ trễ nghiêm ngặt, không thể đọc cơ sở dữ liệu mỗi lần |
| Ghi định lượng | Bất đồng bộ, ghi theo lô | Không chặn đường chính |
| Nhật ký kiểm toán | Bất đồng bộ, có bảo đảm không mất | Không được mất vết chứng minh |
| Truy vấn quản trị | Đọc trực tiếp | Tần suất thấp |

> **Cân bằng cần lưu ý:** bất đồng bộ để nhanh, nhưng quyết định cấp quyền phải **đồng bộ**. Nếu không ghi được vết chứng minh thì không cấp quyền (X-10 trong D03).

---

## B.6 Phương án triển khai

### B.6.1 Môi trường

| Môi trường | Dữ liệu | Ai truy cập | Mục đích |
|---|---|---|---|
| Phát triển | Sinh tự động, mỗi lượt | Nhóm phát triển | Làm việc hằng ngày |
| Thử nghiệm | Dữ liệu giả định | Nhóm phát triển + nghiệp thu | Kiểm thử tích hợp |
| Trước phát hành | Sao chép từ thử nghiệm, có phụ đạo dữ liệu | Nội bộ | Nghiệm thu chấp nhận |
| Sản xuất | Thật | Khách hàng + vận hành | Vận hành thật |

### B.6.2 Trình tự triển khai

```
1. Chạy kiểm thử tự động         ← bắt buộc pass
2. Sao lưu cơ sở dữ liệu
3. Áp dụng migration
4. Chạy tác vụ nền dữ liệu nếu có
5. Triển khai ứng dụng
6. Kiểm tra sức khoẻ
7. Cắt chuyển
8. Theo dõi 30 phút — sẵn sàng quay lại
```

**Yêu cầu bắt buộc:** phải có quy trình quay lại đã được diễn tập thành công trước khi phát hành.

---

## B.7 Chất lượng theo ISO/IEC 25010

| Đặc tính | Yêu cầu | Cơ chế bảo đảm |
|---|---|---|
| Chức năng | Đủ yêu cầu FR-01..12 | Kiểm thử truy vết |
| Hiệu năng | p95 ≤ 50 ms | Tải thật trước phát hành |
| Khả dụng | ≥ 99.9% | SLO + giám sát + cảnh báo |
| An toàn | Không rò rỉ tenant | Kiểm thử chéo tenant bắt buộc |
| Khả năng bảo trì | Module độc lập | Kiểm tra phụ thuộc + mã lỗi |
| Khả năng chuyển đổi | Chuẩn API | OpenAPI 3.1 |
| Khả năng kiểm thử | Có bộ kiểm thử | Phủ ≥ 80% |
| Chất lượng sử dụng | Khách tự phục vụ | Nghiên thu người dùng |

---

## B.8 Bản đồ quyết định kiến trúc

| Mã | Quyết định | Ảnh hưởng |
|---|---|---|
| ADR-001 | Cắt từ `vninvest` | Tiết kiệm 3–4 tháng · kế thừa nợ kỹ thuật |
| ADR-002 | Cơ sở dữ liệu chung + ràng buộc tenant | Rẻ · rủi ro rò rỉ dữ liệu phải kiểm soát |
| ADR-003 | Ràng buộc tenant ở tầng truy vấn | Bắt buộc có kiểm thử tự động phát hiện lỗi lọc |
| ADR-004 | Cache quyền kèm vô hiệu hoá tức thời | Nếu không làm được thì bỏ cache |
| ADR-005 | Capability dạng chuỗi, không `Enum` | Mất kiểm tra kiểu · được khả năng mở rộng |
| ADR-006 | Không tách thư viện, gate ở dịch vụ | Rủi ro pháp lý không giảm · tiết kiệm công |
| ADR-007 | Hai loại khách hàng trong một hệ thống | Cột `tenant_type` phải có từ migration đầu |
| ADR-008 | Cá nhân trả trước, không dùng thẻ tín dụng | Tránh rủi ro nợ · không cần hạn mức VNPay |
| ADR-009 | Mỗi email cá nhân một tài khoản | Chặn lạm dụng, không chặn nhầm |

---

## ADR-007 — Hai loại khách hàng trong cùng một hệ thống

**Trạng thái:** Đã quyết định · **Ngày:** 2026-10-02 · **Quyết định của:** Owner

**Bối cảnh**
Chủ dự án xác nhận không nên bỏ sót nhóm phát triển cá nhân: không có tư cách pháp nhân công ty, nhưng sẵn sàng trả tiền theo tháng bằng thẻ tín dụng hoặc VNPay cá nhân.

Thiết kế ban đầu (D01–D06) xoay quanh pháp nhân: có MST, có hợp đồng, có người đại diện theo pháp luật, có Ops duyệt thủ công.

**Quyết định**
Thêm cột phân loại `tenant_type` vào mô hình khách hàng. Không tách thành hai hệ thống.

| `tenant_type` | Ý nghĩa | Đăng ký |
|---|---|---|
| `organization` | Pháp nhân, có MST và hợp đồng | Ops duyệt thủ công |
| `individual` | Cá nhân, không MST, không hợp đồng | **Tự đăng ký tức thì** |

**Quyết định về quyền bán**

| Nội dung | Quyết định của Owner |
|---|---|
| Q-16 | Cá nhân mua được **mọi** sản phẩm |
| Q-17 | Chưa ấn định giá · thanh toán **theo tháng** |
| Q-18 | Chấp nhận tỷ lệ rời bỏ cao là hiển nhiên |
| Q-19 | **Mỗi email chỉ 1 tài khoản cá nhân duy nhất** |

**Lưu ý phản biện — điểm cần Owner xác nhận lại**

Thông tin billing ràng buộc được **thuế** (ai xuất hoá đơn, ai chịu thuế), nhưng **không tạo ra tư cách chủ tài khoản broker**. Đây là hai loại ràng buộc khác nhau.

Nếu cá nhân mua được `brokerage.place_order`, hệ thống cho họ đặt lệnh chứng khoán thật bằng tài khoản broker của họ. Quy trình `US-014` yêu cầu hồ sơ pháp nhân và người đại diện theo pháp luật — cá nhân không có, nên **không tồn tại phê duyệt hợp lệ nào**.

Đề xuất (chưa áp dụng, chờ Owner quyết):
Cái nhân mua mọi sản phẩm **trừ** sản phẩm có `requires_kyc = true`. Đây không phải hạn chế cá nhân, mà là điều kiện để quy trình phê duyệt tồn tại được.

**Hệ quả**
- Cột `tenant_type` phải có **ngay từ migration đầu tiên**. Thêm sau khi đã có dữ liệu là migration khó.
- Cần nới ràng buộc `tax_id` (`NOT NULL` + `UNIQUE`) ở `customer_registration` và `tenant_billing_profile`
- Hai luồng thanh toán khác nhau: doanh nghiệp trả chuyển khoản theo năm · cá nhân trả trước theo tháng
- Sản phẩm không `requires_kyc` phải là sản phẩm đơn giản nhất để dùng làm mồi

---

## ADR-008 — Cá nhân trả tiền trước, không dùng thẻ tín dụng

**Trạng thái:** Đề xuất · **Ngày:** 2026-10-02

**Bối cảnh**
Owner yêu cầu cho phép cá nhân thanh toán bằng thẻ tín dụng hoặc VNPay cá nhân, theo tháng.

**Kết quả kiểm tra mã**

| Kiểm tra | Kết quả |
|---|---|
| `commercial/vnpay_service.py` hỗ trợ hạn mức thanh toán | **Không có** — chỉ có `generate_payment_url:29` và `verify_ipn_signature:68` |
| `commercial/models.py` có trường thuế nào | **Không có** — chỉ `amount_due:73`, `currency:74` |

**Quyết định**
Cá nhân trả **tiền trước** (prepaid), không dùng thẻ tín dụng, không gia hạn tự động.

**Lý do**

| Yếu tố | Thẻ tín dụng | Tiền trả trước |
|---|---|---|
| Rủi ro nợ | Có | Không |
| Đơn vị mã | `amount:29` là số thực → cần sửa thành số nguyên VND | Giữ nguyên |
| Gia hạn tự động | Cần cơ chế hạn mức VNPay — **hiện không có** | Không cần |
| Nợ kỹ thuật | Thêm | Không thêm |

Nghiên cứu tham khảo (Mercury, 2026-06-30) ghi nhận phần lớn SaaS giai đoạn đầu nên dùng hoá đơn trả trước thay vì gia hạn tự động, tránh xây hạ tầng gia hạn trước khi biết khách sẽ trả bằng cách nào.

**Nếu Owner vẫn muốn VNPay cho cá nhân:** dùng `tran.Type == 'split'` — trả một phần để giữ chỗ gói, không phải gia hạn. Không cần hạn mức.

**Phát hiện thêm về doanh nghiệp**
`Invoice` không có trường MST hay mã số thuế. Doanh nghiệp cần hoá đơn VAT có MST để hạch toán — hiện chưa đáp ứng. Đây là gap **có sẵn trong `vninvest`**, không phải do thay đổi này tạo ra. Cần bổ sung.

**Hệ quả**
- Cá nhân không có gia hạn tự động → phải có nhắc gia hạn thủ công
- Hạn mức tín dụng không cần xây
- Kế hoạch doanh thu v1.0 **không tính** nhóm cá nhân

---

## ADR-009 — Mỗi email cá nhân chỉ một tài khoản

**Trạng thái:** Đã quyết định · **Ngày:** 2026-10-02

**Quyết định**
Mỗi địa chỉ email tạo được nhiều nhất **một** tài khoản cá nhân.

**Cơ chế**

| Ràng buộc | Cách thực thi |
|---|---|
| 1 email = 1 tenant cá nhân | `UNIQUE` trên cột email ở hồ sơ cá nhân |
| Một người nhiều email vẫn 1 tài khoản | Kiểm tra danh sách email đã liên kết khi đăng ký |
| Không lách bằng đổi email | Giới hạn số tenant tạo trên mỗi IP trong 24 giờ |

**Cảnh báo về giới hạn theo IP**
Nhiều người dùng chung IP: văn phòng, mạng di động, mạng doanh nghiệp. Giới hạn thấp sẽ chặn nhầm người dùng hợp lệ.

⇒ Đặt ngưỡng **cao**, chỉ đủ chặn lạm dụng rõ ràng. Ưu tiên tín hiệu email hơn tín hiệu IP.

---

## B.9 Nợ kỹ thuật kế thừa phải xử lý

| # | Vấn đề | Vị trí | Mức | Hành động |
|---|---|---|---|---|
| D-01 | `QuotaRecord` có cột cứng, xung đột với `QuotaHistory` | `commercial/models.py:43-50` | Cao | Bỏ cột cứng, dùng `QuotaHistory` |
| D-02 | `Subscription.tenant` là `OneToOneField` — mỗi tenant chỉ 1 sản phẩm | `commercial/models.py:18` | Cao | Đổi thành `ForeignKey` + thêm chiều sản phẩm |
| D-03 | Bản đồ tính năng hardcode trong module xác thực | `identity_access/views_webhooks.py:196-201` | Cao | Chuyển sang bảng `Capability` |
| D-04 | Phủ kiểm thử `commercial` chỉ 8.6% | 222 / 2 593 | Cao | Bù kiểm thử khi tách |
| D-05 | Secret trong kho mã | `compose.dev.env` | **Rất cao** | Thu hồi, xoay khoá, gỡ khỏi HEAD |
| D-06 | `brokerage/` thiếu hàng rào `write_gate` | `vnbroker/brokerage/base.py:278-288` | Cao | Bổ sung hàng rào |
| D-07 | `Invoice` không có trường MST/mã số thuế | `commercial/models.py:61-89` | Cao | Bổ sung cho hoá đơn VAT doanh nghiệp |
| D-08 | `vnpay_service.py` không hỗ trợ hạn mức thanh toán | `commercial/vnpay_service.py:29,68` | Trung bình | Dùng `tran.Type == 'split'` thay gia hạn |

---

**Cổng chất lượng:** QG-3 — 9 quyết định kiến trúc đã ghi nhận, 8 nợ kỹ thuật kế thừa đã định danh.
**Tài liệu sau:** D05 — Sơ đồ phân rã chức năng và bản đồ module