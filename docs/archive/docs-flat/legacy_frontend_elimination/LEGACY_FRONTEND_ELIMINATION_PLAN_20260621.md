# Kế hoạch loại bỏ Legacy Frontend — Chuyển hoàn toàn sang SaaS Native

**Ngày:** 2026-06-21  
**Mục tiêu:** Xoá thư mục `frontend/` legacy, chỉ dùng `packages/web/` làm frontend duy nhất.

---

## 1. Hiện trạng: Tại sao `frontend/` vẫn tồn tại

### 1.1 6 rào cản chính

| # | Rào cản | Mô tả |
|---|---------|-------|
| 1 | **Docker build host** | `docker-compose.dev.yml` dùng `frontend/Dockerfile.dev-package-shell`. `packages/web/Dockerfile` **không bao giờ được dùng** trong bất kỳ compose file nào. |
| 2 | **Router + Layout + Context** | `frontend/App.jsx` là nơi định nghĩa tất cả routes, layout (sidebar + topnav), context providers (auth, ngôn ngữ, realtime). `packages/web` không có hệ thống providers tương đương. |
| 3 | **~20 pages chưa có trong packages/web** | Admin Core (9 pages), SOCPage, Screener, Whale Advisory, AI Command Center, Upgrade, Tenant SSO, Crawl Control — chỉ tồn tại ở legacy. |
| 4 | **API client thiếu ~30+ endpoints** | `frontend/src/api/client.js` có ~50+ hàm gọi API. `coreApiAdapter` trong packages/web chưa có screener, crawl, realtime ticker, advisory ops, v.v. |
| 5 | **VNStockCharts dependency** | KLine chart engine được clone & build trong `frontend/Dockerfile.dev-package-shell`. packages/web chưa có cơ chế build chart engine riêng. |
| 6 | **Realtime WebSocket infrastructure** | Legacy có `RealtimeProvider` quản lý WebSocket đến `/ws/realtime/` cho live price, dashboard metrics, whale alerts push. `packages/web` **đã có** `useRealtimeFeedCore.js` với đầy đủ reconnect, backoff, heartbeat, auth token refresh — nhưng chưa được cấu hình đúng biến môi trường Vite (`VITE_WS_BASE_URL`) và chưa được kiểm thử E2E. |

### 1.2 Kiến trúc build hiện tại

```
frontend/Dockerfile.dev-package-shell (DEFAULT BUILD — dùng trong compose)
  ├── B1: Clone VNStockCharts từ GitHub
  ├── B2: npm ci + build KLine engine (@vnstockcharts/*)
  ├── B3: COPY packages/web/ → node_modules/@vninvest/web (npm local package)
  ├── B4: npm ci frontend deps + @vninvest/web
  ├── B5: react-scripts build → production bundle
  └── B6: nginx serve (frontend/docker/nginx.conf — API gateway)
```

### 1.3 Nghịch lý

**`packages/web/` là SaaS native nhưng được đóng gói như một thư viện npm nội bộ (`@vninvest/web`) bên trong legacy frontend build.**  
Không thể xoá `frontend/` khi nó vẫn là build host duy nhất.

### 1.4 Vấn đề kỹ thuật nhỏ cần xử lý

| # | Vấn đề | Mức | Ghi chú |
|---|--------|-----|---------|
| 1 | `packages/web/Dockerfile` build context là `.` — sẽ copy toàn bộ monorepo vào image | Thấp | Cần `.dockerignore` hoặc context = `packages/web/` |
| 2 | Legacy nginx có `Docker DNS resolver` (`127.0.0.11`) — packages/web nginx cần kiểm tra | ✅ Pre-resolved | Đã có trong `packages/web/docker/nginx.conf` |
| 3 | Rate limiting zone `api_limit_zone` define trong legacy nginx — packages/web nginx chưa có | ✅ Pre-resolved | Đã có trong `packages/web/docker/nginx.conf` |
| 4 | `packages/web/src/main.js` hiện tại import `pageRegistry` và thiết lập routing — cần audit trước khi viết App.jsx mới | Trung bình | Không đè lên routing hiện tại |
| 5 | Legacy có 2 Dockerfiles: `Dockerfile` (CRA-only) và `Dockerfile.dev-package-shell` (có packages/web) | Thấp | `Dockerfile` cũng sẽ bị xoá |
| 6 | Tên miền `vninvest.edusuccess.vn` cần xác nhận đang trỏ vào legacy image nào | Thấp | Ảnh hưởng rollback plan |

---

## 2. So sánh Feature Parity

### 2.1 Pages

| Route | Legacy `frontend/` | SaaS `packages/web/` | Ghi chú |
|-------|-------------------|---------------------|---------|
| `/login` | — (dùng @vninvest/web) | `AuthLoginPage.js` | ✅ Đã migrate |
| `/register` | — | `AuthRegisterPage.js` | ✅ |
| `/verify-email` | — | `AuthVerifyEmailPage.js` | ✅ |
| `/reset-password` | — | `AuthResetPasswordPage.js` | ✅ |
| `/dashboard` | `PackageDashboardHost.jsx` (wraps packages/web) | `DashboardPage.js` | ⚠️ Cần shell host |
| `/alert-center` | — | `AlertCenterPage.js` | ✅ |
| `/ai-advisory` | `WhaleAdvisory.jsx` | `ShellAiAdvisoryPage.js` (debug) | ❌ Chưa có page thật |
| `/whale-alerts` | — (dùng @vninvest/web) | `WhaleAlertsPage.js` | ✅ |
| `/stocks/:symbol` | `StockDetailPageHost.jsx` (wraps packages/web) | `ShellStockDetailPage.js` | ⚠️ Cần shell host |
| `/portfolios` | `PortfoliosShellHost.jsx` (wraps packages/web) | `PortfoliosPage.js` | ⚠️ |
| `/transactions` | `TransactionsShellHost.jsx` | `TransactionsPage.js` | ⚠️ |
| `/watchlist` | `WatchlistShellHost.jsx` | `WatchlistPage.js` | ⚠️ |
| `/support` | `SupportShellHost.jsx` | `SupportPage.js` | ⚠️ |
| `/settings` | `SettingsShellHost.jsx` | `ShellSettingsPage.js` | ⚠️ |
| `/settings/ai` | `AICommandCenter.jsx` | `AICommandCenterPage.js` | ❌ Page có nhưng chưa wired |
| `/operations-center` | `SOCPage.jsx` | `ShellOperationsCenterPage.js` (debug) | ❌ Chưa có page thật |
| `/screener` | `Screener.jsx` (414 dòng) | — | ❌ **Chưa có** |
| `/upgrade` | `Upgrade.jsx` | — | ❌ **Chưa có** |
| `/admin/core/*` (9 routes) | `AdminCore*.jsx` | — | ❌ **Chưa có** |
| `/admin-crawl-control` | `AdminCrawlControl.jsx` | — | ❌ **Chưa có** |
| `/tenant-admin/*` (8 routes) | `TenantAdmin*.jsx` | `TenantAdmin*.js` | ⚠️ Cả 2 đều có, legacy đang dùng |
| `/commercial/billing` | — | `BillingCenterPage.js` | ✅ |
| `/commercial/payment-return` | — | `PaymentReturnPage.js` | ✅ |

### 2.2 API Endpoints (thiếu trong coreApiAdapter)

| Nhóm | Số lượng | Endpoints |
|------|----------|-----------|
| **Screener** | 9 | rules CRUD, run, admin CRUD, bulk operations |
| **Realtime** | 7 | ticker, price-board, breadth, whale-feed, campaigns, investigation, RVOL |
| **Advisory** | 5 | advisories, canonical, refresh, auto-refresh-info, symbol-stats |
| **Crawl control** | 6 | jobs list, run, stop, runs, audit |
| **DNSE credential** | 3 | CRUD |
| **Backfill** | 2 | system trigger, user trigger |
| **Operator** | 5 | overview, health, tenants, audit-log |
| **Market** | 2 | discovery hub, depth chart |
| **Khác** | 3 | legal pages, health checks, AI CC audit logs |

> **Ghi chú WebSocket:** Ngoài REST endpoints, legacy có `RealtimeProvider` kết nối WebSocket đến `/ws/realtime/` cho live push data. Đây không phải REST API nhưng là infrastructure quan trọng cần được xây dựng lại trong packages/web (xem Bước 2a).

---

## 3. Giải pháp: Lộ trình 7 bước (đã sửa theo critique)

### Bước 0 — Foundation: Chuẩn hóa shared infrastructure

**Mục tiêu:** Đảm bảo legacy và packages/web dùng chung cơ chế auth, i18n, và token storage trước khi bắt đầu migration.

**Công việc:**
- Audit và chuẩn hóa token storage giữa legacy (`client.js` Axios interceptor) và `coreApiAdapter` (`fetch()` native)
  - Xác định key lưu token (localStorage / cookie / memory) chung
  - Đảm bảo 2 hệ thống không mất đồng bộ session trong thời gian chuyển tiếp
- Audit i18n keys: so sánh `frontend/src/i18n/vi.js` vs `packages/web/src/i18n/vi.js`
  - Tạo 1 bản đồ key SSOT
  - Bổ sung keys thiếu
  - Không cho migration page nào nếu i18n keys chưa đầy đủ
- Xác nhận legacy test files có thể archive (không xoá, đánh dấu deprecated)

**Rủi ro:** Thấp — audit và chuẩn hóa, không chạm code production.  
**Thời gian:** 1 ngày.  
**Kiểm tra:** Token storage đồng nhất, i18n coverage report.

---

### Bước 1 — Di dời API client vào coreApiAdapter

**Mục tiêu:** packages/web không còn phụ thuộc legacy `client.js` cho bất kỳ API call nào.

**Công việc:**
- Thêm ~30+ hàm vào `packages/web/src/adapters/core/`:
  - `screener.js` — 9 functions (rules CRUD, run, admin)
  - `market-realtime.js` — ticker, price-board, breadth, whale-feed, RVOL
  - `advisory.js` — canonical, refresh, auto-refresh, symbol-stats
  - `crawl.js` — jobs, runs, audit
  - `dnse.js` — credential CRUD, backfill trigger
  - `operator.js` — overview, health, tenants, audit-log
  - `misc.js` — legal pages, health checks, discovery hub
- Viết unit test cho mỗi adapter function mới (mock response)

**Rủi ro:** Thấp — chỉ thêm code mới, không sửa code cũ.  
**Thời gian:** 2-3 ngày.  
**Kiểm tra:** Legacy `client.js` không còn hàm nào mà coreApiAdapter chưa có + adapter test pass.

---

### Bước 2a — AuthProvider + RealtimeProvider (Infrastructure layer)

**Mục tiêu:** packages/web có AuthProvider và RealtimeProvider hoạt động — không cần viết mới từ đầu nhờ `useRealtimeFeedCore.js` đã có sẵn.

**Công việc:**
- Xây dựng `packages/web/src/context/AuthProvider.js`:
  - JWT storage (dùng chung key với legacy từ Bước 0)
  - Token refresh tự động (dùng coreApiAdapter thay vì Axios interceptor)
  - Session management (login, logout, expiry detection)
- Cấu hình và kiểm thử RealtimeProvider dựa trên `useRealtimeFeedCore.js` đã có sẵn:
  - Đồng bộ biến môi trường Vite: `VITE_WS_BASE_URL`, `VITE_DISABLE_REALTIME_WEBSOCKET`
  - Kiểm thử WebSocket reconnect, exponential backoff + jitter
  - Kiểm thử heartbeat ping/pong
  - Kiểm thử auth token refresh khi WebSocket ngắt với mã 4401
  - Channel management (subscribe/unsubscribe symbol, dashboard, whale alerts)
- **Vá lỗi cú pháp `coreApiAdapter({ env })`** trong PortfoliosPage, TransactionsPage, UserSettingsPage, WhaleAlertsPage (gọi adapter sai cách gây crash runtime)
- **Sửa lỗi chính tả** `coreApiAeload()` → `coreApiReload()` tại `PortfoliosPage.js:73`
- Viết unit test cho AuthProvider + RealtimeProvider (mock WebSocket)

**Rủi ro:** Trung bình — WebSocket engine đã có sẵn, rủi ro chính là cấu hình sai biến môi trường hoặc crash adapter chưa được vá.  
**Thời gian:** 2-3 ngày (giảm từ 3-4 ngày nhờ engine có sẵn).  
**Kiểm tra:** Login/register/session refresh E2E + WebSocket reconnect test + 4 page crash test.

---

### Bước 2b — Layout + Router + Context còn lại (làm song song với Bước 3)

**Mục tiêu:** packages/web có routing, layout, và context providers đầy đủ.

**Công việc:**
- Xây dựng `packages/web/src/layout/AppLayout.js` — Sidebar + TopNav dùng `navigationCatalog.js`
- Xây dựng `packages/web/src/App.jsx` — React Router với tất cả routes
- Chuyển các context còn lại: LangContext (dùng shared i18n từ Bước 0)

> **Lưu ý:** Làm song song với Bước 3. Mỗi page được migrate đều được thêm route vào Router ngay lập tức, không chờ Layout xong hết mới test.

**Rủi ro:** Trung bình — ảnh hưởng routing.  
**Thời gian:** 1-2 ngày (song song với Bước 3).  
**Kiểm tra:** Router hoạt động đúng cho pages đã migrate.

---

### Bước 3 — Xây dựng pages còn thiếu (làm song song với Bước 2b)

**Mục tiêu:** Đạt feature parity 100% giữa legacy và packages/web.

| Page | Legacy | Công việc | Ưu tiên |
|------|--------|-----------|---------|
| `ScreenerPage.js` | `Screener.jsx` (414 dòng) | Build mới, dùng screener adapter từ B1 | 1 (cao nhất) |
| `SOCPage.js` | `SOCPage.jsx` | Upgrade `ShellOperationsCenterPage` lên page thật | 2 |
| `AdminCorePages.js` (9-in-1) | `AdminCore*.jsx` | Gộp vào 1 module với sub-routing | 3 |
| `WhaleAdvisoryPage.js` | `WhaleAdvisory.jsx` (233 dòng) | Thêm logic thật vào shell page có sẵn | 4 |
| `CrawlControlPage.js` | `AdminCrawlControl.jsx` | Dùng crawl adapter từ B1 | 4 |
| `UpgradePage.js` | `Upgrade.jsx` (73 dòng) | Page đơn giản, migrate nhanh | 4 |
| `AICommandCenterPage.js` | — | Wire route + xoá shell page nếu có | 4 |

**Rủi ro:** Trung bình — pages có business logic riêng (Screener 414 dòng).  
**Thời gian:** 3-5 ngày.  
**Kiểm tra:** Từng page hoạt động giống hệt legacy + viết test coverage tối thiểu 70%.  
**Chính sách:** Không merge page mới nếu thiếu i18n keys tương ứng.

---

### Bước 4 — Tách VNStockCharts build vào packages/web

**Mục tiêu:** packages/web tự build KLine chart engine mà không cần `frontend/Dockerfile`.

**Công việc:**
- Thêm vào `packages/web/Dockerfile`:
  - Clone VNStockCharts repo (dùng `STOCKCHART_REF` build arg — đồng bộ với legacy)
  - Build KLine engine (`npm run build:engine-react`)
  - Cache bust dùng git commit hash thay vì hardcode timestamp
  - Copy output vào node_modules
- packages/web `package.json` thêm dependencies: `@vnstockcharts/vn-kline-engine-core`, `@vnstockcharts/vn-kline-engine-react`
- Sử dụng Docker buildkit cache sharing để tránh double build khi chạy shadow run

**Rủi ro:** Trung bình (không phải Thấp như đánh giá cũ) — có thể phiên sinh double build, version drift, cache bust không đồng bộ.  
**Thời gian:** 1 ngày.  
**Kiểm tra:** KLine chart render đúng trên StockDetail page + So sánh output với legacy build.

---

### Bước 5 — Shadow run (canary deployment)

**Mục tiêu:** Chạy song song packages/web và legacy trong môi trường production-like trước khi cutover.

**Công việc:**
- Deploy packages/web lên subdomain `beta.vninvest.edusuccess.vn` (hoặc tương đương)
- Chạy song song 3-5 ngày với legacy
- So sánh metrics giữa 2 bản:
  - Error rate (API 4xx/5xx, frontend crash rate)
  - Response time (TTFB, LCP, FID)
  - Bundle size
- Parity gate: error rate <= legacy, response time không tệ hơn 10%

**Rủi ro:** Thấp — không ảnh hưởng production (chạy song song).  
**Thời gian:** 3-5 ngày (chờ accumulate data).  
**Kiểm tra:** Parity gate PASS.

---

### Bước 6 — Chuyển compose + xoá legacy

**Mục tiêu:** Xoá hoàn toàn thư mục `frontend/`.

**Công việc:**
1. Cập nhật `packages/web/docker/nginx.conf` — thêm các route còn thiếu:
   - `^~ /api/public/` — rate limited
   - `^~ /api/soc/` — rate limited
   - `^~ /api/v1/` — rate limited
   - `^~ /api/admin-ops/` — rate limited
   - `resolver 127.0.0.11` (Docker DNS)
   - `api_limit_zone` rate limiting zone
   - Rewrite rules: `^/api/core/v1/(.*)` → `/core/v1/$1`
2. Sửa `docker-compose.dev.yml`:
   ```yaml
   frontend:
     build:
       context: packages/web/
       dockerfile: Dockerfile
   ```
   > Lưu ý: context phải là `packages/web/`, không phải `.`, để tránh copy toàn bộ monorepo.
3. Xoá toàn bộ thư mục `frontend/` và các file:
   - `frontend/Dockerfile`
   - `frontend/Dockerfile.dev-package-shell`
   - `frontend/docker/nginx.conf`
   - `frontend/docker/`
4. Cập nhật CI/CD pipeline references
5. Monitoring hậu migration 1 tuần

**Rủi ro:** Cao — cần rollback plan (xem §8).  
**Thời gian:** 0.5 ngày + 1 tuần monitoring.  
**Kiểm tra:** Full smoke test + so sánh production bundle output.

---

## 4. Thứ tự ưu tiên đề xuất (sửa theo critique)

```
Tuần 0:     Bước 0 (Foundation: token + i18n audit)
Tuần 1-2:   Bước 1 (API adapter) — 30 functions
Tuần 2-4:   Bước 2a (AuthProvider + RealtimeProvider WebSocket)
Tuần 3-5:   Bước 2b (Layout + Router) + Bước 3 (Pages) — SONG SONG:
            ├── Layout + Router
            ├── ScreenerPage (ưu tiên 1)
            ├── SOCPage (ưu tiên 2)
            ├── AdminCorePages (ưu tiên 3)
            ├── Upgrade, WhaleAdvisory, CrawlControl (ưu tiên 4)
            └── Wire AICommandCenterPage + TenantAdmin (đã có sẵn)
Tuần 5:     Bước 4 (VNStockCharts tách)
Tuần 6:     Bước 5 (Shadow run 3-5 ngày song song)
Tuần 7:     Bước 6 (Compose switch + xoá legacy + monitoring)
            ↓
         Xoá frontend/ ✅
```

### Lý do cập nhật

1. **Bước 0 trước tất cả** — token consistency và i18n parity là nền tảng không thể thiếu.
2. **Bước 1 vẫn giữ nguyên** — ít rủi ro nhất, tạo nền tảng cho mọi bước sau.
3. **Bước 2a trước Bước 2b** — WebSocket infrastructure phức tạp, cần làm riêng, không gộp vào Layout.
4. **Bước 2b + Bước 3 song song** — không chờ Layout xong mới làm page. Mỗi PR migrate 1 page kèm route tương ứng.
5. **Bước 4 giữa chừng** — không ảnh hưởng các bước khác, có thể đẩy lên sớm.
6. **Bước 5 (shadow run) bắt buộc** — không big-bang cutover, chạy song song trước.
7. **Bước 6 cuối cùng** — chỉ khi parity gate PASS.

**Tổng thời gian ước lượng:** 7 tuần (tăng từ 4-5 tuần của plan gốc).

---

## 5. Rủi ro và giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| RealtimeProvider WebSocket phức tạp (reconnect, backoff, heartbeat, auth) | Trung bình | Engine đã có sẵn trong `useRealtimeFeedCore.js` — chỉ cần cấu hình + test |
| Auth flow không đồng bộ giữa legacy và packages/web | Cao | Bước 0 chuẩn hóa token storage trước |
| `coreApiAdapter({ env })` syntax bug gây crash 4 trang SaaS hiện tại | Cao | Vá ngay trong Bước 2a, test E2E trước khi deploy |
| Screener business logic phức tạp (414 dòng) | Trung bình | Copy logic từ legacy, không refactor, ưu tiên cao nhất |
| VNStockCharts double build / version drift | Trung bình | Shared `STOCKCHART_REF` arg + Docker buildkit cache |
| Nginx config thiếu route hoặc khác biệt (Docker DNS, rate limit) | Thấp | Đã pre-resolved — cả 2 đều có sẵn trong packages/web nginx.conf |
| i18n keys thiếu khi migrate page | Trung bình | Automation audit + gate trước mỗi page migration |
| Production downtime khi chuyển compose (build tại chỗ 10-15 phút) | Cao | Backup tag local + rollback < 30 giây (§8) |
| Build context sai (`.` thay vì `packages/web/`) | Thấp | Kiểm tra context path trong compose file |

---

## 6. Tiêu chí hoàn thành (Definition of Done)

- [ ] **Bước 0:** Token storage chuẩn hóa — xác minh khóa JWT trong localStorage trùng khớp giữa 2 port
- [ ] **Bước 0:** i18n coverage report PASS — tạo file mapping keys SSOT
- [ ] **Bước 1:** `packages/web/src/adapters/core/` có tất cả API functions tương đương legacy `client.js`
- [ ] **Bước 2a:** AuthProvider + RealtimeProvider WebSocket hoạt động (reconnect, backoff, heartbeat)
- [ ] **Bước 2a:** Vá lỗi `coreApiAdapter({ env })` syntax bug trong 4 trang PortfoliosPage, TransactionsPage, UserSettingsPage, WhaleAlertsPage
- [ ] **Bước 2a:** Sửa lỗi chính tả `coreApiAeload()` → `coreApiReload()` tại `PortfoliosPage.js:73`
- [ ] **Bước 2a:** Đồng bộ biến môi trường Vite: `VITE_WS_BASE_URL`, `VITE_DISABLE_REALTIME_WEBSOCKET`
- [ ] **Bước 2b:** `packages/web` có App.jsx riêng với routing, layout, context providers
- [ ] **Bước 2b + 3:** Di dời Stats, Heatmap, Deck, Alert Center components từ legacy vào packages/web (không dùng render-props slot)
- [ ] **Bước 3:** Tất cả pages legacy đã có bản SaaS native tương ứng (kèm test >= 70%)
- [ ] **Bước 4:** `packages/web/Dockerfile` tự build VNStockCharts KLine engine (dùng `STOCKCHART_REF`)
- [ ] **Bước 5:** Shadow run >= 3 ngày, parity gate PASS — thiết lập monitor log riêng cho subdomain beta
- [ ] **Bước 6:** `packages/web/docker/nginx.conf` có tất cả proxy routes cần thiết
- [ ] **Bước 6:** `docker-compose.dev.yml` dùng `packages/web/Dockerfile` với context đúng
- [ ] **Bước 6:** Tạo local backup tag `vninvest-frontend:backup-pre-migration` trên server trước khi build mới
- [ ] **Bước 6:** Sửa workflow GitHub Action `.github/workflows/web.yml` trỏ Dockerfile về `packages/web/Dockerfile`
- [ ] **Bước 6:** `frontend/` directory được xoá khỏi repository
- [ ] Smoke test: tất cả routes hoạt động, bundle build thành công
- [ ] Parity check: production bundle tương đương hoặc nhỏ hơn legacy
- [ ] Monitoring 1 tuần hậu migration không có critical incident

---

## 7. Phân công công việc

| Bước | Công việc | Người phụ trách | Deadline |
|------|-----------|----------------|----------|
| 0 | Chuẩn hóa token storage + i18n audit | TBD | TBD |
| 1 | API adapter migration (30 functions) | TBD | TBD |
| 2a | WebSocket RealtimeProvider | TBD | TBD |
| 2b | AuthProvider + Layout + Router | TBD | TBD |
| 3 | ScreenerPage + SOCPage (ưu tiên 1-2) | TBD | TBD |
| 3 | AdminCorePages + Upgrade + WhaleAdvisory (ưu tiên 3-4) | TBD | TBD |
| 4 | VNStockCharts tách build | TBD | TBD |
| 5 | Shadow run setup + monitoring | TBD | TBD |
| 6 | Compose switch + legacy xoá | TBD | TBD |

> **Ghi chú:** Mục này cần được điền sau khi có quyết định về nhân sự và timeline thực tế.

---

## 8. Runbook: Rollback plan

### Cảnh báo quan trọng: Production build tại chỗ

Production deployment hiện tại dùng `deploy_prod.sh` với lệnh `docker compose build` **trên server** (không pull pre-built image từ registry).  
Điều này có nghĩa: **build lại legacy code từ đầu mất 10-15 phút** (npm ci, clone VNStockCharts, build KLine engine, webpack).  
Do đó runbook rollback **không thể dùng phương án "revert commit + rebuild"**.

### Điều kiện kích hoạt rollback
- Error rate > 1% sau khi switch compose (Bước 6)
- 3+ user reports về chức năng không hoạt động
- Critical page (login, dashboard, /stocks) không load
- Build failure kéo dài > 30 phút

### Các bước rollback (dùng backup tag — < 30 giây)

| Bước | Hành động | Thời gian |
|------|-----------|-----------|
| 0 (trước cutover) | `docker tag vninvest-frontend:latest vninvest-frontend:backup-pre-migration` | — |
| 1 | Sửa `docker-compose.prod.yml`: đổi `frontend` image tag về `backup-pre-migration` | < 1 phút |
| 2 | `docker compose up -d frontend` | < 30 giây |
| 3 | Verify smoke test: login, dashboard, /stocks/:symbol | < 2 phút |
| 4 | Thông báo rollback hoàn tất | < 1 phút |
| | **Tổng thời gian** | **< 5 phút** |

> **Phương án thay thế (dài hạn):** Chuyển CI/CD sang build image trên GitHub Actions, push lên GHCR, server chỉ pull — lúc đó rollback chỉ cần `docker compose pull && up -d` (< 2 phút).

### Yêu cầu trước rollback
- Legacy image vẫn tồn tại trong container registry (không purge cho đến khi Bước 6 hoàn tất + 1 tuần monitoring)
- **Backup tag `backup-pre-migration` được tạo trước khi chạy build Bước 6**
- Legacy compose file được archive (không xoá ngay)
- Rollback đã được test ít nhất 1 lần trong môi trường dev
