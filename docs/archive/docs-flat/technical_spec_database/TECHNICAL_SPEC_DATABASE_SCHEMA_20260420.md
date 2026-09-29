# Đặc tả Kỹ thuật: Thiết kế Cấu trúc Dữ liệu (Database Schema)

**Ngày soạn:** 2026-04-20  
**Đối tượng:** Đội ngũ Backend / Database Engineer  
**Mục tiêu:** Cung cấp cấu trúc bảng chi tiết để thực hiện Migration.

---

## 1. Model `SignalVerification` (W6 - Whale Backtesting)

Bảng này lưu trữ kết quả kiểm chứng hiệu quả của các tín hiệu.

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | BigAutoField | Primary Key | |
| `content_type` | ForeignKey | Django ContentType | Để trỏ tới bất kỳ Model tín hiệu nào (Whale, OrderFlow) |
| `object_id` | PositiveIntegerField | | Link tới ID của tín hiệu gốc |
| `symbol` | CharField(10) | db_index=True | |
| `signal_price` | DecimalField(15, 2) | | Giá tại thời điểm phát tín hiệu |
| `t3_price` | DecimalField(15, 2) | | Giá đóng cửa sau T+3 |
| `vnindex_benchmark` | DecimalField(15, 2) | | Giá VNIndex tại thời điểm T+3 |
| `alpha_score` | DecimalField(9, 4) | | (Stock Return - VNIndex Return) |
| `is_success` | BooleanField | default=False | Thành công nếu Alpha > 0 hoặc tăng > 2% |
| `processed_at` | DateTimeField | auto_now_add=True | Thời điểm hệ thống chạy hậu kiểm |

**Index:** `['symbol', 'is_success']`, `['processed_at']`

---

## 2. Model `TelegramProfile` (I1 - Telegram Bot)

Quản lý thông tin định danh và cấu hình thông báo cho người dùng Telegram.

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `user` | OneToOneField | Related to `User` | Một tài khoản VNInvest - một Profile Telegram |
| `telegram_user_id` | BigIntegerField | unique=True | ID định danh từ Telegram API |
| `chat_id` | BigIntegerField | | ID chat (có thể là chat cá nhân hoặc group) |
| `is_verified` | BooleanField | default=False | Đã xác thực link tài khoản qua OTP/Link chưa |
| `priority_threshold`| IntegerField | Choices: 1-High, 2-Med, 3-Low | Cấp độ cảnh báo tối thiểu để đẩy tin |
| `mute_until` | DateTimeField | null=True | Tắt thông báo đến thời điểm nhất định |
| `last_interacted_at`| DateTimeField | auto_now=True | |

---

## 3. Model `SentimentLog` (AI4 - Sentiment Analysis)

Lưu trữ chuỗi thời gian điểm số tâm lý để vẽ biểu đồ Line Chart.

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | BigAutoField | Primary Key | |
| `symbol` | CharField(10) | db_index=True | Mã CK hoặc 'GLOBAL' |
| `sentiment_score` | DecimalField(5, 2) | Range: -1.00 to 1.00 | Điểm tâm lý tổng hợp |
| `source_type` | CharField(20) | news, social, web | |
| `headline_count` | IntegerField | | Số lượng tiêu đề tin tức đã quét |
| `ai_reasoning` | TextField | | Tóm tắt lý do chấm điểm (Context cho AI Advisory) |
| `token_cost` | IntegerField | | Theo dõi chi phí token AI cho lượt phân tích này |
| `captured_at` | DateTimeField | auto_now_add=True | |

**Index:** `['symbol', '-captured_at']`

---

## 4. Ràng buộc & Gating (Open Core)

Đội code cần lưu ý logic kiểm tra quyền (Permission Checks) khi truy vấn:
*   **Whale Alert:** Nếu `user.plan != 'pro'`, các API trả về `SignalVerification` phải filter ẩn các mã ngoài Watchlist quà tặng (max 3 mã).
*   **Telegram:** Bot service khi quét gửi tin phải kiểm tra `TelegramProfile.is_active` và gói cước hiện tại của user để quyết định có mask (`V**`) mã cổ phiếu hay không.
