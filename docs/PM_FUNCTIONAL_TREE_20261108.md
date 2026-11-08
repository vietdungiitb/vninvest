# CÂY PHÂN CẤP CHỨC NĂNG HỆ THỐNG — L0-L4 (PM review 2026-11-08, rev1)

> Ngày: 2026-11-08 · HEAD khi rà soát: `dev` `983b8c270` · Phương pháp: static read-only (4 subagent + B3/B8 audit refute 6 blocker)
> Quy ước: mọi nhánh có `file:line` của code thật; `CHƯA XÁC MINH` = chưa đọc file đó, không suy ra.
> Định tuyến quyết định Owner D1-D8 (`docs/MASTER_TRACKING_2026Q4.md:90-101`): retail-first · giai đoạn đầu **miễn phí lấy brand** · AI = **phân tích kỹ thuật** · **không đặt lệnh** ngoài hợp đồng · 2 tầng broker (retail + staff)
> Rev1 (B3/B8 NEED_REVISION): đã sạch nhánh trên `dev`, bác bỏ P0 SOC prefix + capability bootstrap, đóng SAFE-04, refute loadError, sửa M2-05/M9-02, ghi số thật cho partner/api/ads/Shell.

## 0. Tóm tắt 5 findings nghiêm trọng nhất (rev1 — P0 #3 bị bác bỏ, thay bằng partner double-mount)

1. **Order book là mock 100% nhưng vẫn được tiêu thụ như thật.** BE `market_serving/native_views.py:430` ghi "mock implementation", `:451,522` `is_mock: True`, `:453,524` `synthetic_from_snapshot`, sinh 3 bid/3 ask từ snapshot (`:469-511`) và đã gắn nhãn "ước tính" (`:525-526`). Nhưng FE `packages/web/src/adapters/chartAdapter.js:158-169` (`subscribeToOrderbook` qua `getRealtimeDepthChart` mỗi 5s, xem `chartAdapter.js:154-176`) render vào widget — retail trả tiền cho "dữ liệu không có ở chỗ khác" sẽ mất niềm tin. D6 đã chốt "ước tính" nhưng badge nằm nơi khác, chart order book trong widget vẫn thiếu nhãn ⇒ **P0 niềm tin [T]+[X]**.
2. **3 capability bị gap nhưng UI vẫn gọi: `/ai/agents/` 404 thật + SAML chưa verify + OpenClaw 503.** `ai_agents` rỗng (`ai_agents/apps.py:4-7`, 0 route) nhưng FE `workspace.js:719-728` vẫn gọi `/ai/agents/...` (comment `:720-722` tự ghi 404; `route-contract.test.js:168-171` giữ allowlist `gap-3` duy nhất còn lại). `saml_service.py:388-394` `noop` cho qua, `strict` mà thiếu lib thì `raise` (`:396-400`), `views/sso.py:5-6` "Signature verification is a stub pending python3-saml"; staging lệch `libxml2` giữa `python3-xmlsec` apt và wheel binary (`CODE_CHANGE_AUDIT_LEDGER.md`). `openclaw.py:42-43` `SUPPORTED_PROTOCOLS=()` ⇒ mọi call 503. Hợp chung: tenant enterprise và AI "tính năng hỗ trợ" đều chưa thể bật prod — **P0 [T]+[X]**.
3. **~~Lệch prefix SOC / capability bootstrap — ĐÃ BÁC BỎ~~ → Partner double-mount 110 route trùng (P0 mới [T]).** SOC **không** lệch: FE `soc.js:168-861` gọi `/core/v1/operator/soc/...` có thật vì `vninvest_core/urls.py:65` mount `contracts/operator.urls` → `contracts/operator/urls.py:17` `soc/ → service_ops.urls`, manifest `core-route-manifest.json:136-271` liệt kê đủ **136 route** `/core/v1/operator/soc/...` và `route-contract.test.js:215-231` bảo vệ. Capability **không** thiếu: `coreAdapter.js:104-106` gọi `/core/v1/access/capabilities` (`identity_access/urls.py:21-22` → `profile.py:112-135` trả `principal/abilities/build/navigation/surfaces`), không phải `/core/v1/capability-bootstrap`. Lỗi thật là `identity_access.partner_urls` mount 2 lần: `vninvest_core/urls.py:60` (`core/v1/` → `/core/v1/partner/...`) + `identity_access/urls.py:75` (`partner/` → sinh **110 route** `/core/v1/partner/partner/...` trong manifest `306-415`). Mobile whale-feed 404 là dead path scaffold 0 consumer — không tính vào roadmap prod — **P1 mới [T]**.
4. **CI chết 1/9 workflow vì billing + secrets trì hoãn, VNPay demo secret.** `git ls-files '.github/workflows/*.yml'` = 1 file (`secret-scan.yml`) (`OPEN_WORK_SEC_20260929.md:179-186`), 8 file trong `workflows-disabled/`, `README.md:9-13` `200/200 run fail, steps=0`. `CORE_PAT_PEPPER` 11 commit trong history vẫn đang dùng (`OPEN_WORK_SEC:61-62`), repo PRIVATE (`:64`) nên rủi ro là người có access, Owner trì hoãn rotate (`:49-51`). `vnpay_service.py:16,22` `SECRET_DEMO`, prod fail-closed (`:28-33`) nhưng dev vẫn "NOT verified" (`:35-42`) — deploy nhầm `DEBUG` là nguy hiểm — **P0 [X]+[T]**.
5. **AI contract vẫn ra `BUY|SELL|HOLD` + `target_price` trong khi D2 chốt AI chỉ là kỹ thuật.** `orchestrator.py:717-723` yêu cầu `signal: BUY|SELL|HOLD` + `target_price` + `recommendation` và ~35 chuỗi UI "khuyến nghị" (`ROADMAP_MASTER_2026Q4_2027.md:46`) — đổi câu chữ không đủ, phải đổi schema LLM + UI, không chỉ i18n. Đặt cạnh depth mock và FCM legacy (`outbound_notification_service.py:93` vẫn `fcm.googleapis.com/fcm/send`, đã sửa `True` giả thành `False` `:73-79`) — hợp chung là "dữ liệu/khuyến nghị" chưa trung thực — **P0 [T]**.

---

## L0 — Sản phẩm VNInvest

```
L0: VNInvest = nền tảng phân tích chứng khoán VN (HOSE/HNX/UPCom) cho retail + B2B
    Lợi thế: dữ liệu dòng tiền VN chuẩn hoá + tín hiệu (đối thủ QT không có)
    Giai đoạn 1: MIỄN PHÍ, mục tiêu brand name (D8) — không đo MRR, đo activation/D1/D7/referral
    Chốt dùng: charts · whale · dark flow · AI kỹ thuật (D1) — ĐÃ XÁC MINH bằng code thật
```

## L1 — 8 miền nghiệp vụ

| # | L1 miền | BE chủ | FE chủ | Trạng thái tóm tắt |
|---|---|---|---|---|
| 1 | Auth / Tenant / SSO / PAT | `identity_access` | `pages/auth/` (4) | register/login/verify/reset/change + tenant + PAT + SSO stub — xem L2.1 |
| 2 | Market Data (OHLCV/intraday/symbol) | `market_data` + `data_ingest` + `market_serving` | Market 4 route | snapshot/CVD/ticker thật, depth mock — L2.2 |
| 3 | Portfolio / Ledger / Watchlist / Screener | `user_workspace` (ledger) | Portfolio 7 route | ledger append-only, watchlist/screener thật, capability matrix — L2.3 |
| 4 | Broker Lane DNSE/SSI/TCBS | `user_workspace/broker/` | Broker 3 route | egress fail-closed, sync read-only, order paper-only — L2.3 |
| 5 | Signals / Whale / Dark Flow / Order-flow | `signal_intelligence` + `market_serving` | Signals 7 route | UnifiedAlert/WhaleAlertCanonical thật, dark_flow_score là absorption proxy — L2.5 |
| 6 | AI Advisory + AI Command Center (BYOK) | `advisory` + `ai_analytics` | AI 7 route + Tenant-admin AIPolicy | 6 provider, OpenClaw 503, budget/audit/trace — L2.6 |
| 7 | Commercial / Billing / Quota / VNPay+Stripe | `commercial` | Commercial 2 route | subscription/quota/invoice + VNPay/Stripe fail-closed — L2.7 |
| 8 | SOC / DataOps / Operator / Support / Ads | `service_ops` + `ops_audit` + `support` + `advertising` + `tenant_lifecycle` + `vninvest_core` | SOC 11 + Admin 9 + Tenant-admin 17 + Support 5 | 136 route SOC (qua `core/v1/operator/`) + 110 partner (mount trùng 110) — L2.8 |

Mỗi L1 mở thành L2 (BE app + FE nhóm route) → L3 (chức năng) → L4 (nút/middleware/permission/cache).

---

## L2 — Map BE app ↔ FE nhóm route (đã verify)

### 2.1 Identity & Tenant — `identity_access` ↔ Auth / Tenant-admin / Tenant-self

- BE: `identity_access/urls.py:10-84` (`auth 10-19`, SSO `57-62`, DNSE `65`, member `68-72`, partner `75`, meta `operator/mail 38-41,78-81`) · models 24 (`models.py:44-1485`) · tasks 9 + email 3 · `partner_urls.py` **110 `path()`** (`partner_urls.py:22-195`, tăng từ 108 do W0.10 PR #283 thêm cặp detail ở `:57-58`) · `api_urls.py` **15 `path()`** (`api_urls.py:14-28`) · `ops_audit/urls.py` +2 `partner/audit-logs`
- FE: Auth 4 (`routeCatalog.js:7-45`) + Tenant-admin 17 (`routeCatalog.js:411-769` trong admin 34) + Tenant-self 2
- L3: register/login/verify/reset/change · PAT CRUD + revoke · service-account · tenant-members/invite · DNSE credential · onboarding · SSO (SAML/Google) · partner API 110 route
- L4: `X-Tenant-ID` inject `transport.js:393-397` (`TENANT_ID_STORAGE_KEY="tenant_id"` `:206-227`) · `X-Staff-Switch` (`:400-410`) · `X-Request-ID` (`:386-388`) · SAML `noop/strict` (`saml_service.py:80-88,388-400`)
- **Gap thật (rev1):** `partner_urls` mount 2 lần → **110** `/core/v1/partner/partner/...` (`core-route-manifest.json:306-415`) — sửa ở W0

### 2.2 Market Data — `market_data` + `data_ingest` + `market_serving`

- BE: `market_data/urls.py:1-13` **6 route** (`symbols/daily-prices/intraday/technicals`) → unpack vào `core_urls.py:44-47` (`from .urls import urlpatterns as shared_urlpatterns`) + 35 route riêng = **41 route** tại `core_urls.py` (mount `vninvest_core/urls.py:69`) · `data_ingest/urls.py:31-46` + 16 tasks · `market_serving/urls.py:18-34` + materializers 4
- FE: Market 4 (`routeCatalog.js:47-97`)
- L3: StockProfile/DailyPrice/IntradayTick + GlobalSymbolRegistry + ingest/backfill OHLCV + realtime read-model + depth chart
- L4: depth = synthetic `native_views.py:430,451,522` (xem §0.1), đường dẫn FE `packages/web/src/adapters/chartAdapter.js` (không phải `adapters/core/`) · `global_symbol_planner.py:21-23` hot/warm/cold (`120/60/25/80`)

### 2.3 Portfolio / Broker / Screener / AI-CC — `user_workspace`

- BE: `user_workspace/urls.py:52-173` (`portfolios 52-71`, `ai-command-center 78-102`, `broker 122-149`, `retail 152-153`, `screener 158-172`) · models 19 · tasks 8 + screener 2 · broker `egress/sync_guard/sync_service` fail-closed · **SAFE-04 đã đóng (PR #75 `b59027a14` + NameError `6d805fb8d`)** — 13 class/15 write methods có `permission_classes + required_workspace_permission` (`portfolio_analytics_views.py:913-4417`), import `status` ở `:24` — chỉ còn P2 dọn `force_authenticate` screener `3958-4485`
- FE: Portfolio 7 (`portfolio-workspace` dùng chung `main.tsx:50`) + Broker 3 + Commercial 2
- L3: Portfolio CRUD (create/delete; PATCH có adapter nhưng page chưa nối — xem §4.3) · ledger append-only · watchlist · `ScreenerRule` · broker providers/capabilities (3 lane) · order `placeDNSEOrder` (paper, Idempotency-Key header) · AI Command Center
- L4: `Idempotency-Key` FE `workspace.js:465-479` → BE `views_dnse.py:688-759` · `mode` FE `workspace.js:23-30` → BE `views_dnse.py:301-404` (`live → 403`, `paper → dry_run`) · `TenantScopePermission` `permissions.py:224-313`

### 2.4 Commercial — `commercial` ↔ Commercial 2 route

- BE: `commercial/urls.py:7-21` + `public_urls.py:6` + `stripe_webhooks.py` + `vnpay_service.py`
- FE: `commercial` 2 (`routeCatalog.js:781-799`) + Tenant-admin Billing
- L3: Subscription/QuotaRecord/Invoice/PaymentTransaction/VNPayIPNLog (`models.py:11-133`) + VNPay create+IPN + Stripe checkout/portal/webhook + quota/invoice tasks 8
- L4: VNPay `TMNCODE_DEMO/SECRET_DEMO` (`vnpay_service.py:16,22`), prod `raise` (`:28-33`), dev `NOT verified` (`:35-42`) · Stripe `is_configured()` (`stripe_service.py:37-39`) · legal pages `[]` (`views.py:102-114`)

### 2.5 Signals — `signal_intelligence` + `market_serving` ↔ Signals 7 route

- BE: `signal_intelligence/urls.py:6-18` (13 route) · models 7 · tasks 3 + materializers 5 + parity 2
- FE: Signals 7 (deprecated `whale-alerts` → redirect `alert-center` `main.tsx:249-250`)
- L3: UnifiedAlert/WhaleAlert/OrderFlow/MarketAnomaly + SSE stream + WS consumer + delivery (email/FCM/webpush) + whale-feed + order-flow
- L4: FCM `MOCK_FCM_KEY` → `False` (`outbound_notification_service.py:73-79`), email SMTP thật (`:27-45`), WebPush tương tự, legacy `fcm.googleapis.com/fcm/send` (`:93`) · dark_flow_score = absorption proxy (`session_facts_engine.py:38,205`) · beat NOOP `market_serving.materializers.materialize_unified_alerts` (`settings.py:669-673`) song song task thật `signal_intelligence.materializers.materialize_unified_alerts` (`settings.py:871-875` GHI CHÚ "Overrides the NOOP placeholder") — chỉ cần xóa entry NOOP ở W1.4

### 2.6 AI — `advisory` + `ai_analytics` + `ai_agents` ↔ AI 7 route

- BE: `advisory/urls.py:6-11` (6 route) · models 13 · `ai_clients/` 6 provider · `ai_analytics/urls.py:6-10` · `ai_agents` **0 model, 0 route** (`apps.py:4-7`)
- FE: AI 7 + Tenant-admin AIPolicy
- L3: 3 sub-agent + synthesis · 6 provider (openai/gemini/claude/local/copilot/openclaw) · deployments/routing/budget/trace/audit · AI usage SLO p50/p95/p99
- L4: orchestrator mock guard (`orchestrator.py:572-576`) · OpenClaw 503 (`openclaw.py:42-43,151-152`) · AI analytics `405` cho POST (`views.py:101-107`), SLO `[]` khi không data (`:168-250`) · `aiCommandCenter.loadError` **đã có** `en.js:5639` + `vi.js:5710` (block 5434-5728, không cắt cụt)

### 2.7 SOC / DataOps / Operator / Billing fleet — `service_ops` ↔ SOC 11 + Admin 9

- BE: `service_ops/urls.py:40-210` (~80 `path()`) mount **2 nơi**: `vninvest_core/urls.py:65` (`core/v1/operator/` → `contracts/operator.urls:17` `soc/ → service_ops.urls` = **136 route** `/core/v1/operator/soc/...` trong `core-route-manifest.json:136-271`) + `vninvest_core/urls.py:80` (`api/soc/` trực tiếp)
- FE: SOC 11 + Admin 34 (`routeCatalog.js:411-769`) — adapter `soc.js:168-862` (126 occurrence), `operator.js` (42)
- L3: ServiceDefinition/Config/Health/Ownership · scrape matrix/backfill · vnbroker/broker console · signals/screener/prefetch/dataops · billing/usage/audit fleet · beat reconcile · health probes
- L4: queue depth fail-open (`dataops_market_data.py:725-751` Redis down → `{}/0`, `views/broker.py:76-81` log fail-open) · `PREDEFINED_SYMBOL_GROUPS` (`matrix_coordinator.py:16-27`)

### 2.8 Support / Ads / Tenant-lifecycle / Core

- `support` (`urls.py:15-22`) + `advertising` (`urls.py:34-40` + `api_urls.py:6-8`) + `tenant_lifecycle` (**không route**, chỉ tasks) + `vninvest_core` (health/capability/legacy proxy)
- `vninvest_core/urls.py:51-84` (health/capability/schema + include 12 app + SOC + legacy proxy cuối `api/<path:remaining>` `urls.py:84`)
- L3: Ticket CRUD + staff queue/SLA + email · Ad campaign + HMAC impression/click · trial expiry/suspend/deprovision + quota overflow · health/capability/envelope/pagination/middleware/legacy proxy
- L4: Ads `CORE_AD_SIGNING_SECRET` default `'dev-ad-signing-secret-replace-in-production'` (`views.py:158,197-199,390`) — **XÁC NHẬN CHƯA CHẶN** (không có trong `env_validation.py:99-129`, `settings.py:65-99`, `checks.py:1-278`) — giữ ở W0.2 · fallback promo (`:133-150`) · plan set cứng (`:65,313`) · tenant_lifecycle `TRIAL_EXPIRY_REMINDER_DAYS=(7,3,1)` `tasks.py:40` · legacy `Sunset: Thu,31 Dec 2026` (`legacy_proxy.py:38,45`) · capability-bootstrap legacy `views_health.py:19-36` là **LOW/CLEANUP** (không còn được `coreAdapter.js` dùng, thay bằng `/core/v1/access/capabilities`)

---

## L3-L4 minh họa — 4 use-case đã trace qua file:line (giữ nguyên từ rev0 — không bị bác bỏ)

### UC1: Đặt lệnh DNSE (paper)

`DNSEConnectionPanel.js:208` (`mode:"paper"`) → `workspace.js:472` (`mode` + `Idempotency-Key` header `:477`) → `transport.js:305-321` (`corePost`) → `views_dnse.py:301` (`_resolve_order_mode` — thiếu `mode` → 400, `live` → 403) → `views_dnse.py:688` (thiếu key → 400) → `views_dnse.py:726` (`claim()` — conflict → 409, replay → kết quả cũ `:750-759`)

### UC2: Xem holdings (đọc thật)

`workspace.js:183` `getPortfolioSummary` (BE đã trả `total_market_value/total_cost/total_unrealized_pnl/cash` `portfolio_analytics_views.py:369-383`) nhưng page cũ chỉ đọc `opening_balance` (`PortfoliosPage.tsx:140`) và `getPortfolioSummary` **0 lần gọi** — nối lại khi rebuild `/portfolios/manage`

### UC3: Cursor pagination bị cắt ở 50 dòng im lặng

BE `CoreCursorPagination` (`pagination.py:35-39` `next/previous/results`, `page_size=50`, `ordering=-created_at`) → `envelope.py:87-101` bọc `paginated_envelope` → FE `envelope.js:48-52` unwrap → `workspace.js:36-44` (`getPortfolios` trước đây cắt ở 50 dòng im lặng) — fix là follow `next`, không dùng `count`

### UC4: Depth chart "ước tính"

FE `packages/web/src/adapters/chartAdapter.js:154-176` (`subscribeToOrderbook` → `getRealtimeDepthChart` 5s) → BE `native_views.py:430,451,522` (mock/synthetic, `is_mock: True`) → badge "Ước tính" ở `StockOrderBookWidget.jsx:153-161` nhưng widget order book không có badge — UC cần đồng bộ nhãn hoặc tắt widget (D6)

---

## L4 — Danh mục nút/middleware/permission/error-path

| Nhóm L4 | Nút/điểm chặn | File:line |
|---|---|---|
| Auth header | `X-Tenant-ID`, `X-Request-ID`, `Authorization: Bearer`, `X-Staff-Switch` | `transport.js:386-410`, `permissions.py:266-313` |
| Idempotency | `Idempotency-Key` header, 400/409/replay | `workspace.js:16-20,465-479`, `views_dnse.py:688-759` |
| Order mode | `paper` / `live` (403) | `workspace.js:23-30`, `views_dnse.py:301-404` |
| Pagination | cursor `{next,previous,results}` (không `count`) vs page `{count,…}` | `pagination.py:6-39`, `envelope.js:32-52` |
| i18n | 95 namespace, 6694 vi / 6674 en — lệch 20; `loadError` **đã có** → không còn gap | `en.js:5639`, `vi.js:5710` |
| Styling | `soc.tokens.css` 211 dòng / `soc.components.css` 4061 dòng; `soc.module.css` 3 dòng barrel | `soc.tokens.css:7-21`, `soc.module.css:1-3` |
| Legacy | `api/<path:remaining>` catch-all, Sunset 2026-12-31, 503/502 | `vninvest_core/urls.py:83-84`, `legacy_proxy.py:24-129` |

---

## Khung đối chiếu W0-W5 (rút gọn, chi tiết ở file roadmap)

- **W0 (nền + trung thực):** depth nhãn (M2-01), `/ai/agents/` (M3-02), SAML BL-01b (M1-01), partner double-mount (110 route), wire gate chết, W0.5 contract gate **đã xong PR #281** (chỉ còn `gap-3` allowlist), capability-bootstrap legacy cleanup
- **W1 (kích hoạt retail):** broker credential 2 tầng (D3), tenant-admin 17, broker hub riêng, WS850 broker detail
- **W2 (AI kỹ thuật):** đổi LLM contract D2, rationale + attribution
- **W3-W5:** [T] hết W0-W3, 12 mục [X] chờ bên ngoài
