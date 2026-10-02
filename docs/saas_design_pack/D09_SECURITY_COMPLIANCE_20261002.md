# D09 — Bảo mật & Tuân thủ

**Hồ sơ thiết kế SaaS quản lý phần mềm B2B**
**Ngày:** 2026-10-02 · **Trạng thái:** Đề xuất
**Chuẩn:** OWASP ASVS L2/L3 · ISO 27001 · **Tài liệu trước:** D08 · **Tài liệu sau:** D10

---

## 1. Bề mặt tấn công

| # | Điểm vào | Loại tấn công chính | Mức |
|:---:|---|---|:---:|
| 1 | Cổng quyết định quyền | Khai thác quyền, ghi đè tenant | **Rất cao** |
| 2 | Cổng xác thực | Dò tài khoản, chiếm phiên | Cao |
| 3 | Webhook thanh toán | Giả mạo giao dịch | Cao |
| 4 | Cổng quản trị | Nâng quyền đứng | Cao |
| 5 | Cơ sở dữ liệu | Truy vấn SQL | Cao |
| 6 | Kho bí mật | Rò rỉ khóa | **Rất cao** |
| 7 | Cổng đăng ký | Lạm dụng, spam | Trung bình |
| 8 | Tệp tải lên hợp đồng | Tệp độc hại | Trung bình |

---

## 2. STRIDE — phân tích mối đe doạ

### 2.1 Cổng quyết định quyền

| Mã | Đe doạ | Kịch bản tấn công | Biện pháp |
|---|---|---|---|
| STRIDE-S1 | Giả mạo | Đoán PAT của tenant khác | Hạt pepper · kiểm tra thời gian thẳng nhất quán |
| STRIDE-S2 | Nâng quyền | Đổi `product_code` để lấy quyền rộng hơn | Ràng buộc `product_requires_organization` |
| STRIDE-T1 | Giả mạo | Gửi `capability_codes` rỗng để né kiểm tra | Ràng buộc tối thiểu 1 phần tử |
| STRIDE-T2 | Thao túng | Sửa `decision_id` để đòi hoàn tiền | `decision_id` do máy chủ sinh, UUID v4 |
| STRIDE-I1 | Tiết lộ | Cố đọc quyền tenant khác qua tham số | Ràng buộc tenant bắt buộc ở tầng truy vấn |
| STRIDE-I2 | Tiết lộ | Webhook đoán xem tenant nào đã mua | Câu trả lời không chứa thông tin ngoài quyền của chính requester |
| STRIDE-D1 | Từ chối dịch vụ | Gọi 10⁶ lần/phút để nghẽn | Giới hạn tần suất 1 000/phút/PAT |
| STRIDE-E1 | Nâng quyền | Đổi trạng thái từ `requested` sang `approved` | Chỉ vai trò Compliance được đổi |

> **STRIDE-T1 là điểm dễ sót.** Nếu API chấp nhận mảng `capability_codes` rỗng và mặc định trả `allowed: true`, thì kẻ tấn công chỉ cần gửi `[]` là vượt qua được toàn bộ cơ chế kiểm tra.

### 2.2 Cổng xác thực

| Mã | Đe doạ | Kịch bản | Biện pháp |
|---|---|---|---|
| STRIDE-S1 | Dò tài khoản | Phân biệt "sai mật khẩu" với "không có email" | Thông báo chung `invalid_credentials` |
| STRIDE-S2 | Chiếm phiên | Đánh cắp token phiên | Cookie `HttpOnly` `Secure` `SameSite=Strict` |
| STRIDE-S3 | Chiếm phiên | Không đặt lại mật khẩu sau thay đổi quyền | Vô hiệu hoà token cũ khi quyền thay đổi |
| STRIDE-T1 | Tăng cường | Cài mật khẩu yếu cho tài khoản đã bị xâm nhập | Chặn mật khẩu trong danh sách bị lộ |
| STRIDE-D1 | Từ chối dịch vụ | Vượt giới hạn đăng nhập để khoá tài khoản khách | 10 lần/15 phút · **không** khoá vô thời hạn |

> **Phân biệt thông báo đăng nhập là chi tiết bảo mật cơ bản nhưng rất thường bị sai.** Trả `email_not_found` cho một địa chỉ và `wrong_password` cho địa chỉ khác là đưa danh sách email đã đăng ký cho kẻ tấn công.

### 2.3 Webhook thanh toán

| Mã | Đe doạ | Kịch bản | Biện pháp |
|---|---|---|---|
| STRIDE-S1 | Giả mạo | Webhook giả báo đã thanh toán | Xác minh chữ ký IPN |
| STRIDE-T2 | Thao túng | Gửi lại webhook đã xử lý | Khoá `txn_ref` đã xử lý |
| STRIDE-T2 | Thao túng | Webhook hợp lệ nhưng **số tiền không khớp** | Đối soát với hóa đơn trước khi cấp quyền |
| STRIDE-E1 | Nâng quyền | Webhook cho sản phẩm khác | Đối chiếu `product_code` trong hóa đơn |

> **Kịch bản "số tiền không khớp" là nguy hiểm nhất** vì chữ ký vẫn hợp lệ. Một hệ thống chỉ kiểm tra chữ ký mà không đối soát số tiền sẽ cho kẻ tấn công thanh toán 1 đồng và nhận gói đầy đủ.

### 2.4 Cổng quản trị

| Mã | Đe doạ | Kịch bản | Biện pháp |
|---|---|---|---|
| STRIDE-E1 | Nâng quyền | Ops tự cấp quyền rủi ro cao | Phân tách vai trò — BR-04.1 trong D03 |
| STRIDE-E1 | Nâng quyền | Ops đổi vai trò của chính mình | Không cho đổi vai trò của chính mình |
| STRIDE-R1 | Xác thực quá mức | Duyệt hàng loạt để mở gói cho nhiều khách | Mỗi khách một quyết định — BR-04.3 |
| STRIDE-T2 | Thao túng | Sửa lý do từ chối sau khi gửi | Nhật ký kiểm toán bất biến |

---

## 3. Ràng buộc tenant — phòng thủ nhiều lớp

Đây là rủi ro lớn nhất của mô hình một cơ sở dữ liệu chung (ADR-002).

### 3.1 Bốn lớp phòng thủ

| Lớp | Cơ chế | Chặn được gì |
|:---:|---|---|
| 1 | Bắt buộc `tenant_id` ở mọi bảng nghiệp vụ | Truy vấn không có ngữ cảnh tenant |
| 2 | Bộ lọc tầng truy vấn áp dụng mặc định | Quên ghi điều kiện lọc trong mã |
| 3 | Kiểm thử tự động mỗi lần phát hành | Lỗi lọc tenant tồn tại trong mã |
| 4 | Truy vấn xuyên tenant phải khai báo tường minh | Che giấu truy vấn toàn cục |

### 3.2 Quy tắc dữ liệu

| Quy tắc | Cơ chế |
|---|---|
| Không có bảng nghiệp vụ nào thiếu `tenant_id` | Kiểm tra tự động trong đường kiểm thử |
| Truy vấn không lọc tenant | Bắt buộc khai báo + ghi log cảnh báo |
| Truy vấn xuyên tenant | Chỉ dành cho báo cáo tài chính, có kiểm toán |
| Khoá ngoại liên bảng | Phải cùng `tenant_id` hoặc bảng toàn cục |

### 3.3 Cấm tuyệt đối

| Cấm | Vì sao |
|---|---|
| Khóa truy vấn theo địa chỉ IP khách | IP động, dùng chung |
| Khóa theo `user_agent` | Dễ giả mạo |
| Tin vào IP cho bảo mật | Chỉ dùng giới hạn tần suất và chống spam |

---

## 4. Xác thực & phiên

### 4.1 PAT — thiết kế

| Yêu cầu | Áp dụng |
|---|---|
| Lưu dạng băm, **không** lưu bản rõ | Dùng hàm băm chậm + hạt pepper |
| Hạt pepper lấy từ biến môi trường | `CORE_PAT_PEPPER` — đã có, bắt buộc ở production |
| Hiển thị token **một lần duy nhất** | AC-003.1, AC-003.2 |
| Danh sách chỉ hiện 4 ký tự cuối | AC-003.4 |
| Thu hồi có hiệu lực tức thời | Vô hiệu hoà cache đồng thời |

**Kết quả kiểm tra mã:** `settings.py` đã raise `ImproperlyConfigured` nếu thiếu `CORE_PAT_PEPPER` ở production. Đây là hàng rào đúng — **không được nới lỏng**.

### 4.2 Cấu hình bắt buộc ở production

| Kiểm tra | Hành vi khi thiếu | Vị trí |
|---|---|---|
| `DJANGO_SECRET_KEY` mặc định | Từ chối khởi động | `settings.py` |
| `ALLOWED_HOSTS` rỗng hoặc `*` | Từ chối khởi động | `settings.py` |
| `CORE_PAT_PEPPER` rỗng | Từ chối khởi động | `settings.py` |
| `BILLING_INFO_FERNET_KEY` rỗng | Ném ngoại lệ | Theo mẫu `models.py:879-885` |

> **Không nới lỏng bất kỳ hàng rào nào.** Chúng là sự cố cấu hình phổ biến nhất — và là những hàng rào ngăn thiệt hại khi cấu hình sai.

### 4.3 Chính sách mật khẩu

| Quy tắc | Giá trị |
|---|---|
| Độ dài tối thiểu | 10 ký tự |
| Yêu cầu | Có chữ và số |
| Lưu trữ | Argon2id hoặc PBKDF2 — không dùng MD5/SHA1 |
| Không tái sử dụng 5 mật khẩu gần nhất | |
| Vô hiệu hoà token cũ khi đổi mật khẩu | |

---

## 5. Danh mụt kiểm thử OWASP

### 5.1 Lớp 1 — Tự động, mỗi lần phát hành

| Kiểm tra | Lệnh |
|---|---|
| Phụ thuộc có lỗ hổng | `pip-audit` |
| Mã nguồn có mẫu nguy hiểm | Quét mã |
| Kiểm tra kiểu | Kiểm tra kiểu tĩnh |
| Quét bí mật trong kho | `gitleaks` |
| Kiểm tra cấu hình production | Tự viết — 4 kiểm tra §4.2 |
| Rò rỉ tenant | Kiểm thử tự động |

### 5.2 Lớp 2 — Thủ công, mỗi quý

| Kiểm tra | Nội dung |
|---|---|
| Xác thực | Bỏ qua kiểm tra phía máy chủ |
| Phân quyền | Nâng quyền ngang và dọc |
| Xác thực đầu vào | Chèn truy vấn, kiểu dữ liệu |
| Quản lý phiên | Cố định phiên, hết thời gian chờ |
| Nhật ký | Có ghi đủ không, có thể xoá không |

### 5.3 Lớp 3 — Trước mỗi phát hành chính

| Kiểm tra | Lý do |
|---|---|
| Đánh giá lại từ chối dịch vụ | Ảnh hưởng trực tiếp doanh thu |
| Rò rỉ giữa các tenant | Rủi ro lớn nhất của mô hình |
| Chuỗi cung ứng phụ thuộc | Bên thứ ba mới có thể thêm mối đe doạ |
| Kịch bản thu hồi quyền | Liên quan tiền thật |

---

## 6. Bảo vệ dữ liệu

### 6.1 Phân loại dữ liệu

| Loại | Ví dụ | Bảo vệ |
|---|---|---|
| Bí mật | PAT, khoá, mật khẩu | Không bao giờ ghi log · băm · mã hoá |
| Nhạy cảm | Hồ sơ pháp nhân, hợp đồng | Mã hoá · giới hạn truy cập · ghi log |
| Nội bộ | Cấu hình, giá | Kiểm soát truy cập |
| Công khai | Danh mục sản phẩm, giá niêm yết | Không hạn chế |

### 6.2 Mã hoá

| Dữ liệu | Thuật toán | Khoá |
|---|---|---|
| PAT | Băm chậm + hạt pepper | `CORE_PAT_PEPPER` |
| Thông tin thanh toán | Fernet | `BILLING_INFO_FERNET_KEY` |
| Kết nối cơ sở dữ liệu | TLS | Chứng thư |
| Sao lưu | Mã hoá ở tầng lưu trữ | Do hạ tầng quản lý |

> **Số thẻ tín dụng không bao giờ lưu.** Nếu sau này dùng thẻ, chỉ lưu token của cổng thanh toán. Đây là yêu cầu PCI-DSS và giảm mạnh bề mặt tấn công.

### 6.3 Quy tắc nhật ký kiểm toán

| Ghi | Không ghi |
|---|---|
| Ai thực hiện | Giá trị PAT |
| Thao tác gì | Nội dung Authorization |
| Khi nào | Mật khẩu |
| Với đối tượng nào | Số thẻ |
| Kết quả | Toàn bộ nội dung yêu cầu |

**Bất biến:** nhật ký chỉ thêm, không sửa, không xoá.

---

## 7. Bảo mật cho luồng cá nhân

> Bổ sung theo ADR-007. Đây là phần **dễ bị bỏ sót nhất** khi thêm nhóm khách mới.

### 7.1 Lạm dụng tài khoản

| Mã | Đe doạ | Biện pháp |
|---|---|---|
| IND-S1 | Tạo hàng nghìn tài khoản miễn phí | Turnstile · giới hạn 5/ngày/IP |
| IND-S2 | Tạo hàng loạt, chuyển email | Giới hạn đổi email 3 lần/tháng |
| IND-S3 | Chia sẻ khóa API cho nhiều người | Giới hạn slot máy theo gói |
| IND-S4 | Dùng thử rồi bỏ, lặp lại để lấy miễn phí | Giới hạn 1 tài khoản/email · 1 tài khoản/thiết bị |

> **Giới hạn theo IP phải đặt ngưỡng cao.** Nhiều người dùng chung IP ở văn phòng và mạng di động. Đặt thấp sẽ chặn nhầm người dùng hợp lệ — AC-007.4.

### 7.2 Chia sẻ khóa API

Đây là mối lo lớn nhất của SaaS developer: khách dùng thử rồi chia sẻ khóa cho người khác.

| Biện pháp | Cơ chế | Giới hạn |
|---|---|---|
| Giới hạn slot máy | Kích hoạt máy theo gói | Tầm |
| Ràng buộc hạn mức | Meter | Cao |
| Theo dõi mẫu sử dụng | Phát hiện dùng bất thường | Trung bình |
| Chữ ký phía máy khách | Chống sửa mã | Cao |

> **Không thể chặn hoàn toàn.** Kẻ lạm dụng có thể dùng một khóa từ nhiều máy. Vì vậy cần **kết hợp giới hạn hạn mức với giám sát bất thường**, không chỉ một biện pháp.

### 7.3 Rủi ro pháp lý riêng của nhóm cá nhân

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Cá nhân không có tư cách pháp nhân | Cao | Ràng buộc BR-12 — chờ Owner xác nhận |
| Nhiều tài khoản trống phí | Trung bình | Giới hạn 1 tài khoản/email |
| Bán cho người không đủ tuổi | Trung bình | Xác minh email · điều khoản |
| Khóa API bị bán lại | Cao | Giới hạn slot · chữ ký phía máy khách |

---

## 8. Tuân thủ

### 8.1 Yêu cầu theo loại khách

| Yêu cầu | Doanh nghiệp | Cá nhân |
|---|:---:|---:|
| Hồ sơ pháp nhân | ✔ | ✘ |
| Hợp đồng | ✔ | ✘ |
| Xác minh người đại diện | ✔ | ✘ |
| Xác minh dân danh | Theo yêu cầu | ✘ |
| Phiên bản điều khoản đã ký | ✔ | ✔ |
| Hóa đơn VAT | ✔ | ✘ — biên nhận |
| Nhật ký kiểm toán | ✔ | Chỉ hệ thống |

### 8.2 Quyền được lưu giữ

Dữ liệu về khách phải giữ đủ lâu để giải quyết khiếu nại và kiểm toán.

| Loại | Thời gian lưu |
|---|---|
| Nhật ký kiểm toán | 5 năm |
| Chứng từ thanh toán | 10 năm |
| Quyết định cấp quyền | 5 năm |
| Hồ sơ pháp nhân | Theo quy định kế toán |
| Phiên đăng nhập | 30 ngày |

### 8.3 Quyền của khách

| Quyền | Cơ chế |
|---|---|
| Xuất dữ liệu của mình | Tải xuất API |
| Xem nhật ký của mình | Trang nhật ký |
| Sửa thông tin | Màn hình cài đặt |
| Yêu cầu xoá dữ liệu | Yêu cầu hỗ trợ |

> **Không cho xoá ngay lập tức.** Phải giữ nhật ký và chứng từ theo thời hạn quy định. Xoá tức thì sẽ phá vỡ khả năng điều tra sự cố.

---

## 9. Quản lý bí mật

### 9.1 Sự cố đã xảy ra

| Mục | Chi tiết |
|---|---|
| Vị trí | `compose.dev.env` |
| Trạng thái | **Trong kho mã, không bị bỏ qua** |
| Nội dung | Khoá mã hoá thông tin xác thực + thông tin bí mật khác |
| Tác động | **Mọi dữ liệu xác thực trong cơ sở dữ liệu bị giải mã được** |

### 9.2 Trình tự xử lý — không được đảo

| Bước | Hành động | Ghi chú |
|:---:|---|---|
| 1 | **Thu hồi** khoá | Làm vô hiệu ngay |
| 2 | **Xoay** khoá | Sinh khoá mới |
| 3 | **Gỡ** khỏi HEAD | Xoá khỏi nhánh hiện tại |
| 4 | **Lọc** lịch sử | Cần mọi agent đã dừng |
| 5 | **Chặn tái diễn** | Chặn commit bí mật vào kho |

> **Không lọc lịch sử khi còn agent đang chạy.** Bước 4 phá vỡ công việc của mọi người đang làm dở. Làm sau khi mọi người đã dừng.

### 9.3 Ngăn tái diễn

| Biện pháp | Cách thực thi |
|---|---|
| Bỏ qua tệp môi trường có bí mật | Quy tắc bỏ qua |
| Tệp mẫu chỉ chứa khoá giả | Kiểm tra trong đường kiểm thử |
| Quét bí mật trước khi đẩy | Chặn ở máy chủ |
| Không in bí mật ra nhật ký | Kiểm tra tự động |
| Kiểm soát bí mật tập trung | Biến môi trường · dịch vụ bí mật |

> **Tệp mẫu phải chứa khoá giả hợp lệ về hình thức.** Nếu tệp mẫu chứa giá trị vô lý, không có khả năng phát hiện tệp thật lọt vào kho.

---

## 10. Sẵn sàng ứng cứu sự cố

### 10.1 Kịch bản và phản ứng

| Sự cố | Bước đầu tiên | Thời gian mục tiêu |
|---|---|---|
| Rò rỉ PAT | Thu hồi toàn bộ PAT đó | Ngay |
| Lộ khoá bí mật | Thu hồi khoá (bước 1 §9.2) | Ngay |
| Rò rỉ dữ liệu tenant | Khoá tài khoản liên quan · điều tra | 1 giờ |
| Cổng quyết định quyền gián đoạn | Chuyển sang chỉ đọc hoặc bảo thủ | 15 phút |
| Webhook giả mạo đại diện | Chặn địa chỉ · kiểm tra lại webhook | 15 phút |

### 10.2 Điều phối

| Vai trò | Trách nhiệm |
|---|---|
| Người trực | Nhận thông báo · phân loại |
| Kỹ sư trực | Điều tra · khắc phục |
| Người phê duyệt | Quyết định công bố khách hàng |
| Người ghi chép | Mốc thời gian · quyết định đã đưa ra |

---

## 11. Ma trận rủi ro bảo mật

| Mã | Rủi ro | Khả năng | Tác động | Mức | Biện pháp hiện tại |
|---|---|:---:|:---:|:---:|---|
| SEC-01 | Rò rỉ dữ liệu giữa các tenant | Thấp | Rất cao | Cao | 4 lớp §3 |
| SEC-02 | Lộ khoá bí mật | **Đã xảy ra** | Rất cao | **Rất cao** | Xử lý §9 |
| SEC-03 | Khai thác quyền qua API | Trung bình | Cao | Cao | STRIDE §2.1 |
| SEC-04 | Giả mạo webhook thanh toán | Trung bình | Cao | Cao | Đối soát §2.3 |
| SEC-05 | Nâng quyền trong cổng quản trị | Thấp | Cao | Trung bình | Phân tách vai trò |
| SEC-06 | Chia sẻ khóa API | Cao | Trung bình | Cao | §7.2 |
| SEC-07 | Dò tài khoản qua đăng nhập | Cao | Trung bình | Cao | Thông báo chung |
| SEC-08 | Khai thác truy vấn SQL | Thấp | Rất cao | Trung bình | Truy vấn tham số hoá |
| SEC-09 | Tệp hợp đồng độc hại | Thấp | Trung bình | Thấp | Kiểm tra tệp tải lên |
| SEC-10 | Thay đổi trường hợp cạnh tài sản | Thấp | Rất cao | Thấp | Sửa kèm kiểm thử |

---

## 12. Công việc bảo mật theo giai đoạn

| Giai đoạn | Việc | Ưu tiên |
|---|---|---|
| **Trước khi viết dòng mã đầu tiên** | Xử lý SEC-02 · thiết lập quét bí mật | **Bắt buộc** |
| Trong khi xây | 4 lớp tenant §3 · băm PAT · cấu hình bắt buộc §4.2 | P0 |
| Trước khi phát hành | Kiểm thử Lớp 1 · rò rỉ tenant · đánh giá từ chối dịch vụ | P0 |
| Sau khi phát hành | Kiểm thử Lớp 2 hằng quý · Lớp 3 trước mỗi phát hành chính | P1 |
| Liên tục | Rà soát phụ thuộc · theo dõi bất thường | P1 |

> **Ưu tiên tuyệt đối: SEC-02.** Nó đã xảy ra. Mọi biện pháp khác vô nghĩa nếu khoá mã vẫn nằm trong kho — bất cứ ai clone kho đều đọc được.
>
> Nhắc lại trình tự: **thu hồi → xoay → gỡ → lọc lịch sử → chặn tái diễn.** Đảo thứ tự làm mất hiệu quả.

---

**Cổng chất lượng:** QG-3 — 8 nhóm phân tích STRIDE · 10 rủi ro bảo mật · 4 lớp phòng thủ tenant · kịch bản ứng cứu cho 5 sự cố.
**Tài liệu sau:** D10 — Chiến lược kiểm thử