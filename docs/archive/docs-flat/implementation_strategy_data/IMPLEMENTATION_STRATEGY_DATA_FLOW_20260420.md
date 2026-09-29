# Chiến lược Triển khai & Luồng Dữ liệu (Implementation Strategy)

**Ngày tạo:** 2026-04-20  
**Mục tiêu:** Cung cấp lộ trình kỹ thuật chi tiết để chuyển đổi đặc tả tính năng (Spec) thành mã nguồn (Code).

---

## 1. Thiết kế Schema Dữ liệu (Data Models)

### 1.1 Model `SignalVerification` (W6)
Lưu trữ kết quả kiểm chứng cho từng tín hiệu Whale hoặc Dark Money.
*   `signal_type`: Whale / Dark Money / Order Flow.
*   `original_signal_id`: Liên kết tới bản ghi tín hiệu gốc.
*   `symbol`: Mã chứng khoán.
*   `price_at_signal`: Giá tại thời điểm phát tín hiệu.
*   `price_t_plus_3`: Giá đóng cửa sau 3 phiên giao dịch.
*   `vnindex_return_t_plus_3`: Biến động VNIndex trong cùng kỳ.
*   `alpha_score`: Hiệu suất vượt trội (Stock Return - VNIndex Return).
*   `is_success`: Boolean (Thành công nếu Alpha > 0 hoặc Price Change > 2%).

### 1.2 Model `TelegramProfile` (I1)
Quản lý người dùng và cấu hình thông báo trên Telegram.
*   `user`: ForeignKey tới Django User.
*   `chat_id`: ID chat trên Telegram.
*   `is_active`: Trạng thái kích hoạt.
*   `alert_priority_min`: Ngưỡng ưu tiên nhận alert (Ví dụ: Chỉ nhận High/Critical).
*   `mute_until`: Thời điểm kết thúc trạng thái Mute.
*   `preferred_symbols`: Danh sách mã ưu tiên nhận alert (Watchlist quà tặng).

### 1.3 Model `NewsSentiment` (AI4)
Lưu trữ kết quả phân tích tâm lý tin tức.
*   `symbol`: Mã chứng khoán (hoặc 'GLOBAL' cho thị trường chung).
*   `sentiment_score`: Điểm số từ -1 (Cực xấu) đến 1 (Cực tốt).
*   `summary`: Tóm tắt ngắn gọn lý do gán điểm.
*   `top_keywords`: Các từ khóa chính từ tin tức.
*   `analyzed_at`: Thời điểm phân tích.
*   `source_count`: Số lượng tin tức được dùng để tổng hợp.

---

## 2. Đặc tả API Contract

### 2.1 Telegram Webhook
*   **Endpoint:** `/api/v1/notifications/telegram/webhook/`
*   **Phương thức:** `POST`
*   **Chức năng:** Nhận và xử lý các lệnh từ người dùng (Callback queries từ nút bấm Mute/Detail).

### 2.2 Sentiment API
*   **Endpoint:** `/api/v1/stock/{symbol}/sentiment/`
*   **Kết quả:** Trả về điểm số tâm lý hiện tại và lịch sử 7 ngày gần nhất để vẽ biểu đồ line.

---

## 3. Luồng xử lý bất đồng bộ (Celery Tasks)

1.  **Task `sync_news_sentiment`:**
    *   Chạy mỗi 15-30 phút.
    *   Quét tin mới -> Gọi AI API để lấy điểm sentiment -> Lưu/Cập nhật bảng `NewsSentiment`.
2.  **Task `verify_signals_daily`:**
    *   Chạy lúc 16:30 hàng ngày.
    *   Tìm các tín hiệu đủ T+3 -> Lấy giá đóng cửa -> Tính Alpha -> Cập nhật thành công/thất bại.

---

## 4. Công cụ & Thư viện Đề xuất

*   **Telegram Library:** `python-telegram-bot` (v20+ hỗ trợ Asyncio hoàn toàn).
*   **Sentiment Engine:** Sử dụng OpenAI (GPT-4o mini) hoặc DeepSeek-V3 để tối ưu chi phí phân tích số lượng lớn tiêu đề tin.
*   **Queue Management:** Sử dụng Redis với 2 queue riêng biệt: `default` và `high_priority` (dành riêng cho alert Critical).
