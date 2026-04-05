# Báo Cáo Kiểm Toán Kiến Trúc Hệ Thống (System Architecture Audit)

Tài liệu này ghi nhận các rủi ro kiến trúc đã được xác nhận trong hệ thống VNInvest và chốt các nguyên tắc làm chuẩn cho toàn bộ lộ trình refactor. Đây là tài liệu nền; thiết kế chi tiết nằm ở `REFACTOR_FAT_VIEWS_DESIGN.md`, còn trình tự triển khai nằm ở `REFACTOR_EXECUTION_PLAN.md`.

## 1. Điểm Báo Động Đỏ: Fat Views ở `backend/portfolio/views.py`
- **Tình trạng:** `views.py` đang ôm trực tiếp Network I/O, cache access, parse rate limit, database orchestration và business logic.
- **Rủi ro:** Khó bảo trì, khó unit test, merge conflict cao, và làm tăng xác suất regression khi thay đổi tích hợp `vnstock`.
- **Quyết định kiến trúc:** Refactor theo mô hình 3 lớp với import một chiều cố định:
  - `Views` chỉ parse request, auth/permission, validate input, serialize response.
  - `Services` chỉ chứa business logic và transaction boundary.
  - `Adapters` chỉ giao tiếp với hệ ngoài như `vnstock`, cache, retry và fallback.

## 2. Chuẩn Cấu Trúc Module Sau Refactor
Để tránh thiếu nhất quán giữa các tài liệu, cấu trúc chính thức được chốt như sau:
- `backend/portfolio/market_views.py`
- `backend/portfolio/trading_views.py`
- `backend/portfolio/watchlist_views.py`
- `backend/portfolio/config_views.py`
- `backend/portfolio/services/`
- `backend/portfolio/adapters/`
- `backend/portfolio/exceptions.py`

Không dùng thêm thư mục `new_views/`. Việc chuyển traffic giữa code cũ và code mới sẽ được kiểm soát tại router và settings thông qua feature flag.

## 3. Điểm Nghẽn Giao Tiếp: Client-side WebSocket `useRealtimeFeed.js`
- **Tình trạng:** Một hook có thể bị gọi ở nhiều component trong cùng phiên làm việc.
- **Rủi ro:** Mở nhiều kết nối socket trùng lặp, tăng tải lên Channels/Redis và gây lãng phí tài nguyên phía client.
- **Quyết định kiến trúc:** Chuyển sang `RealtimeProvider` + `Connection Manager Singleton` với các đặc tính bắt buộc:
  - reference counting theo subscriber
  - subscription deduplication theo symbol/channel
  - exponential backoff có jitter khi reconnect
  - circuit breaker khi lỗi lặp lại vượt ngưỡng

## 4. Storage Decision Gate cho `DailyPrice`
- **Rủi ro:** Chuyển sớm sang TSDB làm tăng độ phức tạp vận hành khi chưa có dữ liệu chứng minh cần thiết.
- **Quyết định:** Chưa đổi storage trong giai đoạn refactor hiện tại.
- **Trình tự đánh giá:**
  - Giai đoạn 1: tối ưu RDBMS bằng indexing, partitioning và materialized view nếu cần.
  - Giai đoạn 2: đo p95 của truy vấn biểu đồ dài hạn trong môi trường thực tế.
  - Giai đoạn 3: chỉ mở nhánh đánh giá TimescaleDB hoặc cold-storage nếu p95 vẫn > `500ms` sau tối ưu.

## 5. Measurement Contract
Các chỉ tiêu dưới đây là baseline chung cho audit, design và execution plan.

| Metric | Nguồn dữ liệu | Cửa sổ đo | Điều kiện pass |
| :--- | :--- | :--- | :--- |
| P95 Latency Trading | APM / Grafana | 7 ngày liên tục sau rollout | `< 200ms` |
| Error Rate 5xx | Gateway / APM | 7 ngày liên tục sau rollout | `< 0.1%` |
| Service Test Coverage | CI/CD | Mỗi pull request | `>= 75%` cho service refactored |
| Thời gian thêm API mới | JIRA / team log | 1 POC hoàn chỉnh | `< 2 giờ` |

## 6. Governance Baseline
- Không triển khai kiểu big-bang rewrite.
- Market Data là domain refactor đầu tiên.
- Trading chỉ được mở sau khi Market Data qua đủ contract test, regression test, benchmark và canary.
- Mọi rollout đều phải có rollback bằng feature flag.
- Hotfix P0/Security được phép đi thẳng production nhưng phải backport vào nhánh refactor trong vòng `24h`.

## 7. Thuật Ngữ Chuẩn
- **Fat Views:** Views chứa cả business logic và I/O thay vì chỉ làm controller boundary.
- **Strangler Pattern:** Thay mới dần từng phần, giữ contract cũ hoạt động song song với contract mới.
- **Contract Test:** Kiểm tra response mới không làm lệch schema, status code và error shape của hệ thống cũ.
- **Canary Rollout:** Mở traffic theo tỷ lệ, quan sát metric, rồi mới mở rộng tiếp.
