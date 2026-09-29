# Stock Detail Screen Analysis

Muc tieu:
- Phan tich man hinh chi tiet mot ma co phieu theo huong mot "stock workstation" day du, khong chi la modal xem thong tin co ban.
- Xac dinh khoang cach giua he thong hien tai va muc tieu nghiep vu.
- De xuat cach dua tinh nang nay vao roadmap theo tung lop du lieu va muc do phuc tap.

## 1. Hien trang cua du an

Tinh trang hien tai:
- Frontend da co `StockDetailModal` trong `Watchlist.jsx`, nhung moi hien:
  - ma co phieu
  - ten cong ty
  - nganh
  - san
  - ngay niem yet
- Backend hien co nen du lieu co ban:
  - `StockProfile` cho thong tin tinh
  - `DailyPrice` cho EOD
  - realtime ticker fallback + websocket feed cho gia, whale alert, heartbeat
  - holdings/tracked symbols/watchlist/price alerts

Khoang thieu lon:
- Chua co stock detail page doc lap.
- Chua co API tong hop cho top panel cua mot ma.
- Chua co OHLC time-series API toi uu cho charting da khung thoi gian.
- Chua co du lieu `order book`, `time & sales`, `active buy/sell flow`.
- Chua co thanh ticker thi truong chay ngang o muc app-shell.
- Chua co integration chart library cap workstation nhu TradingView.

Ket luan:
- Day khong phai la mot "nang cap modal" nho.
- Day la mot cum tinh nang cap san pham, can tach thanh nhieu phase roadmap.

## 2. Cau truc nghiep vu cua man hinh muc tieu

### A. Top Panel - Thong tin tong quan trong phien
Can co:
- Ma + san + ten cong ty.
- Gia hien tai, thay doi gia, % thay doi.
- Tran / san / tham chieu.
- Mo cua, trung binh, thap, cao, tong KL.
- Nut di den phan tich co ban, dat lenh.

Y nghia trong he thong VNInvest:
- Day la lop tong hop du lieu market snapshot nhanh nhat cho mot symbol.
- Can dung chung cho Watchlist, Dashboard, screener result, alert click-through.

Nguon du lieu can co:
- EOD/near realtime quote.
- Thong tin static tu `StockProfile`.
- Neu muon dung hon muc workstation thi can bo sung intraday quote aggregate.

### B. Main Chart - Khong gian phan tich ky thuat
Can co:
- Candlestick/line chart.
- Da khung thoi gian: intraday, 1D, 1W, 1M.
- Chi bao ky thuat: MA, RSI, MACD, Volume.
- Cong cu ve neu dung chart library ho tro.

Y nghia trong roadmap:
- Day la cau noi giua market watch, screener, robo-advisor va backtest.
- Neu lam dung, no tro thanh man hinh thao tac trung tam cho user.

Nguon du lieu can co:
- API OHLCV time-series.
- Neu co intraday chart thi can minute bars hoac external chart source.

### C. Right Rail - Order Book va Time & Sales
Can co:
- 3 buoc gia mua/ban tot nhat.
- Tong cho mua / tong cho ban.
- Tape giao dich real-time.
- Active buy / active sell summary.

Danh gia ky thuat:
- Day la lop du lieu kho nhat trong pham vi hien tai.
- Khong nen dua vao sprint gan neu chua co data source on dinh.
- Neu khong co vendor/nguon hop le, can xem day la roadmap P3 thay vi P1/P2.

### D. Thanh ticker thi truong toan cuc
Can co:
- Danh sach ma hot/chon san chay ngang o app shell.

Gia tri:
- De lam, gia tri nhin thay nhanh.
- Co the tan dung realtime ticker feed dang co.

## 3. Phan ra thanh cac lop tinh nang de trien khai

### Phase 1 - Stock Detail Foundation
Pham vi:
- Bien `StockDetailModal` thanh stock detail page/route doc lap.
- Top panel tong hop quote + static profile.
- Basic chart tu `DailyPrice`.
- Khung "Phan tich co ban" toi thieu.

Nen du lieu can co:
- `StockProfile`
- `DailyPrice`
- realtime ticker hien tai

Gia tri:
- Tao duoc man hinh chi tiet co nghia de click tu Watchlist/Dashboard.
- Chua phu thuoc order book data.

### Phase 2 - Technical Analysis Workspace
Pham vi:
- Chart nang cao hon: timeframe, overlay indicators, volume.
- Tich hop chart lib co kha nang mo rong.
- Ket noi voi screener result va robo recommendation.

Gia tri:
- Day muc tieu trung han va rat hop voi roadmap screener/backtest.

### Phase 3 - Session Flow va Intraday Intelligence
Pham vi:
- Top panel intraday day du hon.
- Average price trong phien, high/low, turnover intraday.
- Price alert click-through vao stock detail.
- Whale alert / signal feed theo rieng symbol.

Gia tri:
- Lam man hinh detail tro thanh noi giai nghia signal thay vi chi hien thi gia.

### Phase 4 - Micro-structure (Order Book / Tape)
Pham vi:
- DOM 3 steps / 10 steps.
- Time & sales.
- Active buy / sell.
- Depth chart.

Dieu kien tien quyet:
- Co nguon du lieu order book/tape hop le.
- Co stream processing rieng va quy tac fallback khi mat du lieu.

Khuyen nghi:
- Khong dua vao sprint gan neu chua co data vendor ro rang.

## 4. Tac dong den kien truc hien tai

Backend can them:
- Stock detail aggregate endpoint, vi du:
  - `GET /api/stock-management/stocks/<symbol>/overview/`
  - `GET /api/stock-management/stocks/<symbol>/ohlcv/?interval=1D&range=6M`
  - `GET /api/stock-management/stocks/<symbol>/signals/`
- Neu co intraday:
  - quote snapshot cache
  - intraday bars pipeline
  - order book / tape endpoint neu co data source

Frontend can them:
- Route doc lap, vi du `/stocks/:symbol` hoac `/market/stocks/:symbol`
- Layout 3 vung:
  - top panel
  - chart workspace
  - right rail signals / order book
- Link tu Watchlist, Dashboard, alerts, screener results vao stock detail page.

Domain can can nhac bo sung:
- `PriceAlertRule` da co the click-through vao stock detail.
- `ScreenerRule` va future robo output nen link ve mot symbol workspace thay vi chi modal.
- Neu co order book/tape thi can model cache hoac stream adapter rieng.

## 5. Cac rui ro va quyet dinh can chot som

1. Co hay khong order book data source?
- Neu khong co, khong nen cam ket giao dien DOM/tape trong near-term roadmap.

2. Chart library nao se dung?
- Neu muon gan TradingView-style workspace, can chot tu som de tranh refactor UI 2 lan.

3. Stock detail page co phai diem vao trung tam cua he thong khong?
- Neu co, can chuyen tu modal sang route doc lap som.

4. Dat lenh co nam trong scope san pham khong?
- Neu chua co brokerage integration, nut `Dat lenh` nen la placeholder/CTA thay vi promise chuc nang that.

## 6. Khuyen nghi dua vao roadmap

### De xuat muc uu tien

P1:
- Stock Detail Foundation
- Top panel + chart EOD + thong tin co ban + signal summary

P2:
- Technical Analysis Workspace
- Multi-timeframe chart + indicators + screener/robo integration

P3:
- Order book / time & sales / depth chart
- Chi mo khi co data source thuc te

## 7. De xuat sprint mapping

### Sprint 14
- Tao stock detail page doc lap.
- Top panel tong hop.
- API overview + EOD chart data.
- Link tu Watchlist/Dashboard vao stock detail.

### Sprint 15
- Technical analysis workspace.
- Indicator layer.
- Signal summary theo symbol (whale, price alerts, screener hit neu co).

### Sprint 16+
- Order book / tape / depth chart neu co data vendor.
- Advanced intraday flow analytics.

## 8. Ket luan

Man hinh chi tiet ma co phieu la mot cap nang luc quan trong va hop logic voi huong phat trien VNInvest.

Nhung can dinh vi dung:
- Day la "symbol workspace" cap san pham.
- Khong phai mot modal thong tin phu.

Neu dua dung vao roadmap:
- gan han lam top panel + EOD/realtime chart + thong tin co ban
- trung han lam indicator/signal workspace
- dai han moi lam order book va tape khi co data source phu hop