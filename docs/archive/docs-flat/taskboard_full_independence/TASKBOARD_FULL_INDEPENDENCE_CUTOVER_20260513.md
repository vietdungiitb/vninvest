# TASKBOARD — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Convention**: `[ ]` = chưa làm | `[~]` = đang làm | `[x]` = done | `[!]` = blocked  

---

## Slice C1 — Kích hoạt ingest trong core-beat (est. 0.5h)

**Owner**: Backend Dev | **Queue**: thực hiện trước tiên — unblocks C2

### Tasks

- [ ] **C1.1** — Thêm `'ingest-price-board-60s'` vào `CELERY_BEAT_SCHEDULE` trong `settings.py`
  - File: `packages/core/backend/src/vninvest_core/settings.py`
  - Dòng thêm vào block `CELERY_BEAT_SCHEDULE`
  - Spec: `TECH_SPEC §1.2`
- [ ] **C1.2** — Rebuild core-beat container
  - Command: `docker compose -f docker-compose.dev.yml up -d --build core-beat`
- [ ] **C1.3** — Validate SymbolSnapshot được update
  - Command: Django shell — `(now()-SymbolSnapshot.objects.order_by('-fetched_at').first().fetched_at).seconds < 90`
  - Expected: `True`
- [ ] **C1.4** — Ghi evidence `docs/evidence/CUT-C1-EVIDENCE-20260513.md`

**DoD**:
- `'ingest-price-board-60s'` có trong `settings.CELERY_BEAT_SCHEDULE`
- `SymbolSnapshot.updated_at` fresh < 90s sau restart core-beat
- Evidence file tồn tại

---

## Slice C2 — 9 realtime bridge routes → native (est. 4h)

**Owner**: Backend Dev | **Blocked by**: C1

### Tasks

- [ ] **C2.1** — Tạo `RealtimeTickerView` trong `market_serving/views.py` (hoặc `market_serving/native_views.py`)
  - Data source: `SymbolSnapshot`
  - Spec: `TECH_SPEC §2.2 C2-V1`
- [ ] **C2.2** — Tạo `RealtimeTickerListView`
  - Spec: `TECH_SPEC §2.2 C2-V2`
  - Query param: `?symbols=VCB,HPG`
- [ ] **C2.3** — Tạo `RealtimeIntradayView`
  - Check: `IntradayBar` model có tồn tại không? Nếu không → return `{'bars': [], 'stale': True}`
  - Spec: `TECH_SPEC §2.2 C2-V3`
- [ ] **C2.4** — Tạo `RealtimePriceBoardView`
  - Data source: `SymbolSnapshot`
  - Spec: `TECH_SPEC §2.2 C2-V4`
- [ ] **C2.5** — Tạo `RealtimeBreadthView`
  - Aggregate: count advancing/declining từ SymbolSnapshot
  - Spec: `TECH_SPEC §2.2 C2-V5`
- [ ] **C2.6** — Tạo `RealtimeWhaleFeedView`
  - Data source: `UnifiedAlert` (đã native)
  - Spec: `TECH_SPEC §2.2 C2-V6`
- [ ] **C2.7** — Tạo `RealtimeSymbolInvestigationView`
  - Kết hợp `StockProfile` + `SymbolSnapshot`
  - Spec: `TECH_SPEC §2.2 C2-V7`
- [ ] **C2.8** — Tạo `RealtimeRvolView`
  - RVOL = today_vol / avg_20d_vol từ `DailyPrice`
  - Spec: `TECH_SPEC §2.2 C2-V8`
- [ ] **C2.9** — Tạo `RealtimeDepthChartView`
  - Nếu không có order book native → return `{'bids': [], 'asks': []}`
  - Spec: `TECH_SPEC §2.2 C2-V9`
- [ ] **C2.10** — Cập nhật `market_serving/api_urls.py`: thay 9 `RealtimeLegacyBridgeView` → native views
  - Spec: `TECH_SPEC §2.3`
  - Constraint: giữ nguyên 3 routes đã native (unified-alerts, whale-feed-aggregate, whale-campaigns)
- [ ] **C2.11** — Stop backend container, curl test 9 routes → tất cả 200
  - `docker compose -f docker-compose.dev.yml stop backend`
  - curl mỗi route — không được có 502
- [ ] **C2.12** — Start backend lại (chưa decommission ở bước này)
  - `docker compose -f docker-compose.dev.yml start backend`
- [ ] **C2.13** — Ghi evidence `docs/evidence/CUT-C2-EVIDENCE-20260513.md`

**DoD**:
- 9 routes đều trả 200 khi `backend` container bị stop
- Không còn `RealtimeLegacyBridgeView` trong `api_urls.py`
- Evidence file có curl output cho cả 9 routes

---

## Slice C3 — 11 stock-management bridge routes → native (est. 6h)

**Owner**: Backend Dev | **Blocked by**: C2 (can parallel)

### Tasks

- [ ] **C3.1** — Tạo `StockManagementTechnicalsView` trong `market_data/views.py`
  - `GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG`
  - Spec: `TECH_SPEC §3.2 C3-V1`
- [ ] **C3.2** — Tạo `StockManagementDetailView` (delegate → `StockProfileDetailView`)
  - Spec: `TECH_SPEC §3.2 C3-V2`
- [ ] **C3.3** — Tạo `StockManagementOverviewView`
  - Kết hợp `StockProfile` + `SymbolSnapshot`
  - Spec: `TECH_SPEC §3.2 C3-V3`
- [ ] **C3.4** — Tạo `StockManagementChartView` (delegate → `DailyPriceListView`)
  - Spec: `TECH_SPEC §3.2 C3-V4`
- [ ] **C3.5** — Tạo `StockManagementOrderFlowView`
  - Data source: `UnifiedAlert`
  - Spec: `TECH_SPEC §3.2 C3-V5`
- [ ] **C3.6** — Tạo `StockManagementNewsView` (graceful: empty list)
  - Spec: `TECH_SPEC §3.2 C3-V6`
- [ ] **C3.7** — Tạo `StockManagementNewsAISummaryView` (graceful: null summary)
  - Spec: `TECH_SPEC §3.2 C3-V7`
- [ ] **C3.8** — Wire AI advisory session route → `AdvisoryLatestView`
  - Kiểm tra xem `/api/stock-management/stocks/<symbol>/ai-advisory-session/` đã wire chưa
  - Spec: `TECH_SPEC §3.2 C3-V8`
- [ ] **C3.9** — Wire `ai-advisory-observability` route
  - Check advisory/views.py có ObservabilityView không; nếu không → graceful stub
- [ ] **C3.10** — Wire `ai-advisory-components/generate/` route → advisory generate
- [ ] **C3.11** — Wire `ai-advisory-summary/regenerate/` route → advisory refresh
- [ ] **C3.12** — Cập nhật `market_data/public_urls.py`: thay 11 `StockManagementLegacyBridgeView` → native
  - Spec: `TECH_SPEC §3.3`
- [ ] **C3.13** — Stop backend container, curl test 11 routes → tất cả 200 (hoặc graceful)
- [ ] **C3.14** — Start backend lại
- [ ] **C3.15** — Ghi evidence `docs/evidence/CUT-C3-EVIDENCE-20260513.md`

**DoD**:
- 11 routes đều trả 200 khi `backend` container bị stop
- Không còn `StockManagementLegacyBridgeView` trong `public_urls.py`
- Evidence file có curl output

---

## Slice C4 — Portfolio analytics native computation (est. 4h)

**Owner**: Backend Dev 2 | **Blocked by**: C3

### Tasks

- [ ] **C4.1** — Tạo `PortfolioHoldingsView` trong `user_workspace/views.py`
  - Compute từ `Transaction` aggregation + `SymbolSnapshot` prices
  - Fields: `symbol`, `quantity`, `avg_cost`, `current_price`, `market_value`, `unrealized_pnl`, `unrealized_pnl_pct`
  - Spec: `TECH_SPEC §4.2 C4-V1`
- [ ] **C4.2** — Tạo `PortfolioSummaryView`
  - Tổng hợp từ holdings: total_value, total_pnl, total_pnl_pct
  - Spec: `TECH_SPEC §4.2 C4-V2`
- [ ] **C4.3** — Tạo `PortfolioEquityCurveView`
  - Daily equity curve từ `Transaction` + `DailyPrice`
  - Spec: `TECH_SPEC §4.2 C4-V3`
- [ ] **C4.4** — Tạo `PortfolioAllocationView` (pie chart data)
  - Percent allocation từ holdings
  - Trả `[{'symbol': 'VCB', 'weight': 0.35}, ...]`
- [ ] **C4.5** — Tạo `PortfolioTechnicalsView` (technicals for holdings)
  - Fetch `StockManagementTechnicalsView` data cho symbols trong holdings
- [ ] **C4.6** — Cập nhật URL wiring trong `user_workspace/urls.py`
  - Replace `PortfolioAnalyticsStubView` với real views
- [ ] **C4.7** — Validate: curl holdings → non-empty (cần ít nhất 1 transaction trong dev DB)
  - Nếu dev DB trống: seed 1 transaction trước để test
- [ ] **C4.8** — Stop backend, curl holdings → vẫn 200 với data (không phải empty stub)
- [ ] **C4.9** — Start backend lại
- [ ] **C4.10** — Ghi evidence `docs/evidence/CUT-C4-EVIDENCE-20260513.md`

**DoD**:
- `/api/portfolio/holdings/` trả non-empty array (với data seed trong dev)
- `unrealized_pnl` tính đúng công thức: `(current_price - avg_cost) * net_qty`
- Khi backend stopped → vẫn 200

---

## Slice C5 — Auth email verify native (est. 1h)

**Owner**: Backend Dev | **Can parallel với C4**

### Tasks

- [ ] **C5.1** — Kiểm tra `EmailVerificationToken` model có trong `identity_access/models.py` không
  - Nếu không có: tạo model với fields `user`, `token` (UUID), `created_at`, `expires_at`, `used`
  - Chạy migration: `python manage.py makemigrations identity_access && python manage.py migrate`
- [ ] **C5.2** — Tạo `VerifyEmailView` trong `identity_access/views_auth.py`
  - Spec: `TECH_SPEC §5.2`
- [ ] **C5.3** — Wire URL: `POST /api/auth/verify/` → `VerifyEmailView`
  - File: `identity_access/compat_urls.py` hoặc `urls_auth.py`
- [ ] **C5.4** — Test: `POST /api/auth/verify/` với invalid token → 400; với valid token → 200
- [ ] **C5.5** — Ghi evidence `docs/evidence/CUT-C5-EVIDENCE-20260513.md`

**DoD**:
- `POST /api/auth/verify/` → 200 (không 502)
- Invalid token → 400 `invalid_or_expired_token`

---

## Slice C6 — Misc graceful stubs (est. 2h)

**Owner**: Backend Dev | **Can parallel với C4+C5**

### Tasks

- [ ] **C6.1** — Tạo `SubAccountListView` trả `[]` (INV-06)
  - File: `user_workspace/views.py` hoặc `legacy_views.py`
  - Spec: `TECH_SPEC §6.1`
- [ ] **C6.2** — Wire URL: `GET /api/account/sub-accounts/` → `SubAccountListView`
- [ ] **C6.3** — Tạo `TelegramStatusView` trả `{"status": "not_available"}` (INV-07)
  - Spec: `TECH_SPEC §6.2`
- [ ] **C6.4** — Wire URL: `GET /api/telegram/status/` → `TelegramStatusView`
- [ ] **C6.5** — Watchlist: trigger `sync_market_groups.apply_async` khi add symbol
  - File: watchlist create view trong `user_workspace`
  - Spec: `TECH_SPEC §6.3`
- [ ] **C6.6** — Test: curl `/api/account/sub-accounts/` → `[]`; `/api/telegram/status/` → `{"status":"not_available"}`
- [ ] **C6.7** — Ghi evidence `docs/evidence/CUT-C6-EVIDENCE-20260513.md`

**DoD**:
- SubAccount → `[]` HTTP 200
- Telegram → `{"status": "not_available"}` HTTP 200

---

## Slice C7 — Decommission legacy containers (est. 2h)

**Owner**: Tech Lead + DevOps | **Blocked by**: C1+C2+C3+C4+C5+C6 ALL DONE

### Pre-decommission gates (phải PASS hết — xem `TECH_SPEC §7.1`)

- [ ] **Gate A** — `grep -rn "legacy_bridge_response" packages/core/backend/src/market_serving/` → 0 results
- [ ] **Gate B** — `grep -rn "legacy_bridge_response" packages/core/backend/src/market_data/` → 0 results
- [ ] **Gate C** — `grep -n "LegacyBridge" packages/core/backend/src/market_serving/api_urls.py` → 0 results
- [ ] **Gate D** — `grep -n "LegacyBridge" packages/core/backend/src/market_data/public_urls.py` → 0 results
- [ ] **Gate E** — Evidence files tồn tại: `CUT-C1` đến `CUT-C6`
- [ ] **Gate F** — `SymbolSnapshot` fresh < 90s
- [ ] **Gate G** — Smoke test với backend STOPPED (xem bên dưới)

### Tasks

- [ ] **C7.1** — Stop backend container: `docker compose -f docker-compose.dev.yml stop backend backend-worker`
- [ ] **C7.2** — Smoke test toàn bộ (15 phút):
  - Curl tất cả 20 routes (9 C2 + 11 C3 + 4 C4 + C5 + C6 stubs)
  - Không có 502 hoặc 500
  - Ghi kết quả vào evidence
- [ ] **C7.3** — Xóa bridge code:
  - `Remove-Item packages/core/backend/src/vninvest_core/legacy_http_bridge.py`
  - Verify: `grep -rn "legacy_http_bridge" packages/core/backend/src/` → 0 (ngoài .pyc)
  - Xóa `RealtimeLegacyBridgeView` class từ `market_serving/legacy_views.py` nếu không còn dùng
  - Xóa `StockManagementLegacyBridgeView` class từ `user_workspace/legacy_views.py`
- [ ] **C7.4** — Comment out / remove `backend` và `backend-worker` services từ `docker-compose.dev.yml`
  - Thêm comment: `# DECOMMISSIONED at C7 — 2026-05-13`
- [ ] **C7.5** — Comment out / remove từ `docker-compose.prod.yml` tương tự
- [ ] **C7.6** — Rebuild và restart stack: `docker compose -f docker-compose.dev.yml up -d --build`
- [ ] **C7.7** — Final smoke test sau rebuild (5 phút):
  - `docker ps` → không có container tên `backend` hay `backend-worker`
  - Curl 5 critical routes → tất cả 200
- [ ] **C7.8** — Tech Lead sign-off
- [ ] **C7.9** — Cập nhật `PROGRESS_DASHBOARD.md` và `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- [ ] **C7.10** — Ghi evidence `docs/evidence/CUT-C7-EVIDENCE-20260513.md`

**DoD**:
- `docker ps` → 0 kết quả chứa `backend`
- `grep -rn "legacy_bridge_response" packages/core/backend/src/` → 0 results
- `legacy_http_bridge.py` không còn trong repo
- 5 critical routes → 200 sau khi legacy gone
- Tech Lead đã sign-off

---

## Tổng tiến độ

| Slice | Trạng thái | Evidence | Ghi chú |
|-------|-----------|---------|---------|
| C1 | `[ ]` | — | |
| C2 | `[ ]` | — | |
| C3 | `[ ]` | — | |
| C4 | `[ ]` | — | |
| C5 | `[ ]` | — | |
| C6 | `[ ]` | — | |
| C7 | `[ ]` | — | Chờ C1–C6 |

**Estimate tổng**: ~19.5h ≈ 3 ngày dev  
**Critical path**: C1 → C2 → C3 → C4 → C7  
**Parallel**: C5 và C6 có thể làm song song với C4
