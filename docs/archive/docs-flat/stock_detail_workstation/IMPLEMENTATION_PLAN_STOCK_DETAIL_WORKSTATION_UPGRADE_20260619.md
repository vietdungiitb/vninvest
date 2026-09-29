# KẾ HOẠCH NÂNG CẤP TRANG STOCK DETAIL THÀNH PHÂN HỆ WORKSTATION CHUYÊN NGHIỆP
**Mã tài liệu:** `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_WORKSTATION_UPGRADE_20260619.md`  
**Ngày lập:** 2026-06-19  
**Trạng thái:** Dự thảo thảo luận  

---

## 1. Giới thiệu & Mục tiêu
Trang chi tiết cổ phiếu (`/stocks/:symbol`) hiện tại có bố cục thông tin phân tán theo chiều dọc, khoảng trống rời rạc và thiếu hụt dữ liệu cập nhật tại một số phân hệ. 

Kế hoạch này đề xuất tái cấu trúc trang chi tiết cổ phiếu thành một **Hệ thống màn hình làm việc (Workstation) tích hợp hai cột bên cạnh nhau (SSI iBoard Style)**, kết nối đầy đủ các luồng dữ liệu thời gian thực và Materialized Session Facts từ backend native.

---

## 2. Thiết kế Giao diện (Layout Architecture)
Tái cấu trúc bố cục màn hình từ dạng dọc sang dạng lưới chia đôi (Split-Screen Workstation):

```
+----------------------------------------------------------------------------------+
|                     StockDetailHeader (Thông tin chung, Giá, Tỷ lệ tăng/giảm, KL)|
+----------------------------------------------------------------------------------+
|                     StockSessionWitness (Thanh hiển thị phiên đang chọn)         |
+----------------------------------------------------------------------------------+
|                                  WORKSTATION MAIN                                |
|  +--------------------------------------------+--------------------------------+  |
|  |                                            |   Độ sâu thị trường (OrderBook)|  |
|  |  Biểu đồ giá & CVD & Sức mạnh              |   - Giá/KL Mua | Giá/KL Bán     |  |
|  |  (VNStockChartPanel)                       |   - Thanh tỷ lệ Dư mua/Dư bán  |  |
|  |                                            +--------------------------------+  |
|  |  ~65% Chiều rộng                           |   Nhật ký khớp lệnh (Trade Log)|  |
|  |                                            |   - Thời gian | KL | Giá | M/B  |  |
|  |  +--------------------------------------+  |   - Cập nhật thời gian thực    |  |
|  |  | Radar Dòng Tiền (OrderFlowRadarPanel)|  |   - ~35% Chiều rộng            |  |
|  |  +--------------------------------------+  |                                |  |
|  +--------------------------------------------+--------------------------------+  |
+----------------------------------------------------------------------------------+
|  StockDetailTabs (Hồ sơ doanh nghiệp, Tài chính, Cổ đông, Tin tức...)           |
+----------------------------------------------------------------------------------+
```

---

## 3. Kế hoạch Thay đổi Chi tiết (Proposed Changes)

### 3.1 Backend Service (`packages/core`)

#### A. Sửa lỗi 404 cho API Whale Feed
Đường dẫn `/whale-feed-aggregate/<symbol>/` hiện đang báo lỗi 404 do chưa được đăng ký định tuyến ở tầng ứng dụng native.
- **Tệp chỉnh sửa**: `packages/core/backend/src/market_serving/urls.py`
  - Đăng ký URL:
    ```python
    path('whale-feed-aggregate/<str:symbol>/', legacy_views.RealtimeWhaleFeedAggregateView.as_view(), name='whale-feed-aggregate')
    ```
- **Tệp chỉnh sửa**: `packages/core/backend/src/market_serving/legacy_views.py`
  - Điều chỉnh `RealtimeWhaleFeedAggregateView.get()` để hỗ trợ đọc mã cổ phiếu trực tiếp từ đường dẫn `kwargs.get('symbol')` thay vì chỉ phụ thuộc vào query parameters.

#### B. Bổ dung Dữ liệu Session Facts vào Stock Overview
Hiện tại các thẻ thông tin bên dưới (Tổng lệnh Mua/Bán, tỷ suất Tổ chức/Nhỏ lẻ) bị trống do view overview không truy vấn dữ liệu từ bảng `SessionFacts`.
- **Tệp chỉnh sửa**: `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
  - Trong `StockManagementOverviewView.get()`, truy vấn bản ghi mới nhất của `SessionFacts` theo mã cổ phiếu:
    ```python
    from market_serving.models import SessionFacts
    facts = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()
    ```
  - Ánh xạ các trường:
    - `total_buy_qty` = `facts.total_buy_volume`
    - `total_sell_qty` = `facts.total_sell_volume`
    - `institutional_buy` = `facts.institutional_strength`
    - `retail_buy` = `facts.buy_strength`
  - Trả về các trường này trong gói payload JSON của tổng quan cổ phiếu.

#### C. Mô phỏng Sổ lệnh Mua/Bán (Market Depth)
Do nguồn cấp dữ liệu live chưa hỗ trợ độ sâu sổ lệnh tầng sâu, chúng ta sẽ mô phỏng dữ liệu sổ lệnh ổn định và có ý nghĩa kinh tế dựa trên giá trị tham chiếu và giá khớp hiện hành.
- **Tệp chỉnh sửa**: `packages/core/backend/src/market_serving/native_views.py`
  - Nâng cấp `RealtimeDepthChartView.get()` để tạo ra danh sách 3 mức giá Mua (Bid) và Bán (Ask) tối ưu:
    - Các bước giá mua: `[price - 0.05, price - 0.10, price - 0.15]`
    - Các bước giá bán: `[price, price + 0.05, price + 0.10]`
    - Khối lượng được tính toán động dựa theo phần trăm Tổng khối lượng giao dịch trong ngày nhằm đảm bảo tính chân thực và chuyên nghiệp.

---

### 3.2 Frontend Web (`packages/web`)

#### A. Phân bổ lại Layout chính
- **Tệp chỉnh sửa**: `packages/web/src/pages/StockDetailPage.js`
  - Đưa biểu đồ kỹ thuật và Radar dòng tiền vào khung cột trái (`sdp-left-workspace`).
  - Tạo khung cột phải (`sdp-right-workspace`) chứa hai widget: `StockOrderBookWidget` (sổ lệnh) và `StockExecutionLogWidget` (nhật ký khớp lệnh).
  - Tích hợp vòng lặp tự động (polling) gọi `getRealtimeIntraday` và `getRealtimeDepthChart` định kỳ (ví dụ: mỗi 3-5 giây) để cập nhật dữ liệu liên tục cho hai phân hệ bên phải.

#### B. Tinh chỉnh CSS Giao diện
- **Tệp chỉnh sửa**: `packages/web/src/pages/StockDetailPage.css`
  - Sử dụng CSS Flexbox/Grid để tạo lưới phản hồi (responsive layout). Trên màn hình rộng (Desktop), bố cục chia tỷ lệ `65%` - `35%`. Trên màn hình hẹp (Mobile), cột phải tự động đẩy xuống dưới biểu đồ.
  - Áp dụng các quy tắc màu sắc chuẩn thương mại (Tím cho giá trần, Xanh lơ cho giá sàn, Vàng cho tham chiếu, Xanh lá cho chiều tăng, Đỏ cho chiều giảm) đồng bộ trên tất cả các cột của Order Book và Match Log.

---

## 4. Kế hoạch Kiểm thử & Xác minh

1. **Kiểm thử tự động (Backend focused tests)**:
   Chạy bộ test suite của tổng quan cổ phiếu để đảm bảo việc ghép dữ liệu `SessionFacts` không gây lỗi cấu trúc payload:
   ```powershell
   python packages/core/backend/manage.py test market_data.tests.test_stock_mgmt_native_views --keepdb
   ```
2. **Kiểm thử thủ công (Visual & Interaction validation)**:
   - Xác nhận đường dẫn `/stocks/:symbol` mở ra với bố cục chia cột hợp lý.
   - Kiểm tra nhật ký khớp lệnh thay đổi giá trị và màu sắc tương ứng theo trạng thái Mua/Bán chủ động.
   - Thử nghiệm tính năng đồng bộ phiên (Click một nến bất kỳ trên Kline Chart sẽ tự động cập nhật Khuyến nghị AI và nhật ký lịch sử của phiên tương ứng).

---

## 5. Rủi ro, Phụ thuộc & Đề xuất bổ sung (Discussion Points)

### 5.1 Kiến trúc Realtime (Polling vs WebSocket)
- **Hiện tại**: Plan dùng polling 3-5s cho `getRealtimeIntraday` + `getRealtimeDepthChart`.
- **Rủi ro**: Tải server không cần thiết, độ trễ 3-5s, memory leak nếu cleanup không đúng.
- **Đề xuất**: 
  - **Short-term**: Giữ polling 5s + `AbortController` cleanup khi unmount component.
  - **Mid-term**: Ticket riêng triển khai **WebSocket/SSE** cho Market Depth & Trade Log (backend `packages/core` + frontend hook `useRealtimeFeed`).
  - **Fallback**: Nếu WebSocket chưa sẵn sàng, polling 5s là chấp nhận được cho MVP.

### 5.2 Database Performance & Indexing
- `SessionFacts` query trong `StockManagementOverviewView.get()` cần index composite:
  ```sql
  CREATE INDEX idx_session_facts_symbol_date_desc 
  ON market_serving_sessionfacts (symbol, session_date DESC);
  ```
- Kiểm tra `EXPLAIN ANALYZE` cho query `SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()`.

### 5.3 Whale Feed 404 – Code Health Check
- Xác nhận `legacy_views.RealtimeWhaleFeedAggregateView` còn được maintain không.
- Nếu đã deprecated → viết view mới `RealtimeWhaleFeedAggregateViewV2` thay vì revive legacy code.
- Thêm integration test cho endpoint `/api/whale-feed-aggregate/<symbol>/`.

### 5.4 Mobile UX – Responsive Strategy
- "Cột phải đẩy xuống dưới" có thể gây cuộn quá dài trên mobile.
- **Đề xuất**: 
  - Accordion/Collapsible cho Order Book & Trade Log.
  - Hoặc Tab switch: `[Biểu đồ] [Sổ lệnh] [Nhật ký]` trên mobile (< 768px).
  - Cần prototype Figma/Storybook trước khi implement CSS.

### 5.5 Accessibility (WCAG AA)
- Màu Đỏ/Xanh lá cho Mua/Bán **bắt buộc** kèm icon/badge: ▲/▼, badge "M"/"B", pattern border.
- Focus-visible cho keyboard navigation trên Order Book rows.
- ARIA labels cho live region updates (Trade Log auto-append).

### 5.6 Loading/Error/Empty States
- Thêm Skeleton Loader cho:
  - Order Book (3 bid/ask rows)
  - Trade Log (5-10 rows)
  - CVD/OrderFlowRadarPanel
- Error toast + retry button khi polling fail > 3 lần liên tiếp.

### 5.7 Timezone Consistency
- `SessionFacts.session_date` – xác nhận lưu ở **UTC+7 (Asia/Ho_Chi_Minh)** hay **UTC**.
- Frontend hiển thị phải thống nhất: `Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })`.

### 5.8 Data Readiness Checklist (Dependencies)
| Component | Data Source | Status | Owner |
|-----------|-------------|--------|-------|
| CVD & OrderFlowRadarPanel | Volume profile, Delta, CVD calc | ❓ Cần confirm | Backend |
| SessionFacts (institutional/retail strength) | Materialized view / ETL | ✅ Ready | Backend |
| Mock Market Depth | Synthetic from last price + volume | ✅ Logic defined | Backend |
| Whale Feed Aggregate | Existing legacy view | ⚠️ 404 fix needed | Backend |

### 5.9 Performance Budget & Monitoring
- JS bundle increase < 50KB gzipped cho Workstation layout.
- Polling interval ≥ 5s, max 2 concurrent polls (Depth + Trade Log).
- Memory leak test: mount/unmount 50 lần → heap stable.
- Add Sentry breadcrumb cho polling errors.

### 5.10 E2E Test Coverage (Playwright)
- Smoke test: `/stocks/VCB` load → layout 2 cột → polling updates Trade Log.
- Symbol switch: VCB → HPG → VNM → verify no stale data, no memory leak.
- Mobile viewport: 375px → accordion/tab behavior.
- Accessibility: axe-core scan 0 critical violations.

---

## 6. Quy trình Review & Merge
1. **Backend PR**: Fix Whale Feed + SessionFacts integration + Mock Depth + Index migration.
2. **Frontend PR**: Layout split + Polling hook + Widgets + CSS responsive + A11y.
3. **Integration PR**: Wire endpoints, env config, feature flag `WORKSTATION_LAYOUT_V2`.
4. **QA Sign-off**: Manual test checklist + Playwright E2E pass + Performance budget met.
