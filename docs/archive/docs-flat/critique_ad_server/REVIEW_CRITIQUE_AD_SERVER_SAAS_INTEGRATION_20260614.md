# BÁO CÁO PHẢN BIỆN: KẾ HOẠCH THIẾT KẾ HỆ THỐNG AD SERVER (ADV-SERVER) BACKEND

Tài liệu này cung cấp các phản biện kỹ thuật, phân tích lỗ hổng, đề xuất tối ưu hóa kiến trúc và câu trả lời cho các câu hỏi mở đối với tài liệu thiết kế hệ thống **Ad Server (adv-server)** phía Backend tại [IMPLEMENTATION_PLAN_AD_SERVER_SAAS_INTEGRATION_20260614.md](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_AD_SERVER_SAAS_INTEGRATION_20260614.md).

---

## 1. PHÂN TÍCH LỖ HỔNG & RỦI RO KỸ THUẬT (CRITICAL ISSUES)

### 1.1. Nguy cơ Spam Click/Impression & Gian Lận (Click Fraud / Spamming)
*   **Lỗ hổng:** API `/api/v1/ads/track/impression/` và `/api/v1/ads/track/click/` mở công khai cho client gọi mà không có cơ chế bảo vệ nào. Kẻ tấn công hoặc bot có thể spam hàng triệu request trong thời gian ngắn để làm tràn bộ nhớ Redis Queue, phá hoại thống kê chiến dịch hoặc tăng chi phí tài nguyên vô ích.
*   **Đề xuất giải pháp:**
    1.  **IP Rate Limiting:** Thiết lập giới hạn tần suất ở tầng API Gateway (ví dụ: Tối đa 1 click/giây và 10 impressions/phút từ cùng một IP/User Agent).
    2.  **Cryptographic Signature (Chữ ký liên kết):** Khi API `/api/v1/ads/serve/` trả về thông tin quảng cáo, `destination_url` và `tracking_pixel` phải chứa một token chữ ký ngắn hạn (HMAC Signature). Token này chứa thông tin mã hóa về `campaign_id`, `tenant_id`, `client_ip` và `timestamp` hết hạn (ví dụ: 5 phút). Khi client gửi request tracking lên, backend phải verify chữ ký và timestamp này; nếu không hợp lệ hoặc hết hạn sẽ từ chối ghi nhận log.

### 1.2. Rủi ro mất mát dữ liệu trên Redis Queue
*   **Lỗ hổng:** Việc lưu trữ log thô trên Redis bằng `RPUSH` và để Celery lấy ra bằng `LPOP` / `RPOP` thông thường có rủi ro mất dữ liệu cao. Nếu tiến trình Celery Worker bị crash đột ngột trong khi đang xử lý lô dữ liệu hoặc Redis bị khởi động lại trước khi Celery chạy, dữ liệu log thô chưa lưu xuống DB sẽ mất hoàn toàn.
*   **Đề xuất giải pháp:**
    1.  Sử dụng **Redis Streams** thay vì list thô. Redis Streams hỗ trợ cơ chế Consumer Groups và Acknowledgment (`XACK`), đảm bảo tin nhắn chỉ bị xóa khi worker đã xử lý thành công (bulk insert vào PostgreSQL thành công).
    2.  Nếu dùng Redis List thông thường, hãy sử dụng lệnh `RPOPLPUSH` (hoặc lệnh mới trong Redis là `LMOVE`) để di chuyển tạm bản ghi sang một hàng đợi tạm thời "đang xử lý" (processing queue), chỉ xóa khỏi hàng đợi này sau khi đã thực hiện bulk insert thành công.

### 1.3. Trình chặn quảng cáo (Ad Blockers) chặn đứng API
*   **Lỗ hổng:** Các trình chặn quảng cáo phổ biến (như uBlock Origin, AdGuard) thường chặn các API có chứa từ khóa nhạy cảm như `/ads/`, `/track/`, `/impression/`, hoặc `/click/`. Nếu Widget gọi các API này, trình duyệt sẽ báo lỗi mạng lập tức.
*   **Đề xuất giải pháp:**
    1.  Đổi tên các đường dẫn API thành các tên trung lập hơn, ví dụ: `/api/v1/content/recommend/` (thay vì `/ads/serve/`), `/api/v1/metrics/view/` (thay vì `/track/impression/`), và `/api/v1/metrics/engage/` (thay vì `/track/click/`).
    2.  Widget trên Frontend nên sử dụng phương thức `navigator.sendBeacon(...)` để gửi dữ liệu tracking một cách không đồng bộ và bền bỉ hơn, tránh bị trình duyệt ngắt cuộc gọi giữa chừng khi chuyển trang.

---

## 2. TỐI ƯU HÓA HIỆU NĂNG PHÂN PHỐI ADS (PERFORMANCE TUNING)

### 2.1. Cải tiến cấu trúc Cache phân phối trên Redis
*   **Hiện trạng thiết kế:** Backend dự định lọc các luật nhắm mục tiêu (Targeting Rules) trên RAM sau khi đọc hash từ Redis.
*   **Vấn đề:** Khi số lượng chiến dịch hoạt động tăng lên hàng trăm/hàng nghìn, việc lọc JSON targeting rules bằng mã Python ở mỗi request `/serve/` sẽ làm tăng đáng kể CPU load và độ trễ phản hồi (latency).
*   **Đề xuất cấu trúc chỉ mục trên Redis:**
    *   Thay vì lưu một hash khổng lồ, hãy lập chỉ mục trước (Pre-index) các chiến dịch theo thuộc tính lọc trong Redis:
        *   Các chiến dịch đại trà (Targeting ALL symbols): `ads:active:all:<size>` -> Set of Campaign IDs.
        *   Các chiến dịch nhắm cụ thể theo mã chứng khoán (Targeting specific symbols): `ads:active:symbol:<symbol_code>:<size>` -> Set of Campaign IDs.
    *   Khi có request với `symbol=SSI` và `size=300x50`, server chỉ cần thực hiện lệnh Union trên Redis:
        `SUNION ads:active:all:300x50 ads:active:symbol:SSI:300x50`
        để lấy ra danh sách Campaign ID khả dụng. Việc này diễn ra trên RAM của Redis và mất chưa đến 1ms, loại bỏ hoàn toàn việc phân tích cú pháp JSON targeting rules ở tầng Django.

---

## 3. PHÂN TÍCH SCHEMA DATABASE & THIẾT KẾ MODEL

### 3.1. Phân vùng bảng Log (Table Partitioning)
*   Bảng `AdImpressionLog` và `AdClickLog` sẽ tích tụ hàng triệu bản ghi mỗi tuần. Nếu chạy trên PostgreSQL thông thường không phân vùng, các bảng này sẽ nhanh chóng bị "phình to" (Bloat), làm chậm tất cả các câu lệnh truy vấn báo cáo và thao tác dọn dẹp dữ liệu cũ.
*   **Khuyến nghị:** Cấu hình **PostgreSQL Table Partitioning** cho hai bảng này theo thời gian (ví dụ: phân vùng theo từng tháng hoặc tuần). Đồng thời thiết lập một chính sách tự động xóa (Data Retention Policy) để drop các phân vùng log cũ hơn 30 hoặc 60 ngày để tiết kiệm dung lượng đĩa.

### 3.2. Nguy cơ trùng lặp bản ghi thống kê ngày
*   Trong bảng `AdDailySummary`, trường hợp nhiều Celery tasks chạy song song hoặc chạy lại do bị timeout có thể dẫn đến hiện tượng tranh chấp (Race Condition) khi thực hiện Upsert.
*   **Khuyến nghị:** Đảm bảo ràng buộc `unique_together = ('campaign', 'tenant', 'symbol', 'date')` được thiết lập chặt chẽ ở tầng Database bằng một Unique Constraint thực tế, không chỉ dựa vào khai báo của Django.

---

## 4. GIẢI QUYẾT CÁC CÂU HỎI MỞ (ANSWERS TO OPEN QUESTIONS)

### 4.1. Câu 1: Cho phép Tenant lớn tự cấu hình Ads của riêng họ?
*   **Đồng thuận:** **Rất nên phát triển.** Đây là một điểm bán hàng (Unique Selling Point) cực kỳ mạnh mẽ để thuyết phục các công ty chứng khoán lớn mua gói Enterprise/Custom. Họ muốn nhúng đồ thị của chúng ta nhưng chỉ muốn quảng cáo các sản phẩm tài chính (Mở tài khoản, Margin, Khóa học) của chính họ chứ không muốn người dùng thấy quảng cáo của bên thứ ba.
*   **Phương án thiết kế:**
    1.  Bổ sung bảng cấu hình `TenantAdSetting` liên kết giữa `CoreTenant` và các chiến dịch quảng cáo tùy chỉnh.
    2.  Khi API `/api/v1/ads/serve/` nhận được PAT hợp lệ của một Tenant thuộc gói Enterprise, hệ thống sẽ ưu tiên lọc các chiến dịch được gán cho Tenant đó trước. Nếu không có chiến dịch tùy chỉnh nào, hệ thống mới fallback về phân phối quảng cáo mặc định của VNInvest.

### 4.2. Câu 2: Chiến lược dự phòng (Fallback Strategy) khi Backend Ad Server sập?
*   Để tránh làm hỏng trải nghiệm người dùng cuối trên trang đối tác, Widget đồ thị tuyệt đối không được hiển thị khoảng trống lỗi hoặc báo lỗi mạng.
*   **Phương án thiết kế:**
    1.  **Client-side Hardcoded Backup:** Trong mã nguồn Frontend (Widget), định nghĩa sẵn một hoặc hai banner quảng cáo tĩnh (được lưu trữ trên CDN chịu tải cao như AWS S3/Cloudflare hoặc nhúng base64 ảnh kích thước nhỏ).
    2.  Nội dung mặc định: Quảng cáo giới thiệu các gói tính năng PRO / ENTERPRISE của chính VNInvest hoặc nút dẫn link nâng cấp chung.
    3.  Khi Widget gọi API lấy quảng cáo bị timeout (ví dụ quá 1.5 giây không phản hồi) hoặc nhận mã lỗi 5xx, Frontend sẽ tự động kích hoạt chế độ Fallback, tự hiển thị banner tĩnh và tự sinh link nâng cấp mà không cần phụ thuộc vào sự sẵn sàng của `adv-server`.

---

## 5. TỔNG KẾT & ĐÁNH GIÁ SỰ ĐỒNG BỘ FRONTEND - BACKEND

*   **Sự tương thích:** Thiết kế API `/serve/` của Backend phản hồi cờ `show_ads` và `hide_trademark` khớp 100% với đề xuất tại tài liệu Frontend.
*   **Tính khả thi:** Kế hoạch Backend có tính khả thi rất cao nhờ vào cơ chế bất đồng bộ Redis + Celery để giảm tải cho DB chính.
*   **Bước tiếp theo:** Sau khi chỉnh sửa các điểm phản biện trên, hai bên có thể tiến hành viết API specs (Swagger/OpenAPI JSON) để chốt hợp đồng dữ liệu chính thức và triển khai song song.
