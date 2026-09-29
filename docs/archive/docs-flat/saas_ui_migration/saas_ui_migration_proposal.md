# Đề Xuất Hoàn Thiện Giao Diện Mới SaaS (V2) & Đồng Bộ Tính Năng Dashboard

**Người thực hiện**: Antigravity  
**Ngày lập đề xuất**: 2026-06-12  
**Trạng thái**: ĐANG CHỜ PHÊ DUYỆT (WAITING FOR USER REVIEW)  
**Mục tiêu**: Rà soát codebase hiện tại, đề xuất phương án và lộ trình kỹ thuật cụ thể để hoàn thiện giao diện mới SaaS (`packages/web`) đạt 100% tính năng của giao diện cũ, tiến tới xóa bỏ hoàn toàn thư mục `frontend/` (legacy).

---

## 1. Rà Soát Hiện Trạng & Khoảng Cách Kỹ Thuật (Codebase Audit & Gaps)

Hiện tại, hệ thống đang chạy ở chế độ **Hybrid Host Shell** (build thông qua `frontend/Dockerfile.dev-package-shell` phục vụ cổng 80). Sở dĩ giao diện mới SaaS (`packages/web`) chưa thể chạy độc lập hoàn toàn là vì:

1. **Trang `DashboardPage.js` (SaaS native) thiết kế theo cơ chế slot-injection (Render Props)**:
   - Các vùng hiển thị chính gồm: Header chỉ số (`renderStats`), Bảng danh vị thế (`renderDeck`), Cột cảnh báo (`renderAlertLane`), và Bản đồ nhiệt (`renderHeatmap`) đều là các *slots* trống.
   - Khi chạy độc lập trong router của `packages/web`, các slot này nhận giá trị mặc định là `NOOP` (không render gì cả), dẫn đến màn hình dashboard trống trơn hoặc chỉ có loading skeleton.
2. **Các component nghiệp vụ vẫn nằm ở legacy `frontend/src/`**:
   - Các component cốt lõi như `SmartStatsHeader.jsx`, `PortfolioHeatmap.jsx`, `UnifiedAlertCenter.jsx`, và `FactsFirstModularPositionDeck.jsx` chưa được port sang gói SaaS native (`packages/web`).
3. **Thiếu State Management & Realtime Feed độc lập**:
   - Giao diện mới chưa tích hợp bộ hooks quản lý realtime feed, phân trang alert và trạng thái âm thanh cảnh báo độc lập.
   - Dropdown chọn danh mục (`activePortfolioId`) hiện đang nằm ở Layout của Host Shell cũ mà chưa có mặt trên Layout chính của gói SaaS mới.

### Bảng đối chiếu các file cần di dời (Migration Mapping)

| Thành phần | File nguồn (Legacy - `frontend/src/`) | File đích (SaaS native - `packages/web/src/`) | Trạng thái |
|:---|:---|:---|:---|
| **Trang Dashboard** | `pages/modern/ModernDashboard.jsx` | `pages/DashboardPage.js` | *Cần nâng cấp để render native component* |
| **Header chỉ số** | `components/modern/SmartStatsHeader.jsx` | `features/dashboard/components/SmartStatsHeader.jsx` | *Chưa port* |
| **Bản đồ nhiệt** | `components/PortfolioHeatmap.jsx` | `features/dashboard/components/PortfolioHeatmap.jsx` | *Chưa port* |
| **Cột Cảnh báo** | `components/UnifiedAlertCenter.jsx` | `features/dashboard/components/UnifiedAlertCenter.jsx` | *Chưa port* |
| **Bảng Vị thế Deck** | `components/modern/FactsFirstModularPositionDeck.jsx` | `features/dashboard/components/FactsFirstModularPositionDeck.jsx` | *Chưa port* |
| **Whale Analytics** | `components/FactsFirstWhaleAnalyticsTab.jsx`<br>`components/FactsFirstWhaleBubbleChart.jsx` | `features/dashboard/components/FactsFirstWhaleAnalyticsTab.jsx`<br>`features/dashboard/components/FactsFirstWhaleBubbleChart.jsx` | *Chưa port* |
| **Modal bổ trợ** | `components/modern/OptimizationModal.jsx`<br>`components/WhaleAnalyticsAdvisoryModal.jsx`<br>`components/shared/PaginationBar.jsx`<br>`components/shared/SharkIcon.jsx` | `features/dashboard/components/OptimizationModal.jsx`<br>`features/dashboard/components/WhaleAnalyticsAdvisoryModal.jsx`<br>`components/PaginationBar.jsx`<br>`components/SharkIcon.jsx` | *Chưa port* |
| **Hooks Cảnh báo** | `hooks/useAlertCenterFeed.js`<br>`hooks/usePersistentAlertState.js`<br>`hooks/useWhaleAnalyticsData.js` | `hooks/useAlertCenterFeed.js`<br>`hooks/usePersistentAlertState.js`<br>`hooks/useWhaleAnalyticsData.js` | *Chưa port* |
| **Tín hiệu & Chọn lọc** | `utils/dashboardRealtimeSelectors.js`<br>`utils/modernDashboardSymbolUniverse.js`<br>`utils/alertTaxonomy.js` | `utils/dashboardRealtimeSelectors.js`<br>`utils/modernDashboardSymbolUniverse.js`<br>`utils/alertTaxonomy.js` | *Chưa port* |

---

## 2. Bố Cục Giao Diện Mục Tiêu (Target Information Architecture)

Bố cục giao diện dashboard mới sẽ tuân thủ tuyệt đối cấu trúc **Triad + Full-width Deck** đã được phê duyệt trong gói thiết kế IA ngày 2026-05-19:

### A. Chế độ Workstation (Desktop >= 768px)
* **SmartStatsHeader (Full-width)**: Nén các chỉ số P&L, tổng giá trị tài sản và các thông số rủi ro (Alpha, Beta, Sharpe, Drawdown) thành một dải strip tinh gọn phía trên cùng, kèm theo độ rộng thị trường (Market Breadth).
* **Top Triad Row (1 hàng 3 cột bằng nhau)**:
  * **Cột trái**: `Unified Alert Center` (Live Signal feed, lọc theo nguồn và mức độ khẩn cấp).
  * **Cột giữa**: `Portfolio Heatmap` (Bản đồ nhiệt tỷ trọng danh mục dạng Treemap/Sunburst).
  * **Cột phải**: `AI Advisor Alert Panel` (Tín hiệu AI phân tích dòng tiền và RSI).
* **Bottom Row (Full-width)**: `FactsFirstModularPositionDeck` chiếm trọn 3 cột ngang, tích hợp 4 tab phân tích: *Tổng quan, Kỹ thuật, Cá mập (Whale), và AI Bot*.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ SmartStatsHeader (Tên danh mục + Giá trị + P&L + Beta/Sharpe + Độ rộng)   │
├──────────────────────────────────────────────────────────────────────────┤
│ Unified Alert Center │ Portfolio Heatmap │ AI Advisor Alert Panel       │
│ (Cảnh báo Realtime)  │ (Treemap tỷ trọng)│ (Tín hiệu dòng tiền AI)      │
├──────────────────────────────────────────────────────────────────────────┤
│ FactsFirst Modular Position Deck (Full-width)                            │
│ [Tổng quan] [Kỹ thuật] [Cá mập] [AI Bot]                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### B. Chế độ Mobile (< 768px)
Xếp chồng dọc theo thứ tự ưu tiên nhận thức:
1. `SmartStatsHeader`
2. `Portfolio Heatmap`
3. `Unified Alert Center`
4. `AI Advisor Alert Panel`
5. `FactsFirst Modular Position Deck`

---

## 3. Lộ Trình Triển Khai Chi Tiết (Migration Roadmap)

Kế hoạch hoàn thiện sẽ được chia nhỏ thành 4 phase thực thi độc lập, đảm bảo an toàn hệ thống và không làm đứt gãy trải nghiệm người dùng:

### Phase 1: Port Hooks & Utilities sang SaaS Native
- **Mục tiêu**: Xây dựng nền tảng xử lý dữ liệu và tính toán realtime cho dashboard trong `packages/web`.
- **Hành động**:
  1. Copy và hiệu chỉnh các file util (`alertTaxonomy.js`, `dashboardRealtimeSelectors.js`, `modernDashboardSymbolUniverse.js`) sang `packages/web/src/utils/`.
  2. Copy và chuẩn hóa hooks (`useAlertCenterFeed.js`, `usePersistentAlertState.js`, `useWhaleAnalyticsData.js`) sang `packages/web/src/hooks/`.
  3. Cập nhật các import bên trong các file này trỏ về native context của `packages/web` (như `LangContext` và `PortfolioContext` bản SaaS).
  4. Đảm bảo thay thế hoàn toàn `apiClient` (axios cũ) bằng các phương thức gọi API chuẩn hóa của `coreApiAdapter.js`.

### Phase 2: Di dời & Hiệu chỉnh Visual Components (JSX)
- **Mục tiêu**: Port toàn bộ các component giao diện sang `packages/web` và đảm bảo compile thành công qua Vite.
- **Hành động**:
  1. Tạo thư mục `packages/web/src/features/dashboard/components/`.
  2. Di dời `SmartStatsHeader.jsx`, `PortfolioHeatmap.jsx`, `UnifiedAlertCenter.jsx`, `FactsFirstModularPositionDeck.jsx` cùng các component phụ thuộc của chúng.
  3. Đổi đường dẫn import trong các file này sang cấu trúc thư mục mới của `packages/web`.
  4. Tích hợp thư viện ECharts đã được khai báo sẵn trong `package.json` của `packages/web`.
  5. Đưa toàn bộ file CSS phong cách (`AIAdvisorAlertPanel.css`, styling của AlertCenter, Heatmap) vào thư mục component tương ứng hoặc gộp vào `packages/web/src/index.css`.

### Phase 3: Tích hợp Giao diện & Quản lý State tại DashboardPage.js
- **Mục tiêu**: Loại bỏ cơ chế slot-injection từ Host bridge cũ và đưa việc quản trị vị thế về SaaS native.
- **Hành động**:
  1. Thay đổi `packages/web/src/pages/DashboardPage.js` (viết bằng `createElement` thuần): Import trực tiếp các component con đã được port ở Phase 2 làm renderer mặc định.
  2. Bổ sung dropdown chọn danh mục đầu tư (`activePortfolioId`) ngay trên Sidebar hoặc Header của `Layout` trong `packages/web/src/main.js`. Điều này cho phép đồng bộ hóa ID danh mục đang hoạt động trực tiếp xuống `DashboardPage` mà không cần cầu nối `PackageDashboardHost.jsx` nữa.
  3. Thay thế các route `dashboard` trong `packages/web/src/main.js` để trỏ thẳng tới trang DashboardPage hoàn thiện này.

### Phase 4: Hoán đổi Build & Decommission Legacy
- **Mục tiêu**: Chuyển giao hoàn toàn sang Frontend SaaS độc lập và dọn dẹp codebase.
- **Hành động**:
  1. Cập nhật `docker-compose.yml` và `docker-compose.dev.yml` để build dịch vụ `frontend` trực tiếp từ context `./packages/web` và `Dockerfile` của SaaS native.
  2. Tiến hành chạy thử nghiệm shadow song song giữa cổng cũ và cổng mới để so sánh độ chính xác dữ liệu (Parity Gate - yêu cầu trùng khớp vị thế và giá trị tài sản 100%, tỷ lệ lỗi JS console bằng 0).
  3. Sau 3 ngày chạy ổn định, chính thức xóa bỏ thư mục `frontend/` cũ khỏi dự án.

---

## 4. Ràng Buộc Kỹ Thuật Bắt Buộc (Hard Constraints)

Trong suốt quá trình thực thi, bắt buộc tuân thủ các quy tắc chất lượng code sau:
1. **Quy tắc JSX**:
   - Nghiêm cấm sử dụng JSX tại file cấp trang: [DashboardPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.js). Phải dùng `createElement` thuần.
   - Các component con nằm trong `features/dashboard/components/` **được phép** sử dụng cú pháp JSX bình thường để giữ nguyên tính tương thích của legacy code khi port sang.
2. **Quy tắc Data Layer**:
   - Tuyệt đối không import `apiClient` hoặc axios trực tiếp từ component. Mọi kết nối mạng phải đi qua `coreApiAdapter.js`.
3. **Quy tắc i18n**:
   - Tất cả các chuỗi hiển thị mới phải đi qua hook `useI18n()` và có bản dịch tiếng Việt đầy đủ dấu.

---

## 5. Kế Hoạch Kiểm Thử & Nghiệm Thu (Verification Plan)

### A. Kiểm thử Tự động (Automated Tests)
Chạy bộ test của adapter và hooks sau khi di chuyển để đảm bảo logic tính toán không lỗi:
```bash
# Di chuyển vào thư mục web và chạy test
cd packages/web
npm run test
```

### B. Kiểm thử Thủ công (Manual Verification)
1. Build lại frontend container chạy hoàn toàn bằng SaaS native:
   ```powershell
   docker compose build frontend
   .\start_dev.ps1 -SkipBuild
   ```
2. Mở trình duyệt tại [http://localhost/](http://localhost/), đăng nhập tài khoản.
3. Chọn danh mục `VN30 Lướt sóng` trên thanh điều hướng.
4. Kiểm tra sự hiển thị và đồng bộ dữ liệu realtime của:
   - Header chỉ số (khớp số tiền, lãi lỗ).
   - Bản đồ nhiệt (vẽ đúng ô tỷ trọng, hover hiện tooltip).
   - Cột Cảnh báo (nhận ticker cập nhật liên tục).
   - Bảng vị thế Deck (đầy đủ các tab Tổng quan, Kỹ thuật, Cá mập, AI Bot).
