# Kết quả Thẩm định & Phản biện: Kế hoạch loại bỏ Legacy Frontend (Bản Cuối)

**Ngày lập:** 2026-06-21  
**Tài liệu liên quan:** [LEGACY_FRONTEND_ELIMINATION_PLAN_20260621.md](file:///c:/Mujoco%20Projects/vninvest/docs/LEGACY_FRONTEND_ELIMINATION_PLAN_20260621.md)  
**Trạng thái Audit:** **THÔNG QUA (APPROVED)** — Kế hoạch đã tích hợp đầy đủ các phát hiện kỹ thuật, biện pháp giảm thiểu rủi ro và quy trình rollback khẩn cấp.

---

## 1. Kết quả giải quyết các điểm phản biện kỹ thuật

Dưới đây là bảng đối chiếu kết quả xử lý các phát hiện kỹ thuật cốt lõi giữa tài liệu Phản biện trước đó và Kế hoạch chính thức hiện tại:

| # | Điểm phản biện ban đầu | Trạng thái trong Kế hoạch mới | Chi tiết cập nhật & Đánh giá |
|---|---|---|---|
| 1 | **WebSocket engine đã có sẵn** | **[ĐÃ GIẢI QUYẾT]** | Kế hoạch đã ghi nhận WebSocket engine đã có sẵn trong `useRealtimeFeedCore.js` ở §1.1 rào cản 6. Thời gian Bước 2a được rút ngắn từ 3-4 xuống còn **2-3 ngày**, mức độ rủi ro được giảm từ Cao xuống **Trung bình**. |
| 2 | **Lỗ hổng sập Dashboard** | **[ĐÃ GIẢI QUYẾT]** | Bước 2b và tiêu chí DoD (§6) đã bổ sung nhiệm vụ: Di dời trực tiếp các component cốt lõi của Dashboard (`SmartStatsHeader`, `FactsFirstModularPositionDeck`, `PortfolioHeatmap`, `UnifiedAlertCenter`) cùng các hook realtime từ legacy vào `packages/web` để loại bỏ phụ thuộc slots render-props. |
| 3 | **Lỗi cú pháp gọi Adapter gây crash** | **[ĐÃ GIẢI QUYẾT]** | Đã đưa nhiệm vụ vá lỗi cú pháp `coreApiAdapter({ env })` của 4 trang SaaS hiện tại (`Portfolios`, `Transactions`, `UserSettings`, `WhaleAlerts`) và sửa lỗi chính tả hàm reload (`coreApiReload`) vào công việc chi tiết của Bước 2a và checklist DoD (§6). |
| 4 | **Rủi ro Rollback SLA < 7 phút** | **[ĐÃ GIẢI QUYẾT]** | Đã cập nhật cảnh báo nghiêm trọng ở §8 về việc build tại chỗ (on-server build) tốn 10-15 phút. Thay thế runbook cũ bằng cơ chế **Backup Local Tag** (`backup-pre-migration`) giúp phục hồi hệ thống ngay lập tức trong **< 30 giây**. Bổ sung phương án dài hạn dùng GHCR để pull image sạch. |
| 5 | **Đồng bộ hóa biến môi trường Vite** | **[ĐÃ GIẢI QUYẾT]** | Bổ sung tiêu chí DoD Bước 6 về việc rà soát và đổi toàn bộ các biến môi trường sang định dạng `VITE_` trong các tệp cấu hình docker-compose và workflow GitHub Actions. |
| 6 | **Audit cấu hình Nginx** | **[ĐÃ GIẢI QUYẾT]** | Đã rà soát thực tế `packages/web` và chuyển đổi vấn đề #2 (DNS resolver) và #3 (Rate limit zone) trong §1.4 thành **✅ Pre-resolved** (do cấu hình Nginx hiện tại đã có sẵn). |

---

## 2. Tiêu chí hoàn thành mở rộng (18 DoD Items)

Kế hoạch đã chuẩn hóa quy trình Definition of Done (DoD) thành 18 tiêu chí kiểm duyệt độc lập:

1. **Bước 0:** Xác minh khóa JWT trong `localStorage` trùng khớp giữa 2 port.
2. **Bước 0:** Tạo file mapping keys i18n làm SSOT (Single Source of Truth).
3. **Bước 1:** `packages/web/src/adapters/core/` có đầy đủ 30 API functions mới.
4. **Bước 1 (Vá lỗi):** Sửa cú pháp `coreApiAdapter({ env })` trong 4 trang SaaS hiện tại.
5. **Bước 1 (Vá lỗi):** Sửa lỗi chính tả hàm `coreApiReload()` tại `PortfoliosPage.js`.
6. **Bước 2a:** Đồng bộ cấu hình Vite (`VITE_WS_BASE_URL` và `VITE_DISABLE_REALTIME_WEBSOCKET`) hoạt động ổn định.
7. **Bước 2b:** Di dời các component Dashboard và hooks realtime từ legacy vào `packages/web`.
8. **Bước 2b:** Trình đóng gói `packages/web` có App.jsx riêng hoạt động độc lập.
9. **Bước 3:** 100% trang legacy đã được chuyển đổi sang SaaS Native (kèm test coverage >= 70%).
10. **Bước 4:** Dockerfile của packages/web tự build VNStockCharts KLine engine sử dụng biến dynamic `STOCKCHART_REF`.
11. **Bước 5:** Shadow run >= 3 ngày trên subdomain beta và có luồng log monitoring riêng biệt.
12. **Bước 6:** `packages/web/docker/nginx.conf` có đầy đủ proxy rate limiting và rewrite rules.
13. **Bước 6:** Sửa context build trong `docker-compose.dev.yml` trỏ về `packages/web/` thay vì `.`.
14. **Bước 6:** Đồng bộ hóa toàn bộ biến môi trường Vite (`VITE_...`) trên tất cả compose files.
15. **Bước 6:** Tạo local backup tag `vninvest-frontend:backup-pre-migration` trên server.
16. **Bước 6:** Sửa workflow CI/CD `.github/workflows/web.yml` trỏ file build về Dockerfile mới.
17. **Bước 6:** Thư mục legacy `frontend/` được dọn dẹp sạch sẽ khỏi repository.
18. **Smoke test & Monitoring:** Khử trùng lặp, bundle size tối ưu và giám sát hệ thống ổn định trong 1 tuần hậu migration.

---

## 3. Khuyến nghị Vận hành cho buổi thảo luận

Để buổi họp thảo luận với team diễn ra hiệu quả, dưới đây là các khuyến nghị vận hành cụ thể:

1. **Vận hành Rollback:** 
   * Team phát triển phải thực hiện chạy thử (dry-run) kịch bản rollback bằng tag backup trên môi trường staging trước.
   * Thống nhất đặt tên tag backup có gắn thời gian để tránh bị ghi đè nhầm (ví dụ: `vninvest-frontend:backup-20260621`).
2. **Kế hoạch di dời component Dashboard:**
   * Do các component dashboard có giao diện phức tạp và ảnh hưởng trực tiếp tới trải nghiệm người dùng, đề xuất phân bổ nhân sự phụ trách chuyên biệt cho Bước 2b để đảm bảo layout Workstation V2 không bị lệch style (Vite sử dụng CSS Modules/Vanilla CSS trong khi CRA legacy có thể có các global stylesheet khác).
3. **i18n Localization Gate:**
   * Cần thiết lập một rule kiểm duyệt trước commit (pre-commit hook) hoặc CI gate kiểm tra xem các file JS có chứa chuỗi tiếng Việt hardcode hay không. Mọi text hiển thị bắt buộc phải đi qua hook `useI18n()`.
