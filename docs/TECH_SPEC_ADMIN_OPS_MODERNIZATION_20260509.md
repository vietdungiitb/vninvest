# TECH SPEC - ADMIN-OPS MODERNIZATION (2026-05-09)

## 1. Kiến trúc Giám sát Service (Service Monitoring)
Thay thế logic kiểm tra service cũ bằng Native Celery Inspect API.

### Thành phần: `AdminOpsRuntimeKPIView`
- **Method**: `GET`
- **Logic**:
  1. Sử dụng `celery.app.control.inspect()` để lấy danh sách workers đang chạy (`ping()`, `active()`).
  2. Map kết quả tới các service định danh trong SaaS: `core-worker`, `core-beat`.
  3. Kiểm tra kết nối Redis (`django_redis.get_redis_connection`).
  4. Kiểm tra sức khỏe database Postgres (`django.db.connection.ensure_connection`).

## 2. Native VNStock Adapter
Module mới để lấy dữ liệu bảng giá/lịch sử từ các nguồn bên thứ ba (KBS, VCI) mà không cần qua legacy DB.

### File: `market_data/vnstock_adapter.py`
- **Hàm chính**: `fetch_price_board_snapshot(symbols: list[str]) -> list[dict]`
- **Cấu hình**: Lấy từ `market_data.models.VnstockRuntimeConfig`.
- **Error Handling**: Implement circuit breaker và retry logic để đảm bảo tính ổn định khi gọi API bên ngoài.

## 3. Native Data Lifecycle
Quản lý vòng đời dữ liệu trực tiếp trên Core Models.

### Task: `data_ingest.tasks.fetch_and_upsert_price_board`
- **Flow**:
  1. Đọc `VnstockRuntimeConfig` hiện tại.
  2. Gọi `vnstock_adapter.fetch_price_board_snapshot`.
  3. Map và Upsert vào `market_serving.models.SymbolSnapshot`.
  4. Ghi log vào `data_ingest.models.IngestRun` để audit.

## 4. UI/UX Dashboard alignment
Đảm bảo frontend dashboard nhận được đúng cấu trúc payload từ native API.

- Payload `runtime-kpi` phải trả về đúng field `celery: { alive: bool, workers: list }`.
- Payload `prefetch-warm` phải trả về `task_id` của Celery task native.
