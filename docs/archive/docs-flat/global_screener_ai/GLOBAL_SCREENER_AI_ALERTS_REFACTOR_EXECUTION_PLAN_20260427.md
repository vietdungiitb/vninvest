# KẾ HOẠCH THỰC THI (EXECUTION PLAN)
## GLOBAL SCREENER & AI ALERTS SCALABILITY REFACTOR

**Mục tiêu:** Cung cấp hướng dẫn từng bước (Step-by-step) cho lập trình viên để chuyển đổi mô hình Screener & AI Alerts sang kiến trúc chịu tải cao (High Concurrency), sử dụng SSOT và Event-Driven.

---

## Giai Đoạn 1 (Phase 1): Thiết Lập Database Models (Schema)
> [!IMPORTANT]
> Cần chạy makemigrations và migrate ngay sau khi hoàn thành Phase 1. Không để dồn đến cuối.

1. **Tạo `models_screener_admin.py` trong `backend/portfolio/`:**
   - Class `GlobalScreenerRule`: Kế thừa hoặc sao chép cấu trúc của `ScreenerRule` nhưng phục vụ cho Global.
   - Class `ScreenerScheduleConfig`: Lưu cron expression (`*/5 * * * *`), biến trạng thái bật/tắt `is_user_custom_screener_enabled` (Boolean, default: True).
2. **Tạo `models_alert_history.py` trong `backend/portfolio/`:**
   - Class `UserAlertHistory`: Chứa `user`, `symbol`, `alert_type` (SCREENER/AI/WHALE/DARK_MONEY), `message`, `matched_at`.

## Giai Đoạn 2 (Phase 2): Xây Dựng Global Screener Service (SSOT Core)
> [!NOTE]
> Giai đoạn này rất quan trọng, nó thay thế toàn bộ logic truy vấn nặng nề bằng việc gom dữ liệu (Aggregation) từ các Services hiện tại.

1. **Tạo `services_global_screener.py`:**
   - Class `GlobalScreenerService`.
   - Hàm `precompute_market_snapshot()`: 
     - Lấy giá trị từ `MarketDataService.get_latest_snapshot()`.
     - Kéo dữ liệu từ `views_dark_money_history.py` hoặc model tương ứng.
     - Lấy Whale Scoring.
     - Tính toán chéo để ra một biến Dict lớn: `MasterTechnicalSnapshot`.
     - Lưu `MasterTechnicalSnapshot` vào Redis (`cache.set('global_screener_master_snapshot', data, timeout=3600)`).

## Giai Đoạn 3 (Phase 3): Background Jobs & Celery Tasks
1. **Tạo `tasks_global_screener.py`:**
   - Task `@shared_task: run_global_screener_scheduled_task()`.
   - Task đọc cấu hình từ `ScreenerScheduleConfig` để quyết định có chạy hay không.
   - Gọi `GlobalScreenerService.precompute_market_snapshot()`.
   - Đối chiếu với bộ luật `GlobalScreenerRule`. Nếu có mã khớp, đẩy danh sách mã đó cho AI Generation (Phase 4) và phát sự kiện Broadcast (Phase 5).

## Giai Đoạn 4 (Phase 4): Cấu Trúc Lại AI Advisory (Deduplication)
> [!WARNING]
> Đây là nơi gây ra tốn kém API nhất. Phải làm thật cẩn thận.

1. **Sửa đổi `tasks_whale_auto_generation.py`:**
   - Xóa bỏ vòng lặp query `TrackedSymbol` cho từng User.
   - Thay vào đó, hàm nhận tham số đầu vào là danh sách `matched_symbols` từ Phase 3.
   - Trigger task `generate_whale_advisory_task` cho TỪNG SYMBOL (không phân biệt User).
2. **Sửa đổi `tasks_whale_preflight.py`:**
   - Sửa dòng `cache_key = f'whale_advisory_lock:{user_id}:{symbol}' if user_id...` 
   - Đổi thành `cache_key = f'whale_advisory_lock:{symbol}'` tuyệt đối.

## Giai Đoạn 5 (Phase 5): Refactor User Screener API & Broadcast WebSocket
1. **Sửa đổi `views_screener.py` (`ScreenerRuleRunView`)**:
   - Check cờ `ScreenerScheduleConfig.objects.first().is_user_custom_screener_enabled`. Nếu False, `raise PermissionDenied`.
   - Bỏ toàn bộ code gọi `MarketDataService` và vòng lặp `for row in rows`.
   - Lấy dữ liệu từ `cache.get('global_screener_master_snapshot')`.
   - Chạy hàm filter trên mảng nhớ (Memory) đó. Response sẽ trả về dưới 50ms.
2. **Sửa đổi `services_whale_broadcast.py`**:
   - Nhận tín hiệu từ Phase 3.
   - Lưu bản ghi vào bảng `UserAlertHistory` cho các User đang theo dõi mã đó.
   - Push WebSocket payload `{"event": "SCREENER_MATCHED", "data": ...}`.
