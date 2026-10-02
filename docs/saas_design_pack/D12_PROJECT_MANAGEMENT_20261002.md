# D12 — Quản lý dự án

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** PMI PMBOK 7 · ISO/IEC/IEEE 12207 · **Tài liệu cuối của bộ hồ sơ**

---

## 1. Tình trạng hiện tại

### 1.1 Đã hoàn thành

| Hạng mục | Trạng thái |
|---|---|
| Bộ hồ sơ thiết kế 12 tài liệu | ✅ Hoàn thành |
| Chốt Phương án A (không tách thư viện) | ✅ |
| Chốt ADR-007/008/009 (khách cá nhân) | ✅ |
| Quyết định cắt 117 327 → ~35 336 LOC | ✅ |

### 1.2 Chưa bắt đầu

| Hạng mục | Trạng thái |
|---|---|
| Viết mã | ⬜ Chưa bắt đầu |
| Cắt mã nguồn | ⬜ Chưa bắt đầu |
| Viết migration | ⬜ Chưa bắt đầu |

### 1.3 Còn tồn đọng

| # | Việc | Loại | Chặn |
|---|---|---|---|
| T1 | Xử lý bí mật trong kho mã | Bảo mật | **Mọi việc khác** |
| T2 | License thương mại `vnbroker` | Pháp lý | Bán tier C |
| T3 | Xác nhận Q-16 (tier C cho cá nhân) | Quyết định | BR-12 |
| T4 | Chốt giá gói | Kinh doanh | Thanh toán |
| T5 | Tư vấn pháp lý | Pháp lý | Bán tier C |
| T6 | Đóng `write_gate` cho `brokerage/` | Kỹ thuật | Bán tier C |
| T7 | Ấn định ngân sách hạ tầng | Vận hành | — |
| T8 | 19 câu hỏi Q-01..Q-19 còn mở | Quyết định | Nhiều phần |

---

## 2. Cơ cấu công việc (WBS)

### 2.1 Pha 0 — Xung lửa

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 0.1 | **Xử lý bí mật trong kho mã** (D09 §9.2) | — | 1–2 ngày |
| 0.2 | Tạo kho mới, sao chép mã sạch | 0.1 | 0.5 ngày |
| 0.3 | Chốt 19 câu hỏi còn mở | — | 1 ngày |
| 0.4 | Xác nhận giá gói | — | 1 ngày |

> **0.1 chặn mọi việc khác.** Nếu khoá mã vẫn nằm trong lịch sử, bất cứ ai clone kho đều đọc được — thêm bất kỳ tính năng nào cũng không bảo đảm được điều gì.

### 2.2 Pha 1 — Cắt và ổn định

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 1.1 | Tạo nhánh cắt | 0.2 | 0.5 ngày |
| 1.2 | Gỡ URL app đã cắt khỏi `urls.py` | 1.1 | 0.5 ngày |
| 1.3 | Gỡ app khỏi `INSTALLED_APPS` | 1.2 | 0.5 ngày |
| 1.4 | Gỡ migration của app đã cắt | 1.3 | 1 ngày |
| 1.5 | Gỡ import còn sót (4 tập tin) | 1.3 | 1 ngày |
| 1.6 | Rà soát bảo mật phần kế thừa | 1.5 | 2 ngày |
| 1.7 | Kiểm thử khởi động trên PostgreSQL | 1.5 | 1 ngày |

**Cổng G-1:** Ứng dụng khởi động được · không còn import app đã cắt · kiểm thử pass

### 2.3 Pha 2 — Sửa nợ kỹ thuật

| # | Công việc | Vị trí | Phụ thuộc | Ước lượng |
|:---:|---|---|---|---:|
| 2.1 | `Subscription.tenant` → `ForeignKey` | `commercial/models.py:18` | G-1 | 0.5 ngày |
| 2.2 | Thêm chiều sản phẩm | `commercial/models.py` | 2.1 | 0.5 ngày |
| 2.3 | Bỏ 8 cột cứng của `QuotaRecord` | `commercial/models.py:43-50` | G-1 | 0.5 ngày |
| 2.4 | Chuyển bản đồ tính năng ra bảng | `identity_access/views_webhooks.py:196-201` | G-1 | 1 ngày |
| 2.5 | Kiểm thử migration lên/từ dữ liệu thật | | 2.1–2.4 | 1 ngày |

**Cổng G-2:** Migration chạy được trên PostgreSQL có dữ liệu · có đường quay lại

### 2.4 Pha 3 — Mô hình đa sản phẩm

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 3.1 | Tạo bảng danh mục (5 bảng) | G-2 | 2 ngày |
| 3.2 | Tạo bảng nối tier (2 bảng) | 3.1 | 1 ngày |
| 3.3 | Tạo `Entitlement` | 3.1 | 1 ngày |
| 3.4 | Tạo `CapabilityGrant` | 3.3 | 0.5 ngày |
| 3.5 | Tạo `UsageRecord` | 3.2 | 0.5 ngày |
| 3.6 | Tạo bảng kích hoạt + hồ sơ khách | 3.3 | 1 ngày |
| 3.7 | Tạo bảng kiểm toán quyết định | 3.3 | 0.5 ngày |

**Cổng G-3:** Tất cả bảng tồn tại · có kiểm thử ràng buộc toàn vẹn

### 2.5 Pha 4 — Quyết định quyền

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 4.1 | Viết quyết định quyền 12 bước | G-3 | 2 ngày |
| 4.2 | Ghi nhật ký quyết định (fail-closed) | 4.1 | 0.5 ngày |
| 4.3 | Đo định lượng | 4.1 | 1 ngày |
| 4.4 | Cổng `/entitlements/verify` | 4.1 | 1 ngày |
| 4.5 | **Cache quyền + vô hiệu hoá đồng thời** | 4.1 | 1 ngày |

> **4.5 là hạng mục dễ làm vội.** Không có cơ chế vô hiệu hoá cache thì **không được bật cache**. Nếu thiếu thời gian, bỏ cache chứ đừng bật cache không an toàn.

**Cổng G-4:** p95 ≤ 50 ms · thu hồi quyền có hiệu lực tức thời

### 2.6 Pha 5 — Xác thực & khách hàng

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 5.1 | Thêm cột `tenant_type` | G-3 | 0.5 ngày |
| 5.2 | Nới ràng buộc `tax_id` | 5.1 | 0.5 ngày |
| 5.3 | Đăng nhập, tạo PAT | G-2 | 2 ngày |
| 5.4 | **Đăng ký cá nhân** (tự phục vụ) | 5.2 | 2 ngày |
| 5.5 | **Đăng ký doanh nghiệp** (chờ duyệt) | 5.2 | 1.5 ngày |
| 5.6 | Ràng buộc BR-12 (nếu T3 chốt chặn) | 5.1 | 0.5 ngày |

**Cổng G-5:** Mỗi email chỉ 1 tài khoản cá nhân · cá nhân không hỏi MST/hợp đồng

### 2.7 Pha 6 — Thanh toán

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 6.1 | Bổ sung trường thuế cho `Invoice` | 5.1 | 1 ngày |
| 6.2 | Tạo hóa đơn + chi tiết sản phẩm | 6.1 | 1 ngày |
| 6.3 | Kết nối VNPay (đã có sẵn) | 6.2 | 2 ngày |
| 6.4 | **Đối soát số tiền trước khi cấp quyền** | 6.3 | 1 ngày |
| 6.5 | Phân biệt `vat_invoice` / `receipt` | 6.1 | 0.5 ngày |
| 6.4b | Sửa `amount` thành số nguyên (D-08) | 6.3 | 0.5 ngày |

**Cổng G-6:** Webhook trùng lặp không cấp quyền hai lần · số tiền không khớp bị từ chối

### 2.8 Pha 7 — Danh mục & quản trị

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 7.1 | Cổng khai báo sản phẩm, tier, capability | G-3 | 2 ngày |
| 7.2 | Ràng buộc giấy phép thương mại | 7.1 | 1 ngày |
| 7.3 | Cổng duyệt hồ sơ tenant | 5.5 | 1 ngày |
| 7.4 | Cổng phê duyệt pháp lý | G-3 | 2 ngày |
| 7.5 | Truy vấn nhật ký kiểm toán | G-3 | 1.5 ngày |

**Cổng G-7:** Thêm sản phẩm mới **không cần triển khai lại**

### 2.9 Pha 8 — Giao diện

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 8.1 | Hệ thống thiết kế + thành phần nền | — | 3 ngày |
| 8.2 | Trang đăng nhập / đăng ký | 8.1, 5.3 | 2 ngày |
| 8.3 | Trang đăng ký cá nhân (3 trường) | 8.1, 5.4 | 1 ngày |
| 8.4 | Trang đăng ký doanh nghiệp (5 trường) | 8.1, 5.5 | 1.5 ngày |
| 8.5 | Bảng điều khiển | 8.1, G-4 | 3 ngày |
| 8.6 | Trang quản lý sản phẩm (quản trị) | 8.1, 7.1 | 3 ngày |
| 8.7 | Trang thanh toán | 8.1, G-6 | 2 ngày |
| 8.8 | Trang tạo PAT + hiển thị một lần | 8.1, 5.3 | 1 ngày |
| 8.9 | Thông báo trạng thái quyền | 8.1, G-4 | 1 ngày |
| 8.10 | Kiểm tra tiếp cận | 8.2–8.9 | 2 ngày |

**Cổng G-8:** Đạt WCAG 2.2 AA

### 2.10 Pha 9 — Vận hành

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 9.1 | Thiết lập môi trường triển khai | G-1 | 2 ngày |
| 9.2 | Giám sát + cảnh báo | 9.1 | 2 ngày |
| 9.3 | Sao lưu + diễn tập khôi phục | 9.1 | 2 ngày |
| 9.4 | Tác vụ nền (8 tác vụ) | G-4, G-6 | 3 ngây |
| 9.5 | Tài liệu vận hành | 9.2–9.4 | 2 ngày |

**Cổng G-9:** Diễn tập khôi phục thành công · cảnh báo hoạt động

### 2.11 Pha 10 — Phát hành

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 10.1 | Kiểm thử tự động đầy đủ | Tất cả | 2 ngày |
| 10.2 | Kiểm thử chấp nhận người dùng | 10.1 | 2 ngày |
| 10.3 | Tải thật trên dữ liệu thật | 10.1 | 1 ngày |
| 10.4 | Sửa lỗi phát hiện | 10.2 | 3 ngày |

### 2.12 Pha 11 — Tier C (sau khi có pháp lý)

| # | Công việc | Phụ thuộc | Ước lượng |
|:---:|---|---|---:|
| 11.1 | Đóng `write_gate` cho `brokerage/` | T6 | 1 ngày |
| 11.2 | Ký license thương mại `vnbroker` | T2 | Chờ Owner |
| 11.3 | Luồng xác minh pháp nhân | T5 | 3 ngày |
| 11.4 | Cổng phê duyệt tier C | 7.4 | 2 ngày |
| 11.5 | Hợp đồng có điều khoản định vị pháp nhân | T5 | Chờ Owner |

**Cổng G-10:** Có tư vấn pháp lý + license đã ký

### 2.13 Tổng ước lượng

| Pha | Công việc | Ngày công |
|---|---|---:|
| 0 — Xung lửa | 4 | 3–5 |
| 1 — Cắt | 7 | 6–7 |
| 2 — Nợ kỹ thuật | 5 | 3–4 |
| 3 — Mô hình | 7 | 6–8 |
| 4 — Quyết định quyền | 5 | 5–6 |
| 5 — Xác thực | 6 | 7–8 |
| 6 — Thanh toán | 7 | 6–7 |
| 7 — Quản trị | 5 | 7–8 |
| 8 — Giao diện | 10 | 18–20 |
| 9 — Vận hành | 5 | 11 |
| 10 — Phát hành | 4 | 8 |
| **Tổng v1.0** | **65** | **80–92** |
| 11 — Tier C | 5 | 6 + chờ pháp lý |

**Ước lượng: 80–92 ngày công cho v1.0, không gồm tier C.**

> **Ước lượng này cần kiểm chứng.** Ước lượng phần mềm thường thấp hơn thực tế. Các hạng mục có rủi ro cao nhất: cắt mã (Pha 1), quyết định quyền (Pha 4), giao diện (Pha 8).

---

## 3. Lộ trình theo quý

### 3.1 Chia theo trục

| Quý | Phạm vi | Cổng |
|---|---|---|
| Q1 | Pha 0 + 1 + 2 | Nền tảng vững |
| Q2 | Pha 3 + 4 + 5 | Quyết định quyền + xác thực |
| Q3 | Pha 6 + 7 | Thanh toán + quản trị |
| Q4 | Pha 8 + 9 + 10 | Giao diện + vận hành + phát hành |
| Sau | Pha 11 | Tier C — chờ pháp lý |

### 3.2 Đường gạch phẳng

```
Cắt mã ──► Nợ kỹ thuật ──► Mô hình dữ liệu ──► Quyết định quyền ──► Xác thực
                                                            │
                              Thanh toán ───────────────────┤
                                                            ▼
                                          Quản trị ──► Giao diện ──► Vận hành ──► Phát hành
```

---

## 4. Tiêu chí nghiệm thu

### 4.1 Nghiệm thu từng pha

| Cổng | Tiêu chí bắt buộc |
|---|---|
| **G-1** | Ứng dụng khởi động trên PostgreSQL · không còn import app đã cắt |
| **G-2** | Migration chạy được trên dữ liệu thật · có đường quay lại |
| **G-3** | Tất cả bảng tồn tại · kiểm thử ràng buộc toàn vẹn pass |
| **G-4** | p95 ≤ 50 ms · thu hồi quyền có hiệu lực tức thời |
| **G-5** | 1 email = 1 tài khoản cá nhân · cá nhân không hỏi MST/hợp đồng |
| **G-6** | Webhook trùng lặp không cấp quyền hai lần · số tiền lệch bị từ chối |
| **G-7** | Thêm sản phẩm mới không cần triển khai lại |
| **G-8** | Đạt WCAG 2.2 AA |
| **G-9** | Diễn tập khôi phục thành công · cảnh báo hoạt động |
| **G-10** | Có tư vấn pháp lý + license đã ký |

### 4.2 Nghiệm thu phát hành

| Mã | Tiêu chí | Đo |
|---|---|---|
| RA-01 | 0 lỗi nghiêm trọng | Đếm lỗi |
| RA-02 | 0 lỗi ưu tiên cao | Đếm lỗi |
| RA-03 | Phủ mã ≥ 85% | Báo cáo kiểm thử |
| RA-04 | 62/62 kiểm thử nghiệp vụ pass | Báo cáo |
| RA-05 | 5/5 kiểm thử tenant pass | Báo cáo |
| RA-06 | 0 rò rỉ dữ liệu tenant | Báo cáo |
| RA-07 | 14/14 kịch bản chấp nhận | Nghiệm thu |
| RA-08 | p95 ≤ 50 ms trên dữ liệu thật | Tải thật |
| RA-09 | Sao lưu đã khôi phục thử | Diễn tập |
| RA-10 | Quay lại đã diễn tập | Diễn tập |
| RA-11 | 0 bí mật trong kho | Quét |
| RA-12 | Sẵn sàng ứng cứu sự cố | Nhân sự + tài liệu |

---

## 5. Sổ rủi ro

### 5.1 Rủi ro dự án

| Mã | Rủi ro | Khả năng | Tác động | Mức | Giảm thiểu | Chủ thể |
|---|---|:---:|:---:|:---:|---|---|
| RSK-01 | Bí mật lộ tiếp trong kho | Trung bình | Rất cao | **Cao** | Quét trước khi đẩy | Nhóm |
| RSK-02 | Ước lượng thấp hơn thực tế | **Cao** | Trung bình | Cao | Đặt mốc lại sau mỗi pha | PM |
| RSK-03 | Cắt mã làm hỏng chức năng ẩn | Trung bình | Cao | Cao | Rà soát phụ thuộc + kiểm thử hồi quy | Nhóm |
| RSK-04 | Migration chạy trên dữ liệu thật nhưng lỗi | Trung bình | Cao | Cao | Kiểm thử migration trên dữ liệu thật | Nhóm |
| RSK-05 | Cache quyền không vô hiệu hoá được | Trung bình | Rất cao | Cao | Bỏ cache nếu không làm được | Nhóm |
| RSK-06 | Không đạt 50 ms khi lượng lớn | Trung bình | Trung bình | Trung bình | Tải thật trước phát hành | Nhóm |
| RSK-07 | Rò rỉ dữ liệu tenant | Thấp | Rất cao | Cao | 4 lớp + kiểm thử tự động | Nhóm |
| RSK-08 | Vận hành tốn nhiều nhân lực hơn dự kiến | Cao | Trung bình | Cao | Thiết kế tự phục vụ | PM |
| RSK-09 | Phụ thuộc bên thứ ba gặp sự cố | Trung bình | Trung bình | Trung bình | Có phương án dự phòng | Nhóm |
| RSK-10 | Nhân lực không đủ cho 80–92 ngày công | Trung bình | Cao | Cao | Thuê ngoài / giảm phạm vi | Owner |

### 5.2 Rủi ro kỹ thuật

| Mã | Rủi ro | Giảm thiểu |
|---|---|---|
| RSK-11 | Đặt số migration trùng | Đọc đầu chuỗi thật hoặc để công cụ sinh |
| RSK-12 | Chạy kiểm thử trên SQLite | Luôn dùng PostgreSQL |
| RSK-13 | Báo `PASS` cho thứ chưa chạy | Ghi `CHƯA CHẠY` |
| RSK-14 | Kết quả khác giữa các máy | Chạy lại trên môi trường sạch |
| RSK-15 | Ký tự tiếng Việt gây lỗi mã hoá | Không dùng `print()` tiếng Việt |

### 5.3 Rủi ro pháp lý

| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|:---:|---|
| RSK-16 | Bán `vnbroker` khi chưa có license thương mại | **Rất cao** | Ký trước khi bán |
| RSK-17 | Cá nhân mua được tier C | Cao | Chờ T3 |
| RSK-18 | Khách dùng quyền sai mục đích | Cao | KYC · duyệt · nhật ký |
| RSK-19 | Định vị thương hiệu bị hiểu là sàn giao dịch | Trung bình | Đổi tên · disclaimer |

### 5.4 Ba rủi ro chặn tuyệt đối

| Mã | Rủi ro | Điều kiện dừng |
|---|---|---|
| **RSK-01** | Bí mật trong kho mã | **Không viết dòng mã nào cho tới khi xử lý xong** |
| **RSK-16** | Bán không có license thương mại | **Không bán tier C** |
| **RSK-07** | Rò rỉ dữ liệu tenant | **Không phát hành khi còn lỗi rò rỉ** |

---

## 6. Quy tắc làm việc nhóm

### 6.1 Nguyên tắc từ `AGENTS.md`

| Quy tắc | Áp dụng |
|---|---|
| Không commit thẳng vào `dev` | Tạo `feat/<phạm vi>` rồi yêu cầu hợp nhất |
| Không sửa tệp đang được người khác giữ | Khai báo trước khi sửa dòng đầu |
| Không tự đặt số migration | Đọc đầu chuỗi thật |
| Không chạy kiểm thử trên SQLite | Dựng PostgreSQL |
| Không báo `PASS` cho thứ chưa chạy | Ghi `CHƯA CHẠY` |
| Kết quả kiểm thử phải ghi rõ môi trường | Nêu rõ |

### 6.2 Nguyên tắc bàn giao

| Mã | Quy tắc |
|---|---|
| HO-01 | Bàn giao phải kèm danh sách kiểm thử đã chạy, kèm kết quả |
| HO-02 | Việc chưa hoàn thành phải ghi `CHƯA CHẠY` hoặc `CHƯA LÀM` |
| HO-03 | Nguyên nhân chưa làm phải nêu rõ, không im lặng |
| HO-04 | Mọi quyết định lệch thiết kế phải được ghi lại |

> **HO-02 là nguyên tắc quan trọng nhất.** Việc chưa làm mà báo là xong là nguyên nhân khiến sự cố phát hiện muộn hơn mức cần thiết. Ghi `CHƯA CHẠY` không tốn gì; giấu việc chưa làm thì tốn rất nhiều.

---

## 7. Câu hỏi còn mở — tổng hợp

### 7.1 Quyết định cần Owner (chặn nhiều phần)

| # | Câu hỏi | Chặn |
|---|---|---|
| Q-01 | Ký license thương mại `vnbroker` khi nào? | Bán tier C |
| Q-02 | Giá mỗi sản phẩm / tier? | Thanh toán |
| Q-03 | Cho phép tự đăng ký hay bắt buộc duyệt? | Luồng đăng ký |
| Q-04 | Hạn mức mặc định mỗi gói? | Định lượng |
| Q-05 | Ai ký duyệt tier C? | Phê duyệt |
| Q-06 | Có dùng lại thương hiệu `vninvest` không? | Định pháp nhân |
| Q-07 | Hạn mức mỗi tier cụ thể? | Định lượng |
| Q-08 | Đổi tier tăng giữa kỳ tính tiền thế nào? | Thanh toán |
| Q-09 | Giới hạn số PAT đồng thời? | Xác thực |
| Q-10 | Kích hoạt máy theo thiết bị / IP / cả hai? | Kích hoạt |
| Q-11 | Hợp đồng điện tử có cần chữ ký? | Hợp đồng |
| Q-12 | Chu kỳ tính cước? | Thanh toán |
| Q-13 | Bắt buộc email miền công ty? | Đăng ký |
| Q-14 | Google Workspace trả phí hay miễn phí? | Đăng nhập |
| Q-15 | Chấp nhận người dùng email cá nhân? | Đăng ký |
| **Q-16** | **Cá nhân mua được tier C?** | **BR-12** |
| Q-17 | Giá gói cá nhân? | Thanh toán |
| Q-18 | Nhân sự cho 80–92 ngày công? | Phạm vi |
| Q-19 | Ngân sách hạ tầng? | Vận hành |

### 7.2 Ba câu hỏi chặn tiến độ

| # | Câu hỏi | Chặn pha |
|---|---|---|
| **Q-16** | Cá nhân mua được tier C không? | Pha 5 (BR-12) |
| **Q-17** | Giá gói cá nhân? | Pha 6 |
| **Q-02** | Giá sản phẩm / tier? | Pha 6 |

> Ba câu này **không chặn việc cắt mã** (Pha 1–2). Nhưng chặn Pha 6. Nên có thể bắt đầu ngay với Pha 1–2 trong khi chờ.

### 7.3 Câu hỏi cần điều tra kỹ thuật

| # | Câu hỏi | Người phụ trách |
|---|---|---|
| I-01 | `TenantQuotaMiddleware` (`:323`) đang tính hạn mức thế nào? | Nhóm |
| I-02 | `features_map` (`:196-201`) chứa những gì? | Nhóm |
| I-03 | `tasks.py` (35 KB) của `commercial` có tác vụ nào phụ thuộc app đã cắt? | Nhóm |
| I-04 | `vninvestcharts-widget` adapter có hardcode endpoint `vninvest` không? | Nhóm |
| I-05 | Có bao nhiêu cổng trong `routeCatalog.js` (57 route) là miền tài chính? | Nhóm |

---

## 8. Checklist khởi động dự án

### 8.1 Trước khi viết dòng mã đầu tiên

- [ ] Xử lý bí mật trong kho mã (T1) — **thu hồi → xoay → gỡ → lọc lịch sử → chặn tái diễn**
- [ ] Tạo kho mới, sao chép mã sạch
- [ ] Dựng PostgreSQL cho môi trường phát triển
- [ ] Chốt Q-01..Q-05, Q-16..Q-19
- [ ] Bổ sung cột `tenant_type` vào kế hoạch migration từ đầu

### 8.2 Trước khi phát hành lần đầu

- [ ] 10 cổng G-1..G-10 đạt (trừ G-10 nếu chưa bán tier C)
- [ ] 12 tiêu chí RA-01..RA-12 đạt
- [ ] Diễn tập khôi phục thành công
- [ ] Diễn tập quay lại thành công
- [ ] Bảng điều khiển cảnh báo hoạt động
- [ ] Tài liệu vận hành hoàn tất
- [ ] Nhân sự trực sự cố đã sắp xếp

---

## 9. Thứ tự khởi động đề xuất

### Bước 1 — Làm được ngay, không cần chờ ai

| Việc | Tại sao không cần chờ |
|---|---|
| Xử lý bí mật trong kho | Không phụ thuộc quyết định nào |
| Tạo kho mới | Như trên |
| Dựng PostgreSQL | Như trên |
| Pha 1 — Cắt mã | Cần kết quả I-01..I-05 từ nhóm, không cần Owner |
| Pha 2 — Nợ kỹ thuật | Như trên |

### Bước 2 — Chờ quyết định Owner

| Việc | Chờ gì |
|---|---|
| Pha 6 — Thanh toán | Q-02, Q-17 — giá |
| BR-12 — Ràng buộc tier C | Q-16 |
| Pha 11 — Tier C | Q-01, Q-05 + tư vấn pháp lý |

### Bước 3 — Chờ pháp lý

| Việc | Chờ gì |
|---|---|
| Bán `vnbroker-data` | License thương mại (T2) |
| Bán `vnbroker-brokerage` | T2 + T5 + T6 |

---

## 10. Tổng kết bộ hồ sơ

| Mã | Tài liệu | Dòng | Nội dung chính |
|---|---|---:|---|
| D01 | Quy trình + PRD | 318 | 6 pha · 6 cổng chất lượng · 12 chức năng · 2 loại khách |
| D02 | BRD | 442 | 21 user story · 16 quy tắc nghiệp vụ |
| D03 | Quy trình nghiệp vụ | 513 | 10 quy trình BPMN · 10 trường hợp biên |
| D04 | Kiến trúc + ADR | 525 | 9 quyết định kiến trúc · C4 ba cấp |
| D05 | Phân rã chức năng | 392 | 15 hạng mục · cắt 70% LOC |
| D06 | ERD | 690 | 26 bảng · 11 ràng buộc toàn vẹn · 15 bước migration |
| D07 | API | 574 | 34 thao tác · 24 mã lỗi |
| D08 | UI/UX | 636 | 16 màn hình · 8 trạng thái quyền |
| D09 | Bảo mật | 561 | STRIDE 8 nhóm · 10 rủi ro · 4 lớp tenant |
| D10 | Kiểm thử | 508 | 62 kiểm thử nghiệp vụ · 9 cổng tự động |
| D11 | Vận hành | 512 | 4 môi trường · 4 SLO · 8 tác vụ nền |
| D12 | Quản lý dự án | 517 | 65 công việc · 10 cổng · 19 rủi ro |
| | **Tổng** | **≈6 186** | |

### 10.1 Chỉ số bộ hồ sơ

| Chỉ số | Giá trị |
|---|---|
| Số tài liệu | 12 / 12 |
| Số quyết định kiến trúc | 9 |
| Số quy tắc nghiệp vụ | 16 |
| Số bảng dữ liệu | 26 |
| Số thao tác API | 34 |
| Số kiểm thử nghiệp vụ | 62 |
| Số rủi ro đã định danh | 19 |
| Số câu hỏi còn mở | 19 |
| Ước lượng công sức | 80–92 ngày công |

### 10.2 Ba việc phải làm trước mọi thứ khác

| # | Việc | Vì sao |
|---|---|---|
| 1 | **Xử lý bí mật trong kho mã** | Nếu không, mọi tính năng thêm vào đều không bảo đảm được điều gì |
| 2 | **Chốt Q-16** (tier C cho cá nhân) | Quyết định ranh giới pháp lý — ảnh hưởng thiết kế Pha 5 |
| 3 | **Bắt đầu Pha 1–2** | Không phụ thuộc quyết định nào — tiết kiệm thời gian chờ |

---

**Cổng chất lượng:** QG-6 định nghĩa — 65 công việc phân 12 pha · 10 cổng nghiệm thu · 12 tiêu chí phát hành · 19 rủi ro · 19 câu hỏi còn mở.
**Kết thúc bộ hồ sơ.**