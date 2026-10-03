# Kế hoạch khắc phục lỗi cập nhật thời gian thực cho Heatmap và Daily Price (VNInvest)

Tài liệu này phân tích nguyên nhân lỗi và đề xuất giải pháp kỹ thuật chi tiết để đưa dữ liệu thời gian thực (Real-time feed) từ WebSocket vào các surface hiển thị chính trên SaaS Native Frontend (`packages/web`).

---

## 1. Phân tích nguyên nhân lỗi (Root Cause Analysis)

Hiện tại, cả trang Dashboard tổng quan (`DashboardPage.js`) và trang chi tiết cổ phiếu (`StockDetailPage.js` / `VNStockChartPanel.js`) đều đang ở trạng thái **tĩnh** hoặc chỉ tải dữ liệu một lần duy nhất qua HTTP REST API:

1. **Dashboard Heatmap (Treemap):**
   - Hook `useCoreDashboardData.js` thực hiện song song các lệnh gọi REST API (`getPortfolioHoldings`, `getWatchlists`, v.v.) để lấy danh mục và mã đang theo dõi. Sau đó, nó thực hiện REST API lấy thông số kỹ thuật hàng loạt (`getBulkTechnicalsBySymbols`).
   - `DashboardPage.js` nhận các props `quotesBySymbol`, `realtimeBreadth` từ component cha nhưng trong luồng routing của `main.js`, `DashboardPage` được render trực tiếp mà không nhận bất kỳ props nào. Do đó, dữ liệu bảng giá cập nhật liên tục từ WebSocket không bao giờ được đưa vào Treemap hay thống kê độ rộng thị trường (Market Breadth).

2. **Daily Price & KLineChart (Trang chi tiết cổ phiếu):**
   - Hook `useStockDetailPageModel.js` tải thông tin cổ phiếu một lần duy nhất qua `getStockOverview(symbol)` và `getStockOrderFlow(symbol)`. Nó định nghĩa hàm `handleRealtimeSnapshot` hỗ trợ dồn (batching) cập nhật thời gian thực trong 250ms, nhưng hàm này **không bao giờ được gọi** vì model không đăng ký nhận tin nhắn từ WebSocket.
   - Adapter đồ thị `CoreApiChartAdapter` (trong `VNStockChartPanel.js`) bỏ trống hàm `subscribeToBar` (chỉ trả về một hàm rỗng `() => {}`). Do đó, chart widget không nhận được bất kỳ cập nhật tick giá nào để vẽ tiếp nến thời gian thực hiện tại.

---

## 2. Giải pháp đề xuất (Proposed Solution)

Chúng ta sẽ kết nối hai trang này vào bộ quản lý luồng WebSocket thời gian thực đã có sẵn trong hệ thống (`RealtimeProvider` cung cấp qua `useRealtimeFeedFromManager`).

### 2.1 Đối với Dashboard Page (`DashboardPage.js`)
- Sử dụng hàm hiện có `collectUniqueSortedSymbols` để tổng hợp tất cả các mã cổ phiếu đang có trong danh mục, watchlist và nhóm đang theo dõi của người dùng.
- Gọi hook `useRealtimeFeedFromManager({ symbols })` để tự động kết nối và đăng ký nhận WebSocket ticks cho danh sách mã này.
- Ghép (merge) dữ liệu bảng giá từ WebSocket vào `quotesBySymbol` và cập nhật các cảnh báo thời gian thực (`alerts`, `darkFlowAlerts`).
- Nếu dữ liệu độ rộng thị trường (`realtimeBreadth`) từ props trống, tính toán tự động dựa trên số lượng mã tăng/giảm/không đổi từ real-time quotes để hiển thị trên SmartStatsHeader.

### 2.2 Đối với Stock Detail Page (`useStockDetailPageModel.js`)
- Gọi hook `useRealtimeFeedFromManager({ symbols: [symbol] })` trong model để tự động đăng ký nhận bảng giá của mã hiện tại qua WebSocket.
- Sử dụng một `useEffect` theo dõi sự thay đổi của quote thời gian thực. Khi có giá mới, chuyển tiếp (forward) dữ liệu này vào hàm `handleRealtimeSnapshot(quote)` đã có sẵn để cập nhật header và các tab thông số chi tiết.

### 2.3 Đối với KLineChart (`VNStockChartPanel.js`)
- Cho phép `CoreApiChartAdapter` lưu trữ hàm callback cập nhật của đồ thị:
  ```js
  subscribeToBar(symbol, timeframe, onBar) {
    this.onBarCallback = onBar;
    return () => {
      this.onBarCallback = null;
    };
  }
  ```
- Sử dụng hook `useRealtimeFeedFromManager({ symbols: [symbol] })` bên trong React component `VNStockChartPanel`.
- Khi nhận được quote mới, ánh xạ dữ liệu tick này thành cấu trúc `OHLCVBar` chuẩn và gọi callback của adapter để vẽ tiếp nến thời gian thực:
  ```js
  useEffect(() => {
    if (quote && quote.current_price && chartAdapter.onBarCallback) {
      const nextBar = {
        date: new Date(quote.last_date || Date.now()),
        open: Number(quote.open_price ?? quote.current_price),
        high: Number(quote.high_price ?? quote.current_price),
        low: Number(quote.low_price ?? quote.current_price),
        close: Number(quote.current_price),
        volume: Number(quote.volume ?? 0),
      };
      chartAdapter.onBarCallback(nextBar);
    }
  }, [quote, chartAdapter]);
  ```

---

## 3. Kế hoạch các bước thực hiện (Execution Plan)

1. **Bước 1: Cấu hình cập nhật real-time cho Dashboard**
   - Chỉnh sửa [DashboardPage.js](file:///c:/Mujoco Projects/vninvest/packages/web/src/pages/DashboardPage.js) để tích hợp `useRealtimeFeedFromManager`.
   - Ghép dữ liệu và tối ưu hóa render để tránh giật lag.

2. **Bước 2: Cấu hình cập nhật real-time cho Stock Detail Header & Tabs**
   - Chỉnh sửa [useStockDetailPageModel.js](file:///c:/Mujoco Projects/vninvest/packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js) để kích hoạt đăng ký mã hiện tại với manager.
   - Đẩy tick giá trực tiếp vào snapshot model để cập nhật giá trần/sàn/tham chiếu/khối lượng tức thời.

3. **Bước 3: Kích hoạt nến thời gian thực trên KLineChart**
   - Chỉnh sửa [VNStockChartPanel.js](file:///c:/Mujoco Projects/vninvest/packages/web/src/components/VNStockChartPanel.js) để cập nhật nến hiện tại dựa trên WebSocket ticks.

4. **Bước 4: Kiểm thử và xác minh**
   - Chạy các test case kiểm tra luồng render và vitest để đảm bảo tính ổn định.
   - Hướng dẫn người dùng kiểm tra trực quan trên trình duyệt (thấy phần trăm nhấp nháy cập nhật liên tục trên Treemap và nến chạy trên biểu đồ đồ thị).
