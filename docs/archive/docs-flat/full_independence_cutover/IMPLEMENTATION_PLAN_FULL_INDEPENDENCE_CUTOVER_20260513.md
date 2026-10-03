# IMPLEMENTATION PLAN — Full Independence Cutover (Không Shadow Run)

**Ngày tạo**: 2026-05-13  
**Chiến lược**: Mục tiêu C — Tắt legacy backend hoàn toàn  
**Thay thế**: Shadow run 3 ngày → Staging smoke test 1 ngày  
**Timeline**: ~7 ngày làm việc  
**Status**: AWAITING CONFIRMATION

---

## 1. BASELINE — TRẠNG THÁI THỰC TẾ HÔM NAY

### ✅ Đã xong (không cần làm lại)

| Component | Evidence |
|---|---|
| **B1 — Proxy Gateway** | nginx.conf: `/api/` → `$core_api_upstream`; port 8000 không expose; `frontend.depends_on: core-api` |
| **B7 — WebSocket** | `asgi.py`: ProtocolTypeRouter + `MarketTickerConsumer` tại `/ws/market/{symbol}/` |
| **B6 — Admin Ops** | `/api/admin-ops/*` → native views |
| **Identity Auth** | Login, profile, logout, PAT, register — native tại `identity_access/api_urls.py` |
| **Market Serving** | SymbolSnapshot, SessionFacts, UnifiedAlerts — native |
| **Whale/Signal** | WhaleFeedAggregate, WhaleCalendarCampaigns — native |
| **Portfolio CRUD** | portfolios/, transactions/, watchlist/ — native views |
| **Advisory** | `/core/v1/advisory/latest|refresh|history/{symbol}/` — native |
| **Materializer Tasks** | 4 scheduled tasks trong CELERY_BEAT_SCHEDULE (60s snapshot, 5m session, 2m alerts) |
| **Commercial** | Billing, quota, invoice — native |

### ❌ Còn bridge về legacy (sẽ break khi tắt legacy)

| Route nhóm | Bridge class | Legacy dependency |
|---|---|---|
| `realtime/ticker/{symbol}/` | `RealtimeLegacyBridgeView` | Redis ticker cache của legacy-worker |
| `realtime/tickers/` | `RealtimeLegacyBridgeView` | idem |
| `realtime/intraday/{symbol}/` | `RealtimeLegacyBridgeView` | legacy IntradayTick table |
| `realtime/price-board/{symbol}/` | `RealtimeLegacyBridgeView` | legacy ticker |
| `realtime/breadth/{symbol}/` | `RealtimeLegacyBridgeView` | legacy aggregate |
| `realtime/rvol/{symbol}/` | `RealtimeLegacyBridgeView` | legacy RVOL computation |
| `realtime/depth-chart/{symbol}/` | `RealtimeLegacyBridgeView` | vnbroker via legacy |
| `realtime/symbol-investigation/{symbol}/` | `RealtimeLegacyBridgeView` | legacy aggregate |
| `realtime/whale-feed/{symbol}/` | `RealtimeLegacyBridgeView` | legacy whale table |
| `stock-management/stocks/{symbol}/` | `StockManagementLegacyBridgeView` | legacy StockProfile |
| `stock-management/stocks/{symbol}/overview/` | `StockManagementLegacyBridgeView` | legacy |
| `stock-management/stocks/{symbol}/chart/` | `StockManagementLegacyBridgeView` | legacy DailyOHLC |
| `stock-management/stocks/{symbol}/order-flow/` | `StockManagementLegacyBridgeView` | legacy OrderFlow |
| `stock-management/stocks/{symbol}/news/` | `StockManagementLegacyBridgeView` | legacy news |
| `stock-management/stocks/{symbol}/ai-advisory-session/` | `StockManagementLegacyBridgeView` | legacy advisory |
| `stock-management/stocks/{symbol}/ai-advisory-*` | `StockManagementLegacyBridgeView` | legacy advisory |
| `stock-management/technicals/bulk/` | `StockManagementLegacyBridgeView` | legacy technicals |
| `portfolio/{id}/holdings/` | `PortfolioAnalyticsStubView` | (stub, empty) |
| `portfolio/{id}/summary/` | `PortfolioAnalyticsStubView` | (stub, empty) |
| `portfolio/{id}/chart/` | `PortfolioAnalyticsStubView` | (stub, empty) |
| `portfolio/{id}/equity-curve/` | `PortfolioAnalyticsStubView` | (stub, empty) |
| `portfolio/{id}/allocation/` | `PortfolioAnalyticsStubView` | (stub, empty) |
| `portfolio/{id}/sync/` | bridge | legacy price sync task |

### ⚠️ Ingest — Data pipeline vẫn chạy qua legacy-worker

`data_ingest/tasks.fetch_and_upsert_price_board` — task CÓ trong core, nhưng CHƯA có trong `CELERY_BEAT_SCHEDULE`. Legacy `backend-worker` đang là nguồn duy nhất cập nhật SymbolSnapshot → nếu tắt legacy-worker, market data dừng.

---

## 2. SCOPE

### Trong scope
- Tất cả bridge routes → native implementation  
- Portfolio analytics stubs → real implementation  
- Data ingest → schedule trong core-beat  
- Auth email flows → verify/port nếu cần  
- Misc (SubAccount, Telegram, watchlist sync) → graceful drop hoặc port  
- Decommission `backend`, `backend-worker`, `backend-beat` containers  
- Xóa bridge code sau khi verified

### Ngoài scope
- Thay đổi URL contracts (frontend giữ nguyên paths)
- Database migration sang PostgreSQL riêng (để phase sau)
- Thay đổi chart engine, KLine semantics
- Prometheus/Grafana config

---

## 3. DEPENDENCY MAP

```
C1 (Ingest Cutover)
    │
    ├── C2 (Realtime Native) ← cần C1 để có data
    │
    ├── C3 (Stock Mgmt Native) ← cần C1 (data) và market_data views
    │
    ├── C4 (Portfolio Analytics) ← cần C2 (SymbolSnapshot prices)
    │
    ├── C5 (Auth Verify) ← độc lập
    │
    ├── C6 (Misc Cleanup) ← sau C2, C3, C4 xong
    │
    └── C7 (Decommission) ← cần TẤT CẢ C1-C6 pass smoke test
```

---

## 4. CHI TIẾT TỪNG SLICE

---

### Slice C1 — Data Ingest Cutover

**Estimate**: 0.5 ngày  
**Mục tiêu**: Core-beat tự ingest market data, không phụ thuộc legacy-worker

**Files thay đổi**:
1. `packages/core/backend/src/vninvest_core/settings.py` — MODIFY: thêm entries vào `CELERY_BEAT_SCHEDULE`
2. `packages/core/backend/src/data_ingest/tasks.py` — VERIFY/MODIFY: kiểm tra intraday ingest task

**Nội dung C1.1** — Thêm vào `CELERY_BEAT_SCHEDULE`:
```python
'ingest-price-board-60s': {
    'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
    'schedule': 60.0,
    'options': {'queue': 'realtime_prefetch'},
},
```

**Nội dung C1.2** — Verify/add intraday ingest:
- Nếu `data_ingest/tasks.py` chưa có `fetch_and_upsert_intraday` → port logic từ `backend/portfolio/tasks.py` (schedule_realtime_prefetch_shards)
- Add vào beat schedule 30s interval

**DoD C1**:
- [ ] `fetch_and_upsert_price_board` có trong CELERY_BEAT_SCHEDULE với queue `realtime_prefetch`
- [ ] `docker compose -f docker-compose.dev.yml stop backend-worker` → chờ 2 phút
- [ ] `SymbolSnapshot.objects.filter(updated_at__gt=now()-2min).count() > 0` → data vẫn chảy
- [ ] core-worker-realtime-prefetch logs: `"fetch_and_upsert_price_board (native): upserted N rows"`

**Commit**: `feat(C1): schedule price board ingest in core-beat`

---

### Slice C2 — Realtime Native

**Estimate**: 1.5 ngày  
**Mục tiêu**: Thay 9 `RealtimeLegacyBridgeView` bằng native views đọc từ core tables

**Files thay đổi**:
1. `packages/core/backend/src/market_serving/legacy_views.py` — MODIFY: replace bridge logic trong `RealtimeLegacyBridgeView`
2. `packages/core/backend/src/market_serving/api_urls.py` — MODIFY: map routes tới native views
3. `packages/core/backend/src/market_serving/views.py` — ADD: new native view classes

**Route → Data Source mapping**:

| Route | Native Data Source |
|---|---|
| `realtime/ticker/{symbol}/` | `SymbolSnapshot.objects.get(symbol=symbol)` → serialize as ticker |
| `realtime/tickers/` | `SymbolSnapshot.objects.filter(symbol__in=params['symbols'])` |
| `realtime/intraday/{symbol}/` | `IntradayBar.objects.filter(symbol=symbol, date=today).order_by('timestamp')` |
| `realtime/price-board/{symbol}/` | Same as ticker — SymbolSnapshot |
| `realtime/breadth/{symbol}/` | Aggregate từ SymbolSnapshot (advance/decline count by sector) |
| `realtime/rvol/{symbol}/` | `IntradayBar` volume vs 20-day avg từ `DailyPrice` |
| `realtime/depth-chart/{symbol}/` | Call `vnbroker_adapter.fetch_order_book(symbol)` trực tiếp |
| `realtime/symbol-investigation/{symbol}/` | Join SymbolSnapshot + UnifiedAlert + SessionFacts |
| `realtime/whale-feed/{symbol}/` | `UnifiedAlert.objects.filter(symbol=symbol, alert_type__in=[WHALE, DARK_FLOW])` |

**Response format rule**: Phải match legacy response schema 1:1. Dùng `diff` với một request captured từ legacy bridge trước khi xóa bridge.

**DoD C2**:
- [ ] Tất cả 9 routes trả về 200 với data hợp lệ (không còn gọi `legacy_bridge_response`)
- [ ] `RealtimeLegacyBridgeView._bridge()` method KHÔNG được gọi cho 9 routes này
- [ ] `docker compose -f docker-compose.dev.yml stop backend` → 9 curl tests vẫn 200
- [ ] Response schema spot-check: `realtime/ticker/VIC/` → phải có `symbol`, `price`, `change`, `change_pct`

**Commit**: `feat(C2): realtime native views from core tables (no bridge)`

---

### Slice C3 — Stock Management Native

**Estimate**: 1.5 ngày  
**Mục tiêu**: Thay `StockManagementLegacyBridgeView` bằng native views

**Files thay đổi**:
1. `packages/core/backend/src/market_data/public_urls.py` — MODIFY: swap bridge → native views
2. `packages/core/backend/src/market_data/views.py` — ADD: StockProfileDetailView, StockChartView, StockOverviewView, StockNewsView
3. `packages/core/backend/src/signal_intelligence/api_urls.py` — ADD/VERIFY: order-flow native URL
4. `packages/core/backend/src/advisory/compat_urls.py` (hoặc `public_urls.py`) — ADD: ai-advisory-session compat route

**Route → Native View mapping**:

| Route | Native Implementation |
|---|---|
| `/stocks/{symbol}/` | `market_data.views.StockProfileDetailView` (StockProfile model đã có) |
| `/stocks/{symbol}/overview/` | `market_data.views.StockOverviewView` — aggregate StockProfile + SymbolSnapshot |
| `/stocks/{symbol}/chart/` | `market_data.views.StockOHLCChartView` — DailyPrice model đã có |
| `/stocks/{symbol}/order-flow/` | `signal_intelligence.views.OrderFlowDetailView` — OrderFlowEvent model |
| `/stocks/{symbol}/news/` | `market_data.views.StockNewsView` — gọi `vnbroker_adapter.fetch_news(symbol)` |
| `/stocks/{symbol}/news/ai-summary/` | Same as news nhưng với summary flag |
| `/stocks/{symbol}/ai-advisory-session/` | `advisory.views.AdvisoryLatestView` (đã có) — chỉ cần thêm compat URL |
| `/stocks/{symbol}/ai-advisory-components/generate/` | `advisory.views.AdvisoryRefreshView` → map to this path |
| `/stocks/{symbol}/ai-advisory-components/deleted/` | advisory.views xóa component |
| `/stocks/{symbol}/ai-advisory-summary/regenerate/` | `advisory.views.AdvisoryRefreshView` |
| `/technicals/bulk/` | `market_data.views.BulkTechnicalView` — compute từ DailyPrice + SymbolSnapshot |

**DoD C3**:
- [ ] Tất cả routes trả 200 (không còn proxy call)
- [ ] `StockManagementLegacyBridgeView` không được call trong 11 routes này
- [ ] `docker compose -f docker-compose.dev.yml stop backend` → 11 curl tests pass
- [ ] `/stocks/VIC/` trả có `symbol`, `company_name`, `exchange`, `sector`
- [ ] `/stocks/VIC/chart/` trả OHLCV array với ít nhất 20 candles

**Commit**: `feat(C3): stock management native views (no bridge)`

---

### Slice C4 — Portfolio Analytics Native

**Estimate**: 2 ngày  
**Mục tiêu**: Thay 5 stub views bằng real computation

**Files thay đổi**:
1. `packages/core/backend/src/user_workspace/portfolio_analytics.py` — CREATE: business logic layer
2. `packages/core/backend/src/user_workspace/views.py` — ADD: 5 analytics view classes
3. `packages/core/backend/src/user_workspace/urls.py` — MODIFY: remove stub views, wire real views

**Business logic cần implement**:

**C4.1 — Holdings**:
```
holdings = aggregate(Transaction.objects.filter(portfolio_id=id))
           JOIN current_price FROM SymbolSnapshot
Result: [{symbol, quantity, avg_cost, current_price, current_value, unrealized_pnl, pnl_pct}]
```

**C4.2 — Summary**:
```
summary = {
    total_invested: sum(transaction.amount for buy transactions),
    current_value: sum(holdings.current_value),
    total_pnl: current_value - total_invested,
    total_pnl_pct: total_pnl / total_invested * 100,
    day_change: sum(holdings.day_change),
    num_positions: count(distinct symbols in holdings),
}
```

**C4.3 — Allocation**:
```
allocation = group holdings by sector/symbol
Result: [{label, value, pct}]
```

**C4.4 — Equity Curve / Chart**:
```
equity_curve = for each date in date_range:
    holdings_on_date = compute from transactions before date
    value_on_date = sum(holdings_on_date.quantity * DailyPrice.close)
Result: [{date, value}]
```

**C4.5 — Sync**:
```
sync = trigger fetch_and_upsert_price_board.delay(symbols=portfolio_symbols)
Result: {"synced": N, "symbols": [...]}
```

**SubAccount quyết định**: DROP — return `[]` với HTTP 200. Không implement SubAccount trong core.

**DoD C4**:
- [ ] `GET /api/portfolio/portfolios/{id}/holdings/` → 200 với real holdings data (không phải empty)
- [ ] Holdings có đủ fields: `symbol`, `quantity`, `avg_cost`, `current_value`, `unrealized_pnl`
- [ ] `GET /api/portfolio/portfolios/{id}/summary/` → 200 với `total_invested`, `current_value`, `total_pnl`
- [ ] `GET /api/portfolio/portfolios/{id}/equity-curve/?days=30` → array 30 data points
- [ ] `GET /api/portfolio/portfolios/{id}/allocation/` → array với sector grouping
- [ ] `POST /api/portfolio/portfolios/{id}/sync/` → 200 trigger ingest task
- [ ] `docker compose stop backend` → tất cả vẫn trả data, không phải empty

**Commit**: `feat(C4): portfolio analytics native (replace stubs)`

---

### Slice C5 — Auth Email Flows Verify

**Estimate**: 0.5 ngày (mostly investigation)  
**Mục tiêu**: Xác nhận tất cả auth flows không bridge về legacy

**Kiểm tra**:
```powershell
# Test register
curl -X POST http://localhost/api/auth/register/ -d '{"email":"test@x.com","password":"test1234","name":"Test"}'
# Should return 201 (native) or bridge error

# Test password reset
curl -X POST http://localhost/api/auth/password-reset/request/ -d '{"email":"test@x.com"}'
# Should return 200
```

**Nếu bridge**: Port `RegisterView`, `EmailVerifyView`, `PasswordResetView` vào `identity_access/views_auth.py`  
**Nếu native**: Chỉ document và close

**DoD C5**:
- [ ] `POST /api/auth/register/` → 201 không qua legacy
- [ ] `POST /api/auth/password-reset/request/` → 200 không qua legacy
- [ ] Auth flows không call `legacy_bridge_response()`

**Commit**: `feat(C5): auth flows fully native`

---

### Slice C6 — Misc Cleanup

**Estimate**: 0.5 ngày  
**Mục tiêu**: Xử lý nốt các routes nhỏ còn bridge/stub

**C6.1 — Telegram notifications**: Return `{"status": "not_available", "message": "Tính năng đang được cập nhật"}` với HTTP 200 (không phải 502 bridge error). Xóa bridge call.

**C6.2 — Watchlist sync**: `POST /portfolio/watchlist/sync/` → trigger `fetch_and_upsert_price_board.delay()` cho symbols trong watchlist user.

**C6.3 — Portfolio subaccounts**: Đã là `GenericEmptyListView` (return `[]`) — giữ nguyên, OK.

**C6.4 — ai-command-center**: `GET /portfolio/ai-command-center/` → kiểm tra có bridge không, port nếu cần.

**C6.5 — Whale analytics**: `GET /portfolio/whale/analytics/{symbol}/` → kiểm tra có bridge không, port sang signal_intelligence nếu cần.

**DoD C6**:
- [ ] Không có route nào còn gọi `legacy_bridge_response()` (grep confirm 0 kết quả)
- [ ] Tất cả routes trả data hợp lệ hoặc `{"status": "not_available"}` — không có 502/bridge_unavailable

**Commit**: `feat(C6): remove all remaining bridge calls`

---

### Slice C7 — Decommission (Không Shadow Run)

**Estimate**: 0.5 ngày  
**Mục tiêu**: Tắt legacy containers, xóa bridge code

#### C7.1 — Staging Smoke Test (thay thế shadow run)

```powershell
# Bước 1: Dừng legacy containers
docker compose -f docker-compose.dev.yml stop backend backend-worker backend-beat

# Bước 2: Chạy smoke test suite
# Auth
curl -s http://localhost/api/health/ | python -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' else 1)"
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/auth/login/ -H "Content-Type: application/json" -d '{"email":"admin@test.com","password":"..."}'
# → 200 hoặc 401 (không phải 502)

# Market data
curl -s -H "Authorization: Bearer ..." http://localhost/api/realtime/ticker/VIC/
# → 200 với data (không phải bridge_unavailable)

curl -s -H "Authorization: Bearer ..." http://localhost/api/stock-management/stocks/VIC/chart/
# → 200 với OHLCV

# Portfolio
curl -s -H "Authorization: Bearer ..." http://localhost/api/portfolio/portfolios/{id}/holdings/
# → 200 với holdings

# WebSocket
curl -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost/ws/market/VIC/
# → 101 Switching Protocols

# Verify không còn bridge calls
docker logs vninvest-dev-core-api 2>&1 | Select-String "bridge_unavailable"
# → 0 kết quả
```

**Gate pass**: Tất cả 0 trường hợp "bridge_unavailable" và 0 trường hợp HTTP 502.

#### C7.2 — Xóa bridge code (sau khi smoke test PASS)

**Files REMOVE hoặc SIMPLIFY**:
1. `packages/core/backend/src/market_serving/legacy_views.py` — Xóa `RealtimeLegacyBridgeView` class
2. `packages/core/backend/src/market_data/legacy_views.py` — Xóa `StockManagementLegacyBridgeView` class
3. `packages/core/backend/src/user_workspace/legacy_views.py` — Xóa `PortfolioAnalyticsStubView`, `PortfolioListAnalyticsStubView`
4. `packages/core/backend/src/vninvest_core/legacy_http_bridge.py` — XÓA file hoàn toàn
5. `packages/core/backend/src/vninvest_core/settings.py` — Xóa `LEGACY_BACKEND_URL` setting
6. `docker-compose.dev.yml` — Xóa `backend`, `backend-worker`, `backend-beat` services; xóa `LEGACY_BACKEND_URL` env
7. `docker-compose.prod.yml` — Xóa `backend`, `backend-worker`, `backend-beat` services

#### C7.3 — Final Production Cutover

```powershell
# Deploy production stack không có legacy containers
docker compose -f docker-compose.prod.yml up -d --no-deps --build core-api frontend
docker compose -f docker-compose.prod.yml stop backend backend-worker backend-beat
docker compose -f docker-compose.prod.yml rm -f backend backend-worker backend-beat
```

**DoD C7**:
- [ ] `grep -r "legacy_bridge_response\|LegacyBridgeView\|LEGACY_BACKEND_URL" packages/core/` → 0 kết quả
- [ ] `docker ps | Select-String "backend"` → 0 kết quả (không còn legacy containers)
- [ ] Smoke test suite: 100% PASS (0 502, 0 bridge_unavailable)
- [ ] Port 8000 không exposed trong bất kỳ compose file nào

**Commit**: `feat(C7): decommission legacy backend (full independence)`

---

## 5. RISK TABLE

| Risk | Severity | Mitigation |
|---|---|---|
| SymbolSnapshot stale sau khi tắt legacy-worker trước C1 | HIGH | Làm C1 trước, verify data flow độc lập |
| Response schema mismatch giữa native và legacy | MEDIUM | Capture sample response từ legacy bridge TRƯỚC khi xóa, dùng làm test fixture |
| Portfolio holdings calculation sai P&L | HIGH | Cross-check với legacy `/holdings/` trong C4 test |
| `fetch_order_book` từ vnbroker trong C2 → rate limit | LOW | Cache 1s, fallback empty array (depth-chart is non-critical) |
| Email flows bị bridge về legacy (C5) | MEDIUM | Investigate trước, port nếu cần |
| Telegram notifications user impact | LOW | Return 200 với not_available message — user thấy tính năng "đang cập nhật" |

---

## 6. VALIDATION COMMAND CHÍNH

Chạy sau mỗi slice để xác nhận không còn dependency về legacy:

```powershell
# Check không còn bridge calls trong code
grep -rn "legacy_bridge_response\|LegacyBridgeView" packages/core/backend/src/ --include="*.py"

# Check không còn LEGACY_BACKEND_URL usage
grep -rn "LEGACY_BACKEND_URL" packages/core/ --include="*.py"

# Check smoke test sau khi dừng backend container
docker compose -f docker-compose.dev.yml stop backend backend-worker backend-beat
Start-Sleep 5
# Run curl tests...
docker compose -f docker-compose.dev.yml start backend backend-worker backend-beat  # Restore sau test
```

---

## 7. COMMIT SEQUENCE

```
C1: feat(C1): schedule native price board ingest in core-beat
C2: feat(C2): realtime native views — no bridge dependency  
C3: feat(C3): stock management native views — no bridge dependency
C4: feat(C4): portfolio analytics native — replace all stubs
C5: feat(C5): auth email flows verified native
C6: feat(C6): remove all remaining bridge calls
C7.1: test(C7): staging smoke test — all pass, legacy stop confirmed
C7.2: feat(C7): decommission legacy — remove backend services and bridge code
```

---

## 8. GÒ BÓ BẮT BUỘC (từ AGENTS.md)

1. Không ghi vào legacy DB từ core containers — tất cả native views chỉ đọc từ core DB
2. PAT hash HMAC+pepper — không thay đổi auth layer
3. WebSocket symbol phải sanitize trước khi dùng làm Redis channel key (đã có trong `MarketTickerConsumer`)
4. `LEGACY_BACKEND_URL` phải là env var — không hardcode (đã đúng trong settings.py)
5. Proxy route (`LegacyBridgeView`) phải xóa hoàn toàn trước C7 decommission

---

**Chờ xác nhận để bắt đầu C1.**
