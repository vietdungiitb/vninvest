# IMPLEMENTATION PLAN — Dashboard SaaS Native Remediation

**Ngày**: 2026-05-20  
**Tác giả**: Antigravity  
**Bề mặt ảnh hưởng**: `@vninvest/web` package và `PackageDashboardHost.jsx`  
**Trạng thái**: Hardened (Vòng 2) / Đã tích hợp phản biện kỹ thuật

---

## 1. Goal Description
Bản kế hoạch này mô tả chi tiết các bước nâng cấp và gia cố kỹ thuật cho trang Dashboard SaaS-Native `/dashboard/package-host` để thay thế hoàn toàn route `/dashboard` cũ.

---

## 2. Proposed Changes

### A. Component: `@vninvest/web` (SaaS-Native core package)

#### [MODIFY] [useCoreDashboardData.js](../packages/web/src/features/dashboard/useCoreDashboardData.js)
* **Cô lập Phase 2 & Trả Degraded-State:**
  - Khai báo state cục bộ `technicalsStatus` dạng `{ status: 'idle', errorCode: null }`.
  - Khối gọi API `getBulkTechnicalsBySymbols` bọc trong `try-catch` cục bộ.
  - Khi gặp sự cố mạng hoặc lỗi API kỹ thuật, thiết lập `technicalsStatus` thành `{ status: 'failed', errorCode: '[ERR_CORE_BULK_TECHNICAL_03]' }` và gán `technicals = []`.
  - Phân loại lỗi Phase 1 nếu xảy ra: `[ERR_CORE_PORTFOLIO_SUMMARY_01]` hoặc `[ERR_CORE_PORTFOLIO_HOLDINGS_02]`.
* **Cơ chế Hydration Lifecycle (`hasHydrated`):**
  - Khai báo state `hasHydrated` mặc định `false`.
  - Khi lần fetch đầu tiên của Phase 1 kết thúc, đổi `hasHydrated = true` để khóa vòng đời skeleton load.

#### [MODIFY] [DashboardPage.js](../packages/web/src/pages/DashboardPage.js)
* **WebSocket Stable Ready Token:**
  - Viết thuật toán `collectUniqueSortedSymbols` gom các mã từ holdings, tracked, watchlists, watchlistGroups.
  - Áp dụng deduplicate + alphabetical sort để tạo ra một `readyToken` định danh chuẩn hóa theo set semantics.
  - So sánh `readyToken !== prevReadyTokenRef.current` để phát tín hiệu `onDataReady`.
* **Tương tác chéo Selected Session (Pha A):**
  - Khai báo state `selectedSession` và `selectedSymbol` ở page container level.
  - Chuyển giao các state và hàm gán trị này vào các render prop slots.
* **UX Anti-Flicker:**
  - Sửa đổi điều kiện hiển thị skeleton: `const showSkeleton = loading && !hasHydrated`.
* **Dependency Inversion cho i18n:**
  - Bổ sung prop `t` (bộ dịch) được truyền vào từ ngoài Host Shell.
  - Thay thế các đoạn chữ tiếng Việt cứng thành `t("dashboard.empty", "...")`.

---

### B. Component: `frontend/src/pages` (Host Shell)

#### [MODIFY] [PackageDashboardHost.jsx](../frontend/src/pages/PackageDashboardHost.jsx)
* **Nhận diện Tương tác chéo & Cập nhật Props (Pha B):**
  - Khai báo state chia sẻ `selectedSession` và `selectedSymbol`.
  - Nâng cấp API của các render slots để truyền `selectedSession` và `onSelectSession` trực tiếp vào `AIAdvisorAlertPanel`, `UnifiedAlertCenter` và `FactsFirstModularPositionDeck`.
* **Tiêu chí nghiệm thu từng pha (Delivery Gates):**
  - *Pha A Pass:* Thiết lập xong contract chéo ở Host/Page, build thành công, layout ổn định.
  - *Pha B Pass:* Đồng bộ click thành công toàn bộ các widget.
  - *Rollback:* Revert code Pha A hoặc ngắt cờ liên kết chéo ở Host Shell nếu có lỗi regression trước release.

---

## 3. Verification Plan

### Automated Tests
* Để kiểm định regression, **chúng ta sẽ tạo mới** file test tích hợp UI Lifecycle tại đường dẫn:
  `../packages/web/src/features/dashboard/__tests__/dashboard_lifecycle.test.js`
  File test này bao phủ 4 kịch bản:
  1. Phase 2 sập (`[ERR_CORE_BULK_TECHNICAL_03]`) nhưng holdings vẫn render bình thường.
  2. Danh mục rỗng vẫn gọi `onDataReady` gửi token lên Host.
  3. Refresh/polling không chớp skeleton sau khi `hasHydrated === true`.
  4. Sắp xếp lại danh sách hoặc thay đổi thứ tự API không làm thay đổi `readyToken`.

* **Lệnh chạy test thực tế (chạy từ thư mục web):**
  ```powershell
  Push-Location ./packages/web
  npm test -- src/features/dashboard/__tests__/dashboard_lifecycle.test.js
  Pop-Location
  ```
