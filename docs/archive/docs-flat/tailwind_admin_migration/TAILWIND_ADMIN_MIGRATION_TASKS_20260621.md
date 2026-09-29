# Kế hoạch Phân rã Slice Công việc: Nâng cấp Giao diện VNInvest sang Tailwind Admin
## Tài liệu hướng dẫn chuyển giao đội ngũ lập trình (No-back-and-forth Spec)

**Mã tài liệu:** `docs/TAILWIND_ADMIN_MIGRATION_TASKS_20260621.md`  
**Ngày lập:** 2026-06-21  
**Mục tiêu:** Phân chia thành các lát cắt công việc độc lập (slices), mô tả rõ file nguồn, file đích, cấu trúc giao diện, yêu cầu kỹ thuật và phương thức kiểm duyệt (DoD) để lập trình viên thực hiện được ngay mà không cần hỏi lại.

---

## Danh sách Slices triển khai

```
+-----------------------------------------------------------------------------+
| SLICE 1: App Shell & Sidebar Layout                                         |
+-----------------------------------------------------------------------------+
| SLICE 2: API Adapter Cleanup & syntax bug-fixes                             |
+-----------------------------------------------------------------------------+
| SLICE 3: Upper Triad Dashboard (Stats, Alerts Lane, Heatmap, AI Advisor)    |
+-----------------------------------------------------------------------------+
| SLICE 4: Lower Details Workspace (Whale Bubble Chart & Stats Cards)         |
+-----------------------------------------------------------------------------+
| SLICE 5: Whale Alerts Page Refactor                                         |
+-----------------------------------------------------------------------------+
| SLICE 6: Whale Advisory Page Porting                                         |
+-----------------------------------------------------------------------------+
| SLICE 7: Chart Resize Observability & Docker Chart Engine build             |
+-----------------------------------------------------------------------------+
| SLICE 8: Nginx Gateway Rewrite & Canary Deploy                              |
+-----------------------------------------------------------------------------+
```

---

## SLICE 1: Khung App Shell & Sidebar Layout

### 1. Mục tiêu
Thay thế layout inline CSS thô sơ trong `main.js` bằng cấu trúc Sidebar (co giãn, responsive) và Header (chứa bộ tìm kiếm và hiển thị trạng thái) sử dụng Tailwind CSS dựa trên template mẫu.

### 2. Các file tác động
* [packages/web/tailwind.config.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/tailwind.config.js) (Thêm biến cấu hình màu sắc/layout nếu thiếu)
* [packages/web/src/index.css](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/index.css) (Thêm các CSS class tiện ích của template)
* [packages/web/src/main.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/main.js) (Xóa `layoutStyles` inline, viết lại component `Layout`)

### 3. Mô tả chi tiết kỹ thuật
* **Sidebar (`w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0`)**:
  * **Workspace Selector:** Sử dụng cấu trúc thẻ `<select>` nền tối `bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-accent-cyan outline-none w-full cursor-pointer`.
  * **Menu danh mục:** Lấy dữ liệu từ `navigationCatalog.js`. Thêm class hoạt động (`isActive`): `bg-slate-800/60 text-accent-cyan border-l-2 border-accent-cyan font-semibold px-4 py-2.5 rounded-lg flex items-center gap-3`. Class không hoạt động: `text-slate-400 hover:bg-slate-800/30 hover:text-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors`.
  * **Profile Block:** Nằm dưới đáy Sidebar. Hiển thị thông tin người dùng và nút Đăng xuất màu đỏ mờ `bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 w-full py-2 rounded-lg font-medium transition-colors`.
* **Topbar Header (`h-18 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 flex items-center justify-between px-6`)**:
  * **Trái:** Hamburger Menu điều khiển thu gọn Sidebar; Breadcrumbs động.
  * **Giữa:** Ô input autocomplete tìm mã cổ phiếu `bg-slate-850 border border-slate-800 text-slate-200 text-sm rounded-lg px-4 py-2 focus:border-accent-cyan outline-none w-64`.
  * **Phải:** Icon trạng thái WebSocket (Chấm xanh: Online, Chấm đỏ: Offline), Cờ ngôn ngữ (VI/EN) kết nối qua `LangProvider`, và Chuông thông báo hiển thị các sự kiện Whale mới nhận.

### 4. Quy trình kiểm thử
* Mở giao diện trên màn hình Desktop: Xác nhận Sidebar hiển thị cố định ở bên trái rộng 280px (`w-72`).
* Thu nhỏ trình duyệt dưới 768px: Xác nhận Sidebar ẩn đi và nút Hamburger xuất hiện để kích hoạt Sidebar kéo ra (overlay).
* Nhấp thử thay đổi ngôn ngữ hoặc chuyển đổi Workspace trong dropdown: Trạng thái trong Context phải cập nhật đồng bộ.

---

## SLICE 2: Dọn dẹp API Adapter & Sửa lỗi Crash

### 1. Mục tiêu
Khắc phục triệt để các lỗi cú pháp gọi Adapter và lỗi chính tả hàm reload đang gây crash trang khi chạy độc lập trong `packages/web`.

### 2. Các file tác động
* [packages/web/src/pages/PortfoliosPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/PortfoliosPage.js)
* [packages/web/src/pages/TransactionsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/TransactionsPage.js)
* [packages/web/src/pages/UserSettingsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/UserSettingsPage.js)
* [packages/web/src/pages/WhaleAlertsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/WhaleAlertsPage.js)

### 3. Mô tả chi tiết kỹ thuật
* **Sửa lỗi cú pháp Adapter:** Sửa tất cả các đoạn mã gọi `coreApiAdapter({ env })` bị truyền sai tham số (adapter là đối tượng chứa hàm, không phải hàm tạo). Chuyển thành import trực tiếp `coreApiAdapter` và gọi các phương thức API như:
  * `coreApiAdapter.getPortfolioAnalytics(...)`
  * `coreApiAdapter.getPortfolioHoldings(...)`
  * `coreApiAdapter.getUserConfig(...)`
* **Sửa lỗi chính tả hàm Reload:**
  * Tại `PortfoliosPage.js` (dòng 73 hoặc lân cận), sửa lỗi chính tả từ hàm `coreApiAeload()` thành hàm chuẩn `coreApiReload()`.
* **Cơ chế Fallback:** Bọc các cuộc gọi API trong khối `try/catch`. Khi lỗi xảy ra, cập nhật state `error` và hiển thị bằng component `ErrorBanner` thay vì làm sập ứng dụng (white screen of death).

### 4. Quy trình kiểm thử
* Khởi động dev server (`npm run dev`) và truy cập trực tiếp vào các route `/portfolios`, `/transactions`, `/settings`.
* Xác nhận các trang tải bình thường mà không ghi nhận bất cứ lỗi Uncaught TypeError nào trong Developer Console của trình duyệt.

---

## SLICE 3: Dashboard Triad Grid (Hàng trên)

### 1. Mục tiêu
Tái cấu trúc và thiết kế giao diện Dashboard nửa trên đúng như bố cục Image 1, bao gồm Khối Stats Header, Làn Cảnh báo (Trái), Bản đồ nhiệt (Giữa), và AI Advisor (Phải).

### 2. Các file tác động
* [packages/web/src/pages/DashboardPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.js)
* [packages/web/src/components/dashboard/SmartStatsHeader.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/SmartStatsHeader.js)
* [packages/web/src/components/dashboard/UnifiedAlertCenter.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/UnifiedAlertCenter.js)
* [packages/web/src/components/dashboard/PortfolioHeatmap.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/PortfolioHeatmap.js)

### 3. Mô tả chi tiết kỹ thuật
* **Khối Stats Header (`SmartStatsHeader`):**
  * Định dạng: `sticky top-0 bg-[#070e1e]/90 border-b border-slate-800/80 flex items-center justify-between px-6 py-3`.
  * Hiển thị: Tổng giá trị thị trường, Lãi/lỗ tạm tính đổi màu (xanh lá cây `text-emerald-400` / đỏ hồng `text-rose-500`).
  * Đo độ rộng danh mục: ProgressBar nằm bên phải hiển thị tỷ lệ tăng/không đổi/giảm (VD: `0/13/0`), kết nối với nút Refresh xoay vòng và dấu chấm trạng thái WebSocket.
* **Lưới Triad Grid (`grid grid-cols-1 xl:grid-cols-10 gap-6 my-6`)**:
  * **Làn Cảnh Báo (Left - Chiếm 3/10 cột):**
    * Tiêu đề: "TRUNG TÂM CẢNH BÁO", liên kết "Xem tất cả →".
    * Badge đếm mức độ: 4 hộp nhỏ đếm số lượng Nghiêm trọng (đỏ), Cao (cam), Trung bình (xanh dương), Thấp (xám).
    * Tabs điều phối: Hai nút "Tín hiệu nóng" và "Cấu hình" dạng pill.
    * Empty State: Hiển thị icon vệ tinh mờ và đoạn text: *"Chưa có cảnh báo nổi bật. Trung tâm sẽ tự gộp whale, dark flow và bất thường giá theo thời gian thực."*
    * Pagination Footer: Điều khiển phân trang đầy đủ bao gồm arrows và dropdown số lượng mục trên trang.
  * **Làn Bản Đồ Nhiệt (Center - Chiếm 4/10 cột):**
    * Tiêu đề: "BIẾN ĐỘNG THEO DÕI • REALTIME FEED" kèm chấm tròn xanh dương và badge "LIVE FEED".
    * Filter Bars: Group 1 chọn "Tỷ trọng" / "Vốn hóa" (Active); Group 2 chọn "Treemap" (Active) / "Sunburst".
    * Treemap ECharts: Vẽ ô chữ nhật hiển thị tên mã (VD: `VPB`), phần trăm biến động (VD: `0.00%`), giá hiện tại (VD: `26800.00 VND`). Màu sắc ô: Vàng cát nếu đứng giá, đỏ hồng nếu giảm giá, xanh ngọc nếu tăng giá. Chân biểu đồ có thanh chú giải "TĂNG/GIẢM" màu sắc.
  * **Làn AI Advisor (Right - Chiếm 3/10 cột):**
    * Tiêu đề: "Trung Tâm Tín Hiệu AI Advisor" màu trắng kèm nút "Làm mới". Nội dung hiển thị trạng thái trống hoặc các thẻ khuyến nghị AI Bot.

### 4. Quy trình kiểm thử
* Mở trang Dashboard: Xác nhận bố cục 3 cột chia tỷ lệ `3:4:3` cân đối trên màn hình lớn.
* Tự động điều chỉnh kích thước: Thu hẹp màn hình về cỡ tablet (dưới 1024px) -> Xác nhận lưới chuyển thành bố cục 1 cột xếp chồng dọc.

---

## SLICE 4: Dashboard Phân khu Chi tiết (Hàng dưới)

### 1. Mục tiêu
Tái hiện phân khu chức năng phân tích nâng cao (Image 2) bên dưới Triad Grid trên trang Dashboard, bao gồm tab-bar lớn, bộ lọc phạm vi mã và khu vực phân tích dòng tiền lớn "Cá mập".

### 2. Các file tác động
* [packages/web/src/pages/DashboardPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.js) (Thêm phần render nửa dưới Dashboard)
* [packages/web/src/components/WhaleBubbleChart.jsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/WhaleBubbleChart.jsx) (Tích hợp slider Log-scale)

### 3. Mô tả chi tiết kỹ thuật
* **Thanh Tab-bar lớn:**
  * Định dạng: Nền tối, chứa 4 tab chính: "Tổng quan" (icon tài liệu), "Kỹ thuật" (icon chart), "Cá mập" (Active, icon cá mập), "AI Bot" (icon robot).
* **Thanh lọc phạm vi (Scope Bar):**
  * Nằm trực tiếp dưới Tab-bar. Gồm dropdown "PHẠM VI MÃ" (VD: "Theo dõi riêng (13)"), dropdown "MÃ" (VD: "Tất cả mã") và văn bản hiển thị tổng số mã ở góc phải.
* **Chi tiết tab "Cá mập" (Whale details split panel):**
  * Tiêu đề: Mã phân tích (ACB - 22.850 đ), dropdown "KHOẢNG THỜI GIAN" (Cả phiên), và thanh sức mạnh tổ chức "SỨC MẠNH TỔ CHỨC" (điểm số 0.0).
  * **Cột trái (Whale Bubble Chart):**
    * Trục Y trái: Khối lượng lệnh khớp cá mập (Tỷ đồng: 15 tỷ, 20 tỷ, 25 tỷ, 30 tỷ).
    * Trục Y phải: Giá trị cổ phiếu giao dịch (21.000, 21.500, 22.000, 22.500, 23.000).
    * Trục X: Thời gian phiên thực tế.
    * Các hạt tròn: Xanh ngọc đại diện dòng tiền mua chủ động, hồng đỏ đại diện dòng tiền bán chủ động.
    * Slider "TINH CHỈNH LOG-SCALE": Cho phép người dùng co giãn kích cỡ bong bóng trên biểu đồ.
  * **Cột phải (Stats Card):**
    * Tab phụ: "Tổng quan" và "Tín hiệu" (Active).
    * Thống kê tín hiệu: Tổng lệnh lớn (5), Lệnh mua (2), Lệnh bán (3).
    * Thống kê tổng quan: Tham chiếu (19.660 đ), Đỉnh phiên (19.789 đ), Đáy phiên (19.573 đ).

### 4. Quy trình kiểm thử
* Cuộn trang Dashboard xuống dưới: Đảm bảo Tab-bar xuất hiện đầy đủ 4 tùy chọn.
* Click chọn tab "Cá mập": Biểu đồ bong bóng Whale Bubble Chart phải tải đúng dữ liệu mã được phân tích (VD: ACB), thử kéo slider log-scale để kiểm tra độ co giãn kích thước bóng.

---

## SLICE 5: Trang Cảnh báo Cá mập (Whale Alerts Page)

### 1. Mục tiêu
Thiết kế lại `/whale-alerts` thành trang nhật ký cảnh báo trực tiếp từ luồng WebSocket, phân loại màu sắc các dòng cảnh báo theo mức độ nghiêm trọng.

### 2. Các file tác động
* [packages/web/src/pages/WhaleAlertsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/WhaleAlertsPage.js)

### 3. Mô tả chi tiết kỹ thuật
* **Thanh tìm lọc:** Ô nhập Mã CP (VD: VNM) và lịch chọn ngày.
* **Badge phân loại Severity:**
  * Nghiêm trọng (Critical): `bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse`
  * Cao (High): `bg-orange-500/10 text-orange-400 border border-orange-500/20`
  * Trung bình (Medium): `bg-amber-500/10 text-amber-400 border border-amber-500/20`
  * Thấp (Low): `bg-sky-500/10 text-sky-400 border border-sky-500/20`
* **Realtime update:** Kết nối trực tiếp vào hook `useRealtimeFeed`. Khi có sự kiện mới, chèn sự kiện đó vào đầu bảng (prepend) kèm hiệu ứng trượt nhẹ (slide-in).

### 4. Quy trình kiểm thử
* Mở trang `/whale-alerts`, nhập mã bộ lọc và nhấn tìm kiếm.
* Kiểm tra xem các dòng dữ liệu có hiển thị đúng màu viền và nền tương ứng với cột mức độ nghiêm trọng hay không.

---

## SLICE 6: Di trú trang AI Tư vấn (Whale Advisory Port)

### 1. Mục tiêu
Di chuyển hoàn toàn trang tư vấn cá mập `WhaleAdvisoryPage.jsx` và chuỗi component phụ thuộc từ thư mục `frontend/src/` sang `packages/web` sử dụng adapter `advisory.js`.

### 2. Các file tác động
* [packages/web/src/pages/signals/WhaleAdvisoryPage.jsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/signals/WhaleAdvisoryPage.jsx) (Tạo mới)
* [packages/web/src/components/advisory/](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/advisory/) (Tạo thư mục mới và port các component phụ trợ: `AgenticThoughtStream.js`, `ActionChecklist.js`, `RecommendationCardExplainability.js`)
* [packages/web/src/hooks/useWhaleAdvisoryData.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/hooks/useWhaleAdvisoryData.js) (Tạo mới)

### 3. Mô tả chi tiết kỹ thuật
* **Hook `useWhaleAdvisoryData`:** Viết lại hook để lấy dữ liệu từ `advisory.js` adapter (gồm `getWhaleAdvisories`, `refreshWhaleAdvisory`, `deleteCurrentWhaleAdvisory`).
* **Whale Symbol Sidebar:** Nằm bên trái, hiển thị danh sách các mã cổ phiếu kèm ô tìm kiếm nhanh.
* **Khung điều khiển chính:** Hiển thị khối thought stream dạng console nền tối `bg-slate-950 text-slate-200 font-mono border border-slate-800 p-4 rounded` mô tả chi tiết suy luận của AI Agent; hiển thị bảng checklist hành động và bảng giải thích trọng số.
* **Quy chuẩn i18n:** Thay thế toàn bộ hook `useI18n()` cũ bằng cơ chế dịch nội bộ local (`createTranslator`) để bảo toàn quy chuẩn dịch của `packages/web`.

### 4. Quy trình kiểm thử
* Truy cập `/ai-advisory`. Xác nhận Symbol Sidebar tải đúng danh sách mã.
* Bấm chọn một mã cổ phiếu: Xác nhận khung Thought Stream chạy chữ mô tả lập luận của Agent và hiển thị đúng các checklist khuyến nghị tương ứng.

---

## SLICE 7: Đo lường Thu phóng Biểu đồ & Docker Build Engine

### 1. Mục tiêu
Sửa lỗi vỡ khung Canvas của biểu đồ kỹ thuật khi đóng/mở Sidebar và thiết lập quy trình build engine tách biệt trong Dockerfile.

### 2. Các file tác động
* [packages/web/src/components/VNStockChartPanel.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/VNStockChartPanel.js) (Thêm ResizeObserver)
* [packages/web/src/components/dashboard/PortfolioHeatmap.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/PortfolioHeatmap.js) (Thêm ResizeObserver)
* [packages/web/Dockerfile](file:///c:/Mujoco%20Projects/vninvest/packages/web/Dockerfile) (Cấu hình build engine chart)

### 3. Mô tả chi tiết kỹ thuật
* **ResizeObserver cho biểu đồ:**
  * Bọc mã nguồn khởi tạo biểu đồ trong một `ResizeObserver`. Khi Sidebar thu gọn/mở rộng hoặc kích thước phần tử bọc thay đổi, tự động kích hoạt callback:
    ```javascript
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize();
    });
    resizeObserver.observe(wrapperRef.current);
    ```
* **Dockerfile build chart engine:**
  * Khai báo tham số truyền vào `STOCKCHART_REF` trong Dockerfile.
  * Thêm lệnh clone và build KLine engine trước khi đóng gói gói bundle chính của packages/web:
    ```dockerfile
    ARG STOCKCHART_REF=master
    RUN git clone --branch ${STOCKCHART_REF} https://github.com/vnstockcharts/vn-kline-engine.git /app/engine
    RUN cd /app/engine && npm ci && npm run build:engine-react
    ```

### 4. Quy trình kiểm thử
* Mở trang Stock Detail hoặc Dashboard có chứa biểu đồ.
* Nhấn nút thu gọn Sidebar: Đảm bảo Canvas biểu đồ tự động thay đổi kích thước vừa khít theo khung trống mới mà không bị lệch khung hình hay tràn viền.

---

## SLICE 8: Cấu hình Gateway Nginx & Canary Deploy

### 1. Mục tiêu
Cấu hình gateway an toàn, chạy thử nghiệm shadow run song song trên subdomain và hoàn thành dọn dẹp mã nguồn legacy.

### 2. Các file tác động
* [packages/web/docker/nginx.conf](file:///c:/Mujoco%20Projects/vninvest/packages/web/docker/nginx.conf)
* [docker-compose.dev.yml](file:///c:/Mujoco%20Projects/vninvest/docker-compose.dev.yml)
* [docker-compose.prod.yml](file:///c:/Mujoco%20Projects/vninvest/docker-compose.prod.yml)

### 3. Mô tả chi tiết kỹ thuật
* **Cấu hình Gateway Nginx:**
  * Khai báo Docker DNS resolver: `resolver 127.0.0.11 valid=30s;`.
  * Khai báo vùng giới hạn lưu lượng: `limit_req_zone $binary_remote_addr zone=api_limit_zone:10m rate=15r/s;`.
  * Định nghĩa rewrite rule cho core-api:
    ```nginx
    location /api/core/v1/ {
        rewrite ^/api/core/v1/(.*)$ /core/v1/$1 break;
        proxy_pass http://core-api:8000;
    }
    ```
* **Thay đổi context build trong Compose:**
  * Đổi context build của service frontend từ `.` về `packages/web/`.
* **Dọn dẹp:** Xóa thư mục `frontend/` khỏi repository sau khi shadow run 3 ngày không ghi nhận lỗi.

### 4. Quy trình kiểm thử
* Deploy lên subdomain `beta.vninvest.edusuccess.vn`.
* Tiến hành smoke test trên toàn bộ các route: Đảm bảo cổng Nginx điều phối API chính xác, chặn các request vượt quá rate limit.
