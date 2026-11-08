# MA TRẬN BUG / ERROR / GAP — theo từng chức năng L0-L4 (PM review 2026-11-08, rev1)

> Ngày: 2026-11-08 · Phương pháp: static read-only, mọi khẳng định có `file:line` hoặc ghi `CHƯA XÁC MINH`
> Phân loại: **ERROR** = sai hành vi / 500 / 403 sai / rò / mock làm thật · **GAP** = thiếu so với kỳ vọng/bù nhìn · **RISK** = an toàn/vận hành/future
> Mức: **P0** blocker production · **P1** cao · **P2** trung bình · **P3** thấp
> Nhãn: **[T]** tự giải bằng code · **[X]** cần bên ngoài · **rev1:** B3/B8 bác bỏ 6 blocker cũ — xem §0

## 0. Tóm tắt 5 findings nghiêm trọng nhất (rev1 — đã gọt false-positive theo audit B3/B8)

1. **Depth mock 100% nhưng app vẫn tiêu thụ như thật — P0 [T][X].** BE `market_serving/native_views.py:430` (`mock implementation`), `:451,522` (`is_mock: True`), `:453,524` (`synthetic_from_snapshot`), sinh 3 bid/3 ask từ snapshot (`:469-511`) + MD5 pseudo-random (`:480-487`), badge "Ước tính" (`:525-526`) nhưng FE `packages/web/src/adapters/chartAdapter.js:154-176` poll 5s render vào widget không nhãn — **P0 niềm tin [T][X]** (giữ nguyên).
2. **`/ai/agents/` 404 thật + SAML stub + OpenClaw 503 — P0.** `ai_agents/apps.py:4-7` rỗng, 0 route nhưng FE `workspace.js:719-728` vẫn gọi (comment `:720-722` tự ghi 404; `route-contract.test.js:168-171` giữ `gap-3` allowlist duy nhất còn lại). `saml_service.py:388-394` noop, `:396-400` strict raise (thiếu `python3-saml`; staging lệch `libxml2`). `openclaw.py:42-43` `SUPPORTED_PROTOCOLS=()` ⇒ 503 — **P0 [T][X]** (giữ nguyên).
3. **~~P0 SOC prefix / capability bootstrap~~ → Partner mount trùng 110 route + mobile dead path (bác bỏ P0 cũ).** SOC không lệch (xem TREE §0.3); capability gọi `/access/capabilities` đầy đủ (không phải bootstrap thiếu); mobile whale-feed 404 là scaffold 0 consumer, không tính roadmap prod. **P0 mới thật:** `partner_urls` mount 2 lần → **110 route** `/core/v1/partner/partner/...` (`core-route-manifest.json:306-415`) — **P1 [T]**, sửa W0.
4. **CI chết 1/9 workflow (billing) + `CORE_PAT_PEPPER` còn trong history + VNPay demo — P0 [X][T].** 1 workflow bật (`secret-scan.yml`), 8 disabled (`OPEN_WORK_SEC:179-186`), `200/200 run fail steps=0` (`workflows-disabled/README.md:9-13`). Pepper 11 commit vẫn dùng (`OPEN_WORK_SEC:61-62`), repo PRIVATE (`:64`), Owner trì hoãn (`:49-51`). `vnpay_service.py:16,22` demo, dev NOT verified (`:35-42`) — **P0 [X][T]** (giữ nguyên).
5. **AI contract `BUY|SELL|HOLD` + `target_price` mâu thuẫn D2 — P0 [T].** `orchestrator.py:717-723` yêu cầu BUY/SELL/HOLD + target, ~35 chuỗi "khuyến nghị" (`ROADMAP:46`) — phải đổi schema LLM + UI, không chỉ đổi câu chữ — **P0 [T]** (giữ nguyên).
> **Rev1 closed:** SAFE-04 đã merge PR #75 (`b59027a14`) + NameError `6d805fb8d`; `loadError` đã có đủ 2 locale (`en.js:5639` + `vi.js:5710`); W0.5 đã xong PR #281 (`SCAN_ROOTS` adapters/pages/context + test `:201-208`); `market_data` 6 route đã unpack (`core_urls.py:44-47`) — 4 mục này **không còn là P0**.

---

## Ma trận chi tiết theo miền

### M1 — Auth / Tenant / SSO / PAT (BE `identity_access`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất (ưu tiên) |
|---|---|---|---|---|---|
| M1-01 | **ERROR** P0 [T] | `identity_access/saml_service.py:388-394,396-400; views/sso.py:5-6` | `noop` cho qua ở dev/test, `strict` thiếu lib thì raise — BL-01b chưa verify crypto thật; staging lệch `libxml2` giữa `python3-xmlsec` apt và wheel binary (`CODE_CHANGE_AUDIT_LEDGER.md`) | SSO enterprise prod không bật được | W0/W1.8 B6: implement verify thật (image rebuild hoặc CLI verify — `MASTER_TRACKING:152`), không dùng heuristic |
| M1-02 | **ERROR** P1 [T] | `identity_access/saml_service.py:80-88` | Default `noop` khi `_is_debug_or_test()` else `strict` | Dev/test fail-open có chủ đích | Ghi rõ trong runbook + gate env check |
| M1-03 | **GAP** P1 [T] (rev1 — ĐÃ ĐẾM) | `partner_urls.py:22-195` + `api_urls.py:14-28` + `ops_audit/urls.py` | `partner_urls` **110 `path()`** (55 cặp, tăng từ 108 do W0.10 PR #283 thêm cặp detail `:57-58`); `api_urls` **15 `path()`** (`/api/auth/*` legacy); `ops_audit` +2 `partner/audit-logs` | Số 108 cũ outdated — thật là 110 + mount trùng 110 (xem M1-07) | Dùng 110 + 2 audit; sửa mount trùng ở W0 |
| M1-04 | **RISK** P1 [X] | `OPEN_WORK_SEC:61-62` | `CORE_PAT_PEPPER` 11 commit vẫn dùng ⇒ phải rotate cùng lúc 7 secret (`:70-76`) | Repo PRIVATE nên rủi ro giới hạn người có access, nhưng lên production/public là P0 | Owner mở lại OW-01 SEC khi lên prod/public/give third-party access (`:49-51`) |
| M1-05 | **ERROR** P1 [T] (đã sửa 1 phần) | `commercial/views.py:45,55,65` + `views_analytics.py:23` (`OPEN_WORK_20260927.md:258`) | 4 call site lỗi đã sửa thành `resolve_tenant` (PR #73 `CLAIMS:975`); còn 5 điểm cùng mẫu ở `commercial_partner_views.py:79,108,139,186,282` — Owner để lại (đổi 200-rỗng → 403 cần kiểm FE) | Không còn P0 | W1: kiểm FE trước khi đổi 5 endpoint partner (`:276-284`) |
| M1-06 | **GAP** P2 [T] | `OPEN_WORK_20260927.md:362-379` | OW-04 Turnstile allowlist đã sửa (`env_validation.py:127,134,137`) | Không còn gap | Giữ nguyên, không mở lại |
| M1-07 | **ERROR** P1 [T] (rev1 mới) | `identity_access/urls.py:75` + `vninvest_core/urls.py:60` + `core-route-manifest.json:306-415` | `partner_urls` mount 2 lần → **110 route** `/core/v1/partner/partner/...` (manifest `core:631` chứa 110 trùng) | Tránh mount 2 lần; URL ngoài ý | W0: gỡ 1 mount (chỉ giữ `core/v1/ → partner_urls`), regenerate manifest |

### M2 — Market Data (BE `market_data` + `data_ingest` + `market_serving`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M2-01 | **ERROR** P0 [T][X] | `market_serving/native_views.py:430,451,522,469-511,480-487,525-526` + `packages/web/src/adapters/chartAdapter.js:154-176` + `StockOrderBookWidget.jsx:153-161` | Depth synthetic (3 bid/3 ask từ snapshot + MD5 pseudo-random `:480-487`), badge "Ước tính" ở 1 nơi, widget order book ở repo ngoài không có badge | Retail hiểu nhầm là order book thật; vi phạm D6 | W0: gắn badge "Ước tính" ở mọi nơi tiêu thụ + không để chart ngầm dùng mock (D6) — phần widget là [X] |
| M2-02 | **GAP** P1 [T] | `native_views.py:529-539` | Fallback `tick_size=0.05` khi thiếu `StockProfile` | Sai tick size với mã không có profile | Lấy từ registry hoặc guideline, không hardcode |
| M2-03 | **GAP** P2 [T] | `stock_mgmt_native_views.py:2277-2278,2294` | News AI-summary native stub, portfolio news digest stub (`:3492-3500`), `9` "Graceful stubs return empty/null" | News luôn trống | W2: nối AI advisory vào news, hoặc khai báo "chưa có" |
| M2-04 | **RISK** P2 [T] | `market_data/vnbroker_adapter.py:1372-1419` | Hardcode 6 sector + màu/display_order tĩnh vì provider không trả | Sector không đổi từ BE | Giữ ở adapter + note |
| M2-05 | **RISK** P3 [T] | `market_data/global_symbol_planner.py:21-23` | Hot/warm/cold (`120/60/25/80`) hardcode policy | Không phải lỗi | Giữ + config hóa |
| M2-06 | **ERROR** P0 [T] (rev1 mới, từ Entry 404/407) | `advisory/pricing.py:160` dùng `timezone.utc` đã gỡ ở Django 6 | Đo ở Entry 404/407 làm đỏ `test_no_timezone_utc.py` | Test/gate gãy | W0: đổi sang `datetime.UTC` + sửa test |
| M2-07 | **RISK** P2 [T] (rev1 mới) | `vninvest_core/tests/test_api_envelope_schema.py:607` (`KNOWN_UNREADABLE`) bỏ qua ngầm 5 endpoint `user_workspace.views_broker` | Envelope invariant không kiểm 5 endpoint này | 5 endpoint broker có thể lệch envelope mà không bị chặn | W0: đo envelope 5 endpoint broker, thu hẹp `KNOWN_UNREADABLE` |

### M3 — Portfolio / Ledger / Broker / Screener / AI-CC (BE `user_workspace`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M3-01 | **CLOSED** (rev1) | `portfolio_analytics_views.py:913-4417` (13 class/15 write methods có `permission_classes`) + `status` import `:24` (`P1-5`) | **SAFE-04 đã merge:** PR #75 (`b59027a14`, 2026-10-07) + NameError `6d805fb8d` (2026-10-06). `_get_user_portfolio` fail-closed (`:102-124`) | Không còn P0 | Chỉ giữ P2: dọn 35 legacy test `force_authenticate` screener `3958-4485` |
| M3-02 | **ERROR** P0 [T] | `adapters/core/workspace.js:719-728` + `ai_agents/apps.py:4-7` + `route-contract.test.js:168-171` | `/ai/agents/` 404 thật (FE gọi, BE rỗng) — allowlist `gap-3` duy nhất còn lại | UI AI Agents luôn 404 | W0: hoặc implement `ai_agents` tối thiểu hoặc **gỡ UI** + gỡ allowlist `gap-3` sau W2.1 |
| M3-03 | **GAP** P1 [T] | `PortfoliosPage.tsx:140` + `workspace.js:183` + `portfolio_analytics_views.py:369-383` | BE đã trả `total_market_value/total_cost/total_unrealized_pnl/cash` nhưng page cũ chỉ đọc `opening_balance`, `getPortfolioSummary` 0 lần gọi | Trang quản lý không hiện tiền thật | `pf-manage-rebuild` đã scopes: nối `getPortfolioSummary`/`getPortfolioHoldings` |
| M3-04 | **GAP** P1 [T] | `views.py:186` (`updatePortfolio` PATCH) + page chỉ create/delete | Sửa danh mục không được — adapter còn | Không sửa được danh mục | Bật PATCH ở UI `/portfolios/manage` + routeCatalog entry |
| M3-05 | **RISK** P1 [T] | `user_workspace/permissions.py:224-313` + `views_dnse.py:709-724` | Scope đúng ở cả FE/BE | Không phải lỗi | Giữ |
| M3-06 | **ERROR** P2 [T] | `workspace.js:36-44` + `pagination.py:35-39` | Cursor `{next,previous,results}` không `count`, page_size 50 — trước đây cắt ở 50 dòng im lặng | Danh sách bị cắt âm thầm nếu không follow `next` | Follow `next` / reset |
| M3-07 | **GAP** P2 [T] | `workspace.js:16-20,465-479` + `views_dnse.py:688-759` | Idempotency FE sinh key mỗi submit, BE 400/409/replay — khép vòng | Không phải lỗi | Giữ |
| M3-08 | **RISK** P2 [T] | `broker/base.py:66` + `broker/egress.py:10,114` | `FULLY_SUPPORTED` hardcode provider, egress tốt | Hardcode provider | Version hóa matrix |

### M4 — Commercial / Billing (BE `commercial`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M4-01 | **ERROR** P0 [T] | `commercial/vnpay_service.py:16,22,28-33,35-42` | Dev dùng `SECRET_DEMO` không verify; prod `raise ImproperlyConfigured` | Deploy nhầm `DEBUG` là chấp nhận chữ ký giả | Fail-closed + check `DEBUG` ở startup (`env_validation.py`) |
| M4-02 | **RISK** P1 [T] | `commercial/stripe_service.py:37-39,54-55` + `views.py:472,562` | `is_configured()` + raise nếu thiếu key — tốt | Không phải lỗi | Giữ |
| M4-03 | **GAP** P2 [T] | `commercial/views.py:102-114` | Legal pages trả `[]` có chủ đích | Trang pháp lý trống | Điền nội dung hoặc tắt route |
| M4-04 | **GAP** P2 [T] (product) | `OPEN_WORK_20260927.md:386-398` + `CLAIMS:719-757` | Viewer/editor 403 trên subscription/invoices/cost-trend, nhưng quota `usage:read` vẫn 200 cho viewer — 2 quy tắc khác nhau | Viewer thấy usage nhưng không thấy billing | Owner chốt: quota cũng khóa theo `billing:read` hay giữ `usage:read` |

### M5 — Signals / Whale / Dark Flow (BE `signal_intelligence`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M5-01 | **GAP** P1 [T] | `session_facts_engine.py:38,205` | `dark_flow_score` là absorption proxy (không phải "dấu vết cá mập" tuyệt đối) | UI nói quá nếu ghi "whale" tuyệt đối | Ghi rõ "absorption proxy" trong UI |
| M5-02 | **RISK** P1 [T] | `outbound_notification_service.py:51,54,73-93` | FCM đã sửa `True` giả → `False` (`:73-79`), nhưng vẫn dùng legacy `fcm.googleapis.com/fcm/send` (`:93`) chưa lên HTTP v1; WebPush tương tự | Chưa có key prod thì không gửi được; đã không còn báo giả (D7) | W0: trả `skipped/not_configured` kèm lý do, UI nói "chưa bật" (D7) |
| M5-03 | **GAP** P2 [T] | `settings.py:669-673` (NOOP) + `settings.py:871-875` (thật) | Beat chạy song song 2 task `materialize_unified_alerts` (NOOP `market_serving` + thật `signal_intelligence` ghi "Overrides the NOOP placeholder") | NOOP là rác | W1.4: xóa entry NOOP `669-673` |
| M5-04 | **GAP** P2 [T] | `MASTER_TRACKING:72-78` | HAVE 9/PARTIAL 13/MISSING 11 | Bảng năng lực còn 11 MISSING | Đọc lại ma trận trước khi mở W2 |

### M6 — AI Advisory / AI-CC (BE `advisory` + `ai_analytics` + `ai_agents`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M6-01 | **ERROR** P0 [T] | `advisory/orchestrator.py:717-723` + ~35 chuỗi "khuyến nghị" | LLM bị yêu cầu `signal: BUY|SELL|HOLD` + `target_price` — vi phạm D2 (AI kỹ thuật, không khuyến nghị) | Rủi ro pháp lý + sai định vị brand | W1/W2: đổi LLM schema → kỹ thuật, disclaimer, gỡ order placement (giữ paper) |
| M6-02 | **ERROR** P1 [T] | `ai_clients/openclaw.py:42-43,151-152` | `SUPPORTED_PROTOCOLS=()` ⇒ 503 toàn phần (đúng thiết kế D-03c nhưng chưa implement) | User tưởng AI chính chết | D4: định vị "tính năng hỗ trợ" + fail-closed rõ lý do, hoặc implement protocol |
| M6-03 | **GAP** P1 [T] | `ai_analytics/views.py:101-107,168-250` | POST 405 có chủ đích (chặn bịa số), SLO trả `[]` khi không data | Không phải lỗi | Giữ |
| M6-04 | **CLOSED** (rev1) | `en.js:5639` + `vi.js:5710` | `loadError` **đã có đủ ở cả 2 locale** (block 5434-5728, không cắt cụt 5569/5634 như rev0 ghi) | Không còn gap | Giữ nguyên (slice R1.3 đã đúng) |

### M7 — SOC / DataOps / Operator (BE `service_ops`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M7-01 | **CLOSED** (rev1 — bác bỏ P0 cũ) | `vninvest_core/urls.py:65` + `contracts/operator/urls.py:17` + `core-route-manifest.json:136-271` + `route-contract.test.js:215-231` | **Không lệch prefix:** SOC 136 route tồn tại tại `/core/v1/operator/soc/...` (qua `contracts.operator.urls`), không phụ thuộc nginx rewrite (bẫy `L-V09`) | Không 404 | Hạ `/core/v1/capability-bootstrap` (`views_health.py:19-36`) xuống **LOW/CLEANUP** (legacy dead endpoint, không còn được `coreAdapter.js:104-106` dùng); thay bằng P1 partner double-mount (M1-07) |
| M7-02 | **RISK** P2 [T] | `dataops_market_data.py:725-751` + `views/broker.py:76-81` | Queue depth fail-open 0 khi Redis down (observability) | SOC thấy 0 khi thực là down | Gắn cờ "unavailable", không trả 0 như thật |
| M7-03 | **GAP** P2 [T] | `matrix_coordinator.py:16-27` + `models.py:499` | `PREDEFINED_SYMBOL_GROUPS` tĩnh (VN30/VN50/VN100/HOSE/HNX/UPCOM) | Không đổi từ DB | Giữ, ghi note |

### M8 — Support / Ads / Tenant-lifecycle / Core

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M8-01 | **ERROR** P1 [T] (rev1 — ĐÃ ĐẾM) | `advertising/views.py:158,197-199,390` + `env_validation.py:99-129` + `settings.py:65-99` + `checks.py:1-278` | `CORE_AD_SIGNING_SECRET` default `'dev-ad-signing-secret-replace-in-production'` — **XÁC NHẬN CHƯA CHẶN** (0 hit trong cả 3 nơi) | Deploy quên set là HMAC yếu | W0.2: thêm check prod ở `env_validation.py` |
| M8-02 | **GAP** P2 [T] | `advertising/views.py:65,313` | Plan set cứng `{'starter','pro','enterprise','custom','internal'}` | Plan mới phải sửa code | Lấy từ DB/config |
| M8-03 | **GAP** P2 [T] | `tenant_lifecycle/` + `settings.py:131` | `ai_agents` rỗng (0 model, 0 route) vẫn trong `INSTALLED_APPS` | Dead app vẫn giữ | Xóa app rỗng hoặc gỡ khỏi INSTALLED_APPS |
| M8-04 | **RISK** P3 [T] | `vninvest_core/utils/legacy_stubs.py:42-67` | POST trả `{"status":"accepted"}` rồi bỏ (fail-open nhẹ) | Nhận rồi bỏ làm mất dữ liệu | Trả `503 Feature not yet available` như GET |

### M9 — Frontend cross-cutting (FE `packages/web/src`)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M9-01 | **GAP** P1 [T] (rev1 — ĐÃ ĐẾM) | `pages/workspace/ShellDashboardPage.tsx:173` + `ShellPortfoliosPage.tsx:176` + `ShellTransactionsPage.tsx:174` + `ShellWatchlistPage.tsx:186` + `pages/system/ShellSettingsPage.tsx:146` + `ShellSupportPage.tsx:171` + `ShellAiCommandCenterPage.tsx:237` | 7 file export (`src/index.js:20-27` gỡ khỏi registry) = **1263 LOC** (đo trên `dev`, gồm `useLang`; hoặc **1026 LOC** nếu không tính `ShellAiCommandCenterPage`); `10/10 exports` trong `package.json:36-48` **đã sửa W0.3**, đều trỏ file `.js` tồn tại | Không được tự xóa nếu chưa gỡ `check-shell.mjs` + `src/index.js` (`pageRegistry.js:211-225`) | Đếm theo HEAD này (1263/1026), không dùng 837 cũ |
| M9-02 | **GAP** P2 [T] (rev1 — hạ từ P1) | `pages/tenant-admin/TenantAdminUsagePage.tsx:161-163` + `route-contract.test.js:67` + `SCAN_ROOTS:46-55` | 3 dòng `adapter.coreGet("/partner/...")` **đã dưới gate** (`METHOD_CALL_RE` quét `src/pages/**` từ PR #281) — chỉ thiếu wrapper method trong `coreAdapter.js` | Chỉ là nợ kiến trúc nhỏ | Thêm 3 wrapper `getUsageMeters/Quotas/Tenant` vào `coreAdapter.js` |
| M9-03 | **GAP** P2 [T] | `app/routeCatalog.js:7-791` (69) vs `pageRegistry.js:167` (61) vs `main.tsx:149-255` (75) | Chênh 8 catalog-only (whale-alerts, portfolio-* 5, tenant-admin layout) — ánh xạ `main.tsx:22-51` | Thêm/xóa route phải sửa cả 3 nơi | Ghi ADR + test catalogue diff |
| M9-04 | **CLOSED** (rev1) | `en.js:5639` + `vi.js:5710` | `loadError` **đã có đủ** (giống M6-04) | Không còn gap | Giữ nguyên |
| M9-05 | **GAP** P2 [T] | `ShellWatchlistPage.tsx:148,152` + `TenantUsageSummaryPage.tsx:140` + `VipLocalControlPage.tsx:251` + Entry 421 | Hardcoded EN/VD trong Shell pages — **nhưng Entry 421 (2026-10-30) đã bổ sung `useLang`, 5 trang chrome-level + PaymentReturn/Transactions** — chỉ còn `B3b` ~140 chuỗi phần thân | Đang dọn dần | Đóng B3b theo Entry 421 |

### M10 — Package phụ + Test/CI (đã verify)

| ID | Mức | File:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| M10-01 | **GAP** P2 [T] (rev1 hạ từ P1) | `packages/mobile/src/services/coreApiClient.ts:100-116` vs `market_serving/urls.py:31` | Mobile `/whale-feed-aggregate/` thiếu `realtime/` + `?date=` vs `?trade_date=` — nhưng `packages/mobile` là scaffold 0 dep, 0 consumer, **không tính roadmap prod** | Không chặn prod | Sửa khi làm PWA W4 |
| M10-02 | **GAP** P1 [X] | `packages/mobile/package.json:1-12` (0 dependency), `opencore` build path trỏ `frontend/` rỗng, `vip-app/api_stub.py:108-131` chỉ stub | 3/3 package phụ 0 consumer, 0 CI | Không tính vào roadmap prod | Giữ scaffold đến W4 (PWA/mobile retail-first) |
| M10-03 | **ERROR** P1 [X] | `.github/workflows-disabled/` 8 file + `secret-scan.yml:5-8` | CI tắt từ 2026-09-27 (`README:9-13` 200/200 fail) | Không có lưới an toàn remote | Trả billing mới bật lại; gate thật chỉ là local `pre-push-gate` |
| M10-04 | **GAP** P2 [T] (rev1 — ĐÃ ĐẾM) | `scripts/pre-push-gate.mjs:504-508` + `pre-push-gate.mjs:187` + `:536` | Trong 13 script, **4 script đã gắn** (`check-light-theme` + `check-portfolio-contrast` + `check-page-registry` + `check-multi-agent`) + `check-experiment-env` — còn **9 script** chưa gắn | Không phải 11/13 | Wire 9 script còn lại hoặc khai báo bỏ (W0.1) |
| M10-05 | **ERROR** P2 [T] | Baseline BE `3468/12/224` (`MASTER_TRACKING:267`) vs `602/10/3` (`OPEN_WORK:134`) + Entry 415 (`427+620+1074+508+314+32 OK, 22 pre-existing`) | Số cũ outdated; Entry 415 (PR #299) đã đo baseline mới trên VPS | Không so baseline cũ để đo hồi quy | Lấy `3468/12/224` + Entry 415 làm baseline, chạy lại trên VPS staging trước W1 |

---

## CONTRADICTIONS (plan/doc vs code)

| # | Claim | Thực tế tại file:line | Tác động |
|---|---|---|---|
| C1 | AGENTS.md ghi widget `^1.2.5` | `package.json:108` là `file:vendor/vninvestcharts-widget-1.2.5.tgz` | Audit widget phải đọc vendor local, không tra npm |
| C2 | AGENTS.md ghi types `44 dòng` | `vninvestcharts-widget.d.ts:1-73` là 73 dòng | Plan dùng 44 dòng sẽ thiếu type |
| C3 | `OPEN_WORK_20260927.md:134` baseline 602 test | `MASTER_TRACKING:267` là 3468 test mới nhất + Entry 415 VPS baselines | So baseline cũ là sai |
| C4 | ~~`loadError` thiếu cả 2 locale~~ **ĐÃ BÁC BỎ** | `en.js:5639` + `vi.js:5710` đã có đủ | Giữ, không cần thêm key |
| C5 | Ledger "837 LOC shadow / 17 endpoint / 10/10 exports" | 837 LOC cũ outdated (thật **1263 LOC/7 file** hoặc **1026/6 file** trên `dev`); 10/10 exports **đã sửa W0.3**; 17 endpoint **CHƯA XÁC MINH** số (lọc vẫn chưa xong) | Không dùng 837 cũ để ước lượng code |

## Câu hỏi cần làm rõ (rev1 — còn 3 câu thật)

| # | Câu hỏi | Vì sao giữ lại |
|---|---|---|
| Q1 | `SAFE-04` đã merge chưa? | ❌ **KHÔNG HỎI** — đã rõ PR #75 (`b59027a14`) + `6d805fb8d`. Chỉ hỏi P2 dọn `force_authenticate` nếu có. |
| Q2 | Depth 3 mức giả lập + `pe/pb/roe = 0` + lịch sử < 1 năm — nguồn dữ liệu thật ở W1 hay gắn nhãn trước? | ✅ **GIỮ** — quyết định Product/Timeline (D6). |
| Q3 | Rotate `CORE_PAT_PEPPER` (11 commit) + `DNSE_CREDENTIAL_FERNET_KEY` (7 commit) và nạp billing GH Actions? | ✅ **GIỮ** — quyết định Infra/Ops ([X1],[X2]). |
| Q4 | 110 route `/core/v1/partner/*` là phạm vi thương mại W3 hay nội bộ? | ⚠️ **SỬA SỐ** — không còn CHƯA XÁC MINH: **110 entries** + mount trùng (`identity_access/urls.py:75`). Sửa mount trùng ở W0; chỉ hỏi Owner về lộ diện UI Tenant Admin. |
| Q5 | Mobile scaffold giữ hay xoá? `/core/v1/ai/agents/` dựng BE thật hay gỡ UI? SAML `xmlsec` sửa Dockerfile hay gỡ khỏi runbook? | ✅ **GIỮ (gộp)** — quyết định kiến trúc W0.6/W2.1. |

## Đánh giá tổng thể

- **FE↔BE chính implementable, không blocker:** transport `X-Tenant-ID` (`transport.js:393-397` ↔ `permissions.py:224-313`), `Idempotency-Key` (`workspace.js:465-479` ↔ `views_dnse.py:688-759`), `mode` (`workspace.js:23-30` ↔ `views_dnse.py:301-404`) đã khép vòng, có contract test (`dnse-order-contract.test.js`).
- **Blocker thật cần xử lý trước W1:** depth labelling (M2-01), `/ai/agents/` 404 (M3-02), partner double-mount (M1-07), SAML BL-01b (M1-01), AI contract D2 (M6-01), CI billing (M10-03), ads secret check (M8-01), `pricing.py:160` + envelope broker (M2-06/M2-07).
- **Không có kết luận BE nào là "được"** vì test chưa chạy lại (L-007). Việc này để W0 làm, không làm trong task review này (static).
