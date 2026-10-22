# MASTER TRACKING — VNInvest (2026Q4 → 2027)

> **Điểm vào duy nhất cho đội code.** Đọc file này để biết: dự án đang ở đâu, đã làm gì, làm tiếp cái gì, và bằng chứng ở đâu.
>
> **Cập nhật:** 2026-10-22 (rà soát PM lần 2) · **`dev` @ `91bad0440`** · **Gate:** `pre-push-gate` **34 PASS / 0 SKIP / 0 FAIL**
> **Tài liệu chi tiết:** [`ROADMAP_MASTER_2026Q4_2027.md`](./ROADMAP_MASTER_2026Q4_2027.md) (kỹ thuật) · [`PM_REVIEW_20261022.md`](./PM_REVIEW_20261022.md) (**rà soát việc dang dở + kế hoạch tiếp theo**) · [`BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md`](./BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md) (quản lý) · [`COMPETITIVE_BENCHMARK_20261021.md`](./COMPETITIVE_BENCHMARK_20261021.md) (đối thủ, 108 URL) · [`HANDOVER_W0_FOUNDATION_20261022.md`](./HANDOVER_W0_FOUNDATION_20261022.md) (bàn giao) · [`AGENT_PROTOCOL.md`](./AGENT_PROTOCOL.md) (quy trình) · [`CLAIMS.md`](./CLAIMS.md) + [`CODE_CHANGE_AUDIT_LEDGER.md`](./CODE_CHANGE_AUDIT_LEDGER.md) (bằng chứng)

---

## 1. Tóm tắt 1 trang

| | |
|---|---|
| **Sản phẩm** | Nền tảng phân tích chứng khoán VN (HOSE/HNX/UPCom) cho retail + B2B (broker, cố vấn, quỹ) |
| **Lợi thế cốt lõi** | **Dữ liệu dòng tiền VN chuẩn hoá đi kèm tín hiệu** — đối thủ quốc tế (TradingView, moomoo, Webull, Bloomberg, FactSet) **không có**; FireAnt có nhưng bán dạng feed MetaKit (user tự viết AFL), **chưa phải signal** |
| **Quyết định Owner (D1–D8)** | Retail-first · giai đoạn đầu **miễn phí** (mục tiêu **brand name**, B2B để sau) · AI = **phân tích kỹ thuật** (không khuyến nghị) · **không đặt lệnh** ngoài hợp đồng · 2 tầng tài khoản broker (retail + staff) |
| **Nguyên tắc ưu tiên** | **Ưu tiên vấn đề tự giải quyết bằng code [T]**; việc phụ thuộc bên ngoài [X] **lùi xuống cuối** |
| **Quy tắc môi trường** | **Mọi thử nghiệm chạy trên VPS staging** `14.225.255.47`. **Cấm local Docker.** Sau thử nghiệm phải xoá container/worktree/DB tạm. Cổng chặn máy: `scripts/check-experiment-env.mjs` |
| **Quy mô** | BE **16 Django app** ~93 000 LOC · FE **421 file** ~110 000 LOC · 291 + 215 test file · ~500 route BE · **69** route FE |
| **Đã merge trong kỳ này** | **8 PR** (**#277–#284**) + **1 coordinator không có PR** (W0.8a, commit `31dcae058`/`91bad0440`) — xem §4 |
| **Còn lại trong W0** | **5 việc Phase A** (2 code: sửa 2 lỗi thật + OpenClaw/D4 · 3 doc: vệ sinh registry + backfill ledger + đính chính roadmap) + **2 việc chặn bên ngoài/hạ tầng** (SAML rebuild image · CI billing) + **1 mục chờ Owner** (gap-3) — xem §6 và [`PM_REVIEW_20261022.md`](./PM_REVIEW_20261022.md) |

---

## 2. Hiện trạng (đã verify bằng đọc code thật)

### 2.1 Backend — 16 Django app · ~93 000 LOC · 291 test file

| App | LOC | Năng lực | Bằng chứng |
|---|---|---|---|
| `identity_access` | 13 652 | Auth · tenant · PAT · service account · SSO · **partner API (108 route)** · webhook | `models.py:44,596,254,180` |
| `user_workspace` | 16 001 | Portfolio + **ledger append-only** · watchlist · screener · **3 broker lane** · AI Command Center | `models.py:22,93,1327,795,1063` |
| `service_ops` | 15 239 | **SOC control plane (136 route + 27 operator)** · dataops · signals · screener · matrix · backfill | `registry.py:19-40` |
| `advisory` | 6 772 | **AI advisory BYOK** đa provider · budget · audit · trace · deployment | `ai_clients/__init__.py:21-62` |
| `market_data` | 9 943 | Stock profile · OHLCV · intraday · stock-management native (37 route) | `core_urls.py:48-84` |
| `data_ingest` | 3 827 | Ingestion · backfill · outbox (92 Celery task) | `tasks.py:838,985,1428,2068,3050` |
| `market_serving` | 3 715 | Realtime read-model · CVD · ticker · price-board · whale-feed · depth | `urls.py:18-34` |
| `signal_intelligence` | 4 811 | Alert center · AI alerts · order-flow · whale feed · WebSocket/SSE | `models.py:15,76,110` |
| `commercial` | 2 866 | Subscription · quota · invoice · VNPay + Stripe | `models.py:11,61,91,118` |
| `ops_audit` | 1 604 | Audit event · request trace · API rollup · DB backup | `models.py:12,46,65` |
| `support` | 908 | Ticket user + staff · dashboard | `models.py:46,131,143,155` |
| `advertising` | 904 | Ad widget · campaign · impression/click · trademark | `urls.py:37-38` |
| `ai_analytics` | 490 | AI usage telemetry · SLO p50/p95/p99 | `urls.py:6-10` |
| `tenant_lifecycle` | 307 | Auto-expire trial · suspend quota overflow | `tasks.py:111,142,181,219` |
| `vninvest_core` | 12 094 | Health · capability bootstrap · OpenAPI · legacy proxy · RFC 9457 | `urls.py:44-109` |
| **`ai_agents`** | **5** | ⚠ **APP RỖNG** — model đã xoá, 0 route, 0 view | `ai_agents/apps.py:3-7` |

### 2.2 Frontend — 69 route · 421 file prod · ~110 000 LOC · 215 test file

| Nhóm | Số route | Ghi chú |
|---|---|---|
| Auth / Market / Portfolio | 4 / 4 / 7 | `/login`…`/portfolios/:id/{5 tab}` |
| Signals + AI | 7 | Alert Center (712) · Whale Advisory (527) · AI CC (440) · AI Traces (274) · AI Audit (160) |
| Tenant-admin | 17 | Toàn bộ bộ tenant admin của B2B |
| Operator / SOC | 11 | 9 tab SOC — Signals 2 330 · Vnbroker 1 335 · Overview 1 118 · DataOps 845 |
| Broker / Commercial / Admin / Tenant-self / Khác | 3 / 2 / 9 / 2 / 5 | |
| **Chỉ truy cập bằng URL, không có menu** | **51** | Menu chỉ 18 item (`navigationCatalog.js:5-48`) |

- **Adapter layer:** 11 domain client · **369 lệnh HTTP** (`soc.js` 730/120 · `workspace.js` 683/90 · `market.js` 478/40 · …)
- **Design system SOC:** `soc.tokens.css` **211 dòng** · `soc.components.css` **4 061 dòng** · ⚠ `soc.module.css` **chỉ 3 dòng barrel** (0 token, 0 class) — token phải vào `soc.tokens.css`, class vào `soc.components.css`
- **i18n:** 95 namespace · **6 694 leaf key (vi) / 6 674 (en)** — lệch 20
- **Chart:** widget npm `vninvestcharts-widget@1.2.5` có **59 indicator** trong catalog (+ Pine Editor, Strategy Tester, Bar Replay) — app chỉ bật **7**

### 2.3 Package phụ — cả 3 đều **KHÔNG được nối CI**

| Package | LOC | Vấn đề |
|---|---|---|
| `packages/mobile` | 3 823 | Scaffold React Native — không build được app, 0 consumer |
| `packages/opencore` | 62 | Build path chết: `build-community.mjs` trỏ `frontend/` rỗng |
| `packages/vip-app` | 684 | HTTP stub server · orchestrator rỗng |

### 2.4 Khoảng trống đã đo — 33 năng lực verify trong code: **HAVE 9 · PARTIAL 13 · MISSING 11**

| Trạng thái | Năng lực |
|---|---|
| **HAVE (9)** | Bảng giá tùy chỉnh cột · Lưu & chia sẻ bộ lọc · Benchmarking VN30/VN100 · AI explainability · Cảnh báo rule nâng cao (42 field) · Cảnh báo đa điều kiện (có NOT) · Export CSV/XLSX · Free tier có giới hạn · Giảm giá trả năm |
| **PARTIAL (13)** | TBT (API có, FE 0 hit) · Corporate actions (thiếu split/rights/ex-date) · Tài chính nhiều năm (model đã xoá) · Chỉ số ngành ICB (thiếu chuỗi giá) · Indicator (59 có, bật 7) · Marketplace indicator (có Pine, thiếu tầng publish) · Layout save & share (chỉ localStorage) · Định giá (thiếu DCF/P-B/Graham) · DRIP · Tax PIT 0,1% (chưa tự tính) · Risk metrics (thiếu sharpe/sortino) · Kênh ngoài app (thiếu Slack/Telegram) · Backtest giả định VN (**0/5**) |
| **MISSING (11)** | Trái phiếu · RRG/Z-Score/F-Score/Dupont · Screener theo ngành · Top movers · Pre-trade risk control · Bán theo seat · Platform fee + seat · HĐĐT VAT · App native · Desktop app · Widget OS |

### 2.5 Nợ kỹ thuật đã lập danh sách

- **Backend: 28 stub** (D1–D28) — trong đó **cao**: `ai_agents` rỗng · OpenClaw chưa implement (`openclaw.py:44`) · SAML chưa verify chữ ký thật (`saml_service.py:394-406`) · depth chart mock (`native_views.py:450`) · FCM/VAPID trả True giả (`outbound_notification_service.py:56-57,102-103`)
- **Frontend: 20 stub** (F-1–F-20) — **P0**: 6 entry registry bị shadow (837 LOC chết) · 10/10 `exports` trỏ file `.ts` không tồn tại · ~17 endpoint `/partner/*` gọi thẳng từ page ngoài adapter
- **Gate: 13 script mồ côi** trong `packages/web/scripts/` (không có npm alias, không có trong pre-push) — gồm `check-light-theme` (nay đã wire), `check-portfolio-contrast` (đã wire), `check-uiux-budget`, `measure-route-graph`, `measure-theme-tokens`…
- **CI: 1/9 workflow bật** (`secret-scan.yml`); 8 file nằm trong `.github/workflows-disabled/`
- **Tài liệu trạng thái stale:** `ROADMAP_STATUS.md` (2026-04-03) · `PROGRESS_DASHBOARD.md` (2026-10-03) · `docs/OPEN_WORK_20260927.md` (PR #272/#273 ghi sai là OPEN) · `AGENTS.md` (mục AI-CC nói "R0 chưa bắt đầu" — sai) · `CODE_CHANGE_AUDIT_LEDGER.md` (chỉ còn 9 entry 384–392, Entry 1–383 mất)

---

## 3. Quyết định Owner (D1–D8) — 2026-10-21

| # | Quyết định | Hệ quả kỹ thuật bắt buộc |
|---|---|---|
| **D1** | Khách trả tiền là **retail**, mua thứ **chỗ khác không có**: charts · whale · dark flow · AI | Ưu tiên dữ liệu thật; giá theo seat / advisor workspace xuống W4 (giai đoạn 2) |
| **D2** | AI là **phân tích kỹ thuật**; **không đặt lệnh** ngoài hợp đồng | Đổi **contract LLM** (bỏ `signal: BUY\|SELL\|HOLD` + `target_price` + `recommendation`); thêm disclaimer; gỡ order placement khỏi sản phẩm (giữ `paper`) |
| **D3** | Mỗi lane broker có **2 tầng**: retail (portfolio) + staff (thông tin thị trường) | Cần credential broker cấp **tenant/staff** (hiện chỉ có per-user + 1 row global) |
| **D4** | OpenClaw là **tính năng hỗ trợ** | Định vị lại + fail-closed có lý do (không để user tưởng AI chính đang chết) |
| **D5** | SAML **dùng thật trong tương lai** | Cần verify chữ ký thật (xem blocker §6) |
| **D6** | Depth chart = **"ước tính"** (giữ, gắn nhãn) | Badge "Ước tính" (đã có ở `StockOrderBookWidget.jsx:153-161`); **chart order book** trong widget vẫn thiếu nhãn ⇒ **[X]** (repo ngoài) |
| **D7** | Push = **tính năng tương lai** | Không được báo thành công giả khi thiếu key |
| **D8** | Giai đoạn đầu **miễn phí**, mục tiêu **brand name**; B2B để sau | Bỏ trial 14 ngày; gỡ plan-gating cho whale/dark flow/AI/chart; đo activation/D1/D7/referral thay vì MRR |

---

## 4. Đã triển khai (8 PR — tất cả đã merge + push)

| PR | Nội dung | Bằng chứng |
|---|---|---|
| **#277** | ROADMAP MASTER + benchmark 4 lớp đối thủ (108 URL) | 1 766 dòng, 5 file, DOC-ONLY |
| **#278** | **W0 FOUNDATION** — wire 3 gate chưa từng chạy + sửa path OC-19 + xoá code chết + manifest 612→627 route + sửa 4 call site FE 404 | `pre-push-gate` 28→**34 PASS** |
| **#279** | **Quy định cứng**: mọi thử nghiệm trên VPS staging, cấm local Docker + cổng `check-experiment-env.mjs` | `--self-test` 8/8 |
| **#280** | **W0.6 DATA HONESTY** — 5 endpoint fail-closed (push / whale test / usage meters / quota warning / depth chart) | BE full **3 466 / 11 fail / 224 err** = baseline, **0 hồi quy** |
| **#281** | **W0.5** — **gate contract API hồi sinh** (suite chưa bao giờ chạy) + manifest regenerate + 4 call site 404 | jest route-contract **4/4 PASS**, 396 call, **0 path không resolve** |
| **#282** | **W0.9 = W1.4+W2.1** — bật tape + workspace toolbar + pane chỉ báo 6 indicator | **7 → 13 indicator**; vitest 1 169/1 174, build PASS |
| *(W0.2)* | **Kết luận: không có code chết để xoá** | — | Đã đính chính roadmap bằng **phản chứng chạy thật** trên VPS (2 lần grep sai, 4 test bảo vệ đang đỏ sẵn). Xem ledger Entry 402 |
| **#283** | **W0.10** — gap-2 (route detail service account) + gap-1 (in hoá đơn trực tiếp) + allowlist chỉ còn gap-3 | BE **3 468 / 11 / 224** = baseline; manifest **631 route** |
| *(coordinator)* | **W0.3** — sửa `exports` 10/10 trỏ file `.ts` không tồn tại → `.js` | verify **10/10 resolve** |

**Điểm mấu chốt:** `pre-push-gate` **28 → 34 PASS**, và **3 gate chết đã hồi sinh** (`check-light-theme`, `check-portfolio-contrast`, `route-contract`).

---

## 5. Lộ trình 5 wave

| Wave | Chủ đề | Slice | Thời gian | Nhãn |
|---|---|---|---|---|
| **W0** | Dọn nền để không tự đánh lừa mình | 8 | 2 tuần | 100% [T] |
| **W1** | Dữ liệu đáng tin + đúng pháp lý sản phẩm | 8 | 90 ngày | 100% [T] |
| **W2** | Chiều sâu giá trị retail | 9 | 90–180 ngày | 100% [T] |
| **W3** | Brand name: kích hoạt & giữ chân | 7 | 6–12 tháng | 100% [T] |
| **W4** | Doanh thu & B2B (giai đoạn 2) | 7 | 12 tháng+ | [T] + [X] |

**Chi tiết từng slice + AC đo được:** `ROADMAP_MASTER_2026Q4_2027.md` §4.2–§4.6

### Đã thuộc W0

| Slice | Nội dung | PR |
|---|---|---|
| W0.1 | Wire 3 gate chưa từng chạy + sửa path OC-19 | #278 |
| W0.3 | Sửa `exports` 10/10 | (coordinator) |
| W0.5 | Gate contract hồi sinh + manifest + 4 call site 404 | #281 |
| W0.6 | 5 endpoint fail-closed | #280 |
| W0.9 | Mở khoá dữ liệu chart (7→13 indicator) | #282 |
| W0.10 | gap-1 / gap-2 / allowlist | #283 |

### Còn lại W0 (rà soát PM 2026-10-22 — đã đính chính, không còn "6 slice")

| Slice | Nội dung | Trạng thái thật | Ghi chú |
|---|---|---|---|
| **W0.2** | Xoá code chết (44 route) | ✅ **ĐÃ ĐÓNG — kết luận: KHÔNG XOÁ ĐƯỢC** | Mọi file đều còn **tham chiếu thật**; 4 test bảo vệ đang **đỏ sẵn** ⇒ lưới không đáng tin. Xem ledger Entry 402 |
| **W0.4** | Xoá 6 entry registry bị shadow + `PortfoliosBrokerPage` + `ShellSupportPage` + `ShellAiCommandCenterPage` + 3 feature folder rỗng | ⚠ **6 entry shadow ĐÃ XOÁ (#278); phần còn lại: 0 dòng xoá được** | 3 file component **đang được gate assert** (`packages/web/scripts/check-shell.mjs:37,41,150,156,454,806`) + public API `packages/web/src/index.js:20,27` ⇒ xoá là **vỡ gate**. Thư mục rỗng duy nhất: `packages/web/src/features/advertising/hooks` (1, không phải 3). **Cần đính chính roadmap (Phase A4)** |
| **W0.7** | Đóng 3 blocker AI: **SAML `strict` verify thật** (P0 an toàn) · OpenClaw (D4) · `ai_agents` (app rỗng) | ⏳ **1/3 làm được ngay** (OpenClaw ⇒ W1.7) · SAML **chặn hạ tầng** · `ai_agents` **chờ Owner** | SAML: `xmlsec1` CLI có sẵn (`/usr/bin/xmlsec1` 1.2.41) nhưng `python3-saml` **import lỗi** `lxml & xmlsec libxml2 version mismatch` ⇒ cần rebuild image hoặc verify bằng CLI. **Cần Owner chọn hướng (a)/(b)** |
| **W0.8a** | Chuẩn hoá 4 doc trạng thái | ✅ **DONE** — commit `31dcae058` + `91bad0440` (không có PR) | Ledger Entry **403** (backfill 2026-10-22) |
| **W0.8b** | Bật CI (8 workflow disabled) | ⛔ **[X] — chặn bởi billing GitHub** | 40/40 run fail, `steps=0` ⇒ runner chưa chạy bước nào ⇒ **không sửa được bằng code**. Xem §11 |
| *(gap-3)* | `/ai/agents/*` — app rỗng nhưng **FE UI `AISliceE` vẫn gọi** ⇒ 404 thật trên UI | ⏳ **chờ Owner chốt hướng** | FE: `packages/web/src/adapters/core/workspace.js:727,731,735,739`; BE app `ai_agents` **0 route** |

---

## 6. Việc còn lại — theo thứ tự nên làm tiếp (rà soát PM 2026-10-22)

> **Bản chi tiết (AC đo được, file:line, gate, phụ thuộc): [`PM_REVIEW_20261022.md`](./PM_REVIEW_20261022.md) §4.**
> **Nguyên tắc giữ nguyên (ROADMAP §4.0.1):** "M0 = W0 xanh" — nhưng "xanh" = **đã đóng bằng bằng chứng** (DONE / đính chính bằng `file:line` / `[X]` đã có Owner ticket), **không phải** "còn mục nào ghi trong roadmap".

### Phase A — Đóng W0 + vệ sinh bằng chứng (5 slice S/M, **không cần Owner**)

| # | Việc | Loại | Effort | Ghi chú |
|---|---|---|---|---|
| A1 | **2 lỗi thật còn treo**: `timezone.utc` (`advisory/pricing.py:160`) + 5 endpoint `broker_*` bị bỏ qua envelope (`test_api_envelope_schema.py:607`) | [T] | S | Có test khoá sẵn · BE test trên VPS staging |
| A2 | **Vệ sinh registry claim**: đóng 8 dòng claim cũ (5 `in-progress` + 3 `proposed`) | [T] | S | `audit-status-claims` ⇒ "đang mở: 0" |
| A3 | **Bằng chứng W0.8a**: backfill ledger Entry 403 + sửa trích dẫn PR **sai** của W0.8a (W0.8a **không có PR**) | [T] | S | Doc-only |
| A4 | **Đính chính roadmap** W0.4 + W0.2 (kết luận "không xoá được") | [T] | S | Doc-only · giống cách Entry 402 đã làm |
| A5 | **OpenClaw → tính năng hỗ trợ** (D4, fail-closed có lý do) + ghi nhận `ai_agents` chờ Owner | [T] | M | BE test trên VPS staging |

### Phase B — W1 (2 agent song song sau Phase A)

| # | Việc | Loại | Effort | Phụ thuộc | Ghi chú |
|---|---|---|---|---|---|
| B1 | **W1.1** AI contract → **phân tích kỹ thuật** (bỏ `signal`/`target_price`/`recommendation`) | [T] | L | — | Đổi prompt + shape + serializer + 2 locale + disclaimer · **nền cho W2.1** |
| B2 | **W1.2** Gỡ order placement khỏi sản phẩm (D2) — `live` trả 4xx, nhãn "phiếu thử nghiệm" | [T] | M | — | Không đụng `W1.3`/`W1.5` |
| B3 | **W1.3** Depth chart minh bạch (nhãn "Ước tính" mọi nơi) | [T] | M | — | 1 phần ở repo ngoài ⇒ `[X]` |
| B4 | **W1.4 phần còn lại** — `materialize_unified_alerts` NOOP · indicators `None` · AI news `null` · news digest rỗng · discovery hub rỗng | [T] | M | — | **AC cũ "7→59" đã outdated** (đã 13/59) |
| B5 | **W1.6** Minh bạch whale/dark flow (`dark_flow_score` = absorption proxy + nguồn + freshness) | [T] | M | — | |
| B6 | **W1.8** SAML `strict` verify thật | [T] | M | **Owner Q2** | P0 an toàn (D5) |
| B7 | **W1.9** Chính sách free (D8) — bỏ trial 14 ngày | [T] | M | Owner Q7 | |
| B8 | **W1.10** Push `not_configured` — **chỉ phần còn lại** (W0.6 đã làm phần lõi) | [T] | S | — | |
| B9 | **W1.5** 2 tầng tài khoản broker (D3) — phần code | [T] | L | **Owner Q4/Q5/Q6** | Role mới **không** dùng "COC" (đã bị chiếm) |

### Phase C — Mở song song sau W1.1

**W2.1** (AI chat grounded — phụ thuộc cứng W1.1) · **W2.3** (backtest giả định VN — khác biệt duy nhất vs TradingView) · **W2.9→W2.10** (tài chính nhiều năm → định giá) · **W3.1/W3.2** (activation funnel + referral — cần W1.9 + W1.6).

**Hàng đợi bên ngoài [X]** (chỉ mở khi có điều kiện) — xem `ROADMAP_MASTER` §4.7: đặt lệnh live (cần hợp đồng broker) · corporate actions (cần nguồn feed) · chỉ số ngành ICB · app native (cần App Store) · khoá FCM production · bán dữ liệu VN (bản quyền VSDC/HOSE) · affiliate broker (pháp lý UBCKNN) · agent AI / robo-advisor (compliance) · **bật CI (billing GitHub)**. Theo ROADMAP §4.7: **được phép** làm tiếp W1–W3 **không cần** chờ bất kỳ mục [X] nào.

---

## 7. Quy trình bắt buộc (multi-agent-workflow)

Pipeline 8 bước: **Isolate → Plan → Audit Plan → Claim → Code → Audit Code → Test → Merge**

| Bước | Lệnh | Ghi chú |
|---|---|---|
| 1 Isolate | `pwsh -File scripts/new-agent.ps1 -Agent <tên> -Slice "<việc>"` | Tạo worktree + branch `feat/<tên-agent>` + DB riêng + hook |
| 2 Plan | Skill `project-lessons` (tag-based) | Plan phải ghi `Lessons áp dụng: [L-…]` |
| 3 Audit Plan | Đối chiếu plan ↔ code thật | Mọi `file:line` phải tồn tại |
| 4 Claim | Append `docs/CLAIMS.md` — **commit riêng, TRƯỚC khi sửa dòng đầu tiên** | L-002 |
| 5 Code | Theo plan · `git diff --numstat` không phình | L-G05 |
| 6 Audit Code | Không chạm file deny-list (§2 protocol) | |
| 7 Test | `npx tsc --noEmit` · `npm run lint` · `npm run test:components` · **BE `manage.py test` trên VPS staging** | Không báo PASS cho thứ chưa chạy (L-G02) |
| 8 Merge | `pwsh -File scripts/agent-sync.ps1` (rebase → check migration → **gate** sau rebase) → claim `done` → push → PR | L-G01 |

### Definition of Done (mỗi slice)

fail-before đo được · type-check 0 lỗi · lint 0 error · test 0 fail (BE trên Postgres riêng — **không** chạy được trên SQLite) · `makemigrations --check` không đổi · i18n vi↔en cùng số key · token vào `soc.tokens.css`, class vào `soc.components.css` (**KHÔNG** `soc.module.css`) · contract test cover 100% endpoint FE gọi · **mở ảnh ra xem** (đúng 2 theme) · `git status` chỉ có file cố ý · **1 `## Entry N`** trong ledger.

### Môi trường thử nghiệm (quy định cứng 2026-10-22)

- **Mọi thử nghiệm chạy trên VPS staging `14.225.255.47`** (repo `/opt/vninvest`) — kể cả dùng 1 lần.
- **Cấm local Docker.** Cổng chặn máy: `node scripts/check-experiment-env.mjs` (dòng mới gọi docker mà không có dấu hiệu VPS ⇒ FAIL).
- **Sau thử nghiệm: xoá container / worktree / DB tạm.** Quy trình BE: runbook §12.3 · FE: §12.4.
- Docker local **không khởi động được** (WSL2/Hyper-V) ⇒ `new-agent.ps1` fail bước 2/7 ⇒ tạo worktree thủ công (đã ghi L-M05).

### 5 bài học lớn đã ghi (đọc trước khi code)

| ID | Bài học |
|---|---|
| **L-M05** | Docker chết ⇒ `new-agent.ps1` fail bước 2/7 ⇒ không dùng local Docker để bù |
| **L-M06** | `scripts/agent-pr.ps1` hỏng cú pháp (thiếu terminator here-string) ⇒ Stage 7 không chạy được ⇒ dùng `gh pr create --body-file` + tự đưa checklist reviewer |
| **L-M07** | Gate byte-sensitive (`global-config-drift`) đỏ ở **mọi worktree** (main tree `w/crlf` vs worktree mới `w/lf`) ⇒ phải đo 3 lần (eol · worktree không sửa gì · dev sạch) rồi mới `--no-verify` **kèm lý do trong commit body** |
| **L-M08** | **Quy định đã có sẵn trong repo mà không đọc** ⇒ mất thời gian. Luôn đọc `STAGING_VPS_RUNBOOK.md` §12 trước khi thử nghiệm |
| *(vòng trong phiên)* | **Một gate có thể "chết im lặng" nhiều năm** vì lỗi parse-time ⇒ phải kiểm tra gate **CÓ THẬT SỰ CHẠY** (số test > 0), không chỉ "PASS" |

---

## 8. Bản đồ tài liệu

| Muốn biết gì | Đọc file nào |
|---|---|
| Kế hoạch kỹ thuật chi tiết từng slice (file:line + AC) | `ROADMAP_MASTER_2026Q4_2027.md` |
| **Rà soát việc dang dở + kế hoạch tiếp theo (Phase A/B/C) + guardrail chống sai lệch** | **`PM_REVIEW_20261022.md`** |
| Tóm tắt quản lý (1 trang) + quyết định Owner | `BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md` |
| Đối thủ 4 lớp, 108 URL nguồn, bảng giá | `COMPETITIVE_BENCHMARK_20261021.md` |
| Bàn giao phiên (việc còn lại + ưu tiên) | `HANDOVER_W0_FOUNDATION_20261022.md` |
| Quy trình + deny-list + môi trường thử nghiệm | `AGENT_PROTOCOL.md` · `STAGING_VPS_RUNBOOK.md` §12 |
| Bằng chứng từng thay đổi | `CODE_CHANGE_AUDIT_LEDGER.md` (Entry 392–404) |
| Ai đang giữ file nào | `CLAIMS.md` (`node packages/web/scripts/check-multi-agent.mjs`) |
| Bài học đã ghi | `docs/LESSONS/INDEX.md` (14 file / 56 lesson) |

---

## 9. Chỉ số đo (dashboard mỗi wave)

| Chỉ số | Hiện tại | Mục tiêu cuối W3 |
|---|---|---|
| **Gate trong pre-push** | **34** | ≥ 37 + CI ≥ 1 workflow bật thật |
| **Endpoint có contract test** | ~99%+ (gate `route-contract` **đã hồi sinh** PR #281 — quét 396 call, 0 path không resolve; allowlist còn **đúng 1 gap thật** = gap-3) | **100%** (sau khi Owner chốt gap-3) |
| **Stub BE còn lại** | 28 (đã đóng 5) | **0** |
| **Code chết** | ~3 000 LOC | **0** |
| **Năng lực competitive** | HAVE 9 / PARTIAL 13 / MISSING 11 | **HAVE ≥ 22** |
| **Indicator bật trong app** | 13 / 59 | **59** |
| **Tài liệu stale** | 4 | **0** |
| **Entitlement key** | 8 | ≥ 18 |
| **Tier giá publish** | 0 | 6 (giai đoạn 2) |
| **Activation rate** (đăng ký → first value trong 3 phút) | chưa đo | ≥ 40% |
| **D1 / D7 retention** | chưa đo | 35% / 20% |
| **Referral coefficient** | chưa có referral | ≥ 0,3 |

**Baseline test để so:** BE full suite trên VPS staging = **3 468 test / failures=12 / errors=224 / skipped=7** (Entry 402, đo lại trên `origin/dev` — con số "11 fail" ở Entry 397 đã outdated) · FE vitest = **1 179 passed / 5 failed (2 file pre-existing)** · `pre-push-gate` = **34 PASS / 0 SKIP / 0 FAIL** (đo lại 2026-10-22 trên `dev` @ `91bad0440`) · **2 gate A11Y in "CHUA CHAY"** vì staging đang chạy build khác baseline (`ui-check-theme-contrast` · `ui-check-a11y-runtime`)

---

## 10. Câu hỏi đang chờ Owner

| # | Câu hỏi | Chặn slice nào | Ưu tiên |
|---|---|---|---|
| 1 | **gap-3**: implement BE registry `ai_agents` hay **gỡ UI `AISliceE`**? | W0.7 / W1 | Cao — đang là 404 thật trên UI |
| 2 | **SAML**: (a) sửa `lxml`/`xmlsec` version mismatch + rebuild image, hay (b) verify bằng **`xmlsec1` CLI** qua subprocess? | W0.7 / W1.8 | Cao — P0 an toàn, prod hiện không dùng được SSO |
| 3 | **`contracts/admin_ops`** (2 470 LOC + 740 dòng test): giữ làm bằng chứng contract hay xoá 3 210 dòng? | W0.2 (chốt) | Trung bình — mảng 3 210 dòng đang treo |
| 4 | **Bỏ trial 14 ngày** hay giữ (free nhưng còn hạn dùng thử)? | W1.9 | Trung bình |
| 5 | **Free có quảng cáo không, đặt ở đâu?** (không đặt trong màn hình whale/dark-flow/AI) | W3 | Trung bình |
| 6 | **Ai trả chi phí LLM cho user free?** (cần quota do VNInvest trả, nếu không free không có AI ⇒ mất khác biệt D1) | W2.3 | Cao |
| 7 | **Tên vai trò staff thứ 2**: "COC" đã bị chiếm bởi *Center Operations Center* ⇒ đặt tên mới (`broker_operator`?) | W1.5 | Trung bình |
| 8 | **Credential tầng 2 thuộc tenant hay operator?** (operator ⇒ 2 tenant dùng chung 1 credential ⇒ vi phạm cách ly dữ liệu) | W1.5 | Cao — bảo mật |
| 9 | **Tầng 2 có cần trading token không?** (không ⇒ scope nhỏ hơn nhiều) | W1.5 | Trung bình |

> Bản đầy đủ 9 câu + ảnh hưởng nếu chậm trả lời: [`PM_REVIEW_20261022.md`](./PM_REVIEW_20261022.md) §6.

### Mục 11 — W0.8b: bật CI là **phụ thuộc bên ngoài [X]**, không phải lỗi code

| Bằng chứng | Nội dung |
|---|---|
| `.github/workflows-disabled/README.md:9-14` | **200/200 run gần nhất thất bại**; 8 workflow × 5 run = **40/40 fail** |
| Nguyên nhân gốc | `The job was not started because recent account payments have failed or your spending limit needs to be increased.` — fail sau **2–3 giây với `steps=0`** ⇒ **runner chưa chạy bước nào** |
| Hệ quả | Bật CI lúc này = **40/40 fail = chặn mọi PR** ⇒ không sửa được bằng code |
| Không mất gì | Toàn bộ logic gate vẫn chạy qua `agent-sync.ps1` bước 5 (README dòng 26–36) |
| Việc cần Owner | Xử lý billing / spending limit GitHub Actions ⇒ rồi `git mv .github/workflows-disabled/*.yml .github/workflows/` |
