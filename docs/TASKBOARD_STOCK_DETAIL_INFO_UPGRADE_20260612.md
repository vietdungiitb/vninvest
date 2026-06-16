# TASKBOARD — Stock Detail Info Upgrade 20260612

## 1. Task Breakdown & Estimates

### Phase 1: Header Enhancement (SD-INFO-01 to SD-INFO-04) — ~12 hours ✅ COMPLETE
- **`SD-INFO-01`**: Tạo endpoint backend `/overview/` lấy giá trần, sàn, tham chiếu, mở cửa, trung bình, cao, thấp, volume. (Estimate: 3h) ✅
- **`SD-INFO-02`**: Đăng ký `getStockOverview` trong `market.js` (Vite client adapter). (Estimate: 1h) ✅
- **`SD-INFO-03`**: Thay đổi `useStockDetailPageModel.js` gọi `getStockOverview` thay thế snapshot cũ. (Estimate: 3h) ✅
- **`SD-INFO-04`**: Tái thiết kế component `StockDetailHeader.js` thành 3 hàng chuẩn SSI iBoard. (Estimate: 5h) ✅

### Phase 2: Profile & Shareholders (SD-INFO-05 to SD-INFO-10) — ~14 hours ✅ COMPLETE
- **`SD-INFO-05`**: Viết hàm `fetch_company_info` trong `vnbroker_adapter.py`. (Estimate: 3h) ✅
- **`SD-INFO-06`**: Nâng cấp `StockManagementDetailView` tích hợp caching metadata 24h. (Estimate: 3h) ✅
- **`SD-INFO-07`**: Cập nhật `getStockProfile` trỏ về API native `/stock-management/stocks/{symbol}/`. (Estimate: 1h) ✅
- **`SD-INFO-08`**: Thêm lazy loading cho Hồ sơ và Cổ đông trong hook `useStockDetailPageModel.js`. (Estimate: 2h) ✅
- **`SD-INFO-09`**: Xây dựng UI tab Hồ sơ hiển thị thông tin chung & Ban lãnh đạo. (Estimate: 3h) ✅
- **`SD-INFO-10`**: Xây dựng UI tab Cổ đông hiển thị cơ cấu cổ đông lớn sở hữu. (Estimate: 2h) ✅

### Phase 3: Capital & Statistics (SD-INFO-11 to SD-INFO-14) — ~10 hours ✅ COMPLETE
- **`SD-INFO-11`**: Thiết kế tab Vốn & Cổ tức kết hợp charter capital, listed volume từ profile. (Estimate: 3h) ✅
- **`SD-INFO-12`**: Thiết kế tab Thống kê hiển thị P/E, P/B, EPS, ROE, ROA, Beta, BVPS. (Estimate: 4h) ✅
- **`SD-INFO-13`**: Tích hợp các chỉ số cơ bản lấy từ cache financials. (Estimate: 3h) ✅

### Phase 4: News & Financials (SD-INFO-15 to SD-INFO-20) — ~16 hours ✅ COMPLETE
- **`SD-INFO-15`**: Thêm hàm `fetch_company_financials` và xử lý deduplicate columns. (Estimate: 3h) ✅
- **`SD-INFO-16`**: Cải tiến `StockManagementFinancialsView` tích hợp Redis cache 12h. (Estimate: 3h) ✅
- **`SD-INFO-17`**: Thêm hàm `fetch_rss_news` fallback Google News RSS trong adapter. (Estimate: 3h) ✅
- **`SD-INFO-18`**: Cập nhật `StockManagementNewsView` fallback và Redis cache 30m. (Estimate: 2h) ✅
- **`SD-INFO-19`**: Thiết kế UI tab Tin tức hiển thị news items. (Estimate: 2h) ✅
- **`SD-INFO-20`**: Thiết kế UI tab Tài chính hiển thị BCTC thu nhập và bảng cân đối kế toán dạng quý. (Estimate: 3h) ✅

### Phase 5: Events & Trading Integration (SD-INFO-21 to SD-INFO-24) — ~8 hours ✅ COMPLETE
- **`SD-INFO-21`**: Thiết kế tab Sự kiện hiển thị lịch sử sự kiện. (Estimate: 2h) ✅
- **`SD-INFO-22`**: Tích hợp tab Giao dịch chứa `StockContextDeck` + `AI Advisory Card`. (Estimate: 3h) ✅
- **`SD-INFO-23`**: Rerender OrderFlowRadarPanel đặt ngay dưới biểu đồ. (Estimate: 3h) ✅

### Phase 6: Final Integration & Verification (SD-INFO-25 to SD-INFO-28) — ~8 hours ✅ COMPLETE
- **`SD-INFO-25`**: Xây dựng component `StockDetailTabs.js` gộp 8 tab. (Estimate: 3h) ✅
- **`SD-INFO-26`**: Thay thế các decks cũ trong `StockDetailPage.js` bằng `StockDetailTabs`. (Estimate: 2h) ✅
- **`SD-INFO-27`**: Viết unit tests mock kiểm thử API và cache logic. (Estimate: 2h) ✅
- **`SD-INFO-28`**: Kiểm thử toàn diện hành vi UI trên trình duyệt và responsive. (Estimate: 1h) ✅

---

## 2. Daily Standup Tracker
- **2026-06-12 (Standup)**: Khởi tạo kế hoạch, thống nhất technical specification và chuẩn bị thực hiện Phase 1 (Header).

---

## 3. Blocker Log
- Không có blocker hiện tại.
