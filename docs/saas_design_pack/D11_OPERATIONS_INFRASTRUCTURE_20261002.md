# D11 — Vận hành, Triển khai & Hạ tầng

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** Google SRE Book · ISO/IEC 25010 · **Tài liệu trước:** D10 · **Tài liệu sau:** D12

---

## 1. Cấu trúc môi trường

| Môi trường | Dữ liệu | Ai truy cập | Mục đích | Thời gian sống |
|---|---|---|---|---|
| Phát triển | Sinh tự động mỗi lượt | Nhóm phát triển | Làm việc hằng ngày | Không giới hạn |
| Thử nghiệm | Giả định, tạo lại hằng ngày | Nhóm phát triển | Kiểm thử tích hợp | Không giới hạn |
| Trước phát hành | Sao chép thử nghiệm + phụ đạo | Nội bộ | Nghiệm thu chấp nhận | 2 tuần |
| Sản xuất | Thật | Khách + vận hành | Vận hành thật | Không giới hạn |

### 1.1 Nguyên tắc

| # | Nguyên tắc |
|---|---|
| 1 | Dữ liệu thử nghiệm **không bao giờ** lên sản xuất |
| 2 | Mỗi môi trường có bộ bí mật riêng |
| 3 | Trước phát hành có phụ đạo dữ liệu đủ lớn để tải thật |
| 4 | Sản xuất không dùng dữ liệu giả |

> **Phụ đạo dữ liệu là nguyên tắc số 4 trong ADR của D04 B.4.1.** Cơ sở dữ liệu chỉ có 100 dòng không phát hiện được vấn đề chỉ mục ở quy mô 1 triệu dòng.

---

## 2. Cơ sở hạ tầng

### 2.1 Thành phần

| Thành phần | Lý do cần | Quy mô khởi đầu |
|---|---|---|
| Máy chủ ứng dụng | Chạy API + giao diện | 2 bản (dự phòng) |
| Cơ sở dữ liệu PostgreSQL | Lưu trữ | 1 thể chế chính + 1 bản sao |
| Redis | Cache quyền + hàng đợi | 1 thể chế |
| Lưu trữ tệp | Hợp đồng, chứng từ PDF | Theo nhu cầu |
| Dịch vụ giám sát | Chỉ số + cảnh báo | Bắt buộc |
| Hệ thống nhật ký tập trung | Truy vết sự cố | Bắt buộc |

### 2.2 Quyết định không làm

| Không dùng | Vì sao |
|---|---|
| Kubernetes | Quá nặng v1.0 — một máy chủ ứng dụng là đủ |
| Dịch vụ vi mô | Quy mô v1.0 không cần |
| Cơ sở dữ liệu vector | Không có yêu cầu tìm kiếm ngữ nghĩa |
| Cụm nhiều vùng | Khách ở một thị trường |

> **Nguyên tắc:** không thêm công nghệ mới trừ khi có yêu cầu đã xác nhận. Mỗi công nghệ thêm vào là một phần vận hành phải học và bảo trì.

---

## 3. Môi trường chạy

### 3.1 Cấu hình bắt buộc

| Biến môi trường | Bắt buộc | Hành vi khi thiếu |
|---|:---:|---|
| `DJANGO_SECRET_KEY` | ✔ | Từ chối khởi động |
| `DJANGO_ALLOWED_HOSTS` | ✔ | Từ chối nếu rỗng hoặc `*` |
| `CORE_PAT_PEPPER` | ✔ | Từ chối khởi động |
| `CORE_DATABASE_URL` | ✔ | `ImproperlyConfigured` |
| `BILLING_INFO_FERNET_KEY` | ✔ | Ném ngoại lệ |

> **Nguồn:** `settings.py` hiện đã raise `ImproperlyConfigured` cho 3 trường đầu. Giữ nguyên, không nới lỏng.

### 3.2 Bí mật khác

| Tên | Dùng cho |
|---|---|
| `DJANGO_SECRET_KEY` | Ký phiên |
| `CORE_PAT_PEPPER` | Băm PAT |
| `BILLING_INFO_FERNET_KEY` | Mã hoá thông tin thanh toán |
| Thông tin kết nối cơ sở dữ liệu | — |
| Thông tin kết nối Redis | — |
| Khoá webhook thanh toán | Xác minh webhook |

> **Biến cần thêm:** `BILLING_INFO_FERNET_KEY` chưa tồn tại trong hệ thống hiện tại — thiết kế mới cần. Phải sinh **một giá trị riêng**, không dùng chung với `DNSE_CREDENTIAL_FERNET_KEY`.

---

## 4. Triển khai

### 4.1 Trình tự

```
1. Chạy kiểm thử tự động            ← bắt buộc pass
2. Kiểm tra lệch tài liệu API        ← bắt buộc pass
3. Sao lưu cơ sở dữ liệu             ← xác nhận thành công
4. Áp dụng migration                  ← kiểm tra số lá chùy
5. Chạy tác vụ nền dữ liệu (nếu có)
6. Triển khai ứng dụng
7. Kiểm tra sức khoẻ
8. Cắt chuyển
9. Theo dõi 30 phút
10. Ghi nhận kết quả
```

### 4.2 Quy trình quay lại

| Bước | Hành động |
|:---:|---|
| 1 | Dừng cắt chuyển ngay |
| 2 | Khôi phục mã phiên bản trước |
| 3 | Quay lại migration (nếu có thể) |
| 4 | Khôi phục cơ sở dữ liệu từ sao lưu (nếu không thể) |
| 5 | Thông báo khách hàng bị ảnh hưởng |

> **Yêu cầu:** quy trình quay lại phải được **diễn tập thành công** ít nhất một lần trước khi phát hành lần đầu. Một quy trình quay lại chưa từng thử là một quy trình không tồn tại.

### 4.3 Cổng phát hành

| Cổng | Điều kiện |
|---|---|
| Kiểm thử tự động | 100% pass |
| Phủ mã | ≥ 85% |
| Bảo mật tự động | Không lỗi nghiêm trọng |
| Kiểm thử tenant | 100% pass |
| Sao lưu | Đã tạo và xác nhận |
| Quay lại | Đã diễn tập |
| Sức khoẻ hệ thống | Đạt |

---

## 5. Chỉ số

### 5.1 Chỉ số dẫn dắt

| Chỉ số | Mục tiêu | Tần suất |
|---|---|---|
| Doanh thu định kỳ | Theo kế hoạch | Tháng |
| Số tenant hoạt động | Tăng đều | Tháng |
| Tỷ lệ gia hạn | Theo kế hoạch | Tháng |
| **Tỷ lệ rời bỏ** | Theo kế hoạch | Tháng |
| Sản phẩm đã kích hoạt | Tăng đều | Tháng |

### 5.2 Chỉ số vận hành

| Chỉ số | Mục tiêu |
|---|---|
| Độ trễ p95 quyết định quyền | ≤ 50 ms |
| Độ trễ p99 quyết định quyền | ≤ 150 ms |
| Tỷ lệ lỗi 5xx | < 0.1% |
| Khả dụng cổng quyền | ≥ 99.9% |
| Độ trễ webhook thanh toán | < 5 giây |

### 5.3 Tách chỉ số theo loại khách

| Chỉ số | Doanh nghiệp | Cá nhân |
|---|---|---|
| Thời gian từ đăng ký tới dùng | Nhiều ngày (chờ duyệt) | ≤ 5 phút |
| Tỷ lệ hoàn thành đăng ký | Không đo | Đo |
| Tỷ lệ chuyển đổi thử → trả tiền | Không đo | Đo |
| Tỷ lệ rời bỏ | Thấp | Cao — đã chấp nhận |

> **Không gộp hai nhóm.** Tỷ lệ rời bỏ cao ở cá nhân là bình thường. Nếu gộp chung, tỷ lệ tổng thể tăng và có thể gây đánh giá nhầm chất lượng sản phẩm.

---

## 6. Chỉ số cấp dịch vụ (SLO)

### 6.1 Định nghĩa

| SLO | Mục tiêu | Cửa sổ đo | Lỗi |
|---|---|---|---|
| Cổng quyết định quyền | 99.9% | 30 ngày | 5xx, quá thời gian 1 giây |
| Cổng xác thực | 99.9% | 30 ngày | 5xx |
| Trang danh mục sản phẩm | 99.5% | 30 ngày | 5xx |
| Xử lý webhook | 99.0% | 30 ngày | Không xác nhận trong 60 giây |

### 6.2 Cửa sổ lỗi

| SLO | Số phút lỗi tối đa mỗi 30 ngày |
|---|---:|
| 99.9% | 43 phút |
| 99.5% | 216 phút |
| 99.0% | 432 phút |

> **Không nên đặt SLO 100%.** Không thể đạt được, và buộc đội vận hành phải báo cáo sự cố cho từng lỗi nhỏ — khiến cảnh báo trở nên vô nghĩa.

### 6.3 Tính dự phòng

| Cổng | Ngân sách lỗi | Đánh giá rủi ro |
|---|---|---|
| Quyết định quyền | Rất thấp | Vì mọi tích hợp đều phụ thuộc |
| Xác thực | Rất thấp | Không vào được thì không dùng được |
| Danh mục sản phẩm | Thấp | Có thể dùng bản ghi nhớ |
| Webhook thanh toán | Trung bình | Không cấp quyền thì khách không dùng được |

---

## 7. Giám sát & cảnh báo

### 7.1 Nhóm chỉ số

| Nhóm | Chỉ số |
|---|---|
| Lưu lượng | Số yêu cầu mỗi phút · theo cổng |
| Lỗi | Tỷ lệ 5xx · theo mã lỗi |
| Độ trễ | p50 · p95 · p99 |
| Hạ tầng | Mã hoá · bộ nhớ · số kết nối |
| Nghiệp vụ | Số quyết định quyền · tỷ lệ từ chối |
| **Quyền** | **Tỷ lệ `approval_pending`** |
| **Thanh toán** | **Webhook thất bại** |

### 7.2 Cảnh báo theo mức

| Mức | Điều kiện | Kênh | Thời gian |
|---|---|---|:---:|
| S1 | Cổng quyền không phản hồi | Báo ngay | 15 phút |
| S1 | Tỷ lệ lỗi > 5% trong 5 phút | Báo ngay | 15 phút |
| S1 | Sao lưu thất bại | Báo ngay | 1 giờ |
| S2 | p95 > 100 ms trong 15 phút | Kênh vận hành | 1 giờ |
| S2 | Webhook thất bại > 5 lần | Kênh vận hành | 1 giờ |
| S3 | Tỷ lệ lỗi > 0.5% | Bảng điều khiển | 1 ngày |
| S3 | Tỷ lệ từ chối tăng đột biến | Bảng điều khiển | 1 ngày |

### 7.3 Cảnh báo theo dự báo

| Loại | Ví dụ |
|---|---|
| Tăng đột biến | Số yêu cầu tăng 5 lần so với trung bình tuần trước |
| Hạ nền | Độ trễ tăng đều 3 ngày liên tiếp |
| Dự báo hết hạn | Quyền sắp hết hạn trong 7 ngày |
| Dự báo đầy | Dung lượng đạt 80% |

> **Cảnh báo theo dự báo giá trị hơn cảnh báo ngưỡng.** Khi dung lượng đạt 80% thì đã muộn để hành động. Cảnh báo ở 70% kèm dự báo bao giờ đạt 100% mới kịp xử lý.

---

## 8. Sao lưu & khôi phục

### 8.1 Lịch sao lưu

| Dữ liệu | Tần suất | Thời gian giữ | RPO |
|---|---|---|---|
| Cơ sở dữ liệu | Hằng ngày 02:00 | 30 ngày hằng ngày · 12 tháng theo tháng | 24 giờ |
| Cơ sở dữ liệu | Liên tục | 7 ngày | 1 giờ |
| Tệp (hợp đồng) | Hằng ngày | 12 tháng | 24 giờ |
| Cấu hình hệ thống | Mỗi lần thay đổi | Vĩnh viễn | — |

> **Sao lưu liên tục cho RPO 1 giờ.** RPO 24 giờ không đạt được NFR-D04 trong D02 (RPO ≤ 15 phút). Cần sao lưu liên tục để đạt yêu cầu thật.

### 8.2 Yêu cầu bảo mật sao lưu

| Yêu cầu | Lý do |
|---|---|
| Mã hoá ở tầng lưu trữ | Sao lưu chứa dữ liệu cá nhân |
| Truy cập hạn chế | Cùng cấp độ với dữ liệu gốc |
| Tách khoá khỏi bản sao lưu | Kẻ tấn công sao lưu không lấy được khoá |

### 8.3 Kiểm tra khôi phục

| Tần suất | Nội dung |
|---|---|
| Hằng tháng | Khôi phục bản sao lưu lên môi trường thử nghiệm, chạy kiểm tra |
| Hằng quý | **Diễn tập khôi phục toàn bộ** với thời gian thực tế |

> **Sao lưu mà chưa từng khôi phục thì không phải sao lưu.** Đây là nguyên tắc cơ bản. Bản sao lưu hỏng chỉ phát hiện được khi cần dùng — lúc đó thì đã muộn.

### 8.4 RTO / RPO

| Mục tiêu | Giá trị | Đo bằng |
|---|---|---|
| RTO | ≤ 1 giờ | Diễn tập hằng quý |
| RPO | ≤ 15 phút | Kiểm tra điểm khôi phục |

---

## 9. Quản lý sự cố

### 9.1 Phân loại

| Mức | Định nghĩa | Ví dụ |
|---|---|---|
| S1 | Dịch vụ gián đoạn toàn bộ | Cổng quyền không phản hồi |
| S2 | Chức năng chính hỏng, có đường vòng | Thanh toán lỗi |
| S3 | Chức năng phụ hỏng | Trang thống kê lỗi |
| S4 | Lỗi hiển thị | Nhãn sai |

### 9.2 Vai trò

| Vai trò | Trách nhiệm | Có thể gộp |
|---|---|:---:|
| Người trực | Nhận thông báo, phân loại | Không |
| Kỹ sư trực | Điều tra, khắc phục | Không |
| Người phê duyệt | Quyết định công bố | Có |
| Người ghi chép | Mốc thời gian, quyết định | Gộp với trực |

### 9.3 Trình tự

```
Phát hiện → Phân loại → Báo cáo → Khắc phục → Xác nhận → Rút kinh nghiệm
   │           │          │          │          │            │
   │ Tự động  │ Theo mức │ Kênh     │ Theo mức │ Cả khách  │ Nếu S1/S2
   │ hoặc     │ độ       │ theo mức │ độ       │ hưởng thấy│ trong 5 ngày
   │ khách    │          │          │          │ đã khôi   │
   │ báo      │          │          │          │ phục      │
```

### 9.4 Quy tắc rút kinh nghiệm

| Mã | Quy tắc |
|---|---|
| IR-01 | S1 và S2 phải có bản tóm tắt trong 5 ngày |
| IR-02 | Nêu nguyên nhân gốc, không đổ lỗi cá nhân |
| IR-03 | Mỗi hành động có giờ bắt đầu và kết thúc — để đo thời gian thực tế |
| IR-04 | Ghi cả những điều gần xảy ra |

> **IR-04 dễ bị bỏ sót.** Sự cố gần xảy ra là thông tin giá trị nhất về điểm yếu sắp tới — nhưng không ai báo vì "không có gì hỏng".

### 9.5 Dữ liệu cần ghi lại

| Mục | Lý do |
|---|---|
| Thời điểm phát hiện | Đo thời gian phát hiện |
| Thời điểm bắt đầu khắc phục | Đo thời gian phản ứng |
| Thời điểm khắc phục xong | Đo thời gian phục hồi |
| Số khách bị ảnh hưởng | Đánh giá mức độ |
| Nội dung thông báo đã gửi | Kiểm tra cam kết với khách |

---

## 10. Quản lý khách hàng

### 10.1 Kênh hỗ trợ

| Kênh | Dùng cho | SLO phản hồi |
|---|---|---|
| Tài liệu | Câu hỏi thường gặp | Tức thì |
| Thông báo trong sản phẩm | Sự cố hệ thống | Tự động |
| Thư | Không khẩn cấp | 1 ngày làm việc |
| Trực tuyến | S1 | 15 phút |

### 10.2 Tự phục vụ

| Nội dung | Mục đích |
|---|---|
| Thông báo khi bị từ chối quyền, kèm lý do | Không cần gọi để hỏi "tại sao bị chặn" |
| Hướng dẫn cài đặt SDK có thể sao chép | Không cần hỏi cách dán khóa |
| Trang trạng thái | Không cần gọi hỏi "có sự cố không" |
| Ví dụ `mã lỗi` trong thông báo lỗi | Không cần chụp màn hình khi báo lỗi |

> **Mục tiêu G6 của D01: 80% yêu cầu hỗ trợ giải quyết được tự động.** Bốn mục trên là bốn nguyên nhân phổ biến nhất.

### 10.3 Nội dung nhạy cảm

| Nguyên tắc | Vì sao |
|---|---|
| Thông báo hệ thống không dùng từ mang tính pháp lý | Tránh tạo hiểu lầm về nghĩa vụ |
| Không yêu cầu khách gửi khóa API qua kênh hỗ trợ | Rò rỉ |
| Không yêu cầu khách gửi thông tin định danh qua thư | Bảo mật dữ liệu |

---

## 11. Nhiệm vụ nền

| Tác vụ | Tần suất | Lý do |
|---|---|---|
| Dọn entitlement hết hạn | Hằng ngày | Quét theo `current_period_end` |
| Gửi cảnh báo hết hạn | Hằng ngày | Trước 14 / 7 / 1 ngày |
| Chốt số liệu định lượng | Hằng giờ | Ghi theo lô |
| Tạo bản sao lưu | Hằng ngày 02:00 | RPO |
| Kiểm tra chứng từ thanh toán | Hằng ngày | Đối soát |
| Dọn phiên hết hạn | Hằng ngày | Bảo mật |
| Dọn kích hoạt cũ | Hằng tuần | Độ chính xác số liệu |
| Báo cáo doanh thu | Hằng tháng | Đối soát |

### 11.1 Quy tắc cho tác vụ nền

| Quy tắc | Lý do |
|---|---|
| Chạy lại được an toàn | Tránh ghi trùng khi thử lại |
| Ghi log đầy đủ | Xác định vấn đề khi tác vụ lỗi |
| Có giới hạn tốc độ | Không làm chậm cổng ứng dụng |
| Báo động khi thất bại | Tác vụ lỗi âm thầm tệ hơn không chạy |

> **Tác vụ nền lỗi âm thầm là kiểu lỗi nguy hiểm nhất.** Nếu tác vụ gửi cảnh báo hết hạn chạy sai, khách không được cảnh báo và không biết vì sao mất quyền. Phải có cảnh báo khi tác vụ thất bại.

---

## 12. Ngân sách vận hành

| Hạng mục | Tần suất |
|---|---|
| Hạ tầng máy chủ | Tháng |
| Cơ sở dữ liệu dự phòng | Tháng |
| Sao lưu dài hạn | Tháng |
| Chứng thư chứng kỳ số | Tháng |
| Công cụ giám sát | Tháng |
| Tên miền + chứng thư | Năm |
| Diễn tập khôi phục | Quý |

> **Chưa ấn định chi phí.** Cần biết giá hạ tầng thực tế mới lập ngân sách. Ghi nhận là câu hỏi chờ Owner.

---

**Cổng chất lượng:** QG-6 định nghĩa — 4 môi trường · 4 SLO kèm ngân sách lỗi · 8 cảnh báo theo mức · 8 tác vụ nền · quy trình quay lại đã định nghĩa.
**Tài liệu sau:** D12 — Quản lý dự án