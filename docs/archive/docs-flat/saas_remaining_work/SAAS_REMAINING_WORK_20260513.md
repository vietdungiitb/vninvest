# VIỆC CÒN LẠI THỰC TẾ — SaaS Migration VNInvest

**Ngày**: 2026-05-13  
**Nguồn**: Scan code trực tiếp, không dựa vào tài liệu cũ  
**Phạm vi**: Chỉ những việc THỰC SỰ chưa làm hoặc là stub

---

## MỤC LỤC NHANH

| Priority | Item | Severity | Ảnh hưởng user |
|---|---|---|---|
| P0 | Portfolio Analytics (6 endpoints) | CRITICAL | Màn hình portfolio trắng |
| P0 | Tách core DB | HIGH | Prerequisite tắt legacy |
| P1 | SubAccount migration/drop | HIGH | Feature không hoạt động |
| P1 | Stock Management → Core | HIGH | Chart/news/order-flow |
| P1 | AI Advisory wire frontend → core | MEDIUM | Advisory từ core không hiển thị |
| P2 | Screener trong core | MEDIUM | Screener trống |
| P2 | Ingest worker migration | HIGH | Data dừng nếu legacy tắt |
| P2 | Telegram notifications | LOW | Telegram linking broken |
| P3 | WebSocket consumer verification | MEDIUM | Real-time feeds |
| P3 | CORE_PAT_PEPPER production rotation | HIGH (security) | Auth risk |

---

## P0 — CRITICAL (Làm trước mọi thứ)

### P0-1: Portfolio Analytics — 6 Endpoints Là Stub

**Vị trí stub**: `packages/core/backend/src/user_workspace/legacy_views.py:239-270`  
**URLs stub**: `packages/core/backend/src/user_workspace/urls.py:63-74`

```python
# Đây là stub hiện tại — trả empty với HTTP 200
class PortfolioAnalyticsStubView(APIView):
    def get(self, request, portfolio_id):
        return Response({'data': None, 'status': 'stub'}, status=200)
```

**6 endpoints bị ảnh hưởng**:
1. `GET /api/portfolio/portfolios/{id}/holdings/`
2. `GET /api/portfolio/portfolios/{id}/summary/`
3. `GET /api/portfolio/portfolios/{id}/chart/`
4. `GET /api/portfolio/portfolios/{id}/equity-curve/`
5. `GET /api/portfolio/portfolios/{id}/allocation/`
6. `GET /api/portfolio/portfolios/{id}/analytics/`

**Legacy equivalent**: `backend/portfolio/views.py` — `HoldingsView`, `SummaryView`, `ChartDataView`, `EquityCurveView`, `AllocationView`, `PortfolioAnalyticsView`

**Việc cần làm để fix**:
1. Đọc logic trong legacy views (holdings = join transactions + current prices)
2. Port logic vào `user_workspace/portfolio_analytics.py` hoặc tương tự
3. Viết real views, thay thế stub
4. Test parity vs legacy (mỗi portfolio, kết quả phải giống hệt)

**Độ phức tạp**: HIGH — cần price data, Pandas P&L calculation, current prices  
**Prerequisite**: Core cần đọc được `portfolio_tickersessionclose` và `portfolio_transaction` (đã có access vì same DB)

---

### P0-2: Tách Core Database

**Vấn đề hiện tại**:
```yaml
# docker-compose.dev.yml:66
CORE_DATABASE_URL: postgres://postgres:devpassword@db:5432/vninvest
# SAME database as legacy backend
```

**Tại sao quan trọng**:
- Khi tắt legacy, không có cách nào chắc chắn core không bị ảnh hưởng bởi legacy schema changes
- Materializers đọc từ legacy tables — nếu legacy migrate/rename table, materializers break
- Không thể track "core data" vs "legacy data" dễ dàng

**Việc cần làm**:
1. Tạo PostgreSQL database `vninvest_core` (hoặc dùng schema separation)
2. Viết data migration để copy user portfolios, transactions, watchlists từ `vninvest` → `vninvest_core`
3. Update `CORE_DATABASE_URL` trong compose
4. Cập nhật materializers để đọc từ legacy DB qua `using='legacy'` router (hoặc raw LEGACY_DATABASE_URL)
5. Test parity sau migration

**Độ phức tạp**: VERY HIGH — schema migration, data sync, router setup  
**Có thể defer**: Đến sau P0-1 nếu vẫn dùng hybrid mode

---

## P1 — HIGH (Làm trước khi deprecate legacy)

### P1-1: SubAccount — Quyết Định Migrate Hay Drop

**Tình trạng**:
- Legacy có: `backend/portfolio/models.py` — `SubAccount` model với `broker_account_id`, `account_type`
- Core có: `user_workspace/models.py` — **Không có SubAccount**
- Core trả về: `GenericEmptyListView` (empty list `[]`) cho `/portfolio/subaccounts/`
- Frontend gọi: `GET /portfolio/subaccounts/` trong client.js

**Hai lựa chọn**:

**Option A — Migrate**: Thêm `SubAccount` vào `user_workspace/models.py`
```python
class SubAccount(models.Model):
    portfolio = models.ForeignKey(Portfolio, ...)
    broker_account_id = models.CharField(...)
    account_type = models.CharField(...)  # MARGIN, NORMAL, etc.
```
Viết CRUD views, migrate data từ legacy, update frontend.

**Option B — Drop**: SubAccount là legacy concept từ khi dùng broker API. Nếu không có broker integration trong core, có thể drop hẳn. Frontend sẽ cần refactor UI.

**Khuyến nghị**: Hỏi product owner — feature này có được dùng nhiều không?

---

### P1-2: Stock Management Surface → Core

**Các endpoints vẫn qua bridge về legacy**:
```
GET /stock-management/stocks/{symbol}/              → legacy StockProfileView
GET /stock-management/stocks/{symbol}/chart/        → legacy ChartDataView  
GET /stock-management/stocks/{symbol}/order-flow/   → legacy OrderFlowView
GET /stock-management/stocks/{symbol}/news/         → legacy NewsView
GET /stock-management/stocks/{symbol}/ai-advisory-session/ → legacy AdvisoryView
GET /stock-management/stocks/{symbol}/overview/     → legacy OverviewView
```

**Core đã có**:
- `market_data/views.py` — intraday bars, tick data ✅
- `signal_intelligence/views.py` — order-flow signal ✅
- `advisory/views.py` — latest, refresh, history ✅
- `market_serving/views.py` — symbol snapshot ✅

**Việc cần làm**:
1. Thêm `StockProfileView` vào core (hoặc dùng materializer)
2. Thêm `StockNewsView` vào core (vnbroker news call)
3. Thêm `StockOverviewView` vào core
4. Wire frontend `client.js` routes từ legacy paths → core paths
5. Verify parity cho từng endpoint

---

### P1-3: AI Advisory Frontend Wire

**Tình trạng**:
- Core đã có: `GET /core/v1/advisory/latest/{symbol}/`
- Frontend vẫn gọi: `GET /stock-management/stocks/{symbol}/ai-advisory-session/`

**Fix đơn giản nhất**: Cập nhật `client.js` để gọi `/core/v1/advisory/latest/{symbol}/` thay vì legacy path.

**Cần verify**: Response format giống hệt không? Core advisory response phải match frontend expectation.

**File cần sửa**: `frontend/src/api/client.js` — function gọi advisory  
**Không cần backend code** — chỉ là frontend routing switch

---

## P2 — MEDIUM (Cần làm trước khi core được dùng production)

### P2-1: Screener — Không Có Core Implementation

**Tình trạng hiện tại**:
- Legacy screener: đầy đủ (`ScreenerRuleListCreateView`, `ScreenerRuleRunView`, etc.)
- Core: chỉ có stub `GenericEmptyListView` trả empty list

**Việc cần làm** (nếu muốn giữ screener):
1. Tạo `packages/core/backend/src/screener/` domain
2. Port `ScreenerRule` model và logic từ legacy
3. Implement rule evaluation engine (Python/Pandas filters)
4. Mount vào `vninvest_core/urls.py`

**Nếu muốn drop**: Frontend screener tab sẽ luôn trống — chấp nhận được nếu feature ít dùng.

**Khuyến nghị**: Phân tích usage log trước khi đầu tư implement.

---

### P2-2: Data Ingest Migration

**Tình trạng**:
- Legacy `backend-worker` làm: `schedule_realtime_prefetch_shards`, `offpeak_vnbroker_ingest`
- Core materializers **đọc từ** legacy tables — nhưng ai **ghi vào** legacy tables?
- Nếu tắt `backend-worker`, không có dữ liệu mới → materializers → core feeds trống

**Dependency chain**:
```
vnbroker API 
    → backend-worker (Celery task)
    → portfolio_tickersessionclose (legacy table)
    → core materialize_symbol_snapshot (reads from legacy table)
    → market_serving_symbolsnapshot (core table)
    → Frontend nhận data
```

**Việc cần làm để tắt legacy worker**:
1. Port `schedule_realtime_prefetch_shards` sang core-worker
2. Port `offpeak_vnbroker_ingest` sang core-worker  
3. Core worker ghi vào core tables trực tiếp
4. Materializers đọc từ core tables thay vì legacy tables
5. Test: data flow hoạt động end-to-end

---

### P2-3: Telegram Notifications

**Tình trạng**: Hoàn toàn trong legacy, không có core equivalent.

**Frontend gọi**:
- `POST /portfolio/notifications/telegram/link/`
- `POST /portfolio/notifications/telegram/unlink/`
- `GET /portfolio/notifications/telegram/status/`
- `PUT /portfolio/notifications/telegram/settings/`

**Lựa chọn**:
- **Migrate**: Port Telegram bot integration vào core `notification` domain
- **Keep in legacy bridge**: Hoạt động qua proxy khi legacy vẫn chạy
- **Drop**: Nếu ít user dùng

---

## P3 — LOWER PRIORITY (Stability & Production Readiness)

### P3-1: WebSocket Consumer Verification

**Tình trạng**:
- Django Channels đã cài: `settings.py:INSTALLED_APPS` chứa `channels`
- `SFI-B7` tag đã làm: compose có `core-worker-realtime-stream`
- **Chưa verify**: Consumer files tồn tại không? Routing trong `asgi.py` có websocket protocol không?

**Cần kiểm tra**:
```bash
grep -r "WebsocketConsumer\|AsyncWebsocketConsumer" packages/core/backend/src/
# Check if asgi.py routes websocket
cat packages/core/backend/src/vninvest_core/asgi.py
```

**Rủi ro**: Nếu consumer không tồn tại, realtime feeds sẽ không hoạt động sau khi tắt legacy WebSocket.

---

### P3-2: CORE_PAT_PEPPER Production Rotation

**Tình trạng**:
```
compose.dev.env:13:
CORE_PAT_PEPPER=dev-pat-pepper-replace-in-production
```

**Rủi ro**: Nếu production compose dùng value này → PAT tokens có thể bị forge bởi attacker biết value.

**Fix**: Set `CORE_PAT_PEPPER` = random 32-byte hex string trong production secrets manager.

**QUAN TRỌNG**: Sau khi rotate pepper → TẤT CẢ PAT tokens hiện tại **sẽ invalid**. Users phải re-issue PATs. Plan communication trước.

---

### P3-3: Legacy /api/auth/token/refresh/

**Tình trạng**: Mặc dù JWT đã removed, frontend vẫn có reference tới `/api/auth/token/refresh/`.

**Cần verify**: Frontend có thực sự gọi endpoint này không? Nếu JWT removed thì endpoint 404. PAT không cần refresh.

---

## SUMMARY TABLE — THỨ TỰ LÀM

| Bước | Tên | Effort | Impact | Prerequisite |
|---|---|---|---|---|
| 1 | Portfolio Analytics (P0-1) | 2 tuần | CRITICAL | None |
| 2 | AI Advisory wire frontend (P1-3) | 2 ngày | HIGH | None |
| 3 | WebSocket verify (P3-1) | 1 ngày | MEDIUM | None |
| 4 | PAT pepper rotation (P3-2) | 0.5 ngày | HIGH | Plan user comms |
| 5 | SubAccount decision (P1-1) | 0 hoặc 2 tuần | HIGH | Product decision |
| 6 | Ingest migration (P2-2) | 2 tuần | HIGH | Core DB setup |
| 7 | Core DB separation (P0-2) | 1 tuần | HIGH | #6 |
| 8 | Stock Management → Core (P1-2) | 3 tuần | HIGH | #6, #7 |
| 9 | Screener in core (P2-1) | 1 tuần | MEDIUM | #7 |
| 10 | Telegram in core (P2-3) | 1 tuần | LOW | Product decision |
| 11 | Tắt legacy backend | — | — | Tất cả trên PASS |
