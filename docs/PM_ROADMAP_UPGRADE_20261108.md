# BÁO CÁO HIỆN TRẠNG + HƯỚNG CẢI TIẾN NÂNG CẤP — PM review 2026-11-08 (rev1)

> Ngày: 2026-11-08 · Branch: `feat/pm-review-20261108` (sạch trên `dev` `983b8c270`) · Vai trò: PM chịu trách nhiệm cao nhất, quản lý BE/FE
> Phạm vi: L0-L4 toàn hệ thống (static read-only, 4 subagent evidence + B3/B8 refute 6 blocker, mọi khẳng định có `file:line` hoặc `CHƯA XÁC MINH`)
> Tài liệu đi kèm: `docs/PM_FUNCTIONAL_TREE_20261108.md` (cây L0-L4) · `docs/PM_BUG_GAP_MATRIX_20261108.md` (ma trận bug/gap) · `docs/PLAN_PM_FULL_REVIEW_20261108.md` (plan + checklist lessons)
> Quyết định Owner D1-D8 (`docs/MASTER_TRACKING_2026Q4.md:90-101`): retail-first · **miễn phí lấy brand** · AI = **phân tích kỹ thuật** · **không đặt lệnh** ngoài hợp đồng · 2 tầng broker
> Lessons áp dụng: [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04, L-V09] · Gate: `check-multi-agent` **PASS** · `tsc --noEmit` **exit 0** · `check-lessons` **exit 0** (rev1 đo lại trên `dev`)

## 0. Tóm tắt 5 findings nghiêm trọng nhất (rev1 — ĐÃ GỌT FALSE-POSITIVE)

1. **Depth mock 100% đang bị tiêu thụ như order book thật — P0 niềm tin [T][X].** `market_serving/native_views.py:430,451,522` (mock/synthetic), badge "Ước tính" đã có (`:525-526`) nhưng `packages/web/src/adapters/chartAdapter.js:154-176` vẫn render vào widget không nhãn. Retail mua "dữ liệu không có ở chỗ khác" sẽ mất brand nếu phát hiện — việc W0 phải gắn nhãn mọi nơi tiêu thụ (D6) hoặc tắt widget.
2. **3 capability gap đồng thời: `/ai/agents/` 404 + SAML chưa verify + OpenClaw 503 — P0.** `ai_agents/apps.py:4-7` rỗng mà FE `workspace.js:719-728` vẫn gọi (`gap-3` allowlist `route-contract.test.js:168-171`); `saml_service.py:388-400` noop/strict raise (staging lệch `libxml2`); `openclaw.py:42-43` `()` ⇒ 503. Enterprise SSO và AI "tính năng hỗ trợ" đều chưa prod được.
3. **~~P0 SOC prefix — ĐÃ BÁC BỎ~~ → Partner double-mount 110 route (P1 mới).** SOC **không** lệch (136 route tồn tại qua `contracts/operator/urls.py:17`); capability gọi `/access/capabilities` đầy đủ (`identity_access/urls.py:21-22` → `profile.py:112-135`); mobile whale-feed là scaffold 0 consumer. Lỗi thật là `partner_urls` mount 2 lần → **110 route** `/core/v1/partner/partner/...` (`core-route-manifest.json:306-415`). Hạ `/core/v1/capability-bootstrap` (`views_health.py:19-36`) xuống **LOW/CLEANUP**.
4. **CI chết 1/9 (billing) + `CORE_PAT_PEPPER` 11 commit + VNPay demo — P0 [X][T].** Gate thật chỉ là local `pre-push-gate`. Secrets trì hoãn theo quyết định Owner 2026-10-07 (`OPEN_WORK_SEC:49-51`), mở lại khi lên production/public.
5. **AI contract `BUY|SELL|HOLD` + `target_price` mâu thuẫn D2 — P0 [T].** `orchestrator.py:717-723` + ~35 chuỗi "khuyến nghị" phải đổi schema LLM, không chỉ đổi câu chữ. Không làm thì brand "phân tích kỹ thuật" là quảng cáo sai. *(SAFE-04 **đã đóng** PR #75 `b59027a14` — không còn là blocker.)*

---

## 1. Hiện trạng theo 8 miền (đã verify — rev1)

| Miền | Trên giấy (ledger/MASTER) | Thực tế tại `file:line` | Điểm làm được (giữ) | Điểm nợ (xem matrix) |
|---|---|---|---|---|
| **M1 Auth/Tenant** | 24 model, SSO, PAT, partner **110** route | `identity_access/urls.py:10-84` + `partner_urls.py:22-195` (**110 `path()`**) + `api_urls.py:14-28` (**15**) + `ops_audit` +2 | Tenant resolver SSOT (`resolve_tenant`), PAT CIDR qua `get_client_ip()`, AuditLog fail-closed (`ops_audit/views.py:44-45`) | SAML BL-01b (M1-01), double-mount 110 (M1-07), pepper rotate (M1-04), `pricing.py:160` (M2-06) |
| **M2 Market** | OHLCV/intraday/snapshot/CVD thật | `market_data/urls.py:1-13` (**6 route**) unpack `core_urls.py:44-47` + 35 = **41 route** (`vninvest_core/urls.py:69`); `market_serving/native_views.py:430-526` | Snapshot/CVD/ticker thật; ingest 16 tasks; planner hot/warm/cold | Depth mock (M2-01), stock-mgmt news stub (M2-03), `pricing.py:160` `timezone.utc` (M2-06), envelope broker `KNOWN_UNREADABLE` (M2-07) |
| **M3 Portfolio/Broker** | Portfolio + ledger append-only + 3 broker lane | `user_workspace/urls.py:52-173` + `views_dnse.py:301-759` + `permissions.py:224-313` + **`status` import `:24`, 15 write methods có gate (`:913-4417`) — SAFE-04 ĐÃ ĐÓNG** | Egress fail-closed, idempotency/mode khép vòng, `X-Tenant-ID` SSOT | `/ai/agents/` 404 (M3-02), `getPortfolioSummary` 0 lần gọi (M3-03), P2 dọn `force_authenticate` |
| **M4 Commercial** | Billing + VNPay/Stripe | `commercial/urls.py:7-21` + `vnpay_service.py:16-42` + `stripe_service.py:37-39` | Fail-closed cả 2 cửa (prod raise khi thiếu key) | VNPay dev demo (M4-01), legal pages `[]` (M4-03), quota/billing 2 quy tắc (M4-04) |
| **M5 Signals** | Alert + whale + order-flow | `signal_intelligence/urls.py:6-18` + `outbound_notification_service.py:73-93` + **`settings.py:669-673` NOOP** vs **`settings.py:871-875` thật** | UnifiedAlert/Whale thật, FCM đã bỏ `True` giả | Dark flow là proxy (M5-01), FCM legacy endpoint (M5-02), xóa NOOP beat (M5-03) |
| **M6 AI** | 6 provider BYOK + budget/audit/trace | `advisory/urls.py:6-11` + `orchestrator.py:717-723,572-576` + `ai_analytics/views.py:101-107` + **`en.js:5639` + `vi.js:5710` `loadError` đã có** | Mock guard (DEBUG mới cho template), analytics POST 405 | LLM BUY/SELL/HOLD (M6-01), OpenClaw 503 (M6-02) — ~~`loadError`~~ đã đóng |
| **M7 SOC** | 136 route (qua `core/v1/operator/`) + 110 partner (trùng 110) | `service_ops/urls.py:40-210` (mount 2 nơi: `vninvest_core/urls.py:65` + `:80`) + `soc.js:168-862` + `core-route-manifest.json:136-271` (**136 route**) | Health probes, matrix, dataops — **không lệch prefix** | Queue depth 0 (M7-02), capability-bootstrap LOW/CLEANUP |
| **M8 Support/Ads/Lifecycle/Core** | Ticketing, ads, trial, legacy proxy | `support/urls.py:15-22` + `advertising/views.py:158,390` + `tenant_lifecycle/tasks.py:40,220` + **Entry 415** (`427+620+1074+508+314+32 OK, 22 pre-existing`) | Support đầy đủ validation, lifecycle policy rõ (7,3,1 ngày + 30 ngày) | Ads secret chưa chặn prod (M8-01 — **XÁC NHẬN CHƯA CHẶN**), legacy stub POST `accepted` (M8-04) |

**FE cross-cutting:** 69 catalog / 61 registry / 75 `<Route>` (`routeCatalog.js:7-791`, `pageRegistry.js:167`, `main.tsx:149-255`); 11 domain adapter (workspace 90, market 40, operator 37, soc 126 occurrence); `soc.tokens.css` 211 dòng / `soc.components.css` 4061 dòng; widget vendor 1.2.5 (`package.json:108` là `file:vendor/...`, không phải `^1.2.5`) + React 19 (`:97-98`); **W0.5 đã xong** (`route-contract.test.js:46-55` `SCAN_ROOTS` adapters/pages/context + test `:201-208`); Shell 7 file **1263 LOC** (`ShellDashboardPage.tsx:173` + `ShellPortfoliosPage.tsx:176` + `ShellTransactionsPage.tsx:174` + `ShellWatchlistPage.tsx:186` + `ShellSettingsPage.tsx:146` + `ShellSupportPage.tsx:171` + `ShellAiCommandCenterPage.tsx:237`) hoặc **1026 LOC** nếu không tính AIC; `10/10 exports` **đã sửa W0.3**.

**Test/CI (rev1 baseline):** BE `3468/12/224/7 skipped` (`MASTER_TRACKING:267`) + Entry 415 VPS (`427+620+1074+508+314+32 OK, 22 pre-existing` `d150e5d` PR #299); FE `1179/5` (`:267`); gate `34 PASS` (`MASTER_TRACKING:5`, đã wire **4** script (`pre-push-gate.mjs:504-508` 3 + `:187` `check-multi-agent` + `:536` `check-experiment-env`), còn **9/13** chưa gắn (không phải 11/13); CI **1/9 workflow** (`secret-scan.yml`), `200/200 run fail` (`workflows-disabled/README.md:9-13`).

**Package phụ:** mobile 3.823 LOC (0 dependency), opencore 62 LOC (build path trỏ `frontend/` rỗng), vip-app 684 LOC (stub 8 route `api_stub.py:108-131`) — 3/3 **không nối CI/prod**, không tính vào roadmap prod (mobile whale-feed 404 là dead path scaffold).

---

## 2. Đánh giá: implementable? blocker? ưu tiên?

- **FE↔BE chính implementable, không blocker:** transport `X-Tenant-ID` (`transport.js:393-397` ↔ `permissions.py:224-313`), `Idempotency-Key` (`workspace.js:465-479` ↔ `views_dnse.py:688-759`), `mode` (`workspace.js:23-30` ↔ `views_dnse.py:301-404`) đã khép vòng, có contract test (`dnse-order-contract.test.js`).
- **Blocker thật quyết định W1 có mở được không:** depth labelling (M2-01), `/ai/agents/` 404 (M3-02), partner double-mount (M1-07), SAML BL-01b (M1-01), AI contract D2 (M6-01), CI billing (M10-03), ads secret (M8-01), `pricing.py:160` (M2-06). ~~SOC prefix~~ và ~~SAFE-04~~ **không còn là blocker**.
- **Không có kết luận BE nào là "được"** vì test chưa chạy lại (L-007). Mọi "PASS" sau này phải chạy trên VPS staging (`14.225.255.47`, cấm local Docker — `docs/STAGING_VPS_RUNBOOK.md`).

---

## 3. Hướng cải tiến nâng cấp — theo W0→W5, nhãn [T]/[X]

Nguyên tắc: **W0-W3 = 100% [T]** (không chặn bởi pháp lý/hợp đồng — `ROADMAP_SPECIAL:23`), 12 mục [X] gom vào W5. Mục tiêu (D1/D8): **retail-first, miễn phí lấy brand** — đo activation/D1/D7/referral, không đo MRR. AI = **kỹ thuật** (D2), không đặt lệnh (D2), mỗi lane broker 2 tầng (D3).

### W0 — Nền + trung thực dữ liệu [T] (làm trước mọi thứ)

| Việc | Nội dung | Bằng chứng | AC |
|---|---|---|---|
| **W0-pre: chốt baseline** [T] | Chạy lại BE/FE full trên VPS staging, lấy số mới (`3468/12/224` + Entry 415), xác minh envelope broker (`KNOWN_UNREADABLE` thu hẹp) — **không hỏi Owner SAFE-04** (đã merge `b59027a14`) | L-007 | Số thật + `CHƯA CHẠY` được tick hoặc chạy xong |
| W0.1 wire gate chết | Wire **9** script còn lại (sau 4 đã gắn) vào `pre-push-gate` (trừ 2 đã wire ở W0.1), OC-19 path `packages/...` | `pre-push-gate.mjs:504-508,187,536`, `MASTER_TRACKING:84` | Gate không còn mồ côi, `check-multi-agent` PASS |
| W0 partner double-mount | Gỡ 1 mount `partner_urls` (chỉ giữ `core/v1/ → partner_urls`, bỏ `identity_access/urls.py:75` `partner/`), regenerate `core-route-manifest.json` (110 trùng) | `core-route-manifest.json:306-415` | Manifest không còn 110 trùng |
| W0.6 data honesty | Depth badge mọi nơi tiêu thụ (không chỉ `StockOrderBookWidget.jsx:153-161`), FCM `skipped/not_configured` (D7), whale test fail-closed, push không báo giả | `outbound_notification_service.py:56-57,102-103`, `native_views.py:525-526` | Không còn "thành công giả" khi thiếu key |
| W0.5 contract gate **ĐÃ XONG** | `route-contract.test.js:46-55` `SCAN_ROOTS` adapters/pages/context + test `:201-208` đã quét cả 3 từ PR #281; chỉ còn gỡ allowlist `gap-3` `/core/v1/ai/agents/` ở `:168-171` sau W2.1 | `route-contract.test.js:46-55,168-171,201-208` | Đóng việc này, chuyển sang W0.2 ads check |
| W0 API `/ai/agents` | Quyết: implement tối thiểu hoặc **gỡ UI** (D4 hỗ trợ) — chính là gỡ `gap-3` allowlist | `workspace.js:719-728` | Không còn 404 trên UI |
| W0.2 ads + pricing | Thêm check prod `CORE_AD_SIGNING_SECRET` (`env_validation.py`); sửa `advisory/pricing.py:160` `timezone.utc` → `datetime.UTC` | `advertising/views.py:158`, `pricing.py:160` | Không còn HMAC yếu / test gãy |
| W0.8 CI/billing | [X] trả billing mới bật CI; trước đó gate local là duy nhất | `workflows-disabled/README.md:9-13` | Không cam kết remote CI |

### W1 — Kích hoạt retail + broker 2 tầng [T]

- **W1.5 tenant-admin 17** (`routeCatalog.js:411-769`) — hợp nhất, broker hub tách riêng (`/portfolios/manage/broker`), không nhét panel 540 dòng lên trang quản lý (D-36).
- **W1.7 broker detail WS850** — route `broker-account` (`BrokerAccountRoute`), inbound reconcile, capability matrix versioned (`broker.js:43-49` ↔ `broker/base.py`).
- **W1.8 SAML strict verify thật (B6) [T]+[X image]** — `saml_service.py:388-400` + `requirements.txt:46` + `Dockerfile:19,58` (chỉ thiếu code verify). Cần chọn (a) rebuild image hoặc (b) verify bằng CLI (`MASTER_TRACKING:152`).
- **W1.4 NOOP beat** — xóa entry NOOP `settings.py:669-673` (task thật đã chạy ở `:871-875`).
- **W1 credential 2 tầng (D3):** thêm credential cấp tenant/staff, tách khỏi `UserBrokerConfig` per-user + `SystemBrokerCredential` global 1 row (`identity_access/models.py:974-977`). Tên role `broker_operator` (vì `COC` đã bị chiếm).

### W2 — AI kỹ thuật (D2) + thị trường sâu [T]

- **W2.1 Signal schema:** đổi LLM `signal: BUY|SELL|HOLD` + `target_price` → kỹ thuật (`orchestrator.py:717-723`), UI ~35 chuỗi "khuyến nghị" (`ROADMAP:46`), disclaimer, gỡ order placement (giữ `paper`). Gỡ `gap-3` allowlist sau W2.1.
- **W2.2 Market sâu:** technicals bulk, financials nhiều năm, ICB series, TBT realtime, backtest giả định VN (0/5), risk Sharpe/Sortino, corporate actions, DRIP/tax PIT.
- **W2.3 Whale/dark flow minh bạch:** `dark_flow_score` là absorption proxy — ghi rõ trong UI (`session_facts_engine.py:38,205`).

### W3 — Vận hành + thương mại giai đoạn 2 [T]

- SLA tickets, incident playbook, secret rotation (khi lên prod), CIDR ban + throttle đã có.
- Sau brand: mới mở per-seat/advisor workspace + HĐĐT VAT (D1/D8) — [X] thuế/HĐĐT.

### W4-W5 — [X] chờ bên ngoài (ghi rõ điều kiện mở)

- PWA/App native, Apple App Store, Intellectsoft FCM, vendor HĐĐT, repo widget (breadth mini-chart, tối đa động `realtime/price-board` 3 hàng), IdP chính phủ, bản quyền dữ liệu, contracts broker/UBCKNN.

---

## 4. Quality gates audit (lint/type/i18n/test — rev1 đo tại HEAD `dev` sạch nhánh)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **exit 0 PASS** (0 lỗi, 15 app, 178 claim) |
| Lessons | `node scripts/check-lessons.mjs` | **exit 0** (14 file \| 57/60 \| sách) |
| Type-check | `npx tsc --noEmit` (`packages/web`) | **exit 0** |
| i18n | `loadError` đã có đủ (`en.js:5639` + `vi.js:5710`) — **không còn gap** (R1.3 đúng) | — |
| BE full | `MASTER_TRACKING:267` `3468/12/224` + Entry 415 VPS (`427+620+1074+508+314+32 OK`, PR #299 `d150e5d`) | **CHƯA CHẠY LẠI** (static, ghi CHƯA CHẠY để W0 chạy) |
| FE vitest | `MASTER_TRACKING:267` `1179/5` + Entry 421 B3 done | **CHƯA CHẠY LẠI** |
| Build | `npm run build` | **CHƯA CHẠY** |

> Mọi con số là đã ghi; chưa tự đo lại trong task này (static). Auditor được giao đối chiếu lại mọi số cùng gate.

## 5. Câu hỏi cần làm rõ (cho Owner, B4 — rev1 còn 3 câu thật)

| # | Câu hỏi | Vì sao giữ lại |
|---|---|---|
| Q2 | Depth 3 mức giả lập + `pe/pb/roe=0` + lịch sử < 1 năm — sửa nguồn dữ liệu thật ở W1 hay gắn nhãn `Ước tính / Demo` trước? | Product/Timeline (D6). |
| Q3 | Rotate `CORE_PAT_PEPPER` (11 commit) + `DNSE_CREDENTIAL_FERNET_KEY` (7 commit) và nạp billing GH Actions? | Infra/Ops ([X1],[X2]). |
| Q5 | Mobile scaffold giữ hay xoá? `/core/v1/ai/agents/` dựng BE thật hay gỡ UI? SAML `xmlsec` sửa Dockerfile hay gỡ khỏi runbook? | Kiến trúc W0.6/W2.1. |
| Q4 | 110 route `/core/v1/partner/*` thương mại W3 hay nội bộ? | Đã sửa số (**110 entries + mount trùng**), chỉ hỏi lộ diện UI Tenant Admin. |
| Q1 | SAFE-04 merge chưa? | ❌ **KHÔNG HỎI** — đã merge `b59027a14` + `6d805fb8d`, gỡ khỏi danh sách. |

## 6. Đánh giá tổng thể + bàn giao team

- **BE:** 16 app (`identity_access` 13.652 · `user_workspace` 16.001 · `service_ops` 15.239 · `advisory` 6.772 · `market_data` 9.943 · `data_ingest` 3.827 · `market_serving` 3.715 · `signal_intelligence` 4.811 · `commercial` 2.866 · `ops_audit` 1.604 · `support` 908 · `advertising` 904 · `ai_analytics` 490 · `tenant_lifecycle` 307 · `vninvest_core` 12.094 · `ai_agents` 5 rỗng — `docs/MASTER_TRACKING_2026Q4.md:27-46`).
- **FE:** 69 catalog / 61 registry / 75 `<Route>` + 11 adapter + 95 namespace i18n; W0.5 đã xong, W0.3 exports đã xong.
- **Giao việc:** BE team làm W0.1/W0 partner double-mount/W1.8/W0.2 ads+pricing (M2-06/M2-07); FE team làm contract gate `gap-3` gỡ sau W2.1 + catalog diff + depth badge; PM chốt 3 câu Q2/Q3/Q5 trước khi mở W1. Không tự mở W2 UI trước khi W0 xanh.

---
**Đã bỏ qua:** chạy BE/FE test, build, staging verify, load test, 3 package phụ sâu, subdomain/cookie, nhường cho W0 làm. **Rủi ro:** 17 endpoint `/partner/*` vẫn **CHƯA XÁC MINH** số; nếu partner double-mount chưa gỡ thì manifest sẽ phình 110 trùng; CI billing là [X], không thể tự giải quyết bằng code.
