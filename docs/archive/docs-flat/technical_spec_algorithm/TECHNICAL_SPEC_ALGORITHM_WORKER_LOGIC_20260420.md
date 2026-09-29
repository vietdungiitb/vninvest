# Đặc tả Kỹ thuật: Thuật toán & Logic Xử lý (Worker Logic)

**Ngày soạn:** 2026-04-20  
**Đối tượng:** Đội ngũ Backend / Data Engineer / AI Engineer  

---

## 1. Logic Kiểm chứng Tín hiệu (Backtesting - W6)

### 1.1 Worker: `verify_signals_daily`
*   **Tần suất:** Chạy lúc 16:30 ICT hàng ngày (Daily Job).
*   **Điều kiện quét:** Tìm tất cả các tín hiệu trong bảng `OrderFlowSignal` hoặc `WhaleAdvisory` có ngày tạo là `Today - 3 trading days`.
*   **Quy trình xử lý:**
    1.  Lấy mã chứng khoán (`symbol`) và giá tại thời điểm phát tín hiệu (`signal_price`).
    2.  Truy vấn `DailyPrice` để lấy giá đóng cửa ngày hôm nay (`t3_price`).
    3.  Truy vấn giá đóng cửa của VNIndex cùng ngày.
    4.  **Tính Alpha:** `alpha = ((t3_price / signal_price) - 1) - ((vnindex_t3 / vnindex_t0) - 1)`.
    5.  **Gán nhãn:** 
        *   `is_success = True` nếu `alpha > 0` HOẶC `price_change > 2%`.
    6.  Lưu vào bảng `SignalVerification`.

---

## 2. Logic Phân tích Tâm lý (Sentiment - AI4)

### 2.1 Worker: `sync_news_sentiment`
*   **Tần suất:** Chạy mỗi 30 phút (Periodic Job).
*   **Quy trình xử lý:**
    1.  Quét tiêu đề tin tức từ các nguồn hỗ trợ (CafeF, Vietstock, v.v.) trong 24h qua cho từng mã.
    2.  **Prompting AI:** Gửi danh sách tiêu đề tới AI (GPT-4o mini) với yêu cầu: 
        *   "Chấm điểm tâm lý từ -1 đến 1."
        *   "Tóm tắt lý do chính trong 30 từ."
    3.  **Aggregation:** Nếu một mã có nhiều đợt tin trong ngày, thực hiện tính trung bình trọng số (Weighted Average) dựa trên `headline_count` hoặc độ uy tín của nguồn tin (`news_source_weights`).
    4.  Lưu kết quả vào bảng `SentimentLog`.

---

## 3. Logic Gửi thông báo Phân cấp (Telegram - I1)

### 3.1 Worker: `telegram_alert_dispatcher`
*   **Trigger:** Khi một tín hiệu Whale mới được phát hiện.
*   **Luồng logic:**
    1.  Xác định mức độ nghiêm trọng (`signal_severity`): 
        *   `Critical`: Lệnh > 50 tỷ.
        *   `High`: Lệnh > 10 tỷ.
        *   `Normal`: Các lệnh khác.
    2.  Lấy danh sách User có `TelegramProfile` hoạt động.
    3.  **Gating & Filters:**
        *   Nếu User đang trong trạng thái `mute_until` -> Bỏ qua (Trừ khi là `Critical`).
        *   Nếu User là Free -> `mask_symbol(VNM)` -> `V**`.
        *   Nếu mã không nằm trong Watchlist (3 mã giới hạn) của User Free -> Bỏ qua.
    4.  **Priority Queue:** 
        *   Đưa vào queue `high_priority` nếu là `Critical`.
        *   Đưa vào queue `default` cho các alert khác.
    5.  Gọi Telegram Bot API để gửi tin nhắn.
