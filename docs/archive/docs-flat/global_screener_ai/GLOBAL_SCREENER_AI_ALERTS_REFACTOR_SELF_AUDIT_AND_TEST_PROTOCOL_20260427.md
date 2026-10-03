# GIAO THỨC TỰ KIỂM TRA (SELF AUDIT & TEST PROTOCOL)
## GLOBAL SCREENER & AI ALERTS SCALABILITY REFACTOR

Lập trình viên (AI Session) phải tự chạy các kịch bản kiểm thử (Test Cases) sau để chứng minh mã nguồn không gây lỗi và đạt hiệu suất cao.

---

### Giao Thức 1: Kiểm Thử Chống Trùng Lặp Gọi AI (Deduplication Test)
**Mục tiêu:** Đảm bảo hệ thống AI không bị gọi trùng lặp nếu có nhiều User cùng quan tâm tới một mã.

1. **Khởi tạo dữ liệu giả:** Add 10 tài khoản User cùng cho mã `FPT` vào Watchlist.
2. **Kích hoạt sự kiện:** Gọi hàm `tasks_global_screener` với kết quả trả về mã `FPT` đã trúng luật.
3. **Audit Log Celery:** 
   - Truy vấn log hệ thống của Celery.
   - Xác nhận có đúng **1 task `generate_whale_advisory_task`** cho mã FPT được tạo.
   - Nếu thấy 10 tasks => Giao thức Thất bại (FAIL), yêu cầu sửa lại cơ chế Cache Lock.

### Giao Thức 2: Kiểm Thử User Screener Cache-Only (Zero-DB Query Test)
**Mục tiêu:** Đảm bảo API của User Screener chỉ lấy dữ liệu từ Redis và trả về tốc độ mili-giây.

1. **Chuẩn bị:** Chạy Global Screener để tạo ra `MasterTechnicalSnapshot` vào Redis.
2. **Theo dõi truy vấn DB:** Bật tính năng log DB queries trên môi trường Dev (hoặc dùng thư viện `django.db.connection.queries`).
3. **Thực thi:** Gọi API Endpoint `ScreenerRuleRunView` bằng 1 User với 10 quy tắc phức tạp.
4. **Audit Kết quả:**
   - Kết quả trả ra số lượng queries DB phải bằng **0** (Hoặc chỉ có 1 query xác thực Token user).
   - Tuyệt đối không có query nào gọi vào bảng giá lịch sử hoặc indicator.
   - Nếu có query => Giao thức Thất bại (FAIL).

### Giao Thức 3: Kiểm Thử Feature Flag (Tắt Nóng Hệ Thống)
**Mục tiêu:** Đảm bảo Admin có thể vô hiệu hóa tính năng Screener của User nếu thấy hệ thống quá tải.

1. **Thực thi:** Dùng trang quản trị, set cờ `is_user_custom_screener_enabled = False`.
2. **Kiểm tra API:** Đăng nhập bằng tài khoản User thường, cố tình gọi API `/api/v1/screener/run`.
3. **Audit Kết quả:** 
   - Hệ thống phải văng mã HTTP 403 Forbidden kèm thông báo bảo trì.
   - Khôi phục cờ thành True và xác nhận API hoạt động lại.

### Hướng Dẫn Nộp Báo Cáo
Lập trình viên sau khi thực thi 3 giao thức trên, phải copy Output / Ảnh chụp màn hình và dán vào file **Evidence Template** trước khi đánh dấu Hoàn Thành (Done).
