# Sprint 13 — Portfolio Analytics, Stock Workspace, Admin Ops (Delivered Snapshot)

**Thời gian thực thi**: 2026-04-02  
**Trạng thái**: COMPLETED  
**Mục đích tài liệu**: Chuẩn hóa lại từ bản plan cũ sang trạng thái đã triển khai theo codebase hiện tại.

---

## 1) Phạm vi đã triển khai (Delivered)

### 1.1 Portfolio Analytics
- Có endpoint analytics:
  - `GET /api/portfolio/portfolios/{id}/analytics/`
- Có endpoint allocation theo sector:
  - `GET /api/portfolio/portfolios/{id}/allocation/?by=sector`
- Các chỉ số analytics nâng cao đã được bổ sung trong backend analytics module (theo trạng thái dự án hiện tại và test liên quan).

### 1.2 Stock Detail Workspace
- Trang `StockDetail` đã có nền tảng đầy đủ:
  - Quote realtime
  - Company profile
  - Session stats
  - Tín hiệu/cảnh báo liên quan symbol (price alert + whale alert theo scope)

### 1.3 Admin Operations
- Có API:
  - `GET /api/admin-ops/stats/`
- Có route frontend:
  - `/admin-ops`
- Có kiểm soát quyền và trạng thái hệ thống (realtime/channel/redis) trong luồng admin ops.

### 1.4 Realtime mở rộng liên quan giai đoạn sau
- Thực tế route realtime đã có thêm:
  - `whale-feed/aggregate/`
  - `price-board/<symbol>/`
  - `depth-chart/<symbol>/`
  - `intraday/<symbol>/`
  - `breadth/<symbol>/`
  - `rvol/<symbol>/`
- Các endpoint này phản ánh việc một phần backlog giai đoạn sau đã được đưa vào code sớm.

---

## 2) Trạng thái chất lượng (theo tài liệu và test trong repo)

- Tài liệu trạng thái tổng hợp ghi nhận Sprint 13 đã hoàn thành.
- Test backend liên quan analytics/admin ops/realtime đã có trong:
  - `backend/portfolio/tests/test_analytics_advanced.py`
  - `backend/portfolio/tests/test_admin_ops.py`
  - `backend/portfolio/tests/test_api_routes.py`

---

## 3) Sai khác so với bản kế hoạch ban đầu

Bản `SPRINT13_DETAILED_PLAN.md` trước đây là tài liệu kiểu planning (timeline Day 1..10, checklist chưa tick).  
Tình trạng code hiện tại cho thấy nhiều hạng mục đã hoàn thành và đã vận hành thực tế. Vì vậy tài liệu này được chuyển thành **Delivered Snapshot** để tránh lệch giữa docs và source.

---

## 4) Canonical references

- Trạng thái dự án tổng: `docs/ROADMAP_STATUS.md`
- Checklist nghiệm thu Sprint 13: `docs/SPRINT13_ACCEPTANCE_CHECKLIST.md`
- Nhật ký triển khai theo phiên: `docs/SPRINT_EXECUTION_LOG.md`
- Contract WebSocket: `docs/WEBSOCKET_EVENT_CONTRACT.md`

---

## 5) Historical note

Tài liệu này giữ vai trò thay thế cho bản plan cũ, phục vụ mục đích:
1. Đồng bộ với source hiện tại.
2. Giảm mâu thuẫn giữa “đang planning” và “đã delivered”.
3. Làm baseline cho re-baseline Sprint tiếp theo.
