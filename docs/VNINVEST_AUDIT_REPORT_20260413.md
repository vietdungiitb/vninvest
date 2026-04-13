# Báo cáo Audit Kỹ thuật và Khuyến nghị Nâng cấp - VNInvest

**Ngày thực hiện**: 13/04/2026
**Phạm vi**: Toàn bộ dự án Backend, Frontend, Cơ sở hạ tầng hệ thống.

---

## 1. Tổng quan Kiến trúc hiện tại (Đánh giá chung)
VNInvest hiện đã phát triển vượt ra khỏi một "Portfolio Tracker" thông thường để trở thành một **Nền tảng Phân tích và Robo-Advisor chuyên nghiệp**. 

**Điểm sáng kỹ thuật lớn nhất:**
- **Pipeline Realtime hiện đại**: Setup luồng sự kiện rất chuẩn mực (`vnstock -> Celery Collector -> Redis Pub/Sub -> Django Channels -> Single Hook FE`). Khá ít dự án mã nguồn mở hoặc cá nhân ở quy mô này triển khai được một pipeline độ trễ thấp và bài bản.
- **Phân tách State frontend tinh tế**: Tư duy tổ chức `useRealtimeFeed.js` làm "Single Source of Truth" cho toàn bộ application là một quyết định kiến trúc tuyệt vời, giúp giảm duplicate WebSocket connections và quản lý payload đồng nhất.
- **Quan sát & Vận hành (Observability)**: Rất ấn tượng với các công cụ nội bộ đã có: Admin Ops dashboard, Realtime debug panel, System health checks.
- **Tính trọn vẹn của tính năng (Feature Completeness)**: Các tính năng nâng cao như Whale Campaigns, Dark Money Flow, Analytics Metrics (Sharpe/Sortino) cho thấy chất lượng domain-driven design rất vững.

---

## 2. So sánh VNInvest với các dự án tương tự

### So sánh trong thị trường Việt Nam (FireAnt, Fialda, Simplize, TCBS)
- **Điểm vượt trội**: Dòng tiền lớn (Whale Detection & Campaigns) và Order Flow là các "vũ khí" mà thị trường Việt Nam hiện chỉ cung cấp nhỏ giọt trong bảng giá hoặc phải mua gói premium đắt đỏ (như FiinTrade). VNInvest tính toán các thông số CVD (Cumulative Volume Delta) và Dark Money ngay từ backend là một cách tiếp cận của quỹ (institutional-grade).
- **Điểm khác biệt**: Sự gắn kết trực tiếp của **AI Advisory** bằng cách truyền Context (như thông số kline, giá) vào model theo cụm tab linh hoạt là tính năng độc đáo mà Simplize hay FireAnt chưa thực sự làm sâu.

### So sánh với mảng Toàn cầu (Unusual Whales, TradingView, Delta)
- Dự án có sự tương đồng lớn nhất với **Unusual Whales** (mảng theo dõi dòng tiền/options/whales).
- VNInvest làm khá tốt ở việc "đóng gói" (packaging) sự kiện đơn lẻ thành "Campagin" (Chiến dịch gom/xả hàng), điều mà các tracker khác thường bỏ qua khiến nhà đầu tư bị ngợp (noise).

---

## 3. Khuyến nghị Nâng cấp Hệ thống (Roadmap Upgrade)

Dựa trên baseline codebase khá vững chắc hiện tại (83/83 backend test pass, chuẩn hóa contract API), hệ thống hoàn toàn có thể scale up để thương mại hóa hoặc phục vụ lượng lớn user với các khuyến nghị sau:

### Khía cạnh 1: Hạ tầng Dữ liệu (Market Data Infra)
1. **Dịch chuyển Tick Data sang Timeseries Database**:
   - *Vấn đề*: Hiện tại hệ thống đang lưu tick hoặc events intraday vào SQLite/PostgreSQL (`IntradayTick DB`). Với dữ liệu thị trường, mô hình quan hệ sẽ query rất chậm khi scale theo năm.
   - *Khuyến nghị*: Triển khai **ClickHouse** hoặc **TimescaleDB**. Hai DB này tối ưu hóa việc phân tích chuỗi thời gian (time-series), giúp render Order Flow chart 1h/15m/5m với hàng triệu rows trong mili-giây.

2. **Dịch chuyển Message Broker sang Apache Kafka (Long-term)**:
   - *Vấn đề*: Redis Pub/Sub rất nhanh nhưng **không lưu trạng thái (stateless)**. Nếu Channels node sập, message trong lúc đó bị drop.
   - *Khuyến nghị*: Dùng Kafka làm backbone cho data pipeline. Kafka cho phép lưu trữ message log trong X ngày. Consumer mới khi khởi động có thể tua lại (replay) sự kiện intraday dễ dàng.

### Khía cạnh 2: Nâng cấp Core Features (Business Value)
1. **Backtesting Engine cho Whale Campaigns**:
   - Đã phát hiện được Whale Campaign (chiến dịch gom/xả), bước tiếp theo là: *"Tỷ lệ thắng (Win-rate) của các mã có Whale Accumulation Campaign trong 7-14 ngày tiếp theo là bao nhiêu?"*
   - Cần phát triển 1 module mô phỏng lợi nhuận (Simulation/Backtest) dựa trên tín hiệu AI Advisory & Whale Alert.

2. **Tích hợp Webhook & Social Notifications**:
   - Mở rộng model Alert thành hệ thống Webhook-driven. Cho phép người dùng kết nối Telegram Bot cá nhân, Zalo ZNS hoặc Discord channel để nhận alert Whale giá trị giao dịch > X tỷ realtime.

3. **Multi-broker Auto-Sync (Đồng bộ đa CTCK)**:
   - Thay vì quản lý Portfolio bằng tay, tính năng killer cho app là tự rút số dư và danh mục từ các CTCK lớn (TCBS, VPS, SSI). (Có thể tiếp cận qua reverse API nếu cần thiết, hoặc user nhập Read-only API key nếu CTCK hỗ trợ).

### Khía cạnh 3: Trải nghiệm Mobile & Frontend (UX/UI)
1. **Push Notifications với Firebase Cloud Messaging (FCM)**:
   - App React Native đang ở mức MVP. Để giữ chân user, các tín hiệu (Unified Alert Center) cần được đẩy thành OS Push Notification, giúp người dùng chốt lời/cắt lỗ kể cả khi ứng dụng đang chạy nền.
   
2. **Interactive Charting (TradingView Lightweight Charts)**:
   - Hiện tại đang dùng `recharts` / `chart.js` (như qua biến `AreaChart`). Đối với ứng dụng tài chính, Recharts thiếu tương tác kéo/zoom tự do. 
   - Khuyến nghị chuyển sang thư viện trực quan lõi `lightweight-charts` (từ TradingView) siêu nhẹ, siêu mượt và thân thuộc 100% với trader.

### Khía cạnh 4: Tối ưu kiến trúc hiện vắng bóng
1. **Rate-Limiting nghiêm ngặt (API Gateway)**:
   - Hệ thống phụ thuộc nhiều vào REST APIs. Cần tích hợp Throttle layer mạnh mẽ ở cấp độ Nginx hoặc Kong API Gateway, đặc biệt đối với đường `/api/realtime/whale-feed/` để chống scraping dữ liệu quý giá.
2. **Circuit Breakers cho vnstock**:
   - Vnstock fetching tuy đã có thread timeout nhưng nếu thư viện gọi API bị chặn (403/429 từ SSI/VCI), hệ thống cần một "Circuit Breaker" (như thư viện `pybreaker`) để ngắt request hoàn toàn, tránh lãng phí I/O chờ đợi cho tới khi reset-window hoàn tất.

---
**Tổng Hợp Kế Hoạch Đề Xuất Cho Sprint Tiếp Theo (Sau Sprint 35)**:
- Nâng cấp Chart component cho mượt mà (chuyển sang Lightweight Charts).
- Xây dựng Zalo/Telegram Bot webhook cảnh báo Whale Alert.
- Di chuyển dữ liệu IntradayTick sang ClickHouse để chuẩn bị làm móng cho hệ thống Backtest tự động.
