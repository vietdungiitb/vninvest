# IMPLEMENTATION PLAN - ADMIN-OPS MODERNIZATION (2026-05-09)

## 1. Mục tiêu
Hiện đại hóa phân hệ Admin-Ops, loại bỏ phụ thuộc vào legacy bridge và khôi phục các chức năng quản trị trong môi trường Native SaaS.

## 2. Các vấn đề hiện tại
- [x] Lỗi `ImportError` tại `/api/admin-ops/intraday-universe/warm-now/` do sai tên hàm trong legacy backend.
- [ ] Chức năng `Prefetch` không chạy do vẫn cố gắng kết nối tới database legacy đã bị gỡ bỏ.
- [ ] Không thể giám sát và điều khiển các background services (Celery) từ giao diện Admin-Ops native.
- [ ] Các view Admin-Ops hiện tại chủ yếu là stubs hoặc bridge, chưa có logic xử lý native hoàn chỉnh.

## 3. Giải pháp kỹ thuật

### Phase 1: Ổn định Legacy Bridge (Quick Fix)
- Sửa lỗi import trong `backend/portfolio/views_admin_runtime.py` để các yêu cầu bridge không bị lỗi 500.

### Phase 2: Native Prefetch & Data Ingest
- Triển khai `market_data.vnstock_adapter` để lấy dữ liệu từ các nguồn chính thống thay vì legacy DB.
- Refactor `data_ingest.tasks.fetch_and_upsert_price_board` để sử dụng adapter mới.
- Cập nhật cấu hình runtime trong `VnstockRuntimeConfig` để điều khiển quá trình prefetch.

### Phase 3: Native Service Monitoring
- Cập nhật `AdminOpsRuntimeKPIView` để sử dụng Celery Control API giám sát `core-worker` và `core-beat`.
- Triển khai logic kiểm tra sức khỏe các thành phần: Redis, Postgres, Celery, AI Runtime.

### Phase 4: Native Action Handlers
- Chuyển đổi các view `Warm Now`, `Backfill`, `Sync Market Groups` sang thực hiện trực tiếp thông qua Celery tasks native.

## 4. Danh sách file thay đổi (Dự kiến)
- `backend/portfolio/views_admin_runtime.py` (Fix legacy bridge)
- `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py` (Refactor to native)
- `packages/core/backend/src/data_ingest/tasks.py` (Refactor prefetch logic)
- `packages/core/backend/src/market_data/vnstock_adapter.py` [NEW] (Adapter lấy dữ liệu)

## 5. Kế hoạch xác minh
- Chạy unit tests cho `admin_ops` app.
- Kiểm tra manual trên Admin-Ops Dashboard.
- Audit kết quả thực hiện vào `CODE_CHANGE_AUDIT_LEDGER.md`.
