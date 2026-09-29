# Kế hoạch Xử lý Vấn đề Bản tin Danh mục (Portfolio News Digest)

Tài liệu này trình bày kế hoạch chi tiết để khắc phục việc Bản tin danh mục không hiển thị thông tin và cải thiện độ ổn định của hệ thống tạo bản tin AI.

## 1. Phân tích hiện trạng

Qua quá trình điều tra hệ thống (Audit), chúng tôi xác định các nguyên nhân chính khiến bản tin bị trống:

*   **Lịch trình cứng nhắc (Scheduling):** Tác vụ tự động chỉ chạy từ Thứ 2 đến Thứ 6 vào lúc 16:05 ICT. Vào sáng Thứ 7, hệ thống không tự động tạo bản tin mới và API cũng không tự động hiển thị bản tin của ngày Thứ 6.
*   **Thu thập tin tức yếu (Fragile News Fetching):** Logic thu thập tin tức hiện tại (`tasks_news_context.py`) chỉ sử dụng một nguồn duy nhất là VCI. Nguồn này thường xuyên trả về kết quả trống cho nhiều mã chứng khoán lớn (như VCB, VNM, MWG), dẫn đến việc AI không có nội dung để tóm tắt.
*   **Thiếu cấu hình AI (Missing AI Keys):** Phần lớn người dùng chưa cấu hình API Key AI trong phần cài đặt. Nếu không có key (của người dùng hoặc hệ thống), tác vụ sẽ bị lỗi.
*   **Lọc dữ liệu API quá nghiêm ngặt:** API hiện tại chỉ tìm kiếm bản tin có ngày khớp chính xác với "hôm nay". Nếu hôm nay là cuối tuần hoặc tác vụ chưa chạy, người dùng sẽ thấy thông báo "Chưa có dữ liệu" thay vì thấy bản tin gần nhất.

## 2. Các thay đổi đề xuất

### 2.1. Nâng cấp bộ thu thập tin tức (Robust News Context)
*   **File:** `backend/portfolio/tasks_news_context.py`
*   **Thay đổi:** Chuyển đổi sang sử dụng logic đa nguồn (RSS CafeF, VnEconomy) và tìm kiếm trên Google News RSS giống như logic đang dùng ở trang chi tiết mã chứng khoán. Điều này đảm bảo luôn có nội dung tin tức để tóm tắt.

### 2.2. Cải thiện API hiển thị (Flexible API)
*   **File:** `backend/portfolio/views_stock_news.py`
*   **Thay đổi:** Cập nhật endpoint `/api/stock-management/portfolio/news-digest/` để nếu không tìm thấy bản tin cho "hôm nay", nó sẽ tự động trả về **bản tin gần nhất** hiện có của người dùng đó.

### 2.3. Bổ sung cơ chế thông báo và hướng dẫn
*   **Frontend/Backend:** Thêm thông báo rõ ràng cho người dùng nếu bản tin không tạo được do thiếu AI API Key, kèm theo link hướng dẫn cấu hình.

### 2.4. Điều chỉnh lịch trình (Tùy chọn)
*   **File:** `backend/config/settings.py`
*   **Thay đổi:** Cân nhắc thêm lịch chạy vào sáng Thứ 7 (ví dụ 8:00 sáng) để tổng hợp lại tin tức cuối ngày Thứ 6 và các tin tức sớm trong ngày Thứ 7 cho người dùng.

## 3. Các câu hỏi cần thảo luận

1.  **Cơ chế cuối tuần:** Chúng ta nên để hệ thống tự động hiển thị bản tin Thứ 6 vào ngày Thứ 7, hay nên chạy một bản tin mới vào sáng Thứ 7?
2.  **API Key mặc định:** Chúng ta có nên cấu hình một Key hệ thống (System Key) dùng chung cho các gói tài khoản nhất định để đảm bảo ai cũng có bản tin, hay bắt buộc người dùng phải tự nhập Key?
3.  **Dòng tiền:** Có nên tích hợp thêm thông tin tóm tắt về biến động dòng tiền (Whale Money) của danh mục vào bản tin tin tức này không?

## 4. Kế hoạch triển khai

1.  **Giai đoạn 1:** Nâng cấp logic Fetch News để đảm bảo có dữ liệu đầu vào.
2.  **Giai đoạn 2:** Cập nhật API để hỗ trợ fallback (hiển thị bản tin cũ hơn nếu hôm nay trống).
3.  **Giai đoạn 3:** Kiểm tra (Manual Test) bằng cách chạy lệnh thủ công cho một user cụ thể và kiểm tra hiển thị trên Dashboard.

---
**Người thực hiện:** Antigravity AI
**Ngày lập:** 18/04/2026
