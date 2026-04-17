# 📋 Task Backlog: Realtime Engine Stabilization
**Source Plan:** [IMPLEMENTATION_PLAN_REALTIME_ENGINE_STABILIZATION_20260417.md](file:///c:/Mujoco%20Projects/vninvest/docs/IMPLEMENTATION_PLAN_REALTIME_ENGINE_STABILIZATION_20260417.md)

Dưới đây là danh sách các đầu việc (Tasks) chi tiết để thực thi kế hoạch **Realtime Engine Stabilization (20260417)**. 

> [!IMPORTANT]
> **Hướng dẫn cho Dev:** Thực hiện theo thứ tự từng Phase. Mỗi Phase cần hoàn tất Unit Test và verify logic trước khi chuyển sang Phase tiếp theo. Tuyệt đối tuân thủ kiểm soát bằng Feature Flags.

## Phase 0: Chuẩn bị & Feature Flags 🚩
Mục tiêu: Thiết lập hạ tầng điều khiển luồng để cho phép bật/tắt an toàn.
- [x] Khai báo các Feature Flags mới trong `backend/config/settings.py`.
    - `REALTIME_WS_PLAN_CACHE_ENABLED` (Default: `True`)
    - `REALTIME_WS_AUTH_CACHE_ENABLED` (Default: `True`)
    - `REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED` (Default: `False`)
    - `REALTIME_STREAM_PENDING_RECLAIM_ENABLED` (Default: `False`)
- [x] Cập nhật tài liệu biến môi trường (nếu có file `.env.example`).

## Phase 1: Xử lý lỗi N+1 Advisory Fanout (P0) 🔥
Mục tiêu: Loại bỏ hoàn toàn việc truy vấn Database mỗi khi có event Whale/Advisory bắn xuống WebSocket.
- [x] Chỉnh sửa `RealtimeConsumer.connect` (`backend/portfolio/consumers.py`):
    - Thực hiện resolve User Plan ngay khi kết nối thành công.
    - Lưu vào `self.user_plan` và `self.user_plan_resolved_at`.
- [x] Chỉnh sửa `RealtimeConsumer.whale_advisory`:
    - Đọc Plan từ `self.user_plan` nếu có.
    - Chỉ dùng `_get_user_plan()` làm fallback nếu `REALTIME_WS_PLAN_CACHE_ENABLED` là `False`.
- [x] **Verification**: Regression tests realtime gateway/compute da pass sau khi caching plan hot-path.

## Phase 2: Tối ưu Auth Reconnect Store (P1) 🛡️
Mục tiêu: Giảm tải DB khi hàng ngàn clients cùng reconnect sau khi deploy/mất mạng.
- [x] Chèn logic Cache vào `RealtimeConsumer._authenticate_user`:
    - Sử dụng `cache.get_or_set` với khóa `f"ws_auth:{user_id}"` và TTL ngắn (~120s).
    - Cache chứa snapshot tối giản của User Profile cần thiết cho logic phân quyền.
- [ ] **Verification**: Simulate 100 WebSocket connections trong 1s, kiểm tra CPU Load của PostgreSQL.

## Phase 3: Native Ticker Hot Path (P1) ⚡
Mục tiêu: Loại bỏ sự phụ thuộc vào Pandas trên luồng truyền dữ liệu Ticker siêu nhanh.
- [x] Xây dựng `build_ticker_payload_native` trong `backend/portfolio/realtime/compute.py` sử dụng thuần List/Dict.
- [x] Cập nhật `WsBroadcastConsumer` (`backend/portfolio/realtime/stream_consumers.py`):
    - Kiểm tra flag `REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED`.
    - Nếu bật, bypass Pandas DataFrame conversion cho luồng Ticker.
- [x] **Verification**: Unit test parity payload native/DataFrame da duoc bo sung.

## Phase 4: Redis Stream Pending Reclaim (P2) ♻️
Mục tiêu: Chống thất thoát dữ liệu và dọn dẹp các "Pending Entries" bị kẹt do Worker sập đột ngột.
- [x] Bổ sung logic `XCLAIM` vào `TickConsumerBase.run_once`:
    - Quét các message ở trạng thái `Pending` quá lâu (> 60s).
    - Thực hiện claim về cho worker hiện tại để xử lý lại hoặc ACK nếu quá cũ.
- [x] Cập nhật metrics: Đẩy số lượng pending depth lên Prometheus/Redis Metrics.
- [ ] **Verification**: Manual kill process consumer khi đang đọc dở batch, bật lại và kiểm tra xem các id cũ có được xử lý lại không.

## Phase 5: Nghiệm thu & Hardening ✅
Mục tiêu: Chốt chặn chất lượng cuối cùng.
- [x] Khoi tao checklist soak test: `docs/PHASE5_REALTIME_STABILIZATION_SOAK_CHECKLIST_20260417.md`.
- [ ] Tiến hành Soak Test trong môi trường Staging ít nhất 1 giờ trong giờ giao dịch giả lập.
- [ ] Cập nhật `walkthrough.md` với các hình ảnh/logs chứng minh hiệu quả giảm tải DB.
- [ ] Merge code và monitor dashboard sau release.
