# BÁO CÁO KIỂM TOÁN ĐỘC LẬP (INDEPENDENT AUDIT REPORT)
## Tính năng: Global Screener & AI Alerts Scalability Refactor

**Người thực hiện Kiểm toán:** Ban Kiến Trúc (AI)
**Ngày kiểm toán:** 2026-04-28
**Tiêu chuẩn tham chiếu:** Bộ tài liệu `GLOBAL_SCREENER_AI_ALERTS_REFACTOR_HANDOFF_MASTER_20260427.md`

---

## 1. Đánh Giá Tổng Quan (Executive Summary)
Đội ngũ lập trình (Dev Team) đã làm việc với tốc độ cực kỳ ấn tượng. Dựa trên bản thiết kế kiến trúc, khoảng **85%** khối lượng công việc cốt lõi đã được hiện thực hoá chính xác, bao gồm cả những hạng mục khó nhất như Deduplication và Redis Caching. Tuy nhiên, vẫn còn một vi phạm nghiêm trọng liên quan đến nguyên tắc SSOT (Single Source of Truth) tại phân hệ gom dữ liệu, cần được khắc phục ngay.

---

## 2. Các Hạng Mục Đã Đạt Chuẩn (PASS)

### ✅ Slice 1: Database Migration (Đạt 100%)
- **Tập tin:** `models_screener_admin.py`, `models_alert_history.py`
- **Kết quả:** Đã tạo đầy đủ các class `GlobalScreenerRule`, `ScreenerScheduleConfig` và `UserAlertHistory` với đúng cấu trúc trường (fields) và indexing chuẩn mực.

### ✅ Slice 4: AI Deduplication Refactor (Đạt 100%)
- **Tập tin:** `tasks_whale_preflight.py`, `tasks_whale_auto_generation.py`
- **Kết quả:** Xử lý xuất sắc! 
  - Tại `tasks_whale_preflight.py` (dòng 101), khóa Redis đã được sửa thành `cache_key = f'whale_advisory_lock:{symbol}'`, hoàn toàn gỡ bỏ sự phụ thuộc vào `user_id`.
  - Tại `tasks_whale_auto_generation.py`, vòng lặp đã được tinh giản để nhận `matched_symbols` và gọi LLM đúng một lần cho mỗi mã chứng khoán (Deduplication thành công). Đáp ứng `REQ_DEDUP_01` và `REQ_DEDUP_02`.

### ✅ Slice 5: User Screener Optimization (Đạt 100%)
- **Tập tin:** `views_screener.py`
- **Kết quả:** Đội code đã xử lý rất mượt mà. Đã đưa Feature Flag `is_user_custom_screener_enabled` vào để chặn API khi cần bảo trì (dòng 119-120). Đã loại bỏ hoàn toàn các truy vấn DB (get_historical_indicators), thay bằng cách lấy `cached_snapshot` từ `GlobalScreenerService.CACHE_KEY` (dòng 125). Đáp ứng `REQ_MEM_01` và `REQ_FLAG_01`.

### ✅ Slice 5.5: Event-Driven & Alert History (Đạt 95%)
- **Tập tin:** `tasks_whale_broadcast.py` (Chuyển từ `services_whale_broadcast.py`)
- **Kết quả:** Đã viết hàm `_broadcast_screener_matched` rất thông minh. Nó tự động tìm những User đang Tracked/Watchlist mã chứng khoán (dòng 64-73), sau đó lưu vào `UserAlertHistory` (dòng 89) và bắn WebSocket song song. Đáp ứng `REQ_HIST_01`.

---

## 3. Các Thiếu Sót Cần Khắc Khục Khẩn Cấp (FAIL / ACTION REQUIRED)

### ❌ Vi Phạm SSOT Tại Global Screener (Slice 2)
- **Tập tin vi phạm:** `services_global_screener.py` (Hàm `precompute_market_snapshot`)
- **Phân tích lỗi:** 
  - Đội dev hiện tại **chỉ mới** lấy dữ liệu từ `MarketDataService.get_latest_snapshot` và `get_historical_indicators` để tính toán kỹ thuật cơ bản.
  - **THIẾU:** Code hoàn toàn bỏ qua việc gom dữ liệu từ **OrderFlow (Whale Buy/Sell)** và **Dark Money Flow**, cũng như **AI Advisory**. 
- **Tác hại:** Điều này làm trái thiết kế "Tính năng tổng thể" mà Ban Quản Trị yêu cầu. Screener hiện tại chỉ mới quét được RSI, MA... nhưng không thể quét được bộ luật "Mã có dòng tiền ẩn vào mạnh" hay "Mã có Cá Mập mua".
- **Hành động (Action):** Yêu cầu bổ sung logic gọi `OrderFlow` hoặc `services_whale_analytics_snapshot` vào trong hàm `precompute_market_snapshot` để ghép (merge) chỉ số dòng tiền vào biến `row` trước khi đưa vào bộ nhớ đệm `MasterTechnicalSnapshot`. Vi phạm `REQ_SSOT_01`.

---

## 4. Đề Xuất Nâng Cấp (Upgrades & Polish)

### 🌟 4.1. Thông Báo Trúng Luật Thông Minh Hơn
Trong `tasks_whale_broadcast.py`, thông báo mặc định hiện nay đang hardcode: 
`alert_message = message or f'Mã {normalized_symbol} vừa khớp bộ lọc screener toàn cục.'`
**Đề xuất:** Tại `GlobalScreenerService.match_active_rules()`, khi tìm thấy mã khớp, hãy đính kèm tên của luật (`rule.name`) vào kết quả. Để thông báo gửi tới User sẽ cụ thể hơn, ví dụ: 
*"Mã FPT vừa khớp bộ lọc: Breakout Khối Lượng Kèm Dòng Tiền Cá Mập"*.

### 🌟 4.2. Tối Ưu Cron Job (Tránh Race Condition)
Trong `tasks_global_screener.py` (hàm `run_global_screener_scheduled_task`), việc đẩy sự kiện `auto_generate_advisories_for_all_tracked` xuống Background Queue (dòng 46) là chính xác. Tuy nhiên, hãy đảm bảo rằng có sử dụng cơ chế `apply_async(countdown=...)` được rải ngẫu nhiên (randomize) nếu số lượng `matched_symbols` quá lớn (ví dụ > 50 mã), để tránh việc 50 workers cùng dồn lên gọi AI Provider cùng một giây.

## KẾT LUẬN
Khung sườn kiến trúc (Architecture Skeleton) đã được đội code thực hiện **cực kỳ xuất sắc và chuẩn xác**. Chỉ cần fix lại lỗi thiếu hụt SSOT ở `Slice 2` (Gom thêm dữ liệu Dòng tiền/Whale vào Snapshot) là tính năng này sẵn sàng tung ra Production.
