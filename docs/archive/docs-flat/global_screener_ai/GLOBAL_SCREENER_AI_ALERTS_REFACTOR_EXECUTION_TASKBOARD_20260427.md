# BẢN THEO DÕI CÔNG VIỆC (TASKBOARD)
## GLOBAL SCREENER & AI ALERTS SCALABILITY REFACTOR

**Quy tắc:**
- Sử dụng bảng này để đánh dấu tiến độ công việc `[ ]` (Chưa làm), `[/]` (Đang làm), `[x]` (Hoàn thành).
- Không tự ý thêm bớt đầu việc mà không có sự cho phép của Ban Kiến Trúc.

---

### Slice 1: Database Migration (Quy Hoạch Mô Hình)
- `[ ]` 1.1. Tạo file `models_screener_admin.py` và khai báo `GlobalScreenerRule`, `ScreenerScheduleConfig`.
- `[ ]` 1.2. Tạo file `models_alert_history.py` và khai báo `UserAlertHistory`.
- `[ ]` 1.3. Cập nhật `admin.py` để Admin có thể xem/sửa cấu hình và luật trên Django Admin interface.
- `[ ]` 1.4. Chạy lệnh `manage.py makemigrations` và `manage.py migrate`.

### Slice 2: Global Service Construction (Dịch vụ Lõi)
- `[ ]` 2.1. Tạo file `services_global_screener.py`.
- `[ ]` 2.2. Implement hàm `precompute_market_snapshot()`.
- `[ ]` 2.3. Tích hợp lấy dữ liệu SSOT từ `MarketDataService`.
- `[ ]` 2.4. Lưu dữ liệu đã chắt lọc vào Redis caching (`global_screener_master_snapshot`).

### Slice 3: Celery Tasks & Scheduling (Tự Động Hóa)
- `[ ]` 3.1. Tạo file `tasks_global_screener.py`.
- `[ ]` 3.2. Viết hàm `run_global_screener_scheduled_task`.
- `[ ]` 3.3. Viết hàm `run_global_screener_manual_task` cho Admin.
- `[ ]` 3.4. Cập nhật `celerybeat-schedule` để nhận lịch trình linh hoạt.

### Slice 4: AI Deduplication Refactor (Tối Ưu LLM)
- `[ ]` 4.1. Mở `tasks_whale_preflight.py` và sửa `cache_key` xóa bỏ `user_id`.
- `[ ]` 4.2. Mở `tasks_whale_auto_generation.py`, xóa vòng lặp `User`, thay bằng vòng lặp nhận danh sách `symbols` từ Global Screener.

### Slice 5: User Screener Optimization & WebSocket
- `[ ]` 5.1. Mở `views_screener.py`, tìm API `ScreenerRuleRunView`.
- `[ ]` 5.2. Chèn cờ Feature Flag `is_user_custom_screener_enabled` kiểm tra bảo trì.
- `[ ]` 5.3. Xóa code gọi DB (`get_latest_snapshot`, `get_historical_indicators`).
- `[ ]` 5.4. Thay bằng logic filter trên bộ nhớ Redis Cache.
- `[ ]` 5.5. Viết logic trigger event Push WebSocket và ghi vào `UserAlertHistory` trong `services_whale_broadcast.py`.

### Slice 6: Audit, Kiểm Thử & Nghiệm Thu
- `[ ]` 6.1. Thực hiện Unit Tests trên môi trường test (`manage.py test`).
- `[ ]` 6.2. Kiểm tra log Celery xem có bị gọi LLM duplicate hay không.
- `[ ]` 6.3. Cập nhật báo cáo nghiệm thu theo file Mẫu Evidence.
