# ROADMAP MASTER 2026Q4 → 2027 — Hiện trạng toàn bộ tính năng & lộ trình cạnh tranh toàn cầu

> **Ngày lập:** 2026-10-21 · **HEAD khi viết:** `e5f934ff9` (branch `dev`) · **Claim:** `master-roadmap-2026q4` (`docs/CLAIMS.md`)
> **Vai trò:** PM code lead + system frontend designer · **Phạm vi:** toàn bộ repo `vninvest` (5 package track)
> **Tài liệu liên quan:** `docs/COMPETITIVE_BENCHMARK_20261021.md` (benchmark 4 lớp đối thủ, 108 URL) · `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 393) · `docs/OPEN_WORK_20260927.md` · `docs/OPEN_WORK_SEC_20260929.md`
> **Lessons áp dụng:** L-V01 (script đo phải có control) · L-V02 (gốc rễ kế thừa phải có phản chứng) · L-V04 (assert giá trị thật) · L-G02 (không báo PASS cho thứ chưa chạy) · L-G04 (số đếm phải tách mức độ) · L-G07 (đếm route theo registry, không theo tên file) · L-T01 (append byte-exact, không đổi line-ending) · L-T02 (citation đúng file + dòng) · L-F03 (token → `soc.tokens.css`, class → `soc.components.css`)

---

## 0. Tóm tắt điều hành

1. **VNInvest đã là một nền tảng B2B2B hiếm, không phải một app retail.** 16 Django app · 69 route web · ~500 route API · multi-tenant + PAT + partner API (108 route) + SOC (136 route) + SSO + audit + billing. **Trong nước chưa có đối thủ trực tiếp** ở nhóm này (chỉ BSC Open API = broker→app, FireAnt API = data). Đây là tài sản lớn nhất và **phải đóng gói thành sản phẩm bán được**, không phải để trong code.
2. **Khoảng trống lớn nhất KHÔNG phải "thêm tính năng" mà là "AI nằm trong workflow" + "chiều sâu dữ liệu VN".** Đã verify 33 năng lực trong code: **HAVE 9 · PARTIAL 13 · MISSING 11**. Hầu hết `PARTIAL` là do **backend có nhưng frontend tắt, hoặc thiếu lớp dữ liệu** — chi phí thấp, giá trị cao.
3. **Nền tảng kỹ thuật có 3 "false-green" gate đang làm mọi báo cáo PASS trước đây không đáng tin.** `check-light-theme` không được wire vào pre-push · OC-19 doc-sync match path `^backend/` đã legacy ⇒ luôn PASS · 8/9 CI workflow bị tắt. **Không dọn cái này, mọi "PASS" của roadmap sẽ là ảo.** Đây là Wave 0 bắt buộc.
4. **Khoảng trống doanh thu lớn nhất = giá theo seat.** 0 hit `seat` trong toàn bộ model/giá/entitlement. Nền tảng B2B đã có (multi-tenant, SOC, SSO, audit) nhưng **chưa có đơn vị giá theo seat** ⇒ không đóng gói được cho broker/cố vấn/quỹ. Effort **M**, doanh thu **cao** ⇒ đưa lên Wave 1.
5. **Không nên làm:** fractional shares (VN yêu cầu lô 100) · options/crypto/prediction markets (giấy phép) · desktop app (VN mobile-first) · social community (rủi ro đạo đức "đầu cơ"). **Nên làm sớm:** backtest/paper trading với giả định VN (lô 100 · T+2,5 · phí 2 chiều · PIT 0,1%) — đây là khác biệt duy nhất so với TradingView.

---

## 1. Phương pháp & nguồn bằng chứng

| Lớp audit | Phạm vi | Kết quả | Bằng chứng |
|---|---|---|---|
| **A. Backend** | `packages/core/backend/src/` — 16 Django app, 396 file `.py` | 28 stub/dead-code (mục 2.4) | `settings.py:103-133` (`INSTALLED_APPS`) |
| **B. Frontend** | `packages/web/src/` — 421 file prod | 20 stub/shadow/dead (mục 2.4) | `src/app/routeCatalog.js:5-800` (69 entry) |
| **C. Package phụ** | `packages/mobile` · `packages/opencore` · `packages/vip-app` | 3/3 **không được nối** CI | `git grep` trên `.github` + `docker-compose*.yml` + `scripts/` |
| **D. Đối thủ** | 4 lớp: broker VN · nền tảng QT · terminal TCT · AI-in-finance | 108 URL nguồn chính thức | `docs/COMPETITIVE_BENCHMARK_20261021.md` §7.1 |
| **E. Verify `?`** | 33 năng lực còn `?` trong ma trận | **HAVE 9 / PARTIAL 13 / MISSING 11** | Xem mục 3 |

**Nguyên tắc đã áp dụng:** mọi khẳng định kèm `file:line` · route đếm theo **registry** không theo tên file (L-G07) · số đếm tách "thật / tương đối / không phải lỗi" (L-G04) · gốc rễ kế thừa phải tái hiện được mới hành động (L-V02) · không báo PASS cho thứ chưa chạy (L-G02).

---

## 2. HIỆN TRẠNG (AS-IS)

### 2.1 Quy mô codebase

| Khu vực | Số | Bằng chứng |
|---|---|---|
| Backend — code prod | **~93 000 LOC** / 396 file `.py` | `packages/core/backend/src/` |
| Backend — migration | ~7 500 LOC / 149 file | `packages/core/backend/src/*/migrations/` |
| Backend — test | **291 file** (98 `backend/tests/` + 193 trong `src/`) | `packages/core/pytest.ini` (`testpaths = backend/src`) |
| Backend — Django app | **16** (11 hoạt động + 1 rỗng + 4 support) | `settings.py:103-133` |
| Backend — route khai báo | ~500 | đếm `path(`/`re_path(` trong mọi `urls.py` |
| Frontend — code prod | **~110 195 LOC** / 421 file | `packages/web/src/` |
| Frontend — test | **215 file** (191 src + 24 visual) | vitest + jest + playwright (`package.json:24-27`) |
| Frontend — route | **69 catalog / 67 registry / 61 mount thật / 70 `<Route>`** | `routeCatalog.js:5-800` · `pageRegistry.js:176-338` · `main.tsx:147-253` |
| i18n | 95 namespace · 6 694 leaf key (vi) vs 6 674 (en) — **lệch 20** | `src/i18n/vi.js` (7 346 dòng) + `en.js` (7 314) |
| Design system SOC | `soc.tokens.css` 211 dòng · `soc.components.css` 4 061 dòng | `src/components/soc/` |
| Package phụ | mobile 3 823 LOC · opencore 62 LOC · vip-app 684 LOC (**≈1,3%** tổng) | `git ls-files packages/*` |

### 2.2 Bản đồ tính năng — Backend (16 app)

| App | LOC | Năng lực | Route prefix | Bằng chứng |
|---|---|---|---|---|
| `identity_access` | 13 652 | Auth, tenant, PAT, service account, SSO, **partner API (108 route)**, webhook, report | `/core/v1/`, `/core/v1/partner/` | `models.py:44,596,254,180` · `partner_urls.py:40-183` |
| `user_workspace` | 16 001 | Portfolio + **ledger append-only**, watchlist, screener, **3 broker lane**, AI Command Center | `/core/v1/` | `models.py:22,93,1327,795,1063` · `urls.py:56-176` |
| `service_ops` | 15 239 | **SOC control plane (136 route + 27 operator)**: service registry, dataops, signals, screener, matrix, backfill | `/api/soc/`, `/core/v1/operator/` | `models.py:16,59,101,181,365,598` · `registry.py:19-40` |
| `advisory` | 6 772 | **AI advisory BYOK** đa provider, budget, audit, trace, deployment, backtest | `/core/v1/` | `models.py:17,85,234,408,721,786` |
| `market_data` | 9 943 | Stock profile, OHLCV, intraday, **stock-management native (37 route)** | `/core/v1/` | `core_urls.py:48-84` · `models.py:15,63,135,205` |
| `data_ingest` | 3 827 | Market ingestion, backfill, outbox (92 Celery task) | `/core/v1/` | `tasks.py:838,985,1428,2068,3050` |
| `market_serving` | 3 715 | Realtime read-model: snapshot, CVD, ticker, price-board, breadth, whale-feed, depth | `/core/v1/` | `urls.py:18-34` |
| `signal_intelligence` | 4 811 | **Alert center + AI alerts + order-flow + whale feed**, WebSocket + SSE | `/core/v1/` | `models.py:15,76,110` · `urls.py:6-18` |
| `commercial` | 2 866 | Subscription, quota, invoice, **VNPay + Stripe** | `/core/v1/`, `/api/public/` | `models.py:11,61,91,118` |
| `ops_audit` | 1 604 | Audit event, request trace, API rollup, DB backup | `/core/v1/` | `models.py:12,46,65` |
| `support` | 908 | Ticket user + staff, dashboard | `/core/v1/` | `urls.py:16-23` |
| `advertising` | 904 | Ad widget + campaign + impression/click + trademark | `/core/v1/`, `/api/v1/` | `urls.py:37-38` |
| `ai_analytics` | 490 | AI usage telemetry + SLO (p50/p95/p99) | `/core/v1/` | `urls.py:6-10` |
| `tenant_lifecycle` | 307 | Auto-expire trial, suspend quota overflow | *(không route — Celery)* | `tasks.py:111,142,181,219` |
| `vninvest_core` (project) | 12 094 | Health, capability bootstrap, OpenAPI, **legacy proxy**, 4 handler RFC 9457 | `/core/v1/`, `/api/` | `urls.py:44-109` |
| **`ai_agents`** | **5** | **APP RỖNG** — model đã xoá, 0 route, 0 view | — | `ai_agents/apps.py:3-7` |

### 2.3 Bản đồ tính năng — Frontend (69 route, theo registry)

| Nhóm | Route | Năng lực | Bằng chứng |
|---|---|---|---|
| Auth | 4 | Login · Register · Verify email · Reset password | `pages/auth/` (4 file, 1 043 LOC) |
| Market | 4 | Dashboard · Watchlist · Screener · Stock detail | `pages/DashboardPage.tsx` (405) · `WatchlistPage.tsx` (64) · `ScreenerPage.tsx` (728) · `pages/StockDetailPage.tsx` (362) |
| Portfolio | 7 | Workspace 5 tab (overview/holdings/allocation/analytics/activity) + CRUD manage | `pages/portfolio/` (14 file) |
| Signals / AI | 7 | Alert Center (712) · Whale Advisory (527) · AI CC (440) · AI Usage (21) · AI Traces (274) · AI SLO (200) · AI Audit (160) | `pages/signals/` + `pages/AI*.tsx` |
| Broker | 3 | Broker Hub (252) · Broker Account (78) · Bindings (409) | `pages/broker/` |
| Commercial | 2 | Billing Center (534) · Payment Return (258) | `pages/commercial/` |
| Tenant admin | 17 | Home/Members/SA/PAT/Usage/UsageHistory/Billing/Capabilities/AIPolicy/Audit/Reports/SSO/Security/Webhooks/Settings/Roles | `pages/tenant-admin/` (17 file) |
| Operator / SOC | 11 | Operations Center + Mail Config + 9 tab SOC (Signals 2 330 · Vnbroker 1 335 · Overview 1 118 · DataOps 845) | `components/soc/` (35 file) |
| Admin fleet | 9 | Tenants/SA/PAT/Usage/Billing/Overview/Jobs/AuditTrace + users/billing/usage/audit/analytics | `pages/admin/` (18 file) |
| Tenant self | 2 | Keys · Usage summary | `pages/tenant/` |
| Support / Settings / Upgrade / Crawl / VIP | 5 | Support (313) · UserSettings (257) · Upgrade (76) · AdminCrawl (270) · VipLocal (617) | — |
| **Chỉ-URL, không có menu** | **51** | Toàn bộ `/tenant-admin/*` (17) + `/admin/overview` + `/settings/ai/traces` … | `navigationCatalog.js:5-48` chỉ 18 item vs 69 route |

**Adapter layer** (`src/adapters/core/`) — 11 domain client · 369 lệnh HTTP: `soc.js` 730 LOC/120 lệnh · `workspace.js` 683/90 · `market.js` 478/40 · `operator.js` 154/37 · `broker.js` 182/21 · `advisory.js` 122/21 · `auth.js` 177/11 · `commercial.js` 51/5 · `misc.js` 53/9 · `advertising.js` 55/8 · `dnse.js` 107/6.

**Chart:** `vninvestcharts-widget@^1.2.5` (npm) · type decl `src/types/vninvestcharts-widget.d.ts` (67 dòng) · bridge `src/adapters/chartAdapter.js` (197 LOC) · dùng thật ở `components/VNStockChartPanel.js:1` + `pages/watchlist/components/WatchlistDetailPanel.tsx:1` · **cố ý KHÔNG dùng** ở `components/portfolio/PortfolioChart.tsx:4-9` (ECharts trực tiếp).

### 2.4 Nợ kỹ thuật & code chết — **28 stub BE + 20 stub FE**

#### 2.4.1 P0 — Blocking (phải xử lý ở Wave 0)

| # | Vấn đề | Bằng chứng | Hậu quả |
|---|---|---|---|
| **T1** | **`check-light-theme` KHÔNG được wire vào pre-push** — grep literal `light-theme` trong `scripts/pre-push-gate.mjs` (520 dòng) ⇒ **0 hit** | `packages/web/scripts/check-light-theme.mjs:40` | Gate light theme **tưởng chạy thực tế không chạy** — ledger Entry 391 mô tả T3 là gate nhưng nó không nằm trong 28 gate |
| **T2** | **OC-19 doc-sync gate DEAD** — pattern match `^backend/…` và `^frontend/…`; repo dùng `packages/core/backend/…` + `packages/web/…` ⇒ **không file nào match** | `scripts/quality/check_opencore_doc_sync.ps1:50-51` | Gate luôn PASS (false green) |
| **T3** | **CI thật: 1/9 workflow** — chỉ `secret-scan.yml` bật, 8 file trong `.github/workflows-disabled/` | `.github/workflows/` (1) vs `workflows-disabled/` (8) | Không có CI ⇒ mọi gate chỉ chạy tay |
| **T4** | **`lint` + `test` + `build` KHÔNG có trong pre-push gate** — gate chỉ chạy `tsc --noEmit` | `scripts/pre-push-gate.mjs:292-295,313` | Lint/test không chặn được commit ⇒ 4-agent-báo-PASS → merge `198 test errors=1` (đã xảy ra 2026-09-26) |
| **T5** | **10/10 entry `exports` của `packages/web/package.json` trỏ file `.ts` KHÔNG TỒN TẠI** (thực tế là `.js`) | `package.json:36-48` | `import "@vninvest/web/…"` ⇒ module-not-found |
| **T6** | **6 page-registry entry bị shadow ⇒ 837 LOC component chết** (`dashboard`·`transactions`·`watchlist`·`portfolios`·`settings`·`portfolios-broker`) | `main.tsx:24-28,32-33,49` vs `pageRegistry.js:196-207,239` | Code chết vẫn export công khai `src/index.js:22-27` |
| **T7** | **51 route `market_data` KHÔNG được include** (`urls.py` 6 + `public_urls.py` 34) ⇒ rơi vào legacy proxy | `market_data/urls.py:7-12` · `market_data/public_urls.py:41-82` | FE gọi ⇒ 404/502 |
| **T8** | **`contracts/admin_ops` 2 126 LOC + 26 route trả 410 GONE** nhưng 2 file test contract còn test nó | `vninvest_core/urls.py:37-42,77` · `contracts/admin_ops/urls.py:34-59` | 2 100+ dòng code chết |
| **T9** | **~17 endpoint `/partner/*` gọi thẳng từ page, NGOÀI adapter** ⇒ không được contract test bảo vệ | `route-contract.test.js:49` chỉ quét `adapters/core/` | 2 cặp **lệch số ít/số nhiều**: `/partner/usage/alert-config/` (adapter `:69`) vs `alert-configs/` (page) · `/partner/usage/trend/` (adapter `:89`) vs `trends/` (page) |
| **T10** | **OpenClaw provider `SUPPORTED_PROTOCOLS = ()`** ⇒ mọi call trả 503 | `advisory/ai_clients/openclaw.py:44,153,169-172` | Nếu là default provider ⇒ **chặn sản phẩm** |
| **T11** | **SAML `strict` (prod default) LUÔN raise** — thiếu `python3-saml`+xmlsec1 | `identity_access/saml_service.py:394-406` | Enterprise SSO không dùng được |
| **T12** | **Depth chart (order book) là DỮ LIỆU GIẢ** — `is_mock: True`, `source: synthetic_from_snapshot` | `market_serving/native_views.py:450,520-522,481-509` | FE hiển thị order book giả như thật |
| **T13** | **FCM/VAPID trả `True` giả khi thiếu key** | `signal_intelligence/outbound_notification_service.py:56-57,102-103` | Hệ thống tưởng đã push, user không nhận |
| **T14** | **`materialize_unified_alerts` là NOOP** — task chạy mỗi 120s | `market_serving/materializers.py:211-220` + `settings.py:662-666` | Tốn tài nguyên, không làm gì |
| **T15** | **13 script gate mồ côi** trong `packages/web/scripts/` (không npm alias, không pre-push) | `check-light-theme.mjs` · `check-portfolio-contrast.mjs` · `check-uiux-budget.mjs` · `measure-route-graph.mjs` · `measure-theme-tokens.mjs` · `verify-*.mjs` … | Gate thật không chạy |
| **T16** | **`build-community` trỏ `frontend/` rỗng** ⇒ `packages/opencore` **không đóng gói được** | `packages/web/scripts/build-community.mjs:11-13,18-20` · `frontend/package.json` không tồn tại | Đường build opencore chết |

#### 2.4.2 P1 — Nguy hiểm âm thầm (trả về "thành công" giả)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| T17 | `usage/meters/` **luôn rỗng** (placeholder) | `identity_access/views_tenant.py:523-528` |
| T18 | `send_quota_warning` **không gửi email** | `commercial/tasks.py:290-302` |
| T19 | SOC whale test **luôn báo `success`** | `service_ops/views/signals.py:764-776` |
| T20 | Technical indicators trả `None` (`rsi_14`/`macd`/`atr_14`/`volatility_20`/`volume_ratio`) | `market_data/views.py:245-262` |
| T21 | AI news summary + portfolio news digest + market discovery hub trả `null`/`[]` | `market_data/stock_mgmt_native_views.py:2272-2291,3484-3509` · `user_workspace/portfolio_analytics_views.py:2629-2634` |
| T22 | `partner_urls` đăng ký 2 lần ⇒ `/core/v1/partner/partner/...` tồn tại | `vninvest_core/urls.py:58` + `identity_access/urls.py:78` |
| T23 | `ops_audit.urls` include 2 lần (route thứ 2 bị shadow) | `vninvest_core/urls.py:62` + `identity_access/urls.py:87` |
| T24 | `requiredCapabilities` — **76 nơi khai, 0 nơi đọc** | `routeCatalog.js:299-303` |
| T25 | `staffOnly:true` chỉ khai **1/69** route (~40 route staff thực tế không có cờ) | `routeCatalog.js:396` |
| T26 | **20 key i18n lệch vi↔en**; `check:i18n-hardcoded` chỉ quét 5 path | `src/i18n/vi.js` vs `en.js` · `package.json:33` |
| T27 | 3 feature folder **rỗng** (`community`/`saas`/`vip`) dù `config/buildTarget.js:1` khai 3 target | `features/*/components/index.js:1` = `Object.freeze([])` |
| T28 | Job tracking DNSE backfill lưu `localStorage` ⇒ đóng tab là mất | `adapters/core/dnse.js:25-114` |
| T29 | Broker `ssi`/`tcbs` là tile **"coming soon"** dù BE đã có lane | `components/BrokerSettingsSection.tsx:259-263,274-282` |
| T30 | `check:shell:legacy` gọi script tự khai **DEPRECATED/BROKEN** | `package.json:15` → `scripts/check-shell.mjs:1-10,34-35` |

#### 2.4.3 Tài liệu trạng thái đang SAI (nguy hiểm nhất vì mọi agent đọc để quyết định)

| Tài liệu | Vấn đề | Bằng chứng |
|---|---|---|
| `ROADMAP_STATUS.md` | **Stale 6 tháng 11 ngày** — mọi mục ở 2026-04-01…04-18, trong khi repo đã chuyển monorepo + AI CC đã tới R5.3 | `ROADMAP_STATUS.md:1,5,9,810` |
| `PROGRESS_DASHBOARD.md` | Stale 18 ngày; gate C/D/E/F nói "archive `frontend/` ⏳" nhưng `frontend/` **đã không còn git-track** ⇒ các gate đó vô nghĩa | `PROGRESS_DASHBOARD.md:19,57-61` |
| `docs/OPEN_WORK_20260927.md` | Ghi **PR #272/#273 = OPEN** nhưng cả hai **đã merge** | `git log` merge `1fe43761c` (PR #273) · `CLAIMS.md:1663,1711-1716` = `done` |
| `AGENTS.md` | Mục "PLAN AI Command Center Rev.2" nói *"R0 chưa bắt đầu · M0 = R0 xanh là điều kiện bắt buộc"* ⇒ **SAI**, R0–R5.3 đã merge (PR #245–#251) | `git log` `0bcb015bd`…`3cb8df3b3` |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Chỉ còn **9 Entry (384–392)** — cần verify xem Entry 1–383 còn ở đâu | file hiện 144 dòng / 50 528 byte |
| `packages/mobile` | README nói "future mobile package-track migration" — scaffold, **không build được app**, 0 consumer, 0 CI | `packages/mobile/package.json:2-12` (không `dependencies`) |

### 2.5 Năng lực không thể copy — lợi thế cốt lõi

| Năng lực | Vì sao đối thủ không copy được | Bằng chứng |
|---|---|---|
| **Dữ liệu dòng tiền VN chuẩn hoá đi kèm tín hiệu** | TradingView / moomoo / Webull / Bloomberg / FactSet / Koyfin: **không có dữ liệu dòng tiền VN**. FireAnt **có** nhưng bán dưới dạng feed MetaKit cho AmiBroker (user tự viết AFL) — **chưa phải signal** | `signal_intelligence/models.py:76` · `market_serving/session_facts_engine.py` · `advisory/` |
| **Multi-tenant SaaS + partner API + SOC cho thị trường VN** | Webull Institutional (Mỹ) · Koyfin Teams (Mỹ) · TradingView Enterprise (global). **Trong VN không có đối thủ trực tiếp** | 108 route partner · 136 route SOC · `models.py:44,596,254,180` |
| **AI advisory đa-mô hình có audit + kiểm soát chi phí** | Đối thủ VN ship AI **đóng hộp** (FireAnt Copilot, Mira-bot) — user **không** chọn model, tenant **không** kiểm soát. Đối thủ quốc tế để LLM chạy ngoài | `advisory/ai_clients/__init__.py:21-62` (6 provider) · `models.py:408,721,786` |
| **3 broker lane thật trên 1 tài khoản SaaS** | TradingView trade-through là broker Mỹ · FireAnt Trading là app của FireAnt · BSC Open API 1 CK | `user_workspace/broker/dnse.py:62-84` · `ssi.py:100-133` · `tcbs.py` |
| **Ledger append-only lot-level** | Koyfin có lot-level P/L nhưng **theo dõi**; Webull/Wefolio chỉ tạo basket | `user_workspace/models.py:1327` · `ledger/holdings.py:163,181,252-277` |
| **AI explainability đầy đủ** | rationale LLM + feature attribution + snapshot đầu vào + trust telemetry | `advisory/orchestrator.py:481,875` · `advisory/serializers.py:226-243` · `components/advisory/RecommendationCardExplainability.js:17` |
| **Screener 42 trường** (18 TA + 13 whale + 5 dark-flow + 6 fundamental) | FireAnt Lọc AI có nhưng đóng hộp; TradingView AI Screener là paywall | `user_workspace/screener_helpers.py:70-94,397-431` |
| **Cảnh báo đa điều kiện có NOT** | Koyfin có alert engine nhưng không cho user tự viết rule JSON | `user_workspace/models.py:1084` · `portfolio_analytics_views.py:3593-3608` |
| **SOC control plane 9 tab** | Không đối thủ retail nào có; Koyfin Advisor không có SOC | `components/soc/` (35 file, `SocSignalsPanel.tsx` 2 330 LOC) |

### 2.6 Những thứ **không** nên tự khoe

| Mục | Chuẩn ngành | Thực tế VNInvest |
|---|---|---|
| Số indicator | TradingView 400+ built-in + 100K cộng đồng | **59** trong catalog widget 1.2.5 (66 entry trừ 7 loại chart) — thua xa về "độ sâu" |
| Backtest deep/tick-level | TradingView deep backtesting · FactSet 1 100+ dataset | Chỉ có hit-rate T+1/T+3/T+5; **0/5 giả định VN** |
| Paper trading | 4 lớp đối thủ có | ✗ |
| Social/community | 3 lớp có | ✗ (quyết định cố ý — chấp nhận) |
| Options/futures/margin/short | 3 lớp có | ✗ (phù hợp bản chất sàn VN) |

**5 năng lực doc benchmark ghi `✗` nhưng code ĐÃ CÓ** (trong widget npm — cần mở bằng click thật để khẳng định reachability, không nên tự khoe khi chưa verify): Pine Editor + compiler + `registerSeries` · Strategy Tester (`netProfit`/`winRate`/`profitFactor`) · Bar Replay · `VNInvestMultiCharts` multi-layout (app **không dùng** — `VNStockChartPanel.js:67` chỉ gán biến) · Export **XLSX** thật qua SheetJS (`components/screener/ScreenerExport.tsx:72-79`).

---

## 3. GAP ANALYSIS — 33 năng lực đã verify trong code

> Kết quả: **HAVE 9 · PARTIAL 13 · MISSING 11**. Đây là phần **tiền đề** cho mọi quyết định giá — không công bố bảng giá trước khi có bảng này.

### 3.1 Bảng verdict đầy đủ

| # | Năng lực | Verdict | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| 1 | TBT (time & sales) | **PARTIAL** | `market_data/views.py:411` `IntradayTapeView` · `models.py:167` `IntradayTick` | API thật, **FE 0 hit**; widget có `TapePanel` nhưng app tắt `showTapePanel: false` (`VNStockChartPanel.js:257`) |
| 2 | Corporate actions | **PARTIAL** | `ledger/validators.py:70` `DIVIDEND` · `ledger/holdings.py:271-277` | Thiếu **split/rights/ex-date** (grep 0 hit) · `DailyPrice.is_adjusted` (`models.py:80`) không có writer |
| 3 | Trái phiếu / tín dụng | **MISSING** | grep `coupon\|yield\|maturity\|credit_rating` = 0 | Group `'BOND'` có nhưng `fetch_symbol_group_members` trả rỗng (`vnbroker_adapter.py:915-925`) |
| 4 | Tài chính nhiều năm chuẩn hoá | **PARTIAL** | `vnbroker_adapter.py:1214` `fetch_company_financials` | Model `StockFundamental` **đã bị xoá** (`migrations/0006_remove_stockfundamental.py`) · bug `revenue_growth_yoy` so kỳ liền kề (`screener_helpers.py:346-350`) |
| 5 | Chỉ số ngành / ICB | **PARTIAL** | `market_data/models.py:40` `StockProfile.industry` | Chỉ free-text + 6 nhóm SECTOR hardcode (`vnbroker_adapter.py:1373-1378`); **không có mã ICB, không có chuỗi giá ngành** |
| 6 | Indicator built-in | **PARTIAL** | Widget catalog **59** (66 entry − 7 loại chart) | App mặc định chỉ bật **7 series** (`VNStockChartPanel.js:157-186`) · 10 i18n key `indicatorMovingAverage`..`indicatorObv` là **dead key** (`vi.js:3671-3680`) |
| 7 | Marketplace indicator cộng đồng | **PARTIAL** | Widget có Pine Editor + `PineCompiler.ts` + `registerPinePlugin` | **Marketplace = 0 hit**; `registerIndicator` không được app expose (`PortfolioChart.tsx:15`) |
| 8 | Lưu & chia sẻ layout chart | **PARTIAL** | Widget persist theo `workspaceId` → localStorage (`VNStockChartPanel.js:256`) | **Không sync server / không theo account** · `shareUrl` = 0 hit |
| 9 | Bảng giá tùy chỉnh cột | **HAVE** | `WatchlistContext.tsx:178-197` (persist `vninvest_watchlist_columns_v1`) · `ScreenerResultsTable.tsx:154` | Cả watchlist lẫn screener |
| 10 | Screener nâng cao (RRG/Z/F/Dupont) | **MISSING** | grep `RRG\|z_?score\|f_?score\|altman\|dupont` = **1 hit, là comment CSS `#RRGGBB`** | 0/4 |
| 11 | Lưu & chia sẻ bộ lọc | **HAVE** | `models.py:1063` `ScreenerRule` + `:1087` `is_public` + `views.py:877,913` | Share **trong cùng tenant**, không có link public |
| 12 | Screener theo ngành/chỉ số | **MISSING** | `_SCREENER_ALLOWED_FIELDS` (`screener_helpers.py:70-94`) không có field industry | 12 template (`screener_templates.py:11-126`) không có template ngành |
| 13 | Top movers / market highlights | **MISSING** | `getMarketOverview` chỉ có **trong type** `coreApiAdapter.d.ts:65`, không có implementation | Dead type declaration |
| 14 | Định giá (DCF/P-B/Graham) | **PARTIAL** | `screener_helpers.py:331-360` (P/E, dividend_yield, market_cap, D/E) | **0 DCF, 0 P/B, 0 Graham** (grep 1 hit = emoji 📰) |
| 15 | Benchmarking VN-Index/VN30 | **HAVE** | `ledger/analytics.py:32-33` `DEFAULT_BENCHMARK='VN30'`, `BENCHMARKS=('VN30','VN100')` · alpha/beta/TE/IR `:249-320` | **Không có VN-Index**; sharpe/sortino/correlation bị **cố ý loại** (`portfolio_analytics_views.py:582-583`) |
| 16 | Cổ tức + DRIP | **PARTIAL** | `ledger/validators.py:70` · `ledger/holdings.py:271-277` · `screener_helpers.py:332` | **DRIP = 0 hit** (`reinvest\|drip\|tái đầu tư`) |
| 17 | Tax-aware PIT 0,1% | **PARTIAL** | `ledger/holdings.py:163,181,252-277` (field `tax`, `taxes_paid`) | **KHÔNG tự tính 0,1%**; `personalIncomeTaxSell` là **i18n dead key** (`vi.js:3192`) |
| 18 | Risk metrics | **PARTIAL** | `ledger/analytics.py:328-391` → volatility, `var_95_daily`, max_drawdown, concentration, beta, alpha | Thiếu **sharpe/sortino/correlation** (cố ý — test khẳng định endpoint **không** expose: `tests/test_portfolio_metrics.py:95-99`) |
| 19 | Pre-trade risk control | **MISSING** | `views_dnse.py:136-203` chỉ validate hình thức (symbol/side/volume/lô 100) | `buying_power` chỉ **đọc để hiển thị** (`broker/adapters.py:99,451`), **không chặn lệnh** |
| 20 | AI explainability | **HAVE** | `advisory/models.py:118` `rationale` · `orchestrator.py:481,875` `feature_attribution` · FE `RecommendationCardExplainability.js:17` | Cả rationale + attribution + snapshot + trust telemetry |
| 21 | Cảnh báo rule nâng cao | **HAVE** | 42 field (`screener_helpers.py:70-94`) + 12 template + `ScreenerSchedule` (`models.py:1172`) + `screener_tasks.py:170-209` | |
| 22 | Cảnh báo đa điều kiện | **HAVE** | `models.py:1084` `rules_json` + AND/OR/NOT (`portfolio_analytics_views.py:3593-3608`) | Có `NOT` — mạnh hơn mức "multi-condition" |
| 23 | Kênh cảnh báo ngoài app | **PARTIAL** | Email SMTP `outbound_notification_service.py:12` · FCM `:33` · WebPush `:92` · `PriceAlert.notify_email/sms/push` (`models.py:431-433`) | **Slack/Telegram/WhatsApp/Discord = 0 hit** · `notify_sms` chỉ là boolean, **không có SMS provider** |
| 24 | Backtest giả định VN | **PARTIAL** | `advisory/views.py:931` (hit-rate T+1/T+3/T+5) · `portfolio_analytics_views.py:4455` | **0/5 giả định**: lô 100, T+2,5, phí 2 chiều, PIT 0,1%, slippage. UI tự thừa nhận: `AdvisoryBacktestPanel.js:104` *"Giá chưa trừ phí/thuế"* (`vi.js:6825`) |
| 25 | Export CSV | **HAVE** | `screenerExportUtils.ts:19` `buildCSV` · `AlertCenterPage.tsx:408` · `advisoryExport.js:47` · `AIAuditLogsPanel.tsx:105-118` | **Bonus**: có cả **XLSX** thật (`ScreenerExport.tsx:72-79`) |
| 26 | Free tier có giới hạn | **HAVE** | `commercial/plan_catalog.py:63-72` `PLAN_ENTITLEMENTS['free']`: api_calls 1 000, members 3, audit_days 7, exports 0, ai_regenerate 0 | Có cả entitlement lẫn meter |
| 27 | Giảm giá trả năm | **HAVE** | `packages/web/src/constants/planCatalog.ts:78-86` `VIP_12M` 900 000đ / "Tiết kiệm 300.000 đ" | Server `plan_catalog.py:35-39`; 12 tháng = **360 ngày** |
| 28 | Bán theo seat | **MISSING** | grep `seat\|per_seat\|seat_count` = **0 hit** toàn repo | Chỉ có `members` (giới hạn số user), **không phải giá theo seat** |
| 29 | Platform fee + seat enterprise | **MISSING** | grep `platform_fee` = 0 hit | `enterprise` = giá cố định 900 000đ/360 ngày (`plan_catalog.py:93-102`) |
| 30 | Hóa đơn VAT điện tử | **MISSING** | grep `e_?invoice\|tax_code\|MISA\|VNPT` = 0 hit | `Invoice` (`commercial/models.py:61-88`) là **bản ghi billing nội bộ** |
| 31 | App native iOS/Android | **MISSING** | `packages/mobile/package.json` không có `dependencies`; grep `react-native\|expo\|capacitor` trong mọi package.json = 0 hit | Scaffold 6 screen kiểu RN, **không build được app** |
| 32 | Desktop app | **MISSING** | grep `electron\|tauri` = 0 hit toàn repo | |
| 33 | Widget OS (home screen) | **MISSING** | `packages/web/public/` **không tồn tại**; `index.html` không có `<link rel="manifest">`; `vite.config.ts:13` không PWA plugin | Không PWA ⇒ không có widget |

### 3.2 Xếp hạng theo effort × doanh thu (chỉ MISSING + PARTIAL)

| Năng lực | Effort | Doanh thu | Lý do |
|---|---|---|---|
| **Backtest giả định VN** | **S** | **High** | Engine đã có ở 2 nơi; chỉ thiếu cost model. FireAnt bán MetaKit (Chuyên Nghiệp+). **Khác biệt duy nhất vs TradingView** |
| **Bán theo seat** | **M** | **High** | Nền tảng B2B đã có ⇒ **đòn bẩy doanh thu**. Cần: giá theo seat + entitlement + Stripe quantity + `Invoice.line_items` |
| **Tài chính cơ bản nhiều năm** | **L** | **High** | Model đã bị xoá (`0006_remove_stockfundamental`) ⇒ cần model + backfill + chuẩn hoá. Nền cho #10 + #14 |
| **Tax-aware PIT 0,1%** | **S** | Med | Ledger đã có field `tax`; chỉ thiếu auto-tính + báo cáo lợi nhuận sau thuế |
| **Sharpe/sortino/correlation** | **S** | Med | Engine có sẵn; chỉ cố ý bỏ 3 key |
| **Top movers / market pulse** | **S** | Med | Tác động DAU hằng ngày; screener đã sort được |
| **Screener theo ngành** | **S–M** | Med | 6 SECTOR group + `StockProfile.industry` đã có; chỉ thiếu field + scope. **Tiền đề #5 + #10** |
| **Layout save & share** | **M** | Med | Save = 1 endpoint lưu JSON theo user; share = snapshot public + link |
| **Kênh cảnh báo ngoài app** | **M** | Med | Telegram/Slack = webhook POST (S mỗi cái). **Zalo là moat VN** (chưa đối thủ nào có) |
| **DCF/P-B/Graham** | **M** | Med–High | P/B + Graham = công thức trên dữ liệu sẵn có (S); DCF cần dự phóng FCF (M–L) + phụ thuộc #4 |
| **Corporate actions** | **M** | Med–High | Cần model + **nguồn dữ liệu** (phần khó) + điều chỉnh giá + overlay (widget đã có `showCorporateEvents`) |
| **Pre-trade risk control** | **M** | Med | Đọc buying power + margin → chặn/cảnh báo. **Rào cản procurement B2B** |
| **RRG / Z-Score / F-Score / Dupont** | **M** | Med–High | Z/F/Dupont = công thức trên BCTC (phụ thuộc #4); RRG = L |
| **Platform fee + seat** | **M** | Med–High | Đi cùng "bán theo seat" |
| **HĐĐT VAT** | **M** | Med | **Rào cản procurement B2B** ở VN — có thể chặn deal enterprise |
| **PWA** (thay app native) | **S–M** | Med | `manifest.webmanifest` + service worker + install prompt. Ăn phần lớn giá trị của native mà không cần App Store |
| **DRIP** | **M** | Low–Med | Phụ thuộc corporate actions; PIT 0,1% làm DRIP kém hấp dẫn ở VN |
| **Nâng indicator >100** | **L** | Med | Phải làm ở **repo riêng** `vninvestcharts-widget` ⇒ lệ thuộc ngoài monorepo. Trước mắt: **bật hết 59** |
| **Marketplace indicator** | **L** | Low–Med | Phương án rẻ: expose Pine Editor sẵn có làm "chỉ báo tuỳ chỉnh" (S–M), **không** cần marketplace |
| **Chỉ số ngành / ICB** | **L** | Med–High | Cần phân cấp ICB chuẩn + chuỗi giá ngành (nhiều nguồn) |
| **Trái phiếu** | **L** | Low | Chỉ 1 lớp đối thủ có ⇒ **không phải white-space** theo luật §B.1 |
| **App native** | **XL** | High nhưng xa | Thay bằng **PWA** (S–M) trước |
| **Desktop app** | **XL** | Low | VN mobile-first — **không nên** trong roadmap gần |

---

## 4. LỘ TRÌNH

### 4.0 Nguyên tắc thực thi

1. **M0 = W0 xanh.** Không bắt đầu W1 trước khi Wave 0 (nền + gate) đóng — nếu không, mọi "PASS" của W1–W4 là **không kiểm chứng được** (L-G02 + bài học 4-agent-báo-PASS → merge `198 test errors=1`).
2. **Mỗi slice = 1 PR + 1 claim + 1 ledger Entry.** Không nhét nhiều feature vào 1 PR.
3. **Không bán tier mới trước khi entitlement tồn tại.** Gate: không có `PLAN_ENTITLEMENTS` entry tương ứng ⇒ không được publish giá.
4. **Không giảm chức năng hiện có** để làm scope nhỏ hơn. Nếu thu hẹp (ví dụ tắt depth chart giả) ⇒ ghi rõ trong ledger + thông báo Owner.
5. **0 hồi quy:** mọi slice phải có **fail-before** đo được (L-V04) + **fail-after** + gate chạy thật trên code **sau rebase** (L-G01).
6. **Ưu tiên W1 theo doanh thu × effort**, không theo độ dễ.

### 4.1 WAVE 0 — "Dọn nền để không tự đánh lừa mình" (P0 · 2 tuần · 8 slice)

| Slice | Nội dung | File chính | Effort | AC (đo được) |
|---|---|---|---|---|
| **W0.1** | **Wire gate thật**: `check-light-theme` + `eslint` + `vitest run` vào `pre-push-gate.mjs`; sửa pattern OC-19 (`^packages/core/backend/` + `^packages/web/`) | `scripts/pre-push-gate.mjs` · `scripts/quality/check_opencore_doc_sync.ps1:50-51` | **M** | Grep `light-theme` trong pre-push ≥1 hit · OC-19 self-test fail trên path sai |
| **W0.2** | **Xoá code chết**: `contracts/admin_ops` (2 126 LOC, 26 route) + `market_data/urls.py` (6) + `market_data/public_urls.py` (34) + `ops_audit/urls_parity.py` (4) — hoặc **include** lại nếu FE cần | `vninvest_core/urls.py:37-42,58,62` · `market_data/urls.py:7-12` | **M** | `grep -c "path("` trong `src/**/urls*.py` khớp URLconf thật · 2 file test contract cũ phải xoá cùng lúc |
| **W0.3** | **Sửa `exports` của `packages/web/package.json`** (10/10 trỏ `.ts` không tồn tại) — sửa `.ts`→`.js` hoặc xoá khối `exports` nếu package không được consume | `packages/web/package.json:36-48` | **S** | `node -e "require.resolve"` cho từng entry export → 0 lỗi |
| **W0.4** | **Dọn route/component chết**: 6 registry entry shadow + `PortfoliosBrokerPage` + `ShellSupportPage` + `ShellAiCommandCenterPage` + 3 feature folder rỗng + `config/buildTarget.js` | `pageRegistry.js:196-207,208-220,239` · `main.tsx:24-49` · `features/{community,saas,vip}/` | **M** | Mọi entry `pageRegistry` đều được `resolvePageComponent` gọi tới (script đếm theo registry, L-G07) |
| **W0.5** | **Đưa ~17 endpoint `/partner/*` về adapter** + sửa 2 cặp lệch số ít/số nhiều (`alert-config`/`alert-configs`, `trend`/`trends`) | `pages/tenant-admin/TenantAdminUsagePage.tsx:157-224` + 6 page khác · `adapters/core/operator.js:69,89` | **M** | `route-contract.test.js` quét **cả** page → 0 endpoint ngoài adapter |
| **W0.6** | **Fail-closed mọi "giả"**: depth chart `is_mock` · FCM/VAPID mock · SOC whale test · `usage/meters` · `send_quota_warning` · `materialize_unified_alerts` NOOP · AI news summary null | `market_serving/native_views.py:450,520-522` · `outbound_notification_service.py:56-57,102-103` · `service_ops/views/signals.py:764-776` · `identity_access/views_tenant.py:523-528` · `commercial/tasks.py:290-302` · `market_serving/materializers.py:211-220` | **L** | Mỗi endpoint: hoặc **trả 501 + lý do**, hoặc **dữ liệu thật**, hoặc **UI gắn nhãn "ước tính"** — có assert |
| **W0.7** | **Đóng 3 blocker AI**: OpenClaw (cấp protocol hoặc gỡ khỏi provider list + migration) · SAML (`python3-saml` + xmlsec1, hoặc fail-closed rõ ràng) · `ai_agents` (xoá khỏi `INSTALLED_APPS` hoặc implement) | `advisory/ai_clients/openclaw.py:44` · `identity_access/saml_service.py:394-406` · `settings.py:131` | **M** | `curl` 3 endpoint trả **200 với dữ liệu thật** hoặc **503 có lý do**, **không 200 giả** |
| **W0.8** | **Chuẩn hoá tài liệu trạng thái** + **bật lại CI** (8 workflow disabled) + **khôi phục/verify ledger Entry 1–383** | `ROADMAP_STATUS.md` · `PROGRESS_DASHBOARD.md` · `docs/OPEN_WORK_20260927.md:39-40` · `AGENTS.md` (mục AI-CC) · `.github/workflows-disabled/` | **M** | Mỗi doc có "verified: <date> @ <sha>" · `git log docs/CODE_CHANGE_AUDIT_LEDGER.md` cho biết Entry 1–383 ở đâu |

**Định nghĩa "Done" W0:** `pre-push-gate` chạy ≥ 31 gate (thêm 3) · OC-19 self-test fail trên path legacy · 0 route khai báo mà không include · 0 component chết trong registry · contract test cover 100% endpoint FE gọi · 0 endpoint trả dữ liệu giả · 3 doc trạng thái có ngày verify · CI bật ≥ 1 workflow (web-ci).

### 4.2 WAVE 1 — "Đóng AI gap + mở đường B2B" (P0 · 90 ngày · 11 slice)

| Slice | Nội dung | Nền tảng đã có | Effort | Vì sao P0 |
|---|---|---|---|---|
| **W1.1** | **AI assistant chat** grounded vào dữ liệu VN của chính VNInvest + **trích dẫn nguồn** | 6 provider (`ai_clients/__init__.py:21-62`) · orchestrator · audit log | **L** | FireAnt Copilot + TV Copilot + Robinhood Cortex **đều đã có**; là điều kiện không chuyển sang FireAnt |
| **W1.2** | **NL-screener**: prompt tiếng Việt → filter + cột + thứ tự, có **Explanation** minh bạch từng filter | 42 field (`screener_helpers.py:70-94`) + `ScreenerRule` | **M** | FireAnt Lọc AI + TV AI Screener (paywall 100–500 req/tháng) ⇒ **chi phí thấp, giá trị cao** |
| **W1.3** | **Backtest/paper trading với giả định VN**: lô 100 · T+2,5 · phí 2 chiều · PIT bán 0,1% · slippage · khớp giá mở cửa phiên kế tiếp | 2 engine backtest + widget Strategy Tester | **M** | **Khác biệt duy nhất vs TradingView**; đồng thời sửa nhãn *"Giá chưa trừ phí/thuế"* (`AdvisoryBacktestPanel.js:104`) |
| **W1.4** | **Tax-aware P/L 0,1%** + lot-level cost basis + báo cáo lợi nhuận sau thuế | ledger `tax`/`taxes_paid` (`ledger/holdings.py:163,181,252-277`) | **S** | Không đối thủ VN nào làm · điều kiện bán cho khách nghiêm túc |
| **W1.5** | **Risk metrics bổ sung** sharpe / sortino / correlation | `ledger/analytics.py:328-391` đã có vol/VaR/DD/beta/alpha | **S** | Bảng giá sản phẩm; cần sửa test khẳng định "không expose" (`test_portfolio_metrics.py:95-99`) |
| **W1.6** | **Top movers / market pulse** (1 trang) | screener đã sort momentum | **S** | Tác động DAU hằng ngày |
| **W1.7** | **Screener theo ngành/chỉ số** | 6 SECTOR group + `StockProfile.industry` | **S–M** | Tiền đề cho RRG (W2.3) + heatmap (W1.8) |
| **W1.8** | **Heatmap theo ngành** (bật lại scope ngành) | `components/dashboard/PortfolioHeatmap.js` **đã có 593 LOC** | **S** | Fidelity heatmap **miễn phí** ⇒ không monetize riêng, đóng gói vào Pro |
| **W1.9** | **Giá theo seat + platform fee** (monetization enabler) | `plan_catalog.py` + `Invoice.line_items` + Stripe | **M** | **0 hit `seat` toàn repo** ⇒ chưa đóng gói được cho broker/cố vấn |
| **W1.10** | **Kênh cảnh báo Zalo (OA) + Telegram/Slack** | `outbound_notification_service.py` (email/FCM/WebPush sẵn) | **M** | **Zalo là moat VN** — chưa đối thủ nào có |
| **W1.11** | **Bảng giá công khai + landing B2B + demo tenant** | `commercial/public_urls.py:6` legal pages + plan catalog | **M** | Tiền đề mọi doanh thu tier |

**Định nghĩa "Done" W1:** AI chat chạy trên dữ liệu VN thật **có trích dẫn** · NL-screener sinh đúng filter **có Explanation** · backtest khớp 1 case số liệu thật của FireAnt (lô 100 + phí 2 chiều + PIT) · `seat` có trong `PLAN_ENTITLEMENTS` + `Invoice.line_items` + Stripe quantity · Zalo gửi thật 1 tin · **≥1 khách hàng B2B ký trial Business tier** · bảng giá publish.

### 4.3 WAVE 2 — "Chiều sâu dữ liệu + chiều sâu thực thi" (P1 · 90–180 ngày · 10 slice)

| Slice | Nội dung | Effort | Ghi chú |
|---|---|---|---|
| **W2.1** | **Corporate actions** — model sự kiện (ex-date, tỷ lệ split/rights) + nguồn dữ liệu + điều chỉnh giá `is_adjusted` + overlay chart | **M–L** | Phần khó là **nguồn dữ liệu** (có thể phải mua feed). Widget đã có `showCorporateEvents` |
| **W2.2** | **Tài chính cơ bản nhiều năm chuẩn hoá** — model (đã bị xoá ở `0006_remove_stockfundamental`) + backfill + chuẩn hoá + YoY thật (fix bug `revenue_growth_yoy`) | **L** | Nền cho W2.3 |
| **W2.3** | **Định giá + fundamental screener**: DCF · P/B · Graham Number · Z-Score · F-Score · Dupont | **M** | W2.2 là tiền đề |
| **W2.4** | **Pre-trade risk control**: đọc buying power → chặn/cảnh báo sức mua & margin | **M** | Rào cản procurement B2B |
| **W2.5** | **Conditional orders** (OCO · Up/Down · Trailing) trên DNSE + **mở lane SSI/TCBS** (đang "coming soon") | **M** | `BrokerSettingsSection.tsx:259-282`; SSI iBoard đã chứng minh khả thi ở VN |
| **W2.6** | **Export/SDK cho quant**: Excel add-in + Python SDK | **M** | FireAnt for Excel chỉ Cao Cấp ⇒ cửa vào B2B |
| **W2.7** | **PWA**: `manifest.webmanifest` + service worker + install prompt + push | **S–M** | Thay cho app native (XL). Cần `packages/web/public/` (**đang không tồn tại**) |
| **W2.8** | **Bật hết 59 indicator + Pine Editor + multi-chart layout** (đang tắt: `VNStockChartPanel.js:157-186,257,259`) + xoá 10 i18n dead key | **S–M** | Chi phí thấp, hiệu ứng cao — *"độ sâu" là điểm yếu đã biết* |
| **W2.9** | **Chart layout save & share** (server-side, theo account) | **M** | Giữ chân + khác biệt FireAnt |
| **W2.10** | **AI proactive digest** (mỗi sáng: "danh mục tăng/giảm vì…") | **M** | Khác biệt "AI có" vs "AI hữu ích" |

### 4.4 WAVE 3 — "Nền tảng B2B + AI content" (P1–P2 · 6–12 tháng · 7 slice)

| Slice | Nội dung | Effort | Đối thủ tham chiếu |
|---|---|---|---|
| **W3.1** | **Advisor/client workspace** — client portfolios, model portfolio, attribution, báo cáo định kỳ có branding, import statement | **L** | Koyfin Advisor Core $209 / Pro $299 |
| **W3.2** | **AI report / slide** cho môi giới & content creator | **M** | FireAnt AI Report (chỉ Cao Cấp 5,75tr/12th) |
| **W3.3** | **White-label widget** (từ advertising widget sẵn có) | **M** | TradingView Enterprise |
| **W3.4** | **Orderflow tier pro** — volume profile, footprint, TPO (bật cái đã có trong widget) + **foreign/proprietary flow depth** (điểm khác biệt VN) | **M** | TV Plus $29,95 / Premium $59,95 |
| **W3.5** | **Target allocation + auto-rebalance + sub-account theo mục tiêu + DRIP** | **M** | VNDIRECT MYDGO · eToro |
| **W3.6** | **Hóa đơn VAT điện tử** (MISA/VNPT) | **M** | Rào cản procurement B2B ở VN |
| **W3.7** | **Data licensing tier** — phí dữ liệu theo volume + partner data API | **M** | Bloomberg tách phí data + phí sàn · Webull Overage |

### 4.5 WAVE 4 — "Dài hạn / ghi để dành" (P3 · 12–24 tháng · 5 slice)

W4.1 App native iOS/Android (chuyển `packages/mobile` từ scaffold → app thật) · W4.2 Agent AI sandbox-first (MCP/REST tools, mặc định paper trading, 2 lớp xác nhận cho live) · W4.3 Robo-advisor lite (compliance) · W4.4 Chỉ báo cộng đồng (Pine marketplace) + widget OS · W4.5 Trái phiếu / tín dụng.

### 4.6 Tổng effort & phụ thuộc

| Wave | Slice | Effort (ed) | Phụ thuộc cứng |
|---|---|---|---|
| W0 | 8 | ~25–30 | — (đi trước tất cả) |
| W1 | 11 | ~70–90 | W0.6 (fail-closed) · W0.7 (provider) · W1.7 → W1.8 |
| W2 | 10 | ~60–80 | W2.2 → W2.3 · W1.3 → W2.5 |
| W3 | 7 | ~45–60 | W1.9 (seat) → W3.1 · W2.1 (corporate actions) → W3.5 DRIP |
| W4 | 5 | ~60–90 | W2.7 (PWA) → W4.1 |

**Tổng ~260–350 engineer-day** cho W0–W3 (tương đương 4–6 agent song song × 2 tháng). Cần **coordinator** phân bổ theo DAG, không chia theo file.

---

## 5. MONETIZATION

### 5.1 Bảng giá đối thủ (đã verify từ trang bảng giá chính thức)

| Sản phẩm | Giá | ≈ VND/tháng | Nguồn |
|---|---|---|---|
| FireAnt Thiết Yếu | 1.429.000đ/năm | **119.000đ** | `company.fireant.vn/bang-gia` |
| FireAnt Chuyên Nghiệp | 3.830.000đ/năm | **319.000đ** | cùng trên |
| FireAnt Cao Cấp | 5.750.000đ/năm | **479.000đ** | cùng trên |
| TradingView Essential | $12,95/tháng | ~337.000đ | `tradingview.com/pricing/` |
| TradingView Plus | $29,95 | ~779.000đ | cùng trên |
| TradingView Premium | $59,95 | ~1.559.000đ | cùng trên |
| TradingView **AI Copilot add-on** | $7,50/tháng | ~195.000đ | đối thủ 3rd-party review |
| Koyfin Plus / Premium | $39 / $79 | ~1.014.000 / 2.054.000đ | `koyfin.com/pricing/` |
| **Koyfin Advisor Core / Pro** | $209 / $299 | **5.434.000 / 7.774.000đ** | cùng trên |
| Robinhood Gold | $5/tháng | ~130.000đ | robinhood.com |
| Moomoo Engine | $3,99/tháng | ~104.000đ | moomoo.com |
| Bloomberg Terminal | $31.980/năm/seat | ~2.665.000đ/tháng | third-party |
| FactSet Workstation | ~$12k–30k/năm | ~1tr–2,5tr/tháng | third-party |

**Điểm định vị:** sàn VN 119k–479k/tháng · trần retail quốc tế 1–2tr/tháng · trần pro/B2B 5,4–7,8tr/tháng/seat.

### 5.2 6 tier đề xuất (đối chiếu catalog hiện tại)

> Catalog hiện tại: `free` · `starter` (100.000đ/30 ngày) · `pro` (500.000đ/180 ngày) · `enterprise` (900.000đ/360 ngày) — `commercial/plan_catalog.py:35-46`. Đề xuất dưới đây **mở rộng**, không phá catalog cũ.

| Tier | Tên | Giá đề xuất | Thay đổi so với hiện tại | Bổ sung |
|---|---|---|---|---|
| **0** | **Free** | 0đ | `free` đã có (`plan_catalog.py:63-72`) | + giới hạn watchlist 30 mã, screener ≤10 tiêu chí, AI advisory 3 lượt/tháng, **có quảng cáo** |
| **1** | **Basic** | **149.000đ/tháng** · 1.490.000đ/năm | = `starter` giá 100k + **giá theo số** | + realtime, watchlist không giới hạn, lịch quét screener, alert email/push/**Zalo**, **AI chat 100 lượt/tháng**, export CSV |
| **2** | **Pro** | **499.000đ/tháng** · 4.490.000đ/năm | ≈ `pro` 500k (giữ) | + NL-screener, **paper trading + backtest giả định VN**, conditional orders, whale signals đầy đủ, heatmap, corporate actions, webhooks, export XLSX, Slack/Telegram, AI chat 500 lượt |
| **3** | **AI Add-on** | **199.000đ/tháng** | **MỚI** (mô hình TradingView Copilot) | AI chat không giới hạn, AI report/slide, NL-screener không giới hạn, ưu tiên model |
| **4** | **Business / Tenant** | **3.000.000–8.000.000đ/tháng/tenant + 1.290.000–1.990.000đ/tháng/seat** | **MỚI** (cần W1.9) | tenant admin console, SSO/SAML, audit, partner API, white-label widget, **client/advisor workspace**, AI budget theo tenant |
| **5** | **Enterprise** | **15.000.000–60.000.000đ/tháng/tenant + phí dữ liệu theo volume** | `enterprise` 900k/360d → **thay bằng** | API giao dịch thương mại, data licensing, SLA 99,9%, triển khai |

### 5.3 Ma trận entitlement — code cần có (hiện tại **THIẾU**)

| Nhóm | Free | Basic | Pro | AI add-on | Business | Enterprise | **Cần code** |
|---|---|---|---|---|---|---|---|
| Realtime market data | delayed | ✓ | ✓ | ✓ | ✓ | ✓ | `realtime` flag trong entitlement |
| Screener nâng cao + lịch quét | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | `screener_advanced` |
| NL-screener | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `nl_screener` |
| AI chat | ✗ (3 lượt) | 100 | 500 | ∞ | ∞+quota | ∞+quota | `ai_chat_monthly` (**mới**) |
| Backtest giả định VN | ✗ | cơ bản | ✓ | ✓ | ✓ | ✓ | `backtest_vn` |
| Paper trading | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `paper_trading` (**mới**) |
| Conditional orders | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `conditional_orders` (**mới**) |
| Whale / order-flow | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `whale_signals` |
| Order placement | ✗ | ✗ | ✓ (DNSE) | ✓ | ✓ | ✓ | `order_placement` |
| Webhooks / API read | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `webhooks` đã có |
| Export XLSX / SDK | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | `exports` đã có |
| **Số seat** | 1 | 1 | 3 | 3 | theo HĐ | không giới hạn | **`seats` (mới — W1.9)** |
| Tenant admin + SSO + SOC + audit | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | `sso` đã có; thêm `soc`, `tenant_admin` |
| Client/advisor workspace | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | `advisor_workspace` (**mới — W3.1**) |
| Quảng cáo | có | ✗ | ✗ | ✗ | ✗ | ✗ | `ads` (**mới** — tách khỏi paid tier) |

### 5.4 Nguồn doanh thu ngoài subscription

| Nguồn | Mô hình | Điều kiện |
|---|---|---|
| Affiliate/referral broker | hoa hồng mở tài khoản + khối lượng | Cần rà soát pháp lý UBCKNN về referral fee — **CHƯA XÁC MINH** |
| Data licensing | thuê dữ liệu VN cho quant/tổ chức | Cần xác minh giấy phép cung cấp dữ liệu VSDC/HOSE — **CHƯA XÁC MINH** |
| Paper trading / sandbox B2B | phí theo tenant | Moomoo Sandbox · Webull Institutional |
| AI usage overage | trả theo token | Khớp SOC có budget control (`advisory/models.py:408` `AIDeployment`) |
| Ads | free tier | Đã có `advertising/` widget |
| Model portfolio / robo-lite | phí quản lý | Cần compliance |

---

## 6. QUY TRÌNH THỰC THI

### 6.1 Pipeline 8 bước (theo `docs/AGENT_PROTOCOL.md`)

1. **Isolate** — `scripts/new-agent.ps1` tạo branch `feat/<tên-agent>`; **tên branch phải khớp đúng tên agent trong claim** (L-M02).
2. **Plan** — nạp skill `project-lessons` trước; plan phải ghi `Lessons áp dụng: [L-…]` hoặc `NONE – <lý do>`.
3. **Audit plan** — đối chiếu plan ↔ code thật; mọi reference phải `read`/`grep` xác nhận tồn tại.
4. **Claim** — append vào cuối `docs/CLAIMS.md`, **commit riêng, trước khi sửa dòng đầu tiên** (L-002).
5. **Code** — theo slice, không gộp. Không commit file shared (deny-list §2).
6. **Audit code** — fail-before đo được + fail-after + `git diff --numstat` không phình (L-T01).
7. **Test** — gate chạy thật trên code **sau rebase** (L-G01). Ghi rõ `PASS` | `FAIL` | **`CHƯA CHẠY`** (L-G02).
8. **Merge** — `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → gate) → claim `done` → push → `pwsh -File scripts/agent-pr.ps1`.

### 6.2 Definition of Done (bắt buộc cho mọi slice từ W0 trở đi)

| # | Điều kiện | Lệnh kiểm |
|---|---|---|
| 1 | Fail-before **đo được** trước khi sửa | script/gate có exit code khác 0 |
| 2 | Type-check | `npx tsc --noEmit` (FE) · `python manage.py check` (BE) |
| 3 | Lint | `npm run lint` — **0 error** (warning chấp nhận, ghi rõ số) |
| 4 | Test | `npm run test:components` + `npm run test` — **0 fail**; BE: `pytest` trên **Postgres riêng** (không phải SQLite — `array_agg` fail) |
| 5 | Migration | `makemigrations --check --dry-run` = không đổi, hoặc migration do `makemigrations` sinh (**không tự đặt số**) |
| 6 | i18n | `npm run i18n:scan:strict` = 0 · vi↔en **cùng số key** |
| 7 | Token/CSS | token → `soc.tokens.css` · class → `soc.components.css` (**KHÔNG** `soc.module.css`) (L-F03) |
| 8 | A11y | `check:contrast` + `check:theme-contrast` + `check:focus-ring` = 0 |
| 9 | Contract | `route-contract.test.js` cover **100%** endpoint FE gọi |
| 10 | Bằng chứng hình ảnh | **mở ảnh ra xem**, chụp **sau** khi nội dung render, đúng **2 theme** (L-V05, L-F12) |
| 11 | Working tree | `git status --short` chỉ có file cố ý (L-V03) |
| 12 | Ledger | append **1 `## Entry N`** ở đầu `docs/CODE_CHANGE_AUDIT_LEDGER.md` |
| 13 | Lessons | nếu mắc lỗi đủ 4 điều kiện §1.3 `docs/LESSONS/INDEX.md` ⇒ ghi ngay trong phiên |
| 14 | Bài học mới | `node scripts/check-lessons.mjs` = 0 (C1 ≤120 dòng · C2 ≤60 lesson · C3 khớp INDEX) |

### 6.3 Gate hiện có (28) — sau W0.1 sẽ là ≥31

`syntax` · `encoding` · `secret-scan-selftest` · `secret-scan` · `i18n-strict` · `audit-status` · `system-design` · `preflight-selftest` · `global-config-drift` · `shim-delegate` · `preflight-trailer` · `preflight-deny-extract` · `hook-mode` · `i18n-strict-selftest` · `tsc --noEmit` · `check-multi-agent` · `check-ai-cc` · `lessons` · `admin-ux` · `admin-routes` · `admin-routes-selftest` · `envelope-contract` · `openapi-budget` · `ui-check-token-conflict` · `ui-check-heading-contract` · `ui-check-focus-ring` · `ui-check-theme-contrast` · `ui-check-a11y-runtime`

**13 script mồ côi cần nối hoặc khai báo bỏ** (W0.1): `check-light-theme` · `check-portfolio-contrast` · `check-uiux-budget` · `measure-route-graph` · `measure-theme-tokens` · `slice-e-hardcode-scan` · `verify-admin-fixes` · `verify-admin-nginx-routing` · `verify-envelope-wiring` · `verify-envelope` · `css-loader` · `find-extensionless` · `fix-esm-imports`.

---

## 7. RỦI RO & CÂU HỎI CẦN OWNER CHỐT

### 7.1 Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | **Định giá "AI khuyến nghị" = tư vấn đầu tư** (crossing từ công cụ) | Cao | Rà soát UBCKNN **trước** khi publish bảng giá AI add-on. **CHƯA XÁC MINH** |
| R2 | **Bán lại dữ liệu thị trường VN** — bản quyền VSDC/HOSE | Cao | Chỉ bật W3.7 sau khi có ý kiến pháp lý. **CHƯA XÁC MINH** |
| R3 | Chọn sai khách hàng trả tiền chính (retail vs B2B) — 2 mô hình giá chênh 10× | Cao | W1.9 + W1.11 phải chạy **song song**; demo tenant cho 3 khách B2B trước khi invest W3.1 |
| R4 | Nguồn dữ liệu corporate actions có sẵn hay phải mua feed | TB–Cao | W2.1: khảo sát giá feed **trước** khi commit effort L |
| R5 | **Gate vẫn xanh giả** sau W0 nếu CI không bật | Cao | W0.1 + W0.8 cùng lúc; AC: CI ≥1 workflow chạy thật |
| R6 | `packages/web` là **package thật** hay chỉ app? Quyết định có cần `exports` hợp lệ | TB | W0.3 — Owner chốt: giữ `exports` (sửa `.ts`→`.js`) hay xoá |
| R7 | Xung đột claim với agent khác đang chạy (CLAIMS.md 524 KB, 1723 dòng, nhiều claim `in-progress` cũ) | TB | Kiểm tra `docs/CLAIMS.md` trước mỗi slice |
| R8 | Agent đọc tài liệu trạng thái **stale** (ROADMAP_STATUS 6 tháng) ⇒ quyết định sai | Cao | W0.8 trước mọi wave khác |

### 7.2 8 câu hỏi cần Owner chốt

| # | Câu hỏi | Ảnh hưởng | Hạn |
|---|---|---|---|
| **Q1** | **Khách hàng trả tiền chính là retail NĐT hay Business/tenant?** | Quyết định 70% effort của W1–W3 | Trước W1.9 |
| **Q2** | Có được định giá **"AI khuyến nghị"** không (UBCKNN)? | Bật/tắt AI add-on + NL-screener | Trước W1.1 |
| **Q3** | **Ai trả phí giao dịch DNSE** — VNInvest thu commission hay chỉ là công cụ? | Mô hình doanh thu cốt lõi | Trước W1.9 |
| **Q4** | `packages/web` có được consume như **npm package thật** không? | W0.3 giữ hay xoá `exports` | Trước W0.3 |
| **Q5** | **OpenClaw**: cấp D-03c (protocol/base URL/auth) hay **gỡ khỏi danh sách provider**? | W0.7 + chặn user mới (`advisory/models.py:250`) | Trước W0.7 |
| **Q6** | **SAML SSO** production có dùng thật không? (`strict` hiện luôn raise) | W0.7 — fail-closed chấp nhận được hay phải cài `python3-saml` | Trước W0.7 |
| **Q7** | **Depth chart giả** — tắt UI hay gắn nhãn "ước tính"? | W0.6 | Trước W0.6 |
| **Q8** | **Push notification** đã có key FCM/VAPID production chưa? | W0.6 (đang trả `True` giả) | Trước W0.6 |

---

## 8. PHỤ LỤC

### 8.1 Bản đồ file theo lớp

| Lớp | Vị trí | Quy mô |
|---|---|---|
| Django app | `packages/core/backend/src/<app>/` | 16 app · 396 file `.py` |
| URLconf gốc | `packages/core/backend/src/vninvest_core/urls.py` | 109 dòng |
| Plan catalog (SSOT giá) | `packages/core/backend/src/commercial/plan_catalog.py` | 201 dòng |
| Route catalog (FE) | `packages/web/src/app/routeCatalog.js` | 69 entry |
| Page registry (FE) | `packages/web/src/pages/pageRegistry.js` | 67 entry |
| Runtime routes (FE) | `packages/web/src/main.tsx` | 70 `<Route>` |
| Navigation | `packages/web/src/app/navigationCatalog.js` + `layouts/full/vertical/sidebar/sidebaritems.ts` | 18 item |
| Adapter layer | `packages/web/src/adapters/core/` | 11 domain client · 369 lệnh HTTP |
| Chart widget | `packages/web/node_modules/vninvestcharts-widget@1.2.5` | 59 indicator · Pine Editor · Strategy Tester |
| SOC tokens/classes | `packages/web/src/components/soc/soc.tokens.css` (211) · `soc.components.css` (4 061) | **KHÔNG** dùng `soc.module.css` (barrel 3 dòng) |
| i18n | `packages/web/src/i18n/vi.js` (7 346) · `en.js` (7 314) | 95 namespace |
| Gate máy | `scripts/pre-push-gate.mjs` (520) · `packages/web/scripts/` (38) | 28 gate đang chạy · 13 mồ côi |
| Bằng chứng | `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 393) · `docs/CLAIMS.md` | — |

### 8.2 Chỉ số đo (dashboard dùng cho mỗi wave)

| Chỉ số | Hiện tại | Mục tiêu cuối W3 |
|---|---|---|
| Route catalog | 69 | 85+ |
| Endpoint có contract test | ~95% (adapter) | **100%** |
| Stub BE còn lại | 28 | **0** |
| Code chết định lượng | ~3 000 LOC (`admin_ops` 2 126 + registry shadow 837) | **0** |
| Năng lực competitive | HAVE 9 / PARTIAL 13 / MISSING 11 | **HAVE ≥22** |
| Indicator bật trong app | 7 / 59 | **59** |
| Gate trong pre-push | 28 | **≥31** + CI ≥1 workflow |
| Tài liệu trạng thái stale | 3 | **0** |
| Entitlement keys | 8 | **≥18** |
| Tier giá publish | 0 | **6** |

### 8.3 Tài liệu phải đọc khi bắt đầu wave

- Wave 0: `docs/AGENT_PROTOCOL.md` §2 (deny-list) §10 (đóng phiên) §11 (planning gate) · `docs/LESSONS/INDEX.md` §1.2.1 (C1/C2/C3) · `docs/LESSONS/build-gates.md` (L-G01, L-G02, L-G08) · `docs/LESSONS/verification.md` (L-V01…L-V07)
- Wave 1: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (46 slice · 6 wave · 7 quyết định D-01…D-07) — **R0–R5.3 đã merge**, dùng làm mốc, không dùng làm trạng thái
- Wave 2: `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` (85 KB) · `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (100 KB)
- Wave 3: `docs/SAAS_PLATFORM_DESIGN_20261002.md` (34 KB) · `docs/COMMERCIAL_COMPARISON_ROADMAP_20260726.md`
- Mọi wave: `docs/OPEN_WORK_20260927.md` + `docs/OPEN_WORK_SEC_20260929.md` (2 file **khác nhau** cùng dùng số `OW-01..OW-05` — luôn ghi rõ tên file khi tra cứu)

### 8.4 Ghi chú trung thực

- **Chưa chạy** (ghi `CHƯA CHẠY` theo L-G02): `npm run test` toàn bộ · `npm run test:components` toàn bộ · BE `pytest` toàn bộ (cần Postgres riêng — **không chạy được trên SQLite** vì `identity_access/9000_auth_user_email_ci_unique.py:60` dùng `array_agg`) · E2E Playwright · ảnh chụp thật sau khi sửa · deploy staging.
- **Baseline BE test đã biết** (tại `e01dbf3d`): `602 test — failures=10, errors=3` — dùng làm mốc, đừng điều tra lại (`docs/OPEN_WORK_20260927.md:488-503`).
- **1 flake FE đã biết**: `useAlertCenterSnapshot.pagination.component.test.ts` fail không ổn định trong full suite (riêng file luôn 3/3) — **không** quy cho code mới.
- **Đối thủ trực tiếp ở nhóm data/analysis VN là FireAnt, không phải TradingView.** Bất kỳ roadmap nào không so với FireAnt là so sai.
- Tài liệu này **lập trên context do Owner cung cấp + đọc code thật**. Mọi ô `?` đã verify bằng grep/reader thật trên `packages/core` + `packages/web`; riêng 5 năng lực nằm trong widget npm cần **click thật** để khẳng định reachability.
