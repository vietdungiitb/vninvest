# TASKBOARD — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Tác giả**: Antigravity  
**Phiên làm việc**: `VNINVEST_SAAS_NATIVE_DASHBOARD_UPGRADE`  
**Trạng thái**: Hardened (Vòng 2) / Đã tích hợp phản biện kỹ thuật

---

## 1. Hướng dẫn sử dụng
Bảng taskboard này dùng để theo dõi tiến độ thi công của các slice công việc nâng cấp trang Dashboard SaaS-Native.
* Ký hiệu `[ ]` là công việc chưa thực hiện.
* Ký hiệu `[/]` là công việc đang triển khai.
* Ký hiệu `[x]` là công việc đã hoàn thành và kiểm thử thành công.

---

## 2. Danh mục công việc (Work Breakdown Structure)

### Slice 1: Cô lập Phase 2 & Trả Degraded-State Contract
* [ ] Cô lập khối API technicals gộp `getBulkTechnicalsBySymbols` bằng try-catch cục bộ trong `useCoreDashboardData.js`.
* [ ] Báo lỗi Phase 1 nếu có: `[ERR_CORE_PORTFOLIO_SUMMARY_01]` hoặc `[ERR_CORE_PORTFOLIO_HOLDINGS_02]`.
* [ ] Báo lỗi degraded Phase 2 chuẩn: `[ERR_CORE_BULK_TECHNICAL_03]`.
* [ ] Expose `technicalsStatus` ra ngoài hook để hỗ trợ giám sát DataOps trực quan.

### Slice 2: Sinh Stable Ready Token chuẩn hóa (Set Semantics)
* [ ] Viết helper `collectUniqueSortedSymbols` gom, chuẩn hóa, deduplicate và sắp xếp alphabet các mã cổ phiếu bao phủ holdings, trackedSymbols, watchlists, và watchlistGroups.
* [ ] Gỡ bỏ so sánh tham chiếu mảng cũ `holdings !== prevHoldingsRef.current` ở `DashboardPage.js`.
* [ ] Tạo chuỗi tuần tự hóa `readyToken` ổn định để làm delta so sánh, đảm bảo WebSocket không bị churn.

### Slice 3: UX Anti-Flicker qua Hydration Lifecycle (`hasHydrated`)
* [ ] Khai báo cờ hiệu `hasHydrated` mặc định `false` trong hook dữ liệu.
* [ ] Thiết lập `hasHydrated = true` ngay khi vòng tải dữ liệu Phase 1 lần đầu tiên hoàn tất.
* [ ] Điều chỉnh logic hiển thị skeleton trong `DashboardPage.js`: `showSkeleton = loading && !hasHydrated`.

### Slice 4: Tương tác chéo Selected Session Pipeline (Delivery Gates)
* [ ] **Pha A (Định hình Contract):** Khai báo state `selectedSession` và `selectedSymbol` ở container `DashboardPage.js` và liên kết mapping qua render slots.
* [ ] **Pha B (Hiện thực hóa Component):** Sửa đổi props của `AIAdvisorAlertPanel.jsx`, `UnifiedAlertCenter.jsx` và `FactsFirstModularPositionDeck.jsx` để lắng nghe session được chọn và thay đổi tương tác chéo.
* [ ] **Rollback Strategy:** Xây dựng phương án ngắt cờ liên kết hoặc revert nhanh Pha A nếu có regression.

### Slice 5: Đảo ngược phụ thuộc i18n
* [ ] Định nghĩa prop `t` (bộ dịch) được Host Shell inject truyền vào `DashboardPage.js`.
* [ ] Thay thế các chuỗi cứng tiếng Việt bằng `t(...)` sử dụng bộ dịch được truyền vào.

### Slice 6: Tạo mới bộ kiểm thử UI Lifecycle chuyên sâu
* [ ] **Tạo mới thư mục và file test** tại đường dẫn: `packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js`.
* [ ] Viết test suite Jest bao phủ 4 ca test trọng điểm (Phase 2 fail, Empty holdings ready, anti-flicker, stable token sorting).
