# Kế hoạch Triển khai Nâng cấp Watchlist & Market Radar (SaaS Native)

## 1. Phân tích Hiện trạng (Current State Analysis)
Trang Watchlist hiện tại (`packages/web/src/pages/WatchlistPage.tsx` - 1,698 dòng) đóng vai trò là trung tâm theo dõi thị trường nhưng đang bộc lộ nhiều hạn chế so với các phần mềm thương mại hàng đầu (TradingView, Webull, FireAnt):

*   **Kiến trúc:** Monolithic component. Toàn bộ logic (fetch data, realtime xử lý, UI render, form handling) bị dồn vào một file khổng lồ, gây khó khăn cho việc bảo trì và mở rộng tính năng.
*   **Trải nghiệm người dùng (UX):** Đứt gãy. Khi người dùng muốn xem biểu đồ chi tiết của một mã cổ phiếu, họ phải click vào link và bị chuyển hướng sang trang `/stocks/:symbol`, làm gián đoạn luồng theo dõi thị trường.
*   **Giao diện (UI):** Thiết kế dạng bảng (table) tĩnh, cổ điển. Biểu đồ sparkline dạng đường viền (stroke) xám đơn điệu. Thiếu các hiệu ứng thị giác (visual cues) cao cấp như nháy sáng (glow) thời gian thực hay thiết kế Glassmorphism chuẩn SOC.
*   **Thiếu tính năng:** Không có bộ chọn cột (column picker), không có tính năng lọc/screener ngay trên danh sách, không có khu vực hiển thị chi tiết (tin tức, dòng tiền) ngay lập tức.

## 2. Mục tiêu Nâng cấp (World-Class Upgrade Goals)
Biến Watchlist thành một **Terminal Phân tích Tích hợp**, mang lại trải nghiệm "All-in-one screen" (Tất cả trên một màn hình):
*   **Three-Pane Layout:** Bố cục 3 vùng thông minh (Danh mục - Bảng dữ liệu - Chi tiết phân tích).
*   **Interactive Details:** Xem biểu đồ kỹ thuật tương tác (`VNInvestCharts`), tin tức, lệnh cá mập ngay tại Pane bên phải mà không cần chuyển trang.
*   **Advanced Features:** Bộ lọc kỹ thuật (Screener), Tùy chỉnh cột (Custom Columns), Phân tích AI (AI Advisor).
*   **Premium Aesthetics:** Giao diện Glassmorphism, hiệu ứng Glow nhấp nháy giá, Area Sparkline Gradient.

---

## 3. Bản đồ Component Mới (Component Map)

Để giải quyết vấn đề Monolithic, hệ thống sẽ được phân rã thành các components chuyên biệt:

```mermaid
graph TD
    WP[WatchlistPage (Container, State & Data Fetching)]
    WP --> WS[WatchlistSidebar]
    WP --> WM[WatchlistMainWorkspace]
    WP --> WDP[WatchlistDetailPanel]

    WS --> SL[SidebarList (Holds, Tracked, Custom, Indices)]
    WS --> SF[SidebarForm (Create List)]

    WM --> WH[WatchlistHeader (Title, Realtime Status)]
    WM --> WT[WatchlistTabs (Table, Manage, Alerts)]
    WM --> WTB[WatchlistTable]
    WM --> WC[WatchlistControls (Screener, Column Picker, Density)]

    WDP --> MC[MiniChart / Interactive Chart]
    WDP --> WF[WhaleAlertFeed (Dòng tiền cá mập)]
    WDP --> NF[NewsFeed (Tin tức)]
    WDP --> AI[AIAdvisorCard (Nhận định AI)]
```

*   **Tách file:** Các component con sẽ được đưa vào thư mục `packages/web/src/pages/watchlist/components/`.

---

## 4. Bố cục Giao diện (UI Mockup & Layout)

Thiết kế sẽ chuyển từ dạng 2 cột (hiện tại) sang dạng 3 cột có thể gập mở.

```text
+-------------------+-------------------------------------------------+-------------------------+
| DANH MỤC (280px)  | VÙNG LÀM VIỆC CHÍNH (Flexible)                  | CHI TIẾT MÃ (350px)     |
|                   |                                                 | (Có thể đóng/mở)        |
| [ ] Nắm giữ (5)   | 📁 Danh mục Công nghệ                     [Sync]|                         |
| [ ] Cảnh báo (10) | +---------------------------------------------+ | [ FPT - FPT Corp ]  [x] |
|                   | | Tabs: [Bảng giá] [Quản lý mã] [Cảnh báo]    | |                         |
| - Tùy chỉnh -     | +---------------------------------------------+ | +---------------------+ |
| [*] Cổ phiếu CN   | | [Lọc chỉ báo ▾] [Cột hiển thị ▾] [Compact]  | | | VNInvestCharts    | | |
| [ ] Bất động sản  | +---------------------------------------------+ | | (Interactive)     | | |
|                   | | Mã  | Giá    | % Thay đổi | RSI | Biểu đồ   | | +---------------------+ |
| - Chỉ số -        | |---------------------------------------------| |                         |
| [ ] VN30          | | FPT | 130,00 | +2.5% (X)  | 68  | [~~^^^]   | | [ AI Advisor ]        | |
| [ ] VN100         | | VCB |  90,00 | -1.2% (Đ)  | 45  | [___~~]   | | Nhận định: Bullish... | |
|                   | | HPG |  30,50 | +0.0%      | 52  | [-~~~~]   | |                         |
|                   | +---------------------------------------------+ | [ Whale Alerts ]        | |
| [+ Tạo danh mục]  |                                                 | 14:30 - Mua đột biến    | |
+-------------------+-------------------------------------------------+-------------------------+
```
*(Ghi chú: (X) là hiệu ứng Glow Xanh, (Đ) là hiệu ứng Glow Đỏ).*

---

## 5. Luồng Dữ liệu & State Management (Data Flow)

1.  **Data Fetching & Caching:**
    *   Vẫn sử dụng `coreApiAdapter` để fetch dữ liệu tĩnh (danh sách watchlists, technicals, price alerts).
    *   Tối ưu hóa: Tránh gọi API thừa bằng cách sử dụng `useMemo` và `useEffect` chặt thực hơn khi component mount hoặc đổi list.
2.  **Realtime Feed:**
    *   Vẫn dùng `useRealtimeFeedFromManager(symbols)`.
    *   Dữ liệu realtime sẽ được truyền (pass down) tới `WatchlistTable` để hiển thị giá, và truyền tới `WatchlistDetailPanel` để vẽ nến thời gian thực trên biểu đồ nếu biểu đồ đang mở.
3.  **State Quản lý Mã Đang Chọn (Selected Symbol):**
    *   Thêm một state mới `activeSymbolDetail: string | null` tại `WatchlistPage`.
    *   Khi click vào một row trong `WatchlistTable`, `activeSymbolDetail` được set (vd: `"FPT"`), kích hoạt mở `WatchlistDetailPanel`.
4.  **Tối ưu Re-render:**
    *   `WatchlistTable` và các Rows sẽ được bọc trong `React.memo` để chỉ re-render những hàng có cập nhật giá từ Realtime Feed, tránh re-render toàn bộ bảng (hiện tại bảng 100 mã sẽ bị re-render nặng khi có 1 mã nhấp nháy).

---

## 6. Các Tính năng Mới Đặc sắc (Key Features Implementation)

1.  **WatchlistDetailPanel (Thành phần quan trọng nhất):**
    *   Sử dụng component `<VNInvestCharts symbol={activeSymbolDetail} />` nhúng trực tiếp. (Cần đảm bảo component chart hỗ trợ chế độ mini/compact).
    *   Fetch tin tức và whale alerts liên quan đến `activeSymbolDetail`.
2.  **Bộ tùy chỉnh cột (Column Picker):**
    *   Thêm một nút Dropdown cho phép check/uncheck các cột muốn hiển thị. Lưu cấu hình này vào `localStorage` để giữ nguyên cài đặt cho lần truy cập sau.
3.  **Biểu đồ Sparkline Gradient:**
    *   Sửa đổi hàm `renderSparkline` hiện tại.
    *   Thêm thẻ `<linearGradient>` và vẽ thành dạng polygon/area thay vì chỉ dùng `polyline` hoặc `<path fill="none">`.

---

## 7. Các Bước Thực Thi (Execution Steps)

1.  **Bước 1: Tái cấu trúc & CSS (Refactoring & Styling)**
    *   Chia file `WatchlistPage.tsx` ra các components nhỏ (Sidebar, Table, Header).
    *   Cập nhật `WatchlistPage.css` theo thiết kế Glassmorphism (Thêm các hiệu ứng hover, shadow, transitions).
2.  **Bước 2: Xây dựng WatchlistDetailPanel**
    *   Tạo Layout 3 cột.
    *   Nhúng `VNInvestCharts` vào Panel bên phải. Xử lý logic click row để mở Panel.
3.  **Bước 3: Nâng cấp Bảng & Biểu đồ (Table & Sparkline)**
    *   Viết lại `renderSparkline` thành dạng Area Gradient.
    *   Thêm tính năng tùy biến cột hiển thị.
4.  **Bước 4: Cảnh báo cá mập & AI**
    *   Tích hợp UI cho Whale Alerts và AI Advisor Placeholder vào Detail Panel.
