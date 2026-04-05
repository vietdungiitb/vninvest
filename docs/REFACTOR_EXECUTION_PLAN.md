# Kế Hoạch Triển Khai Thực Thi Fat Views

Tài liệu này chuyển hóa audit và design thành lộ trình triển khai thống nhất. Mọi nội dung bên dưới phải bám đúng cấu trúc module, feature flag và thứ tự phase đã chốt ở hai tài liệu nền.

## 1. Phạm Vi Triển Khai Được Phê Duyệt
- Không big-bang rewrite.
- Không dùng `backend/portfolio/new_views/`.
- Không đổi storage của `DailyPrice` trong phase refactor đầu tiên.
- Không đụng Trading trước khi Market Data đã qua đủ vòng kiểm chứng.

## 2. Phase 0: Baseline và Chuẩn Bị
### Mục tiêu
Chốt measurement contract, feature flag, cấu trúc module và baseline metric trước khi viết code refactor.

### Code scope
- `backend/config/settings.py`: khai báo feature flags từ environment.
- `backend/portfolio/exceptions.py`: chuẩn hóa exception dùng chung.
- router hiện tại của `portfolio`: thêm điểm gắn toggle chọn implementation cũ/mới.

### Deliverables
- `ENABLE_NEW_MARKET_VIEWS`
- `ENABLE_NEW_TRADING_VIEWS`
- `ENABLE_REALTIME_CONNECTION_MANAGER`
- dashboard baseline cho p95, 5xx, throttle và cache hit/miss.

## 3. Phase 1: Refactor Market Data
### Code scope
- `backend/portfolio/adapters/vnstock_adapter.py`
- `backend/portfolio/adapters/cache_adapter.py`
- `backend/portfolio/services/market_data_service.py`
- `backend/portfolio/market_views.py`
- router `portfolio` dùng flag `ENABLE_NEW_MARKET_VIEWS` để chọn implementation.

### Quy tắc triển khai
- Giữ nguyên endpoint contract cũ.
- Legacy implementation vẫn tồn tại song song tối thiểu `3 tháng`.
- `transaction.atomic()` chỉ được phép xuất hiện trong service nếu có ghi dữ liệu.

## 4. Phase 2: Realtime Connection Management
### Code scope
- frontend `RealtimeProvider`
- frontend connection manager singleton
- tích hợp backend/frontend để deduplicate subscription và chuẩn hóa reconnect behavior

### Mục tiêu
- không tăng số socket theo số lượng component
- có reference counting, subscription deduplication, backoff và circuit breaker

## 5. Phase 3: Refactor Trading
### Code scope
- `backend/portfolio/services/trading_service.py`
- `backend/portfolio/trading_views.py`
- router `portfolio` dùng flag `ENABLE_NEW_TRADING_VIEWS`

### Điều kiện vào phase
- Market Data đã qua canary ổn định theo measurement contract
- regression suite cho auth, throttle, cache và rollback đã hoạt động

## 6. Verification Gate Bắt Buộc
Mỗi phase chỉ được promote khi đạt đủ các điều kiện sau:
1. **Contract tests:** schema, status code và error shape của endpoint mới khớp legacy.
2. **Regression tests:** auth JWT, permission, throttle, cache behavior, provider fallback.
3. **Benchmark:** đo latency, error rate, CPU, memory trước và sau refactor.
4. **Canary rollout:** mở traffic `10% -> 50% -> 100%`.

## 7. Rollback và Alerting
- Rollback bằng feature flag, không rollback bằng sửa code nóng.
- Forced rollback nếu xảy ra một trong hai điều kiện:
    - `5xx > 1.5%` trong `5 phút`
    - hoặc p95 `> 500ms` trong `5 phút`
- Alert phải gắn với APM/Grafana trước khi mở canary.

## 8. Decision Gate cho DailyPrice
Sau khi ba phase trên ổn định, mới mở bước đánh giá storage:
1. tối ưu RDBMS trước
2. đo lại p95 chart query
3. chỉ cân nhắc TimescaleDB hoặc cold-storage nếu p95 vẫn vượt `500ms`

## 9. Approval Record
Tài liệu này là execution plan hợp lệ khi và chỉ khi còn đồng bộ với:
- `SYSTEM_ARCHITECTURE_AUDIT.md`
- `REFACTOR_FAT_VIEWS_DESIGN.md`

Nếu một trong ba tài liệu thay đổi về module structure, phase order, flag strategy hoặc rollback rule thì execution plan phải được cập nhật đồng thời trước khi sprint planning bắt đầu.
