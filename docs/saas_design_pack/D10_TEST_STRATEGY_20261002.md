# D10 — Chiến lược kiểm thử & Bảo đảm chất lượng

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** ISO/IEC/IEEE 29119 · **Tài liệu trước:** D09 · **Tài liệu sau:** D11

---

## 1. Nguyên tắc

| # | Nguyên tắc | Giải thích |
|---|---|---|
| 1 | Kiểm thử theo **rủi ro**, không theo tỉ lệ | Cổng quyền cần kiểm thử kỹ hơn trang giới thiệu |
| 2 | Kiểm thử **ràng buộc tenant** là bắt buộc | Rủi ro lớn nhất của mô hình một cơ sở dữ liệu |
| 3 | Kiểm thử **trạng thái âm** ngang hàng trạng thái dương | Hệ thống quyền hỏng khi cho phép quá mức, không phải khi chặn quá mức |
| 4 | **Không báo PASS cho thứ chưa chạy** | Kiểm thử chưa chạy = `CHƯA CHẠY` |
| 5 | Cùng kịch bản phải cho cùng kết quả trên máy khác | Bài học từ sự cố 2026-09-26 |

> **Nguyên tắc 5 dẫn từ sự cố thật trong lịch sử dự án:** 4 agent đều báo kiểm thử đạt, nhưng khi gộp lại chạy thì 198 test có 1 lỗi do ký tự tiếng Việt trong `print()` gây lỗi mã hoá trên Windows. Bài học: kết quả trên máy một agent **không** đại diện cho máy khác.

---

## 2. Tầng kiểm thử

### 2.1 Kim tự tháp

```
        ┌──────────────┐
        │  Chấp nhận   │  10 test · 1 lần/quý · người thật
        │  người dùng  │
        └──────┬───────┘
       ┌───────▼────────┐
       │  Kiểm thử đầu │  50 test · trước mỗi phát hành
       │     cuối       │
       └───────┬────────┘
      ┌────────▼─────────┐
      │  Kiểm thử tích  │  300 test · mỗi lần ghép nhánh
      │      hợp        │
      └───────┬─────────┘
     ┌─────────▼──────────┐
     │    Kiểm thử đơn    │  1 500 test · mỗi lần đẩy mã
     │      vị           │
     └───────────────────┘
```

### 2.2 Phân bổ công sức

| Tầng | Số lượng | Mục tiêu phủ | Tần suất |
|---|---:|---:|---|
| Đơn vị | 1 500 | ≥ 85% dòng mã | Mỗi lần đẩy mã |
| Tích hợp | 300 | Mọi tương tác cơ sở dữ liệu và cổng | Mỗi lần ghép nhánh |
| Đầu cuối | 50 | Luồng người dùng chính | Trước phát hành |
| Chấp nhận | 10 | Kịch bản sử dụng thật | Mỗi quý |

> **Mục tiêu phủ ≥ 85%**, không phải 100%. Phần không kiểm thử được là trình diễn giao diện tĩnh và mã khởi tạo đơn giản. Đẩy lên 100% thường dẫn tới viết kiểm thử cho mã không cần kiểm thử.

---

## 3. Kế hoạch kiểm thử chi tiết

### 3.1 Cổng quyết định quyền — ưu tiên tuyệt đối

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-ENT-01 | PAT hợp lệ, có quyền | 200, `allowed: true` |
| TC-ENT-02 | Tenant chưa mua sản phẩm | 403, `entitlement_missing` |
| TC-ENT-03 | Entitlement hết hạn | 403, `entitlement_expired` |
| TC-ENT-04 | Tier không chứa capability | 403, `tier_insufficient` |
| TC-ENT-05 | Capability cần duyệt, chưa duyệt | 403, `approval_pending` |
| TC-ENT-06 | Vượt hạn mức | 429, `quota_exceeded` |
| TC-ENT-07 | Mảng `capability_codes` rỗng | 422, **không** cho qua |
| TC-ENT-08 | `product_code` không tồn tại | 404 |
| **TC-ENT-09** | **Thu hồi quyền → gọi lại ngay lập tức** | **403, phải bị chặn** |
| **TC-ENT-10** | **Sửa tham số tenant → thử đọc tenant khác** | **403, không rò rỉ dữ liệu** |
| TC-ENT-11 | Cá nhân hỏi sản phẩm `requires_kyc` | 403, `product_requires_organization` |

> **TC-ENT-09 và TC-ENT-10 là hai test bắt buộc tuyệt đối.** TC-ENT-09 chặn lỗi cache quyền (BR-08.2 trong D03). TC-ENT-10 chặn rò rỉ dữ liệu tenant — rủi ro lớn nhất. Không được bỏ qua vì "khó tái hiện".

### 3.2 Xác thực

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-AUTH-01 | PAT hợp lệ | 200 |
| TC-AUTH-02 | PAT sai định dạng | 401, `pat_invalid` |
| TC-AUTH-03 | PAT hết hạn | 401, `pat_expired` |
| TC-AUTH-04 | PAT bị thu hồi | 401, `pat_revoked` |
| TC-AUTH-05 | Tenant bị khoá | 403, `tenant_suspended` |
| TC-AUTH-06 | Email không tồn tại | `invalid_credentials` |
| TC-AUTH-07 | Mật khẩu sai | `invalid_credentials` — **giống hệt TC-AUTH-06** |
| TC-AUTH-08 | Token phiên cũ sau khi đổi mật khẩu | 401 |

> **TC-AUTH-07 phải cho kết quả giống hệt TC-AUTH-06.** Nếu hai thông báo khác nhau, kẻ tấn công dò được email nào đã đăng ký.

### 3.3 Khách cá nhân

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-IND-01 | Đăng ký email mới | 201, `status: active` ngay |
| TC-IND-02 | Đăng ký không có MST | Không hỏi MST, vẫn tạo được |
| TC-IND-03 | Đăng ký không có hợp đồng | Không hỏi hợp đồng |
| TC-IND-04 | Email đã có tài khoản cá nhân | 409 |
| TC-IND-05 | Email đang ở tài khoản doanh nghiệp | **Vẫn cho tạo cá nhân** |
| TC-IND-06 | Vượt ngưỡng số tenant trên IP | 429 |
| TC-IND-07 | Giao diện thanh toán cá nhân | Không có trẻ tín dụng / trả góp |
| TC-IND-08 | Số tiền = số nguyên đồng | `199000`, không phải `199000.55` |
| TC-IND-09 | Chứng từ của cá nhân | `invoice_kind: receipt` |
| TC-IND-10 | Hết hạn mà chưa trả | `expired`, **không** có `past_due` |
| TC-IND-11 | Cá nhân gọi API sản phẩm `requires_kyc` | 403, `product_requires_organization` |
| TC-IND-12 | Nhiều người dùng chung IP văn phòng | **Không bị chặn** |

> **TC-IND-12 chống lỗi chặn nhầm.** Giới hạn theo IP đặt quá thấp là lỗi gây mất khách, và chỉ lộ ra khi có khách thật.
>
> **TC-IND-08 bám theo phát hiện D-08** — `vnpay_service.py:29` nhận `amount: float`. Số thực khi làm tròn trở thành sai số tiền thật.

### 3.4 Thanh toán

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-BIL-01 | Thanh toán thành công | Entitlement kích hoạt |
| TC-BIL-02 | Thanh toán thất bại | Giữ nguyên quyền cũ |
| TC-BIL-03 | Webhook trùng lặp | Xử lý **đúng một lần** |
| TC-BIL-04 | Webhook sai chữ ký | Bỏ qua + cảnh báo |
| **TC-BIL-05** | **Webhook hợp lệ nhưng số tiền không khớp** | **Từ chối cấp quyền + cảnh báo** |
| TC-BIL-06 | Webhook cho sản phẩm khác | Từ chối |
| TC-BIL-07 | Bỏ giữa chừng | `expired`, không cấp quyền |
| TC-BIL-08 | Gia hạn | Nâng kỳ, không mất quyền |

> **TC-BIL-05 là test quan trọng nhất của nhóm thanh toán.** Chữ ký hợp lệ nhưng số tiền sai là trường hợp thật. Không đối soát thì kẻ tấn công trả 1 đồng và nhận gói đầy đủ.

### 3.5 Ràng buộc tenant — bắt buộc mỗi phát hành

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-TEN-01 | Tạo dữ liệu ở 3 tenant khác nhau | Mỗi tenant thấy đúng dữ liệu của mình |
| TC-TEN-02 | Tenant A đọc tài nguyên của tenant B | 404, **không** phải 403 (không tiết lộ sự tồn tại) |
| TC-TEN-03 | Truy vấn không lọc tenant | Bị chặn hoặc ghi cảnh báo |
| TC-TEN-04 | Truy vấn toàn cục không khai báo | Từ chối chạy trong production |
| TC-TEN-05 | Bảng nghiệp vụ thiếu `tenant_id` | Kiểm tra tự động thất bại |

> **TC-TEN-02 trả 404 chứ không phải 403** là điểm cần chú ý. Trả 403 nói lên "tài nguyên này tồn tại nhưng bạn không có quyền" — tức là đã tiết lộ nó tồn tại. Kẻ tấn công dò tài nguyên của từng tenant khác chỉ cần phân biệt 403 và 404.

### 3.6 Hạn mức

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-MET-01 | Dưới 80% | `normal` |
| TC-MET-02 | Đạt 80% | `warning` + cảnh báo |
| TC-MET-03 | Vượt 100% | 429 + `critical` |
| TC-MET-04 | Hạn = -1 | `unlimited`, không tính phần trăm |
| TC-MET-05 | Sang kỳ mới | Đếm về 0, lịch sử kỳ trước giữ nguyên |
| TC-MET-06 | Vượt hạn cứng | **Không** ghi nhận thêm |

### 3.7 Danh mục & quản trị

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-PRD-01 | Tạo sản phẩm với mã hợp lệ | 201 |
| TC-PRD-02 | Mã trùng | 409 |
| TC-PRD-03 | Mã sai định dạng | 422 |
| TC-PRD-04 | Sản phẩm `PROPRIETARY` chưa có giấy phép | 201 + cảnh báo |
| TC-PRD-05 | Kích hoạt sản phẩm chưa có giấy phép | **Từ chối** |
| TC-PRD-06 | Bỏ capability đang được cấp | **Từ chối** |
| TC-PRD-07 | Thêm sản phẩm mới không cần triển khai | **Không cần triển khai** |

> **TC-PRD-07 kiểm chứng mục tiêu G3** của D01 — thêm phần mềm mới chỉ cần thao tác dữ liệu. Nếu test này đòi hỏi triển khai lại, thiết kế đã sai.

### 3.8 Phê duyệt pháp lý

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-CMP-01 | Ops cố cấp quyền rủi ro cao | **Từ chối** |
| TC-CMP-02 | Compliance duyệt kèm phiên bản điều khoản | Cấp quyền |
| TC-CMP-03 | Duyệt khi giấy phép chưa ký | **Từ chối** |
| TC-CMP-04 | Từ chối không kèm lý do | **Từ chối thao tác** |
| TC-CMP-05 | Cấp hàng loạt nhiều khách một lần | **Từ chối** |

---

## 4. Kiểm thử hiệu năng

### 4.1 Yêu cầu

| Đường | Yêu cầu p95 | Yêu cầu p99 | Tần suất kiểm thử |
|---|---|---|---|
| `/entitlements/verify` | ≤ 50 ms | ≤ 150 ms | Mỗi phát hành |
| `/entitlements/current` | ≤ 100 ms | ≤ 300 ms | Mỗi phát hành |
| `/auth/login` | ≤ 300 ms | ≤ 800 ms | Mỗi phát hành |
| `/billing/checkout` | ≤ 500 ms | ≤ 1 200 ms | Mỗi phát hành |
| Cổng thông tin | LCP ≤ 2.5 s | — | Mỗi phát hành |

### 4.2 Kịch bản tải

| Kịch bản | Quy mô |
|---|---|
| Thông thường | 50 người dùng đồng thời |
| Đỉnh | 200 người dùng đồng thời |
| Hạn mức | 1 000 tenant · 5 000 PAT |
| Vượt hạn mức | Phải **thất bại có kiểm soát**, không sập |

### 4.3 Chạy trên dữ liệu thật

> **Kiểm thử hiệu năng trên dữ liệu giả lọc bỏ vấn đề chỉ mục.** Chỉ mục trên 100 dòng và trên 1 triệu dòng hành xử khác nhau.

| Yêu cầu | Quy mô dữ liệu |
|---|---|
| Thông thường | 10 nghìn tenant · 1 triệu entitlement |
| Đỉnh | 100 nghìn tenant · 10 triệu dòng nhật ký |

### 4.4 Kiểm thử cơ sở dữ liệu

| Mục | Công cụ |
|---|---|
| Kế hoạch truy vấn | `EXPLAIN ANALYZE` |
| Chỉ mục còn thiếu | Theo dõi truy vấn chậm |
| Kích thước bảng | Theo dõi tăng trưởng |
| Phân trang sâu | Truy vấn với khoá con trỏ ở trang 10 000 |

---

## 5. Kiểm thử di chuyển dữ liệu

### 5.1 Vì sao bắt buộc

Sáu thay đổi trong D06 §10 là thay đổi phụ thuộc — không thể để công cụ tự sinh:

| Bước | Loại |
|---|---|
| 10 | Đổi `OneToOneField` → `ForeignKey` |
| 11 | Chuyển `plan` (chuỗi) → `tier_id` (khoá ngoại) |
| 12 | Đổi tên bảng |
| 14 | Bỏ 8 cột của `QuotaRecord` |
| 15 | Bổ sung cột vào bảng đã có dữ liệu |

### 5.2 Yêu cầu cho mỗi migration

| Yêu cầu | Lý do |
|---|---|
| Chạy trên PostgreSQL thật | SQLite không dùng được — `array_agg` |
| Chạy với dữ liệu đã có | Dữ liệu rỗng thì không lộ ra lỗi chuyển đổi |
| Có đường quay lại | `RunPython` để khôi phục |
| Chạy trên cỡ dữ liệu thật | Thời gian chạy khác nhau |
| Kiểm thử khi migration thất bại giữa chừng | Trạng thái nửa vời |

> **Cảnh báo từ sự cố lịch sử:** đặt số migration trùng đã gây `Conflicting migrations; multiple leaf nodes` và chặn triển khai ngày 2026-09-26. Không tự đặt số — đọc đầu chuỗi thật hoặc để công cụ sinh.

---

## 6. Kiểm thử tự động trong đường liên hợp

| Kiểm tra | Công cụ | Điều kiện chặn |
|---|---|---|
| Phong cách mã | Kiểm tra kiểu tĩnh | Không lỗi |
| Kiểm tra kiểu | Kiểm tra kiểu tĩnh | Không lỗi |
| Bí mật trong kho | Quét bí mật | Không phát hiện |
| Phụ thuộc có lỗ hổng | Kiểm tra phụ thuộc | Không lỗi nghiêm trọng |
| Đơn vị | Khung kiểm thử | ≥ 85% phủ |
| Tích hợp | Khung kiểm thử | 100% pass |
| Kiểm thử tenant | Khung kiểm thử | 100% pass |
| Lệch tài liệu API | Sinh schema | Không lệch |
| Cấu hình production | Kiểm tra cấu hình | Đủ 4 mục D09 §4.2 |

---

## 7. Kiểm thử chấp nhận người dùng

### 7.1 Kịch bản doanh nghiệp

| # | Kịch bản | Bước | Điều kiện đạt |
|---|---|---|---|
| 1 | Đăng ký mới | Nộp hồ sơ → chờ duyệt → đăng nhập → tạo PAT | Không cần hỗ trợ |
| 2 | Mua gói | Chọn gói → thanh toán → kích hoạt | Nhận hóa đơn VAT đúng MST |
| 3 | Tích hợp SDK | Dán khóa → gọi API → nhận quyền | Không tự tạo lại khóa |
| 4 | Bị từ chối quyền | Gọi tính năng không có → đọc thông báo | **Hiểu vì sao bị chặn** |
| 5 | Chờ duyệt pháp lý | Yêu cầu tier C → theo dõi | Hiểu đang chờ gì |
| 6 | Vượt hạn mức | Dùng hết → thấy cảnh báo → nâng cấp | Hiểu còn bao nhiêu |
| 7 | Kiểm tra nhật ký | Xem ai đã làm gì | Thấy đủ |
| 8 | Thu hồi quyền | Ops thu hồi → gọi API lại | **Bị chặn ngay** |

> **Kịch bản 4 và 8 là quan trọng nhất.** Chúng kiểm tra hai giá trị cốt lõi: người dùng hiểu vì sao bị chặn, và việc thu hồi có hiệu lực tức thời hay không.

### 7.2 Kịch bản cá nhân

| # | Kịch bản | Điều kiện đạt |
|---|---|---|
| 1 | Đăng ký và dùng thử | Từ mở trang đến có khóa API ≤ 5 phút |
| 2 | Không bị hỏi MST | Không thấy trường MST |
| 3 | Mua gói tháng | Thanh toán được, không cần hợp đồng |
| 4 | Gia hạn | Không mất cấu hình |
| 5 | Tài liệu hóa đơn | Nhận biên nhận, hiểu đó không phải hóa đơn VAT |
| 6 | Đăng ký lại cùng email | Thông báo rõ, không tạo tài khoản thứ hai |

### 7.3 Tiêu chí chấp nhận

| Mã | Tiêu chí | Đo |
|---|---|---|
| QA-01 | Không có lỗi nghiêm trọng | Đếm lỗi |
| QA-02 | Không có lỗi ưu tiên cao | Đếm lỗi |
| QA-03 | Hoàn thành 100% kịch bản bắt buộc | 14/14 |
| QA-04 | Người dùng hiểu lý do bị từ chối | Khảo sát sau phiên |
| QA-05 | Thời gian đăng ký cá nhân ≤ 5 phút | Đo thực tế |
| QA-06 | Không rò rỉ dữ liệu tenant | Kiểm thử tự động |

---

## 8. Suy giảm về kết quả kiểm thử

### 8.1 Nguyên tắc báo cáo

| Tình huống | Báo cáo đúng |
|---|---|
| Đã chạy, pass | `PASS` + số liệu |
| Đã chạy, fail | `FAIL` + chi tiết lỗi |
| **Chưa chạy** | **`CHƯA CHẠY`** — không suy ra là sẽ pass |
| Chạy trên máy khác | Nêu rõ khác môi trường |

> **Không bao giờ báo `PASS` cho thứ chưa chạy.** Đây là quy tắc từ `AGENTS.md` và từ sự cố 2026-09-26 — khi merge lại, kết quả khác với từng báo cáo của agent.

### 8.2 Kinh nghiệm từ lịch sử

| Bài học | Áp dụng |
|---|---|
| Kết quả trên máy agent không đại diện máy khác | Chạy lại trên môi trường sạch trước khi phát hành |
| Ký tự tiếng Việt trong mã gây lỗi trên một hệ điều hành | Không dùng `print()` tiếng Việt trong mã chạy thật |
| Migration trùng số chặn triển khai | Đọc đầu chuỗi migration thật |
| Chạy thử trên SQLite thất bại | Luôn dùng PostgreSQL |

---

## 9. Ma trận truy vết kiểm thử

| Yêu cầu | Kiểm thử đơn vị | Tích hợp | Đầu cuối |
|---|:---:|:---:|:---:|
| FR-01 Xác thực | ✔ | ✔ | ✔ |
| FR-02 Quyết định quyền | ✔ | ✔ | ✔ |
| FR-03 Mã lý do | ✔ | ✔ | ✔ |
| FR-04 Nhật ký kiể toán | ✔ | ✔ | ✔ |
| FR-05 Định lượng | ✔ | ✔ | ✔ |
| FR-06 Chặn hạn mức | ✔ | ✔ | ✔ |
| FR-07 Thanh toán | ✔ | ✔ | ✔ |
| FR-08 Khai báo sản phẩm | ✔ | ✔ | ✔ |
| FR-09 Phê duyệt | ✔ | ✔ | ✔ |
| FR-10 Hợp đồng, hóa đơn | ✔ | ✔ | ✔ |
| FR-12 Bảng điều khiển | ✔ | ✔ | ✔ |
| NFR-01 Hiệu năng | — | ✔ | ✔ |
| NFR-03 Khả dụng | — | ✔ | — |
| NFR-05 Bảo mật | ✔ | ✔ | ✔ |
| NFR-06 Tiếp cận | — | — | ✔ |
| NFR-08 Truy vết | ✔ | ✔ | ✔ |
| Ràng buộc tenant | ✔ | ✔ | ✔ |

---

## 10. Tổng kết kiểm thử

| Nhóm | Mã lượng |
|---|---:|
| Cổng quyền | 11 |
| Xác thực | 8 |
| Khách cá nhân | 12 |
| Thanh toán | 8 |
| Ràng buộc tenant | 5 |
| Hạn mức | 6 |
| Danh mục & quản trị | 7 |
| Phê duyệt pháp lý | 5 |
| **Tổng** | **62** |

Cộng với 1 500 test đơn vị, 300 test tích hợp, 50 test đầu cuối, 10 kịch bản chấp nhận.

---

**Cổng chất lượng:** QG-5 định nghĩa — 9 kiểm tra bắt buộc trong đường liên hợp · 62 kiểm thử nghiệp vụ đánh số · 3 kiểm thử được đánh dấu **bắt buộc tuyệt đối** (TC-ENT-09, TC-ENT-10, TC-BIL-05).
**Tài liệu sau:** D11 — Vận hành & triển khai