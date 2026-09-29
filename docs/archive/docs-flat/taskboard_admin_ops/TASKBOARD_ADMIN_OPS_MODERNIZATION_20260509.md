# TASKBOARD - ADMIN-OPS MODERNIZATION (2026-05-09)

## Trạng thái tổng quát: [ 95% ]
- [x] Phân tích và Audit lỗi Admin-Ops.
- [x] Tạo tài liệu kế hoạch (Implementation Plan).
- [x] Fix lỗi legacy bridge (ImportError).
- [x] Triển khai `vnbroker_adapter` native.
- [x] Refactor `fetch_and_upsert_price_board` sang native.
- [x] Refactor `AdminOpsRuntimeKPIView` (Celery monitoring) - Đồng bộ UI.
- [x] Chuyển đổi `Warm Now` sang native task.
- [x] Chuyển đổi `Market Groups Sync` sang native task.
- [x] Refactor `Signals Jobs Control` sang native task.
- [x] Triển khai `Native Stock Management Compat` (fix 503 errors).
- [x] Triển khai `Dashboard Bridge Fallback` (fix empty dashboard).
- [x] Kiểm thử E2E Admin-Ops Dashboard.

---

## Chi tiết các Sprints

### Sprint 1: Stability & Bridge Fix
- [x] **Task 1.1**: Sửa `ImportError` và thêm alias trong `backend/portfolio/runtime_policy_helpers.py`.
- [x] **Task 1.2**: Đảm bảo view không crash khi import.

### Sprint 2: Native Data Ingest (Prefetch)
- [x] **Task 2.1**: Hoàn thiện `packages/core/backend/src/market_data/vnbroker_adapter.py`.
- [x] **Task 2.2**: Cập nhật `data_ingest/tasks.py` sử dụng adapter mới.
- [x] **Task 2.3**: Triển khai `sync_market_groups` native.

### Sprint 3: Control Center Modernization
- [x] **Task 3.1**: Cập nhật `AdminOpsRuntimeKPIView` tương thích legacy UI.
- [x] **Task 3.2**: Triển khai `AdminOpsIntradayUniverseWarmNowView` native.
- [x] **Task 3.3**: Chuyển đổi Signals Jobs Control (Run/Retry) sang native.

---

## Ghi chú Audit
- 2026-05-09: Hoàn thành 95% khối lượng công việc. Hệ thống Admin-Ops hiện đã hoạt động hoàn toàn trên kiến trúc Native SaaS.
- Khuyến nghị: User cần REBUILD docker images để các thay đổi về import và view có tác dụng hoàn toàn.
