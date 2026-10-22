# ROADMAP MASTER 2026Q4 → 2027 — Hiện trạng toàn bộ tính năng & lộ trình cạnh tranh toàn cầu

> **Ngày lập:** 2026-10-21 · **HEAD khi viết:** `e5f934ff9` (branch `dev`) · **Claim:** `master-roadmap-2026q4` (`docs/CLAIMS.md`)
> **Vai trò:** PM code lead + system frontend designer · **Phạm vi:** toàn bộ repo `vninvest` (5 package track)
> **Tài liệu liên quan:** `docs/COMPETITIVE_BENCHMARK_20261021.md` (benchmark 4 lớp đối thủ, 108 URL) · `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 393) · `docs/OPEN_WORK_20260927.md` · `docs/OPEN_WORK_SEC_20260929.md`
> **Lessons áp dụng:** L-V01 (script đo phải có control) · L-V02 (gốc rễ kế thừa phải có phản chứng) · L-V04 (assert giá trị thật) · L-G02 (không báo PASS cho thứ chưa chạy) · L-G04 (số đếm phải tách mức độ) · L-G07 (đếm route theo registry, không theo tên file) · L-T01 (append byte-exact, không đổi line-ending) · L-T02 (citation đúng file + dòng) · L-F03 (token → `soc.tokens.css`, class → `soc.components.css`)

---

## 0. Tóm tắt điều hành

> **Bản 2 (2026-10-21) — đã pivot theo quyết định Owner.** Bản 1 định vị B2B2B là hướng chính; **Owner đã chốt đổi**: ưu tiên **người dùng cuối (retail)**, **giai đoạn đầu miễn phí, chấp nhận không có doanh thu**, mục tiêu là **lấy brand name**; B2B (nhà phát triển ký hợp đồng) để sau, khi hệ thống đủ tốt. Mọi phần còn lại của tài liệu đã viết lại theo hướng đó. Xem §1.1 (8 quyết định) và §1.2 (hệ quả chiến lược).

1. **Sản phẩm trả tiền (sau này) là retail, và thứ họ mua là thứ chỗ khác không có: charts · whale · dark flow · AI phân tích kỹ thuật.** Không phải "nhiều tính năng" mà là **dữ liệu dòng tiền + tín hiệu** mà TradingView/moomoo/Webull/Bloomberg **không có cho thị trường VN**.
2. **Hai tầng ứng dụng trên mỗi broker lane (DNSE/SSI/TCBS)**: (a) **người dùng cuối** → portfolio của chính họ; (b) **staff COC** → thông tin thị trường. ⇒ **2 tài khoản riêng biệt, không dùng chung.** Hiện code **chưa có** khái niệm credential broker cấp tenant/staff (chỉ có `UserBrokerConfig` per-user + 1 `SystemBrokerCredential` global) ⇒ đây là **slice kiến trúc P0** (§4.3 W1.4).
3. **AI = phân tích kỹ thuật, KHÔNG phải khuyến nghị đầu tư; hệ thống KHÔNG đặt lệnh trừ khi có hợp đồng riêng.** Hôm nay LLM **được yêu cầu** trả `signal: BUY|SELL|HOLD` + `target_price` + `recommendation` (`orchestrator.py:717-723`) và ~35 chuỗi UI nói "khuyến nghị" ⇒ phải đổi **contract đầu ra của LLM + tầng UI**, không chỉ đổi câu chữ.
4. **Trung thực dữ liệu là vấn đề P0, không phải P2.** Retail sẽ trả tiền cho "dữ liệu mà chỗ khác không có" — nên **order book trên biểu đồ đang là dữ liệu giả** (`native_views.py:430` tự ghi *"mock implementation"*, `:450` `is_mock: True`) mà app **đang tiêu thụ** (`chartAdapter.js:160`) là **rủi ro niềm tin lớn nhất**. Whale/dark flow thì **thật** (tick thật → `UnifiedAlert`/`WhaleAlertCanonical`; `dark_flow_score` = |net CVD|/total value — là **absorption proxy**, cần ghi rõ trong UI).
5. **Nền tảng kỹ thuật có 3 "false-green" gate** (`check-light-theme` không wire · OC-19 doc-sync path legacy · CI 1/9 workflow) ⇒ mọi "PASS" sau này không kiểm chứng được nếu không dọn Wave 0 trước.
6. **Giai đoạn đầu: miễn phí, không doanh thu — vậy mục tiêu đo là brand name.** ⇒ ưu tiên **kích hoạt & giữ chân** (activation funnel, referral, PWA/mobile, push) thay vì entitlement/pricing. **0 referral/affiliate** trong toàn repo · **không PWA** (`packages/web/public` không tồn tại) · trial 14 ngày (`onboarding_views.py:137`) — cần nghĩ lại vì "free" nghĩa là không hết hạn.
7. **Không nên làm:** fractional shares (lô 100) · options/crypto/prediction (giấy phép) · desktop app (VN mobile-first) · social community "đầu cơ" · **đặt lệnh trong sản phẩm** (ngoài phạm vi hợp đồng) · **bán theo seat / advisor workspace** (để sau — B2B giai đoạn 2).

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

## 1.1. QUYẾT ĐỊNH OWNER — 2026-10-21 (8 câu, đã chốt)

| # | Câu hỏi (bản 1) | **QUYẾT ĐỊNH** | Hệ quả kỹ thuật bắt buộc |
|---|---|---|---|
| **D1** (Q1) | Khách trả tiền chính là retail hay B2B? | **RETAIL** — cần thông tin thị trường mà chỗ khác không có: **charts, whale, dark flow, AI advisory** | Xoá ưu tiên per-seat / advisor workspace khỏi W1. Đưa **dữ liệu whale/dark flow/AI** lên hàng đầu. Toàn bộ benchmark "white-space" phải đọc lại theo lăng kính retail |
| **D2** (Q2) | Được định giá "AI khuyến nghị" không? | **AI mang tính KỸ THUẬT (phân tích kỹ thuật)**. **Hệ thống KHÔNG hỗ trợ đặt lệnh trừ khi có hợp đồng riêng** | ① Đổi **contract đầu ra LLM**: `signal: BUY\|SELL\|HOLD` + `target_price` + `recommendation` → hướng kỹ thuật (`orchestrator.py:717-723`). ② Đổi ~35 chuỗi i18n "khuyến nghị" (`vi.js:3789,3794,3795,4505,4507,5176,5216,5230-5235,6794,6950,7023`…). ③ **Gỡ order placement khỏi sản phẩm** (giữ `paper` mode) — `views_dnse.py:390-399` đã chặn `live` cứng, giữ nguyên + ghi rõ |
| **D3** (Q3) | Ai trả phí giao dịch DNSE? | **Mỗi lane broker (DNSE/SSI/TCBS) có 2 tầng ứng dụng**: (a) **người dùng cuối** → portfolio; (b) **staff COC** → thông tin thị trường. ⇒ **2 tài khoản riêng biệt** | Cần **credential broker cấp tenant/staff** tách khỏi `UserBrokerConfig` (per-user). Hôm nay chỉ có: `UserBrokerConfig` (`user` NOT NULL, `user_workspace/models.py:819-825`) + `SystemBrokerCredential` **global 1 row/provider** (`identity_access/models.py:974-977`). Tên "COC" **đã bị chiếm** bởi *Center Operations Center* (`docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md:1`) ⇒ đặt tên role mới, ví dụ `broker_operator` |
| **D4** (Q5) | OpenClaw: cấp protocol hay gỡ? | **OpenClaw là TÍNH NĂNG HỔ TRỢ** | Không phải provider giao dịch chính. `advisory/ai_clients/openclaw.py:44` `SUPPORTED_PROTOCOLS = ()` ⇒ mọi call 503. Cần: implement protocol **hoặc** định vị lại thành "trợ lý hỗ trợ" + fail-closed rõ ràng (không để user hiểu là AI chính đang chết) |
| **D5** (Q6) | SAML production dùng thật không? | **DÙNG THẬT TRONG TƯƠNG LAI** | Không chấp nhận `strict`-luôn-raise là trạng thái vĩnh viễn. `python3-saml` **đã có** trong `requirements.txt:46`; `libxmlsec1-dev` + `xmlsec1` **đã có** trong `Dockerfile:19,58` ⇒ chỉ thiếu code verify (BL-01b) tại `saml_service.py:402-406` |
| **D6** (Q7) | Depth chart giả: tắt hay gắn nhãn? | **ƯỚC TÍNH** (giữ, gắn nhãn) | Không tắt UI. Nhưng phải: (a) gắn nhãn "ước tính" ở **mọi** nơi hiển thị, (b) **không** để chart order book ngầm dùng mock — `chartAdapter.js:160` gọi `getRealtimeDepthChart` ⇒ `native_views.py:450` `is_mock: True` |
| **D7** (Q8) | Đã có key FCM/VAPID production chưa? | **CHƯA CÓ — tính năng tương lai** | Không được báo thành công giả. `outbound_notification_service.py:56-57,102-103` trả `True` khi thiếu key ⇒ phải trả `skipped`/`not_configured` **kèm lý do**, và UI phải nói "chưa bật" |
| **D8** (mới) | Ai trả tiền khi nào? | **B2B để sau** (khi hệ thống đủ tốt, có nhà phát triển ký hợp đồng). **Giai đoạn đầu MIỄN PHÍ, chấp nhận không có doanh thu** — mục tiêu là **lấy brand name** | Toàn bộ §5 cũ (6 tier + giá) **chuyển sang "giai đoạn 2"**. Thay bằng: (a) **mục tiêu đo = brand name** ⇒ đo **activation, DAU, retention, referral, brand search**, không đo MRR. (b) Bỏ `plan`/entitlement gating khỏi đường **giá trị cốt lõi** (whale/dark flow/AI/chart) — đây là thứ định vị thương hiệu. (c) Trial 14 ngày (`onboarding_views.py:137`) **không còn hợp lý** khi sản phẩm free ⇒ cần chính sách mới |

### 1.2. Hệ quả chiến lược (những gì bản 1 nói sai)

| Tuyên bố ở bản 1 | Trạng thái sau D1–D8 | Lý do |
|---|---|---|
| "Khoảng trống doanh thu lớn nhất = giá theo seat" | ❌ **Hạ ưu tiên** | D1: retail-first, D8: B2B để sau. Per-seat chuyển sang W3 (giai đoạn 2) |
| "W1 = AI chat + NL-screener + backtest + seat pricing + Zalo + bảng giá" | 🔁 **Đổi thứ tự** | D1+D8: trước tiên phải **có dữ liệu đáng tin** + **kích hoạt được**, sau đó mới mở rộng |
| "Đối thủ trực tiếp ở nhóm data/analysis VN là FireAnt" | ✅ Giữ | Nhưng thêm: đối thủ **cho "AI khuyến nghị"** (FireAnt Copilot) — ta **không** theo hướng đó (D2) ⇒ khác biệt là **phân tích kỹ thuật có dữ liệu dòng tiền thật** |
| "Bảng giá 6 tier" | ⏸ **Giai đoạn 2** | D8: miễn phí, chưa doanh thu |
| "AI advisory là lợi thế lớn nhất" | 🔁 **Cần làm lại** | D2: phải đổi contract LLM + UI. Giá trị còn lại = **rationale + feature attribution + dữ liệu dòng tiền thật**, không phải khuyến nghị |
| "Whale/dark flow = lợi thế khó copy" | ✅ Giữ, **nhưng phải trung thực** | Whale **thật** (`signal_intelligence/tasks.py:280-360`, source `pandas_tick_engine`) · `dark_flow_score` **thật nhưng là absorption proxy** (`session_facts_engine.py:38,205`) — phải ghi rõ trong UI, không gọi là "dấu vết cá mập" tuyệt đối |

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

## 4. LỘ TRÌNH (BẢN 2 — retail-first, free, không đặt lệnh)

> Đã viết lại toàn bộ theo D1–D8 (§1.1). **Thứ tự thay đổi so với bản 1**: trước khi mở rộng tính năng, phải **(1)** làm dữ liệu đáng tin, **(2)** đúng pháp lý sản phẩm, **(3)** có 2 tầng tài khoản broker, **(4)** kích hoạt được người dùng. Tăng trưởng/brand mới đi sau.

### 4.0 Nguyên tắc thực thi (cập nhật)

1. **M0 = W0 xanh.** Không bắt đầu W1 trước khi Wave 0 (nền + gate) đóng — nếu không, mọi "PASS" của W1+ là **không kiểm chứng được** (L-G02 + bài học 4-agent-báo-PASS → merge `198 test errors=1`).
2. **Mỗi slice = 1 PR + 1 claim + 1 ledger Entry.** Không nhét nhiều feature vào 1 PR.
3. **Trung thực dữ liệu > thêm tính năng.** Retail mua "dữ liệu mà chỗ khác không có" ⇒ **mọi giá trị `is_mock`/synthetic phải được nhãn rõ ở UI** hoặc endpoint phải fail-closed. Không được bán "ước tính" như "thật".
4. **Không bán thứ chưa có entitlement.** Trong giai đoạn free, "entitlement" = **không chặn tính năng giá trị cốt lõi** (whale / dark flow / AI / chart). Không để `plan` chặn 3 phần đó.
5. **0 hồi quy:** mọi slice có **fail-before** đo được (L-V04) + **fail-after** + gate chạy thật trên code **sau rebase** (L-G01).
6. **Đổi ngôn ngữ = đổi contract.** Với D2, không được chỉ đổi chuỗi hiển thị: phải đổi **prompt + shape JSON + serializer + component + 2 locale** cùng lúc, và có test khoá shape mới.

### 4.1 WAVE 0 — "Dọn nền để không tự đánh lừa mình" (P0 · 2 tuần · 8 slice)

| Slice | Nội dung | File chính | Effort | AC (đo được) |
|---|---|---|---|---|
| **W0.1** | **Wire gate thật**: `check-light-theme` + `eslint` + `vitest run` vào `pre-push-gate.mjs`; sửa pattern OC-19 (`^packages/core/backend/` + `^packages/web/`) | `scripts/pre-push-gate.mjs` · `scripts/quality/check_opencore_doc_sync.ps1:50-51` | **M** | Grep `light-theme` trong pre-push ≥1 hit · OC-19 self-test fail trên path sai |
| **W0.2** | **Xoá code chết**: `contracts/admin_ops` (2 126 LOC, 26 route) + `market_data/urls.py` (6) + `market_data/public_urls.py` (34) + `ops_audit/urls_parity.py` (4) | `vninvest_core/urls.py:37-42,58,62` · `market_data/urls.py:7-12` | **M** | Số `path(` trong `src/**/urls*.py` khớp URLconf thật · 2 file test contract cũ xoá cùng lúc |
| **W0.3** | **Sửa `exports`** của `packages/web/package.json` (10/10 trỏ `.ts` không tồn tại) | `packages/web/package.json:36-48` | **S** | `require.resolve` từng entry export → 0 lỗi |
| **W0.4** | **Dọn route/component chết**: 6 registry entry shadow + `PortfoliosBrokerPage` + `ShellSupportPage` + `ShellAiCommandCenterPage` + 3 feature folder rỗng | `pageRegistry.js:196-207,208-220,239` · `main.tsx:24-49` | **M** | Mọi entry registry đều được `resolvePageComponent` gọi tới (đếm theo registry, L-G07) |
| **W0.5** | **Đưa ~17 endpoint `/partner/*` về adapter** + sửa 2 cặp lệch số ít/số nhiều (`alert-config`/`alert-configs`, `trend`/`trends`) | `pages/tenant-admin/TenantAdminUsagePage.tsx:157-224` + 6 page khác · `adapters/core/operator.js:69,89` | **M** | `route-contract.test.js` quét **cả** page → 0 endpoint ngoài adapter |
| **W0.6** | **Fail-closed mọi "giả"** (D6 + D7): depth chart `is_mock` · FCM/VAPID mock · SOC whale test · `usage/meters` · `send_quota_warning` · `materialize_unified_alerts` NOOP · AI news summary null | `market_serving/native_views.py:450,520-522` · `outbound_notification_service.py:56-57,102-103` · `service_ops/views/signals.py:764-776` · `identity_access/views_tenant.py:523-528` · `commercial/tasks.py:290-302` · `market_serving/materializers.py:211-220` | **L** | Mỗi endpoint: **trả 501 + lý do** hoặc **dữ liệu thật** hoặc **UI gắn nhãn "ước tính"** — có assert |
| **W0.7** | **Đóng 3 blocker AI**: OpenClaw (D4 — định vị "tính năng hỗ trợ" + implement protocol hoặc fail-closed rõ ràng) · SAML (D5 — implement BL-01b) · `ai_agents` (app rỗng → xoá khỏi `INSTALLED_APPS` hoặc implement) | `advisory/ai_clients/openclaw.py:44` · `identity_access/saml_service.py:402-406` · `settings.py:131` | **M** | `python3-saml` **được import** và `strict` verify được 1 Response có chữ ký hợp lệ (test với fixture thật) |
| **W0.8** | **Chuẩn hoá tài liệu trạng thái** + **bật CI** (8 workflow disabled) + **khôi phục/verify ledger Entry 1–383** | `ROADMAP_STATUS.md` · `PROGRESS_DASHBOARD.md` · `docs/OPEN_WORK_20260927.md:39-40` · `AGENTS.md` (mục AI-CC) · `.github/workflows-disabled/` | **M** | Mỗi doc có "verified: <date> @ <sha>" · CI ≥1 workflow chạy thật |

**Định nghĩa "Done" W0:** `pre-push-gate` ≥31 gate · OC-19 self-test fail trên path legacy · 0 route khai báo mà không include · 0 component chết trong registry · contract test cover 100% endpoint FE gọi · 0 endpoint trả dữ liệu giả · 3 doc trạng thái có ngày verify.

### 4.2 WAVE 1 — "Dữ liệu đáng tin + đúng pháp lý sản phẩm" (P0 · 90 ngày · 8 slice)

> Đây là wave **quan trọng nhất** với chiến lược mới: một retail free mà thấy dữ liệu giả / AI khuyến nghị sẽ **không quay lại**, và không có brand name nào được xây trên nền không đáng tin.

| Slice | Nội dung | Bằng chứng cần sửa | Effort | AC |
|---|---|---|---|---|
| **W1.1** | **AI: contract đầu ra → phân tích kỹ thuật.** Bỏ `signal: BUY\|SELL\|HOLD` + `target_price` + `recommendation`; thay bằng hướng kỹ thuật: `technical_bias` (thuận/trung lập/bất lợi) · `setup` (mô hình giá) · `support_resistance` (vùng tham khảo) · `risk_level` · `confidence` · `rationale` · `technical_summary`. Đổi prompt synthesis + 3 sub-agent, serializer, component, **cả 2 locale**, thêm disclaimer "phân tích kỹ thuật, không phải khuyến nghị đầu tư" | `orchestrator.py:717-723` (contract) · `:561` (system prompt synthesis) · `advisory/serializers.py:226-243` · `orchestrator.py:481,875` (attribution) · i18n `vi.js:3789,3794,3795,4505,4507,5176,5216,5230-5235,6794,6950,7023` | **L** | Prompt test khoá shape mới (assert **không** còn key `signal`/`target_price`/`recommendation`) · 0 chuỗi "khuyến nghị" còn trong 2 locale · disclaimer hiện ở mọi màn hình AI |
| **W1.2** | **Gỡ order placement khỏi sản phẩm** (D2). Giữ `mode=paper`; `mode=live` trả lỗi rõ ràng "cần hợp đồng riêng"; đổi nhãn "phiếu lệnh" → **"phiếu thử nghiệm"**; ẩn nút "Đặt lệnh" ở stock detail; audit operation tách `broker.place_order.paper` | `views_dnse.py:390-399` (live bị chặn) · `:211,235,240` (audit operation) · `adapters/core/workspace.js:465-479` · `components/advisory/AdvisoryOrderTicket.js:7,47-59` · `components/DNSEConnectionPanel.js:247-306` · `pages/StockDetailPage.tsx:211-213` | **M** | 0 call `mode=live` trong FE · mọi nhãn lệnh có chữ "thử nghiệm"/"paper" · endpoint `live` trả 4xx + message giải thích |
| **W1.3** | **Trung thực depth chart (D6)**: `is_mock`/`source` phải đi tới FE; mọi nơi hiển thị order book gắn nhãn **"Ước tính"**; chartAdapter **không** được dùng mock mà không cảnh báo | `market_serving/native_views.py:430,450-451,520-522` · `adapters/chartAdapter.js:154-176` (điểm `:160` gọi endpoint mock) | **M** | Response depth-chart có `is_mock` ⇒ FE hiện badge "Ước tính" · test khoá badge |
| **W1.4** | **2 tầng tài khoản broker (D3)** — kiến trúc. Model mới `TenantBrokerCredential` (`tenant` + `provider` + `purpose` ∈ {`market_info`,`trade`,`backfill`}) · resolver theo tenant · endpoint SOC theo tenant (thay `get_or_create(provider=…)` global) · permission + role mới (**đừng dùng tên "COC"** — đã bị chiếm bởi Operations Center) · FE: tách panel retail vs panel staff | `identity_access/models.py:974-977` (global 1 row) · `:1017-1035` (`get_system_broker_secrets`) · `:1038-1057` (lấy credential của admin bất kỳ — **nên bỏ**) · `user_workspace/models.py:819-825` (`user` NOT NULL) · `:880-883` (unique) · `service_ops/views/broker.py:440,463` · `broker/sync_service.py:49,61,67` · `broker/base.py:80-108` (capability matrix) | **L** | 2 tenant khác nhau **không** dùng chung credential · test chứng minh 2 tenant × 3 provider = 6 row tách biệt · `data_ingest/tasks.py:2470` truyền tenant |
| **W1.5** | **Minh bạch whale / dark flow.** (a) Ghi rõ `dark_flow_score` là **absorption proxy** (`|net_cvd|/total_value`), không phải "dấu vết cá mập" tuyệt đối — hiện công thức trong UI. (b) Sửa `materialize_unified_alerts` NOOP. (c) Hiện **nguồn + độ mới** dữ liệu (provider, thời điểm, `stale`) trên mọi panel whale/dark flow | `market_serving/session_facts_engine.py:38,205` · `session_facts_engine.py:350` · `market_serving/models.py:95-101` (`source`, `stale`) · `signal_intelligence/tasks.py:280-360` (nguồn thật `pandas_tick_engine`) · `market_serving/materializers.py:211-220` · `advisory/orchestrator.py:439,452,471,484` | **M** | UI hiện công thức + nguồn + freshness · `materialize_unified_alerts` không còn NOOP · test khoá nhãn "absorption proxy" |
| **W1.6** | **OpenClaw → tính năng hỗ trợ (D4)**: định vị lại role trong UI + implement protocol nếu có, nếu không thì **fail-closed có lý do** (không để user tưởng AI chính đang chết) | `advisory/ai_clients/openclaw.py:44,153,169-172` · `advisory/models.py:250` (provider option) | **M** | 1 test: gọi openclaw ⇒ trả 200 với kết quả **hoặc** 503 có `error_code` + message tiếng Việt giải thích "tính năng hỗ trợ đang chưa bật" |
| **W1.7** | **SAML strict thật (D5)**: implement BL-01b dùng `python3-saml` (đã có `requirements.txt:46`) + `xmlsec1` (đã có `Dockerfile:19,58`) | `identity_access/saml_service.py:384-406` · `requirements.txt:46` · `Dockerfile:19,58` | **M** | Test: 1 Response có chữ ký hợp lệ ⇒ `strict` **verify pass**; Response sai chữ ký ⇒ **reject** (không chỉ "raise vô điều kiện") |
| **W1.8** | **Chính sách "free" + push not-configured (D7 + D8)**: bỏ trial 14 ngày (hoặc đổi thành "free vô hạn"); push trả `skipped` + lý do khi thiếu key; UI nói "chưa bật" thay vì im lặng | `onboarding_views.py:137` (`trial_ends_at = now + 14d`) · `tenant_lifecycle/tasks.py:111,142` (auto-expire) · `outbound_notification_service.py:39,56-57,97,102-103` | **M** | Tenant free không bị auto-expire · `send_push` thiếu key ⇒ `skipped` + `reason` + test |

### 4.3 WAVE 2 — "Chiều sâu giá trị retail" (P1 · 90–180 ngày · 9 slice)

> 4 nhu cầu D1 tương ứng 4 cụm: **chart** (W2.1–2.2) · **AI** (W2.3–2.4) · **whale/dark flow** (đã ở W1.5 + W2.7) · **backtest VN** (W2.5).

| Slice | Nội dung | Nền tảng đã có | Effort | Ghi chú |
|---|---|---|---|---|
| **W2.1** | **Bật trọn 59 indicator + Pine Editor + tape + corporate events** (đang tắt) | Widget 1.2.5 có sẵn: 59 indicator · Pine Editor + compiler + `registerSeries` · `TapePanel` · `showCorporateEvents` · `VNInvestMultiCharts` | **S–M** | App hiện chỉ bật **7 series** (`VNStockChartPanel.js:157-186`), `showTapePanel: false` (`:257`), `showCorporateEvents: false` (`:259`) ⇒ **chi phí thấp, hiệu ứng cao nhất** vì "charts" là nhu cầu #1 của retail. Xoá 10 i18n dead key `vi.js:3671-3680` |
| **W2.2** | **Chart layout lưu server + share** (hiện chỉ localStorage theo `workspaceId`) | `VNStockChartPanel.js:256` + `chartAdapter.js` | **M** | Không tự khoe "share" khi chưa có link |
| **W2.3** | **AI assistant chat** grounded vào dữ liệu VN + **trích dẫn nguồn** | 6 provider (`ai_clients/__init__.py:21-62`) · orchestrator 4 trace/refresh · audit log | **L** | Reframe theo W1.1: chat phân tích kỹ thuật, **không** ra lệnh mua/bán. FireAnt Copilot / TV Copilot / Robinhood Cortex đều đã có ⇒ điều kiện không chuyển sang FireAnt |
| **W2.4** | **NL-screener**: prompt tiếng Việt → filter + cột + thứ tự, có **Explanation** | 42 field (`screener_helpers.py:70-94`) + `ScreenerRule` (`models.py:1063`) | **M** | FireAnt Lọc AI + TV AI Screener (paywall 100–500 req/tháng) ⇒ chi phí thấp, dùng hằng ngày |
| **W2.5** | **Backtest/paper trading với giả định VN**: lô 100 · T+2,5 · phí 2 chiều · PIT bán 0,1% · slippage · khớp giá mở cửa phiên kế tiếp | 2 engine backtest + widget Strategy Tester | **M** | **Khác biệt duy nhất vs TradingView**. Sửa nhãn *"Giá chưa trừ phí/thuế"* (`AdvisoryBacktestPanel.js:104`, `vi.js:6825`) |
| **W2.6** | **Tax-aware P/L 0,1% + lot-level** + **sharpe/sortino/correlation** | ledger `tax`/`taxes_paid` (`ledger/holdings.py:163,181,252-277`) · `ledger/analytics.py:328-391` | **S** | Sửa test khẳng định "không expose" (`tests/test_portfolio_metrics.py:95-99`) |
| **W2.7** | **Top movers / market pulse** (1 trang) | screener đã sort momentum | **S** | Tác động DAU hằng ngày — cũng là **màn hình đầu tiên** cho retail |
| **W2.8** | **Screener theo ngành + heatmap theo ngành** | 6 SECTOR group + `StockProfile.industry` + `PortfolioHeatmap.js` (**đã có 593 LOC**) | **S–M** | Bật scope ngành cho heatmap có sẵn |
| **W2.9** | **AI proactive digest** (mỗi sáng: "danh mục tăng/giảm vì…") | scheduler + Celery beat (`settings.py:592-639`) + FCM/WebPush | **M** | Khác biệt "AI có" vs "AI hữu ích" (Cortex Portfolio Digests / eToro Tori) |

### 4.4 WAVE 3 — "Brand name: kích hoạt & giữ chân" (P1–P2 · 6–12 tháng · 7 slice)

> D8 nói mục tiêu giai đoạn đầu là **brand name** ⇒ wave này **không phải phụ lục**, mà là **mục tiêu**. Đo bằng activation rate · D1/D7 · referral · brand search — **không đo MRR**.

| Slice | Nội dung | Hiện trạng (đã verify) | Effort |
|---|---|---|---|
| **W3.1** | **Onboarding activation funnel**: checklist 5 bước (tạo TK → nối broker → thêm portfolio → thêm watchlist → nhận cảnh báo đầu tiên) + **first value trong 3 phút** + empty state có dữ liệu mẫu | **CHƯA CÓ** onboarding checklist/progress/tour (`grep onboarding\|checklist\|first_value\|progress\|tour` = 0 ở FE) | **L** |
| **W3.2** | **Referral + share**: mã giới thiệu, link mời, chia sẻ watchlist/screener công khai, **chia sẻ ảnh tóm tắt phân tích** | **0 referral/affiliate/utm** trong toàn repo (trừ 1 `utm_source` trong URL widget nâng cấp). Có sẵn: `is_public` (`user_workspace/models.py:1087`) + `ScreenerRuleForkAPIView` (`views.py:913`) | **M** |
| **W3.3** | **PWA + push thật**: `manifest.webmanifest` + service worker + install prompt + FCM/VAPID production key | **Chưa có PWA** — `packages/web/public` **không tồn tại**, `index.html` không có `<link rel="manifest">`, `vite.config.ts:13` không PWA plugin | **M** |
| **W3.4** | **Mobile ergonomics cho VN** (data saving, 3G, màn hình nhỏ) | Có 1 spec `tests/visual/mobile-ergonomics.spec.ts`; có `lighthouse-budget.json` | **M** |
| **W3.5** | **Landing page + SEO + brand assets** | **Chưa có landing page**; route `commercial` chỉ có billing + payment-return + legal pages (`commercial/public_urls.py:6`) | **M** |
| **W3.6** | **Widget nhúng thương hiệu = kênh phân phối miễn phí** (tái dùng advertising widget sẵn có) | Có sẵn: `/core/v1/widget/config`, `/core/v1/widget/ad` (`advertising/urls.py:37-38`) + `/api/v1/content/display/` (`api_urls.py:5`) | **M** |
| **W3.7** | **Nhật ký sự kiện hành trình retail** để đo funnel (activation, D1, D7, referral) | Có `ops_audit` + `api_rollup` (`ops_audit/tasks.py:206`) + Prometheus (`settings.py:936`) | **M** |

### 4.5 WAVE 4 — "Giai đoạn 2: doanh thu & B2B" (để sau, khi hệ thống đủ tốt)

> Owner: *"B2B sẽ cần khi hệ thống đủ tốt sẽ có nhà phát triển ký hợp đồng"*. ⇒ **toàn bộ wave này KHÔNG làm trong 12 tháng tới**, chỉ **thiết kế sẵn** để không phải refactor sau này.

| Slice | Nội dung | Effort | Ghi chú |
|---|---|---|---|
| W4.1 | **Chính sách giá + entitlement** (định nghĩa lại theo retail, không theo B2B) | M | Thiết kế trước W1.4 (2 tầng tài khoản) |
| W4.2 | **Giá theo seat + platform fee** | M | 0 hit `seat` toàn repo — mới làm khi có khách |
| W4.3 | **Advisor/client workspace** | L | Koyfin Advisor $209/$299 là mốc |
| W4.4 | **Bảng giá công khai + landing B2B + demo tenant** | M | Dùng lại hạ tầng tenant/SOC đã có |
| W4.5 | **Data licensing tier** (phí theo volume) | M | Cần rà soát bản quyền VSDC/HOSE — **CHƯA XÁC MINH** |
| W4.6 | **Hóa đơn VAT điện tử** (MISA/VNPT) | M | Rào cản procurement B2B |
| W4.7 | **AI add-on tier** + **model portfolio / robo-lite** | M–L | Cần compliance |

### 4.6 WAVE 5 — Dài hạn (12–24 tháng)

W5.1 App native iOS/Android (chuyển `packages/mobile` từ scaffold → app thật) · W5.2 Agent AI sandbox-first (MCP/REST, mặc định paper, 2 lớp xác nhận) · W5.3 Corporate actions + nguồn dữ liệu · W5.4 Tài chính cơ bản nhiều năm + DCF/Z-Score/F-Score/Dupont/RRG · W5.5 Chỉ số ngành ICB + chuỗi giá ngành · W5.6 Trái phiếu / tín dụng · W5.7 Marketplace indicator (Pine) + widget OS.

### 4.7 Tổng effort & phụ thuộc

| Wave | Slice | Effort (ed) | Phụ thuộc cứng |
|---|---|---|---|
| W0 | 8 | ~25–30 | — (đi trước tất cả) |
| W1 | 8 | ~70–90 | W0.6 → W1.3 · W0.7 → W1.6/W1.7 · W1.1 trước W2.3 (cùng contract) |
| W2 | 9 | ~65–85 | W1.1 → W2.3 · W1.5 → W2.9 · W2.5 → (tương lai) conditional orders |
| W3 | 7 | ~45–60 | W1.8 → W3.3 (push) · W1.5 → W3.1 (first value có dữ liệu thật) |
| W4 | 7 | ~50–70 | W1.4 (2 tầng tài khoản) → W4.1/W4.2 |
| **Tổng W0–W3** | **32** | **~205–265** | ≈ 3–4 agent song song × 2 tháng |


## 5. CHIẾN LƯỢC DOANH THU — GIAI ĐOẠN 1: MIỄN PHÍ, MỤC TIÊU LÀ BRAND NAME

> **D8 (Owner, 2026-10-21):** *"B2B sẽ cần khi hệ thống đủ tốt sẽ có nhà phát triển ký hợp đồng; giờ tập trung vào người dùng cuối để lấy brand name. Chấp nhận giai đoạn đầu không có doanh thu, phải miễn phí."*
>
> ⇒ Bản 1 của tài liệu này coi **6 tier + giá** là trọng tâm. **Đã hạ xuống giai đoạn 2** (§5.3). Giai đoạn 1 **không có doanh thu** ⇒ **hàm mục tiêu đổi**: từ *MRR* sang **activation · D1 · D7 · referral · brand search**.

### 5.1 Hàm mục tiêu giai đoạn 1 (đo được, không cần doanh thu)

| Chỉ số | Mục tiêu | Nguồn đo trong repo | Hiện trạng |
|---|---|---|---|
| **Activation rate** (đăng ký → first value trong 3 phút) | ≥ 40% | Cần sự kiện funnel (W3.7) | **Chưa có** đo |
| **D1 / D7 / D30 retention** | D1 ≥ 35% · D7 ≥ 20% | `ops_audit` + `api_rollup` (`ops_audit/tasks.py:206`) + Prometheus (`settings.py:936`) | Có sẵn hạ tầng, **chưa có dashboard** |
| **Referral coefficient** (mỗi user mời được mấy user) | ≥ 0,3 | Chưa có referral (W3.2) | **0 referral/affiliate/utm** toàn repo |
| **Brand search** (lượt tìm "vninvest", traffic tự nhiên) | theo dõi | Landing + SEO (W3.5) | **Chưa có landing page** |
| **Push opt-in** | ≥ 25% user bật | `outbound_notification_service.py` | Push **chưa có key** (D7) |
| **PWA install** | ≥ 10% active user | W3.3 | **Chưa có PWA** (`packages/web/public` không tồn tại) |
| **Số mã trong watchlist trung bình** | ≥ 8 | `WatchlistItem` | — |
| **Tỉ lệ phiên có dữ liệu whale/dark-flow thật** | 100% | `SessionFacts.source` ∈ {LIVE, CACHE, COMPUTED} (`market_serving/models.py:95-99`) | Cần đo theo `source` + `stale` |
| **Tỉ lệ màn hình AI hiển thị disclaimer** | 100% | W1.1 | Chưa có disclaimer |

### 5.2 Chính sách "miễn phí" — 5 quyết định cụ thể phải chốt

| # | Vấn đề | Hiện trạng | Đề xuất | Ảnh hưởng |
|---|---|---|---|---|
| **P1** | **Trial 14 ngày** | `onboarding_views.py:137` `trial_ends_at = now + 14d`; `tenant_lifecycle/tasks.py:111,142` auto-expire | **Bỏ hạn dùng thử** — free vô hạn cho retail | Nếu không, user mất dữ liệu sau 14 ngày ⇒ giết brand. Ảnh hưởng trực tiếp D7 |
| **P2** | **`plan` gating có chặn tính năng giá trị cốt lõi không?** | `PLAN_ENTITLEMENTS` (`plan_catalog.py:62-102`) có `exports: 0` cho `free`/`starter`, `ai_regenerate: 0` cho `free`/`starter` | **Gỡ gating** cho whale / dark flow / AI phân tích / chart. Giữ gating cho *chi phí biên* (số lượt AI) | Nếu giữ gating ⇒ retail free không thấy đúng thứ khác biệt ⇒ vô nghĩa chiến lược brand |
| **P3** | **Quảng cáo cho user free?** | Đã có `advertising` app (widget + campaign + impression/click) | **Giữ, nhưng giới hạn** — không intrusive trong màn hình dữ liệu (whale/dark flow/AI) | Đối thủ trả phí đều bỏ quảng cáo; free tier có ads là chuẩn ngành (TradingView Basic) |
| **P4** | **Ai trả tiền hạ tầng AI?** | BYOK (`advisory/models.py:234` `UserAICredential`) — user tự mang key | **Hỗ trợ cả 2**: BYOK cho pro + **quota AI do VNInvest trả** cho free (giới hạn lượt) | Nếu free không có AI ⇒ mất khác biệt cốt lõi (D1) |
| **P5** | **Có cần tài khoản "COC" (staff) trả phí?** | D3: tầng 2 là staff dùng thông tin thị trường | **Chưa** — staff của chính VNInvest hoặc của khách hàng B2B sau này | Ảnh hưởng thiết kế credential W1.4 (tách purpose) |

### 5.3 Giai đoạn 2 — 3 đường doanh thu (thiết kế sẵn, **không làm trong 12 tháng tới**)

| Đường | Mô hình | Mốc giá tham chiếu (đã verify) | Điều kiện phải có trước |
|---|---|---|---|
| **A. Bán cho nhà phát triển (B2B)** | Hợp đồng theo tenant: platform fee + seat + SLA | Koyfin Advisor Core $209 ≈ 5,43tr/tháng/seat · TradingView Enterprise · Webull Institutional | W1.4 (2 tầng tài khoản) · W4.1/W4.2 (seat) · W4.3 (advisor workspace) · W4.6 (HĐĐT VAT) |
| **B. Bán dữ liệu VN** | Phí dữ liệu theo volume + partner API | FireAnt API · FactSet/Bloomberg tách phí data | **CHƯA XÁC MINH** bản quyền VSDC/HOSE |
| **C. Affiliate / referral broker** | Hoa hồng mở tài khoản + khối lượng giao dịch | FireAnt × Shinhan | **CHƯA XÁC MINH** pháp lý UBCKNN về referral fee |

### 5.4 Bảng giá tham chiếu (để thiết kế giai đoạn 2, **không publish giai đoạn 1**)

| Sản phẩm | Giá | ≈ VND/tháng | Nguồn |
|---|---|---|---|
| FireAnt Thiết Yếu / Chuyên Nghiệp / Cao Cấp | 1,429tr · 3,83tr · 5,75tr /năm | **119k · 319k · 479k** | `company.fireant.vn/bang-gia` |
| TradingView Essential / Plus / Premium | $12,95 · $29,95 · $59,95 | ~337k · 779k · 1.559k | `tradingview.com/pricing/` |
| TradingView AI Copilot add-on | $7,50/tháng | ~195k | third-party review |
| Koyfin Plus / Premium | $39 · $79 | ~1,014k · 2,054k | `koyfin.com/pricing/` |
| Koyfin Advisor Core / Pro | $209 · $299 | ~5,434k · 7,774k | cùng trên |
| Robinhood Gold · Moomoo Engine | $5 · $3,99 | ~130k · ~104k | robinhood.com · moomoo.com |
| Bloomberg Terminal | $31.980/năm/seat | ~2,665k/tháng | third-party |
| FactSet Workstation | ~$12k–30k/năm | ~1tr–2,5tr/tháng | third-party |

**Bảng 6 tier của bản 1** (Free / Basic 149k / Pro 499k / AI add-on 199k / Business 3–8tr+seat / Enterprise 15–60tr) **được giữ nguyên trong §5.4 bản 1 lịch sử** và sẽ viết lại khi chốt chính sách giá. **Ưu tiên thiết kế sẵn**: entitlement key `seats` (W4.2) + tách `purpose` trong credential broker (W1.4) — để khi có khách B2B không phải refactor model.

### 5.5 Ma trận entitlement — **giai đoạn 2**, giữ nguyên thiết kế

| Nhóm | Free | Basic | Pro | AI add-on | Business | Enterprise | **Cần code** |
|---|---|---|---|---|---|---|---|
| Realtime market data | delayed | ✓ | ✓ | ✓ | ✓ | ✓ | `realtime` |
| Whale / dark flow / AI phân tích | **✓ (miễn phí — D8)** | ✓ | ✓ | ✓ | ✓ | ✓ | **gỡ gating** |
| Screener nâng cao + lịch quét | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `screener_advanced` |
| NL-screener | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | `nl_screener` |
| AI chat | quota thấp | 100 | 500 | ∞ | ∞+quota | ∞+quota | `ai_chat_monthly` |
| Backtest giả định VN | cơ bản | ✓ | ✓ | ✓ | ✓ | ✓ | `backtest_vn` |
| Paper trading | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `paper_trading` |
| **Order placement (live)** | ✗ | ✗ | **✗ — chỉ khi có hợp đồng (D2)** | ✗ | ✗ | ✗ | **KHÔNG bán** |
| Webhooks / API read | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | `webhooks` |
| Export XLSX / SDK | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | `exports` |
| **Số seat** | 1 | 1 | 3 | 3 | theo HĐ | không giới hạn | **`seats` (mới)** |
| Tenant admin + SSO + SOC + audit | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | `soc`, `tenant_admin` |
| Client/advisor workspace | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | `advisor_workspace` |
| Quảng cáo | có | ✗ | ✗ | ✗ | ✗ | ✗ | `ads` |

### 5.6 Nguồn doanh thu ngoài subscription (giai đoạn 2) — đã đánh giá ở §5.3


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

### 7.2 8 câu đã chốt (2026-10-21)

Xem bảng đầy đủ tại **§1.1** (D1–D8). Tóm tắt: **D1** retail-first (charts · whale · dark flow · AI kỹ thuật) · **D2** AI là phân tích kỹ thuật, **không** đặt lệnh trừ khi có hợp đồng · **D3** 2 tầng tài khoản broker (retail + staff) · **D4** OpenClaw = tính năng hỗ trợ · **D5** SAML dùng thật tương lai · **D6** depth chart = "ước tính" (giữ, gắn nhãn) · **D7** push = tính năng tương lai, không báo thành công giả · **D8** giai đoạn đầu **miễn phí**, B2B để sau.

### 7.3 6 câu còn mở (chặn W1)

| # | Câu hỏi | Vì sao chặn | Hạn |
|---|---|---|---|
| **Q1** | **Tên gọi cho vai trò staff thứ 2** (tầng "COC")? **"COC" đã bị chiếm** bởi *Center Operations Center* (`docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md:1`) | W1.4 tạo model + permission + route — đặt tên sau rất đắt | Trước W1.4 |
| **Q2** | **Credential tầng 2 thuộc tenant hay thuộc operator?** | Tenant ⇒ mỗi khách có 1 tài khoản DNSE riêng. Operator ⇒ 1 global account dùng chung ⇒ **vi phạm cách ly dữ liệu giữa các tenant** (đây đúng là lỗi của `SystemBrokerCredential` hiện tại: `provider unique=True` toàn hệ thống, `identity_access/models.py:974-977`) | Trước W1.4 |
| **Q3** | **Tầng 2 có cần trading token không?** | Nếu **không** ⇒ W1.4 chỉ còn read path (`get_balance`/`get_positions`/`get_orders`), **không** đụng lifecycle token DNSE (`views_dnse.py:862-910`) ⇒ scope nhỏ hơn nhiều | Trước W1.4 |
| **Q4** | **Bỏ trial 14 ngày hay giữ?** | `onboarding_views.py:137` + `tenant_lifecycle/tasks.py:111,142` — nếu free vô hạn thì phải sửa cả 2, nếu không user mất dữ liệu sau 14 ngày | Trước W1.8 |
| **Q5** | **Free có quảng cáo không, và ở đâu?** | Đối thủ trả phí đều "No ads" ⇒ ads chỉ ở free, và **không** đặt trong màn hình whale/dark-flow/AI (khác biệt cốt lõi) | Trước W3 |
| **Q6** | **Ai trả chi phí LLM cho free?** | Nếu không có quota do VNInvest trả ⇒ free không có AI ⇒ mất khác biệt D1. Cần con số chi phí biên/user | Trước W2.3 |


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

**Giai đoạn 1 (free, mục tiêu brand name) — đo hành vi, không đo tiền:**

| Chỉ số | Hiện tại | Mục tiêu cuối W3 |
|---|---|---|
| **Chuỗi "khuyến nghị" còn trong i18n** | ~35 chuỗi (2 locale) | **0** (chuyển sang "phân tích kỹ thuật") |
| **Key `signal`/`target_price`/`recommendation` trong shape LLM** | có (`orchestrator.py:717-723`) | **0** (shape kỹ thuật mới) |
| **Màn hình AI có disclaimer** | 0 | **100%** |
| **Endpoint trả dữ liệu giả mà không nhãn** | ≥ 7 | **0** |
| **Panel hiển thị order book có nhãn "Ước tính"** | 0 | **100%** |
| **Tenant-level broker credential** | 0 (chỉ per-user + 1 global) | **có** (2 tầng, tách per tenant) |
| **Indicator bật trong app** | 7 / 59 | **59** |
| **Referral / share / PWA / landing** | 0 / 0 / 0 / 0 | **có** (W3) |
| **Trial tự hết hạn** | 14 ngày | **0** (free vô hạn) hoặc đã chốt |
| **Onboarding checklist** | không có | **có** (W3.1) |
| **Route catalog** | 69 | 78+ |
| **Endpoint có contract test** | ~95% (adapter) | **100%** |
| **Stub BE còn lại** | 28 | **0** |
| **Code chết định lượng** | ~3 000 LOC | **0** |
| **Gate trong pre-push** | 28 | **≥31** + CI ≥1 workflow |
| **Tài liệu trạng thái stale** | 3 | **0** |

**Giai đoạn 2 (doanh thu) — đo sau, xem §5.1/§5.5:** activation rate · D1/D7/D30 · referral coefficient · brand search · MRR theo tier · seat · AI cost/user.


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
