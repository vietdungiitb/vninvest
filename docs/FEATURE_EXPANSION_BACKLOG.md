# Feature Expansion Backlog (sau dot review y tuong)

Muc tieu:
- Dua cac de xuat mo rong moi vao backlog chinh thuc cua du an.
- Uu tien theo gia tri nghiep vu, do phu hop voi nen hien tai va do kho trien khai.
- Tranh bien backlog thanh danh sach y tuong roi rac khong co thu tu thuc thi.

Nguyen tac sap xep:
- Uu tien cao cho tinh nang tan dung truc tiep nen realtime, analytics va tracked symbols da co.
- Chi day cac tinh nang can nguon du lieu/doi tac ngoai len sau khi he thong noi bo da on dinh.
- Moi nhom tinh nang moi phai co owner, KPI va definition of done ro rang truoc khi dua vao sprint.

## P0 - Nen tang can lam som

### 1. Shared frontend realtime layer
Muc tieu:
- Gom logic websocket, polling fallback, reconnect, stale state vao mot hook/service dung chung.

Trang thai:
- Hoan tat trong dot refactor ngay 2026-04-01 voi hook `frontend/src/hooks/useRealtimeFeed.js` va da ap dung cho Watchlist + Dashboard.

Ly do uu tien:
- Watchlist va Dashboard dang co logic lap.
- Day la tien de cho price alert, realtime P/L, whale alert history va observability.

Pham vi de xuat:
- Tao `useRealtimeFeed` hoac service tuong duong.
- Chuan hoa subscription management theo holdings, tracked symbols, active view.
- Chuan hoa status `idle / connecting / live / polling / stale`.

DoD:
- Watchlist va Dashboard dung chung mot layer realtime frontend.
- Khong tao websocket leak khi chuyen view.
- Fallback polling tiep tuc hoat dong khi socket mat.

### 2. Realtime portfolio value va unrealized P/L
Muc tieu:
- Cap nhat NAV, gia tri danh muc va lai/lo chua thuc hien gan realtime theo gia thi truong hien tai.

Trang thai:
- Hoan tat phien ban frontend dau tien ngay 2026-04-01 trong `DashboardRealtimePanel`, co card gia tri gan realtime, unrealized P/L, delta so voi snapshot va stale positions.

Ly do uu tien:
- Gia tri nguoi dung nhin thay rat ro.
- Tan dung duoc holdings engine, tracked symbols va realtime ticker da co.

Pham vi de xuat:
- Backend tinh lai holdings mark-to-market tu realtime ticker cache.
- Dashboard hien thi tong NAV, P/L ngay, P/L chua thuc hien.
- Co stale indicator neu du lieu ticker da cu.

KPI:
- Dashboard update on dinh khi gia 4-20 ma thay doi.
- Sai lech NAV gan realtime trong nguong cho phep so voi snapshot.

### 3. User-defined realtime price alerts
Muc tieu:
- Cho phep dat nguong gia theo tung ma va nhan canh bao khi vuot moc.

Trang thai:
- Hoan tat vertical slice ngay 2026-04-01: co model/API/admin/UI Watchlist va cooldown luu theo DB. Trigger hien duoc phat hien in-app dua tren `useRealtimeFeed`.

Ly do uu tien:
- Phu hop truc tiep voi tracked symbols.
- De demo, de do tac dong va mo rong sang alert center.

Pham vi de xuat:
- Model/API cho alert rule theo user: `symbol`, `condition`, `target_price`, `cooldown_seconds`.
- Realtime evaluator tai backend hoac tren stream consume.
- UI tao/sua/xoa alert va lich su alert gan nhat.

DoD:
- Co the tao alert `price_above` va `price_below`.
- Alert khong ban trung lap lien tuc trong cua so cooldown.

### 4. Scheduled sync cho tracked symbols va watchlists
Muc tieu:
- Tu dong cap nhat gia va du lieu cho cac ma duoc theo doi, khong phu thuoc thao tac tay.

Trang thai:
- Hoan tat backend automation co ban ngay 2026-04-01: service union symbol, Celery tasks, beat config env va management command `sync_watch_assets`.

Pham vi de xuat:
- Celery Beat jobs cho tracked symbols.
- Runbook quan sat task status + retry.
- Admin quick action de chay sync tay khi can.

## P1 - Gia tri phan tich cao, nen lam sau khi realtime on dinh

### 5. Nang cap portfolio analytics
Chi so uu tien:
- Maximum Drawdown
- Sharpe Ratio
- Sortino Ratio
- Alpha va Beta so voi benchmark
- Time-Weighted Rate of Return (TWR)

Ly do uu tien:
- Tang chat luong danh gia hieu suat dau tu.
- Phu hop voi lop analytics Pandas da co.

Pham vi de xuat:
- API analytics nang cao theo portfolio va subaccount.
- Chart equity curve + benchmark compare.
- Export CSV/JSON cho report.

### 6. Allocation analysis nang cao
Pham vi de xuat:
- Sector/industry allocation.
- Market-cap allocation.
- So sanh co ban voi benchmark thi truong neu du du lieu.

Gia tri:
- Lam ro muc do tap trung rui ro danh muc.
- Ket noi tot voi `SecuritiesGroup` va `StockProfile`.

### 7. Whale alert UX + observability
Pham vi de xuat:
- History ngan cua whale alerts.
- Severity buckets.
- Anti-duplicate.
- Client-side counters: reconnect, fallback, stale, received events.

Ly do uu tien:
- Day la phan hardening can thiet de realtime san sang staging.

## P2 - Mo rong nghiep vu sau khi nen tang da vung

### 8. Screener nang cao
Pham vi de xuat:
- Pre-built screeners: tang truong, gia tri, co tuc cao, breakout.
- Rule types phuc tap hon: RSI, MACD, moving average cross, volume breakout.
- Backtesting ket qua screener.

### 9. Quan ly rui ro danh muc
Pham vi de xuat:
- Diversification score / HHI.
- Value at Risk (VaR).
- Scenario analysis / stress testing.

### 10. Admin operations dashboard
Pham vi de xuat:
- Tong quan so user, portfolio, tracked symbols, last sync, task failures.
- Trang thai worker/Celery/realtime mode.
- Quick links den admin-sync, seed, sync gia, runbook.

### 11. Stock detail workspace
Trang thai:
- Hien tai moi co `StockDetailModal` o muc xem profile co ban. Chua co stock detail page doc lap va chua co workspace ky thuat/realtime day du.

Pham vi de xuat:
- Top panel tong hop quote + company profile + session stats.
- EOD/realtime chart cho mot symbol.
- Signal summary theo symbol: whale alert, price alerts, screener hit, signal gan nhat.
- Route doc lap de click-through tu Watchlist, Dashboard, alerts.

Khuyen nghi phan ra theo phase:
- P1: foundation page + top panel + chart EOD.
- P2: indicator workspace + screener/robo integration.
- P3: order book / tape / depth chart khi co data source.

## P3 - Tinh nang co gia tri cao nhung phu thuoc ben ngoai

### 12. Realtime news va corporate events feed
Rui ro/chu y:
- Phu thuoc nguon du lieu va chat luong entity mapping theo symbol.
- Can co anti-spam va muc uu tien thong bao.

### 13. Brokerage integration
Rui ro/chu y:
- Bao mat, token lifecycle, dong bo sai lech, reconciliation.
- Phu thuoc API broker.

### 14. Order book / market depth
Rui ro/chu y:
- Chi nen lam khi co data vendor phu hop va tan suat du lieu dap ung.

Lien he voi stock detail workspace:
- Day la thanh phan phu thuoc ben ngoai cho phase micro-structure cua man hinh chi tiet ma.

### 15. Social / community features
Pham vi de xuat:
- Public portfolio sharing tuy chon.
- Follow other investors.
- Discussion theo symbol.

Khuyen nghi:
- Khong dua vao near-term sprint neu core portfolio + realtime + analytics chua dat muc on dinh.

## Mapping de xuat vao cac sprint

### Sprint 12 (dang lam)
- Shared frontend realtime layer
- Whale alert UX + observability co ban
- Chuan hoa reconnect/fallback/stale handling

### Sprint 13
- Realtime portfolio value va unrealized P/L
- User-defined price alerts
- Scheduled sync cho tracked symbols/watchlists

### Sprint 14
- Portfolio analytics nang cao
- Allocation analysis nang cao
- Admin operations dashboard
- Stock detail foundation page

### Sprint 15+
- Screener nang cao + backtesting screener results
- Risk management (VaR, HHI, stress testing)
- Stock detail technical workspace
- News/events feed
- Brokerage integration

## Tieu chi dua tu backlog vao sprint that

1. Co owner ro rang: BE, FE, QA, DevOps.
2. Co estimate theo task thay vi chi co y tuong cap cao.
3. Co xac dinh ro du lieu dau vao va rui ro phu thuoc ben ngoai.
4. Co KPI do duoc tren local/staging.
5. Khong pha vo contract API dang dung.