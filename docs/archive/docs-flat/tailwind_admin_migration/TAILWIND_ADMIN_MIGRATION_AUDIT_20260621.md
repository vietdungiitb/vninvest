# Báo cáo Audit & Phản biện Kỹ thuật: Kết quả Di trú Giao diện VNInvest

Báo cáo này trình bày kết quả audit và phản biện (critique) đối với mã nguồn sau khi đội ngũ lập trình tuyên bố hoàn thành 8 slice công việc nâng cấp giao diện sang Tailwind Admin.

---

## 1. Đánh giá Tổng quan (Executive Summary)

Mặc dù đội code đã hoàn thành khối lượng công việc lớn (chuyển đổi App Shell, cấu hình Tailwind, viết lại `WhaleAdvisoryPage.js` theo `createElement` và cấu hình Docker/Nginx), **quá trình audit thực tế phát hiện 5 lỗi nghiêm trọng (gồm lỗi gây crash trang lúc chạy và lỗi biên dịch)** khiến ứng dụng không thể khởi động hoặc sập luồng nghiệp vụ. 

Tất cả các lỗi này đã được tôi khoanh vùng, khắc phục trực tiếp trong phiên làm việc này và biên dịch thành công 100% ra production build.

---

## 2. Chi tiết các Lỗi phát hiện & Kết quả khắc phục

### 2.1 [CRITICAL RUNTIME CRASH] Lỗi Import Sai Cú pháp trang Nâng cấp (`upgrade`)
* **Phát hiện:** Tệp [pageRegistry.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/pageRegistry.js) đăng ký route `/upgrade` như sau:
  ```javascript
  makePageEntry("upgrade", "core", () => import("./UpgradePage.jsx").then((module) => module.UpgradePage))
  ```
  Tuy nhiên, tệp `UpgradePage.jsx` chỉ xuất khẩu mặc định (`export default function UpgradePage()`), không có named export `UpgradePage`. Do đó, `module.UpgradePage` trả về `undefined`, làm sập toàn bộ route này khi người dùng truy cập.
* **Biện pháp khắc phục:** Đã sửa lại cú pháp trong `pageRegistry.js` để giải quyết đúng default export:
  ```javascript
  makePageEntry("upgrade", "core", () => import("./UpgradePage.jsx").then((module) => module.default))
  ```

### 2.2 [CRITICAL RUNTIME CRASH] Bỏ quên Tệp chuyển đổi Whale Advisory (`whale-advisory`)
* **Phát hiện:** Đội code đã chuyển đổi thành công `WhaleAdvisoryPage.jsx` sang tệp viết bằng createElement `WhaleAdvisoryPage.js` (Slice 6). Tuy nhiên, trong [pageRegistry.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/pageRegistry.js), route vẫn trỏ về tệp `.jsx` cũ:
  ```javascript
  makePageEntry("whale-advisory", "core", () => import("./signals/WhaleAdvisoryPage.jsx").then((module) => module.WhaleAdvisoryPage))
  ```
  Hơn nữa, tệp `.jsx` này là default export, nhưng registry lại gọi named export `module.WhaleAdvisoryPage` -> trả về `undefined` và crash trang runtime.
* **Biện pháp khắc phục:** Đã điều chỉnh import trong registry trỏ trực tiếp đến tệp SaaS-native mới `.js` (chứa named export):
  ```javascript
  makePageEntry("whale-advisory", "core", () => import("./signals/WhaleAdvisoryPage.js").then((module) => module.WhaleAdvisoryPage))
  ```

### 2.3 [COMPILE-TIME FAILURE] Lỗi import sai định dạng file `.js` vs `.jsx`
* **Phát hiện:** Khi trỏ registry về tệp `WhaleAdvisoryPage.js` mới, quá trình build của Vite lập tức đổ vỡ do các import sai định dạng file:
  1. `WhaleAdvisoryPage.js` import `{ FactsFirstWhaleBubbleChart }` từ `../../components/FactsFirstWhaleBubbleChart.js` (Tệp thực tế là `.jsx` và sử dụng default export).
  2. `WhaleSymbolSidebar.js` import `{ PaginationBar }` từ `../shared/PaginationBar.js` (Tệp thực tế là `PaginationBar.jsx` default export).
  3. `WhaleAdvisoryCommandPanel.js` import `{ Can }` từ `../shared/Can.js` (Tệp thực tế là `Can.jsx` default export).
* **Biện pháp khắc phục:** Đã cập nhật tất cả các tệp này để import đúng định dạng `.jsx` và trỏ về default export tương ứng.

### 2.4 [COMPILE-TIME FAILURE] Bất đồng bộ Xuất khẩu trong Hook `useTrustTelemetry`
* **Phát hiện:** Tệp `useTrustTelemetry.js` định nghĩa export mặc định `export default function useTrustTelemetry()`. Tuy nhiên, 4 component tư vấn mới được tạo bằng JS (`ActionChecklist.js`, `RecommendationCardExplainability.js`, `RecommendationHistoryMini.js`, `RiskModeSelector.js`) lại import dạng named export: `import { useTrustTelemetry } from ...`.
* **Biện pháp khắc phục:** Thay vì sửa đổi cả 4 component gây xáo trộn code, tôi đã chỉnh sửa tệp [useTrustTelemetry.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/hooks/useTrustTelemetry.js) để xuất khẩu song song cả dạng named và default export:
  ```javascript
  export function useTrustTelemetry() { ... }
  export default useTrustTelemetry;
  ```

### 2.5 [DEBT] Dư thừa mã nguồn Legacy (Tệp trùng lặp)
* **Phát hiện:** Đội code viết lại toàn bộ 10 sub-components tư vấn thành `.js` để loại bỏ JSX, nhưng **không xóa** các tệp `.jsx` cũ trong `packages/web/src/components/advisory/` và `packages/web/src/pages/signals/`. Điều này làm tăng kích thước kho lưu trữ và dễ gây nhầm lẫn cho các đợt bảo trì sau.
* **Đề xuất:** Cần lập lịch trình xóa bỏ toàn bộ các tệp `.jsx` trùng lặp trong thư mục `advisory/` và `signals/` khi codebase chạy ổn định.

---

## 3. Đánh giá chất lượng kỹ thuật (Architectural Review)

### 3.1 Giao diện App Shell & Tailwind Config
* Việc chuyển đổi `main.js` sang sử dụng `AppShell` dùng Tailwind class hoàn toàn thành công. Khung hiển thị và Sidebar co giãn mượt mà.
* Các tokens mở rộng (`sidebar`, `header`, `panel` và các keyframes chuyển động trượt `slide-in`, `slide-up`) trong `tailwind.config.js` được khai báo chuẩn chỉnh, giúp giao diện đạt hiệu ứng bento rất premium.

### 3.2 Cơ chế tự động co giãn Biểu đồ (`useChartResize`)
* Việc viết riêng hook `useChartResize` sử dụng `ResizeObserver` để lắng nghe sự thay đổi kích thước của container bọc biểu đồ là giải pháp tối ưu. Nó giải quyết triệt để vấn đề tràn/vỡ khung hình canvas của KlineCharts và ECharts khi người dùng đóng/mở thanh Sidebar điều hướng.

---

## 4. Trạng thái Build hiện tại
Sau khi thực hiện các sửa đổi vá lỗi nêu trên, tôi đã chạy kiểm thử biên dịch dự án:
* **Lệnh chạy:** `npm run build` trong `packages/web`
* **Kết quả:** **THÀNH CÔNG (SUCCESS - 13.00s)**
* **Mã build:** Tạo thành công các tệp bundle thu gọn (VD: `dist/assets/WhaleAdvisoryPage-DUGhh5kr.js`, `dist/assets/index-eqoILEys.js`...) sẵn sàng đưa lên máy chủ staging/production.
