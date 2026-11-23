# Widget News & Events API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng skill repo `workflow-dev-loop` (vninvest profile) + `project-lessons`; song song thì thêm `multi-agent-workflow`. Mỗi task TDD fail-before → pass-after, steps dùng checkbox `- [ ]`.
> **Trạng thái:** PLAN (chưa code) — cần audit độc lập B3 + đồng thuận B4 trước khi khai claim/sửa dòng code đầu tiên.

**Goal:** Cấp 2 hàm API cho `vninvestcharts-widget` tiêu thụ: (1) corporate events theo vùng thời gian qua `StockDataAdapter.fetchCorporateEvents`, (2) tin tức per-symbol qua `EnterpriseDataAdapter.fetchSymbolNews` — dữ liệu thật từ DB/API vninvest đã có, không bịa.

**Architecture:** BE thêm 1 endpoint đọc `CorporateAction` (không migration, bảng đã có từ pipeline corporate-actions) + siết `limit` cho endpoint news đã có; FE thêm 1 lớp mapper mỏng (BE shape → widget shape) trong `chartAdapter`/`enterpriseBinding`, host `VNStockChartPanel` truyền `corporateEvents` + bật `showCorporateEvents` ở chế độ `live`.

**Tech Stack:** Django 5 / DRF + `drf-spectacular` / `CorporateAction` + `DailyPrice` (Postgres) / React 19 + `@vninvestcharts/widget@0.4.7-ent` (`file:vendor/vninvestcharts-widget-0.4.7-ent.tgz`) + `@vninvestcharts/engine-core@0.5.8`.

**Spec:** câu hỏi audit 2026-11-23 ("vnbroker có company news and events, vninvest có hàm API cho widget không?") + bằng chứng đã đọc trong §0.

**Lessons áp dụng:** [L-B01, L-V01, L-V02, L-V04, L-T01, L-T02, L-F10, L-F12]

## 0. Bằng chứng đã tự mở đọc (không đoán)

| Widget cần | vninvest có | Kết luận |
|---|---|---|
| `StockDataAdapter.fetchCorporateEvents?(symbol, from, to)` — `packages/web/node_modules/@vninvestcharts/engine-core/dist/index.d.ts:855` | Không endpoint đọc nào phơi `CorporateAction`; `grep corporate-actions` trong `core_urls.py` = 0 hit | **MỞ — Task 1** |
| `corporateEvents` / `showCorporateEvents` / `corporateEventsMode?: "live" \| "demo"` — `widget/dist/dts/widget/VNInvestChartsProps.d.ts:83-89`; helper `fetchCorporateEvents(adapter, symbol, from, to, plotData?, {allowMockEvents})` — `widget/dist/dts/widget/adapters/corporateEvents.d.ts:11`; `CorporateEvent{id, type: D\|E\|N\|S, timeIndex, timestamp, date, label, title, description, data}` — `.../events/CorporateEventsOverlay.d.ts:1-11` | `CorporateAction` model đã có (`market_data/models.py:100-151`, DIV/ISS, `ex_date`, `source_event_id` unique) + ingest nightly (`data_ingest/tasks.py:3514`) + `adj_close` sau flag `CORPORATE_ACTIONS_ENABLED` (`stock_mgmt_native_views.py:4044-4061`) | DB sẵn, thiếu lớp đọc |
| `EnterpriseDataAdapter.fetchSymbolNews?(symbol, limit?) → NewsItem[] \| null`, `NewsItem{id, symbol, title, url, publishedAt(ms), source?, snippet?}` — `widget/dist/dts/lib/types/adapter.d.ts:46-77` | `GET .../stocks/{symbol}/news/` đã có (`core_urls.py:65`, view `stock_mgmt_native_views.py:2271-2358`, nguồn `News(source=KBS).by_symbol` + fallback RSS, cache 2h) nhưng **bỏ qua `limit`/`page_size`** (cache key `stock_news:{symbol}` duy nhất) | **MỞ nhỏ — Task 2** |
| Profile envelope đã kèm `events` thô từ `Company.events()` (`stock_mgmt_native_views.py:1730-1752`, fetch `vnbroker_adapter.py:1186-1204`) | Shape vnbroker thô, không range query, không map `CorporateEvent` | Giữ cho tab Hồ sơ; widget dùng Task 1, không dùng cái này |
| `createChartStockDataAdapter` chỉ có bars/trades/orderbook/search (`chartAdapter.js:59-221`); `VNStockChartPanel.js:503-506` cố ý `showCorporateEvents: false` ("BE chưa có nguồn ... overlay sẽ rỗng"); test khóa hành vi này (`vnstock-chart-panel.data-unlock.component.test.ts:63-67`) | — | **MỞ — Task 3** (bật có điều kiện) |

## B1. Baseline đo thật (2026-11-23)

| Lệnh | Kết quả |
|---|---|
| `git status --short` | sạch (trước khi ghi file plan này) |
| `git rev-parse --abbrev-ref HEAD` | `feat/chart-enterprise-demo` |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — 0 lỗi, 0 trùng migration; còn cảnh báo CLAIMS stale (dòng claim ghi file không tồn tại trong worktree) — không chặn |
| `tsc` / `eslint` / `vitest` / BE pytest / `vite build` | **CHƯA CHẠY** (theo workflow chạy trên VPS staging khi vào Task 1–4, cấm Docker local) |

Phối hợp multi-agent: `docs/CLAIMS.md:40` có claim `in-progress` của `chart-widget-team` giữ file `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` (đề tài B-3 corporate actions trùng chủ đề). Claim này đã được release stale tại `CLAIMS.md:1936` (worktree mất + rev-list 0 + spec đã trong dev). Plan này tạo file mới `docs/PLAN_WIDGET_NEWS_EVENTS_API_20261123.md` — không chạm file đó. Trước khi khai claim code (B5) phải đọc lại CLAIMS đuôi + `git status`, file ai giữ `in-progress` thì DỪNG.

**Xung đột file ở B1 (verify lại 2026-11-23 sau audit B3 — mỗi dòng đã mở đúng file đọc đúng dòng, L-T02):**
- `vet-finish` giữ `stock_mgmt_native_views.py`: in-progress `:1879`, nhưng đã có done `:1881` (Entry 415) + coordinator RELEASE stale `:1935` (branch mất local+remote, commit `d150e5df7` đã trong dev — tự verify `merge-base --is-ancestor` exit 0 cả `origin/dev` lẫn `HEAD`). → File TỰ DO, Task 2 MỞ lại (điều kiện: re-verify không holder mới vào lúc khai claim).
- `w0-9-chart-data-unlock` giữ `VNStockChartPanel.js` + data-unlock test: in-progress `:1815`, nhưng đã có done `:1821` (PR #282 merge) + coordinator RELEASE stale `:1933` + xác nhận `:1932` ("không còn agent nào giữ thật"). → File TỰ DO.
- `chart-widget-team` giữ spec B-3: in-progress `:40` + RELEASE `:1936`. → Không liên quan file code.
- `market.js`: done `:943`/`:1950`/`:1961`/`:1973`/`:1975`/`:2023`, NHƯNG còn 2 in-progress mới (2026-11-21): `:2015` (`stock-f07-slash` — branch đã merge `origin/dev`, superseded bởi done `:2023` PR #480 → stale) và `:2022` (`stock-slow-load`, branch `docs/allsymbols-close-claims` CÒN TỒN TẠI local+remote, CHƯA merge → HOLDER SỐNG). → **KHÔNG SỬA `market.js`** trong slice này; Task 3 dùng file mới `adapters/core/corporate.js` + nối vào `coreApiAdapter.js` (file này không ai giữ: `:943` done, `:114` released, `:2041` done).
- Kết luận: không file SCOPE nào còn holder sống sau khi reroute. `core_urls.py`, `chartAdapter.js` (`:2041` done), `chartEnterpriseBinding.js` (`:2041` done), `transport.js` (`:66` released) đều tự do.

## Global Constraints (mọi task kế thừa)

- Auth BE: `require_pat_scopes_or_human_session(request, 'market:read')` như các view anh em (`stock_mgmt_native_views.py:1695,2295`).
- Trả về qua `envelope(...)`; số là số (không `""` cho thiếu số), ngày ISO; Unix ms cho `timestamp`/`publishedAt`.
- Không migration mới (đọc bảng hiện có); nếu `makemigrations` đòi sinh → dừng, báo blocker (không tự đặt số).
- Không `npm/pip install`, không nâng `vnbroker`, không đổi version widget trong slice này.
- `corporateEventsMode` production luôn `"live"`; không `allowMockEvents`, không fixture demo vào dữ liệu thật (Rule 15 trung thực).
- Thiếu/không fetch được → `{snapshot: null, note}` / `null` / `[]` rỗng + note, không bịa giá trị.
- Không log/print token/secret; migration/script không `print()` tiếng Việt (L-B03).
- Không commit thẳng `dev`; mỗi code slice 1 claim append cuối `docs/CLAIMS.md` + 1 branch `feat/*` + 1 PR merge-commit. Không chạm file deny-list §2 `docs/AGENT_PROTOCOL.md`; cần thì ghi vào claim + báo coordinator.
- Sau mỗi lần ghi file: `git diff --numstat` khớp số dòng dự kiến (L-T01); citation `file:line` phải mở đúng file đọc đúng dòng (L-T02).
- BE pytest / FE test / build **chỉ trên VPS staging** (`14.225.255.47`, `bash scripts/deploy-staging.sh`, DB tạm riêng, xong DROP); thiếu môi trường → ghi `CHƯA CHẠY` (L-B01). `tsc`/`eslint` chạy local được (không cần Docker).

## Review Focus (5 failure mode + test ghim)

| # | Input / điều kiện | Hành vi kỳ vọng | Test ghim |
|---|---|---|---|
| 1 | `ex_date` cùng ngày có 2 DIV (950 + 1.500) | 2 event riêng, không gộp tiền | Task 1 `test_two_div_same_ex_date_kept_separate` |
| 2 | `from > to`, `symbol` lowercase/khoảng trắng | 400 `from_after_to` / chuẩn hóa `upper().strip()` | Task 1 `test_invalid_range_400`, `test_symbol_normalized` |
| 3 | Không PAT / PAT sai scope | 401/403, không lộ dữ liệu | Task 1 `test_requires_market_read` (dương tính + âm tính, L-V04) |
| 4 | `published_at` string RSS vs ISO vnbroker | FE map ra `publishedAt` ms epoch, sai parse → bỏ item đó, không crash | Task 3 `test_news_mapper_skips_bad_date` + control ngày biết trước (L-V01) |
| 5 | Widget gọi khi adapter thiếu/không có bars | `[]`/`null` + note, `showCorporateEvents` không bật trên overlay rỗng | Task 3 `test_empty_does_not_enable_overlay` |

## SCOPE / LIMIT / Non-goals / Rollback

- **SCOPE (file chạm):** `market_data/corporate_actions/views.py` (mới — view đọc) + `market_data/core_urls.py` (thêm 1 route mount) + `market_data/tests/test_corporate_action_read_api.py` (mới) + `market_data/stock_mgmt_native_views.py` (Task 2, MỞ sau release `:1935` — slice claim riêng, re-verify trước) + `packages/web/src/adapters/core/corporate.js` (mới — `createCorporateClient`, TRÁNH `market.js` đang bị holder sống `:2022` giữ) + `packages/web/src/adapters/coreApiAdapter.js` (nối client mới) + `packages/web/src/adapters/chartAdapter.js` (`fetchCorporateEvents`, `fetchSymbolNews`), `packages/web/src/lib/chartEnterpriseBinding.js` (mở rộng adapter), `packages/web/src/components/VNStockChartPanel.js` (wiring props), `packages/web/src/utils/corporateEventMapper.js` (mới) + test, `packages/web/src/i18n/locales/vi|en/*` (nếu thiếu label), `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` (cập nhật điều kiện), `docs/REQ_WIDGET_NEWS_EVENTS_20261123.md` (mới — Task 5). KHÔNG CHẠM: `market.js` (holder sống), deny-list §2.
- **LIMIT:** tối đa 3 vòng sửa/bước (B6); audit B3 tối đa 3 vòng `NEED_REVISION`, quá thì ghi `blocker` dừng.
- **Non-goals:** không thêm nguồn ingest mới; không `cash_flow`/`period=year`; không depth/tick/Pine; không đổi ingest/adjustment hiện có; không bật `CORPORATE_ACTIONS_ENABLED` cho bars trong slice này.
- **Rollback:** BE route mới là additive — revert = gỡ route + view; FE revert `showCorporateEvents` về `false`. Cache key news có hậu tố limit nên không nhiễm cache cũ.

---

### Task 0 — Probe đường gọi widget (read-only, 0 runtime)

**Files:** chỉ đọc: `packages/web/node_modules/@vninvestcharts/widget/dist/*` (chunk gọi `fetchCorporateEvents`), `VNStockChartPanel.js:200-221,448-539`, `chartEnterpriseBinding.js`.

**Interfaces:** không sản xuất interface; ghi kết quả vào `docs/evidence/widget-news-events/call-path.md`.

- [ ] **Step 1: xác minh widget tự gọi `adapter.fetchCorporateEvents` hay chỉ đọc prop `corporateEvents`.** Grep trong `widget/dist` chuỗi `fetchCorporateEvents` + `corporateEvents` (ngoài `.d.ts`), đọc đoạn gọi thật (from/to lấy từ visible range nào, `plotData` là gì, `timeIndex` do ai điền). Không đoán từ tên hàm (L-V02).
- [ ] **Step 2: xác minh nơi widget tiêu thụ `fetchSymbolNews`** (dock enterprise nào gọi, `limit` truyền bao nhiêu, `null` render ra sao).
- [ ] **Step 3: chốt 1 trong 2 phương án wiring, ghi vào evidence:** (A) host-driven prop (`corporateEvents` tính từ `internalBars` + range) hay (B) adapter-driven (`fetchCorporateEvents` trả `CorporateEvent[]` hoàn chỉnh, widget tự gọi). Ưu tiên phương án widget thật sự gọi; nếu cả hai đều được thì chọn A (host kiểm soát `showCorporateEvents` theo có/không dữ liệu).
- [ ] **Step 4: ghi bảng map chốt:** `DIV → D`, `ISS → S`, profile-events khác → `N`, `E` để dành (earnings sau này). Không code khi chưa có bảng này.

### Task 1 — BE: `GET .../stocks/{symbol}/corporate-actions/` (đọc DB)

**Files:**
- Create: `packages/core/backend/src/market_data/corporate_actions/views.py` (mới — `CorporateActionsReadView`; đặt ở đây thay vì `stock_mgmt_native_views.py` để tránh file đang bị claim stale giữ, xem §B1)
- Modify: `packages/core/backend/src/market_data/core_urls.py` (mount `stock-management/stocks/<str:symbol>/corporate-actions/` → view mới; file này không ai giữ `in-progress`)
- Create: `packages/core/backend/src/market_data/tests/test_corporate_action_read_api.py`

**Interfaces:**
- Consumes: `CorporateAction` (`models.py:100-151`), `envelope()`, `require_pat_scopes_or_human_session(request, 'market:read')`, `extend_schema` như view anh em.
- Produces (cho Task 3): `GET /core/v1/stock-management/stocks/{SYMBOL}/corporate-actions/?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N` → `200 {symbol, from, to, count, actions: [{id, action_type: DIV|ISS, ex_date, record_date, payment_date, cash_amount_per_share: number|null, stock_ratio_pct: number|null, currency, source, source_event_id, raw_title, parse_status, ambiguous_cash_pct, ambiguous_ratio_pct}], note}`. Mặc định `to` = hôm nay, `from` = `to - 365 ngày`; `limit` mặc định 200, tối đa 1000. Lọc `is_latest=true` + `ex_date` trong `[from, to]`, sắp xếp `ex_date ASC`. Symbol chuẩn hóa `upper().strip()`; mã không tồn tại → 404; `from > to` → 400. Không pagination envelope phức tạp (count + cap đủ cho overlay).

- [ ] **Step 1: viết test fail-before** trong `test_corporate_action_read_api.py`: route mới hiện 404; các AC: 200 + shape đúng khi có 2 DIV cùng `ex_date` (giữ riêng 2 event — Review Focus 1); `from > to` 400; không PAT 401 (assert status + body rỗng dữ liệu, L-V04); `cash_amount_per_share` là number không phải string; `symbol` lowercase vẫn 200.
- [ ] **Step 2: chạy test trên VPS staging DB tạm → FAIL** (404 route). Lệnh + output ghi vào evidence; DB xong DROP (L-B01). Không chạy được → `CHƯA CHẠY` + lý do.
- [ ] **Step 3: implement view + route** (fail-closed: exception nguồn → 200 envelope rỗng + `note`, không 500; số dùng `_to_float`-style hiện có, ngày ISO).
- [ ] **Step 4: chạy lại test → PASS toàn file + regression `test_corporate_action_*` cũ xanh.** Ghi lệnh + exit code.
- [ ] **Step 5: commit riêng** (`git status --short` + `git diff --cached` trước khi commit, L-V03/L-T01).

### Task 2 — BE: `news/` tôn trọng `limit` — MỞ (coordinator đã release stale `:1935`, re-verify lúc khai claim)

**Trạng thái:** MỞ — coordinator đã release stale `vet-finish` tại `CLAIMS.md:1935` (2026-11-13, superseded bởi done `:1881`); `check-multi-agent` exit 0 xác nhận. Điều kiện vào B5: re-verify `grep in-progress stock_mgmt_native_views` không còn holder mới. Chạy slice claim riêng sau Task 1 để giới hạn blast radius. Trước Task 2 merge, widget dùng lát cắt `limit` ở FE (Task 3) — không chặn overlay.

**Files (khi được mở khóa):**
- Modify: `packages/core/backend/src/market_data/stock_mgmt_native_views.py` (`StockManagementNewsView.get`)
- Modify: `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py` (thêm case limit) hoặc file test mới nếu file cũ quá lớn — quyết ở lúc làm, ghi lý do.

**Interfaces:**
- Consumes: logic fetch/cache hiện có (`stock_mgmt_native_views.py:2293-2358`).
- Produces: `GET .../news/?limit=N` (mặc định 20, tối đa 100; slice sau khi lấy cache, cache key thêm hậu tố limit để không nhiễm chéo). Shape response giữ nguyên `{symbol, news: [...], note}` (tương thích caller cũ `page_size=5` ở Watchlist).

- [ ] **Step 1: test fail-before** — gọi `?limit=3` với 5 item trong nguồn mock → hiện trả > 3 (chứng minh bỏ qua limit).
- [ ] **Step 2: chạy trên VPS → FAIL đúng chỗ.**
- [ ] **Step 3: implement slice + cache key theo limit.**
- [ ] **Step 4: PASS + regression news/ai-summary cũ xanh.**
- [ ] **Step 5: commit riêng.**

### Task 3 — FE: mapper + adapter + wiring widget

**Files:**
- Create: `packages/web/src/adapters/core/corporate.js` (mới — `createCorporateClient({ coreGet })` theo đúng mẫu `createMarketClient` ở `market.js:7`; TRÁNH sửa `market.js` vì holder sống `:2022`)
- Modify: `packages/web/src/adapters/coreApiAdapter.js` (import + nối `createCorporateClient` vào factory như `marketClient` ở `:63-64`; file này không ai giữ sống: `:943` done, `:114` released, `:2041` done)
- Create: `packages/web/src/utils/corporateEventMapper.js` (+ `__tests__/corporateEventMapper.test.js`)
- Modify: `packages/web/src/adapters/chartAdapter.js` (thêm `fetchCorporateEvents(symbol, fromMs, toMs)` + `fetchSymbolNews(symbol, limit?)`)
- Modify: `packages/web/src/lib/chartEnterpriseBinding.js` (thêm `fetchSymbolNews`/`fetchCorporateEvents` vào enterprise adapter với `*WithNote` trung thực)
- Modify: `packages/web/src/components/VNStockChartPanel.js` (lấy events theo visible range/symbol, truyền `corporateEvents` + `showCorporateEvents: events.length > 0` + `corporateEventsMode: "live"`)
- Modify: `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` (điều kiện `showCorporateEvents` theo có/không dữ liệu thay vì `false` cứng)

**Interfaces:**
- Consumes: Task 1 response (`actions[]`), Task 2 response (`news[]`); widget types `CorporateEvent` (`CorporateEventsOverlay.d.ts:1-11`), `NewsItem` (`adapter.d.ts:46-56`); `coreApiAdapter`.
- Produces: `mapCorporateActionToCorporateEvent(action) → {id, type: D|S|N, timestamp (ms Asia/Ho_Chi_Minh 00:00 ex_date), date (YYYY-MM-DD), label, title (raw_title), description, data: {action_type, cash_amount_per_share, stock_ratio_pct, source, parse_status}}` — mapper FE tự gán `timeIndex` (so khớp `timestamp` vào bars đã load; widget chỉ nhận `any[]` từ `fetchCorporateEvents(symbol: string, from: number, to: number): Promise<any[]>` ở `packages/web/node_modules/@vninvestcharts/engine-core/dist/index.d.ts:855`, không tự điền index); `mapNewsToNewsItem(item) → {id, symbol, title, url, publishedAt, source, snippet}` (`published_at` lỗi parse → bỏ item); `fetchSymbolNews` lát cắt client-side theo `limit` (tạm thời thay Task 2 cho tới khi slice BE merge); `fetchCorporateEvents` fail → `[]`; `fetchSymbolNews` fail/không tin → `null`.

- [ ] **Step 1: test mapper fail-before** (file chưa tồn tại): DIV → `D`, ISS → `S`, `ex_date 2024-09-24` → đúng ms epoch với control `new Date(...Asia/Ho_Chi_Minh)` (L-V01); news `published_at` rác → bị bỏ; `limit` cắt đúng.
- [ ] **Step 2: chạy FE test trên VPS → FAIL** (module missing). Ghi lệnh + output.
- [ ] **Step 3: implement mapper (module-level constants, không object literal trong hook — L-F10) + `corporate.js#getCorporateActions` (qua `coreApiAdapter`, KHÔNG chạm `market.js`) + 2 hàm adapter** (fail → `[]`/`null` + note, không throw qua widget).
- [ ] **Step 4: wiring `VNStockChartPanel`** theo phương án Task 0 chốt: fetch theo symbol + visible range (debounce, hủy khi đổi symbol — E4 clear-data-cũ như tape/advisory `VNStockChartPanel.js:264-280,292-310`), `showCorporateEvents` chỉ `true` khi có events (Review Focus 5), `corporateEventsMode: "live"`. Cập nhật test data-unlock tương ứng (test cũ `showCorporateEvents: false` cứng sẽ đỏ — là đỏ có chủ ý, sửa test theo hành vi mới + giữ case rỗng → `false`).
- [ ] **Step 5: chạy suite FE liên quan trên VPS → PASS** (`vnstock-chart-panel*`, mapper, `coreApiAdapter.test.js` nếu chạm). `tsc` + `eslint` xanh (L-F12: grep lại prop trong `VNInvestChartsProps.d.ts` còn tồn tại trước khi truyền).
- [ ] **Step 6: commit riêng** (kiểm `git diff --cached` không lọt file người khác, L-T01 numstat).

### Task 4 — i18n + staging verify + đóng

**Files:** `packages/web/src/i18n/locales/vi|en/*` (chỉ nếu thiếu label loại sự kiện/empty state), `docs/evidence/widget-news-events/*` (gates + ảnh).

- [ ] **Step 1: `npm run i18n:scan` + kiểm hardcoded** chuỗi mới (dùng `stockDetail.eventsTitle` sẵn có `Lịch Sử Sự Kiện Doanh Nghiệp` nếu đủ, không đẻ key trùng).
- [ ] **Step 2: verify staging:** curl 2 endpoint (shape + limit + 401 không PAT), mở chart staging có events overlay — **mở ảnh ra xem** (L-V05), đối chiếu prop/CSS theo L-F12.
- [ ] **Step 3: ghi evidence gates** (lệnh + exit code từng cổng; cổng nào không chạy được → `CHƯA CHẠY` + lý do, không PASS giả).
- [ ] **Step 4: desks-check ngược:** `showCorporateEvents` rỗng → `false`; `corporateEventsMode` luôn `live`; log không chứa token.

### Task 5 — REQ gửi đội widget (doc-only, sau Task 0)

**Files:**
- Create: `docs/REQ_WIDGET_NEWS_EVENTS_20261123.md`

**Nội dung (viết từ kết quả Task 0, không đoán):** với mỗi thiếu hụt phía widget (nếu có) ghi 1 mục: hiện trạng (file:line trong `packages/web/node_modules/@vninvestcharts/widget/dist/dts`), tác động tới tích hợp vninvest, yêu cầu cụ thể + AC `Given/When/Then` phía widget (ví dụ: tự gọi `adapter.fetchCorporateEvents` theo visible range khi `showCorporateEvents` bật mà `corporateEvents` không truyền; tài liệu `timeIndex` do ai điền; `fetchSymbolNews` được dock nào gọi). Nếu Task 0 chứng minh widget đã đủ → ghi `NONE – <lý do>` thay vì bịa yêu cầu.

- [ ] **Step 1: tổng hợp gap từ evidence Task 0** (mỗi gap 1 dòng + file:line widget).
- [ ] **Step 2: viết REQ, mỗi yêu cầu kèm AC kiểm được phía vninvest** (curl/panel hành vi sau khi widget nâng cấp).
- [ ] **Step 3: không commit code widget trong repo này** (repo khác) — REQ là biên bản bàn giao.

## Câu hỏi cần Owner chốt (không chặn Task 0–1, Task 3–5)

1. Nhãn tiếng Việt cho `D/S/N` trên overlay (đề xuất: D = "Cổ tức", S = "Phát hành/thưởng", N = "Sự kiện") — Task 4 cần trước khi khóa i18n.
2. Có mở `E` (earnings) từ nguồn nào sau này không, hay giữ để dành?
3. Range mặc định 365 ngày đủ cho overlay không, hay muốn 730?

## B3 revision log (2026-11-23, vòng 1 → sửa plan)

Verdict vòng 1: NEED_REVISION (`docs/evidence/widget-news-events/PLAN_AUDIT_B3.md`). Tự verify lại từng objection (L-V02):
- **O1 (đúng, đã sửa):** bổ sung claim `w0-9` in-progress `:1815` + done `:1821` (PR #282) + RELEASE `:1933` + xác nhận `:1932` vào §B1 — file TỰ DO.
- **O2 (đúng + phát hiện thêm, đã sửa):** bổ sung các claim `market.js`; `:2015` stale (superseded `:2023` PR #480) nhưng `:2022` là HOLDER SỐNG (branch `docs/allsymbols-close-claims` còn, chưa merge) → Task 3 reroute sang `corporate.js` mới, KHÔNG sửa `market.js`.
- **O3 (BÁC, có bằng chứng):** đọc lại `docs/CLAIMS.md` lúc 2026-11-23 cho `vet-finish` = `:1879`, done = `:1881`, RELEASE = `:1935`, chart-widget-team release = `:1936` — khớp citation trong plan, không drift; đã bổ sung thêm các dòng liên quan để khỏi phải tra cứu lại.
- **O4 (đúng, đã sửa):** mọi path widget thành `packages/web/node_modules/...` (4 chỗ) + ghi chữ ký thật `fetchCorporateEvents(symbol: string, from: number, to: number): Promise<any[]>` (`engine-core/dist/index.d.ts:855`) + mapper FE tự gán `timeIndex`.
- **O5 (đúng, đã sửa):** Task 2 chuyển BLOCKED → MỞ (release `:1935` có hiệu lực từ 2026-11-13), chạy slice claim riêng sau Task 1 + re-verify lúc khai claim.

## B4 Đồng thuận (2026-11-23)

- **B3:** AGREE vòng 3 (`docs/evidence/widget-news-events/PLAN_AUDIT_B3.md`). Reservation duy nhất: B5 re-verify đuôi CLAIMS (đếm LF) + `git status` — xem B5.
- **Owner (chat 2026-11-23):** "làm theo đề xuất" (Native: implement task-by-task trong session này) + "nếu widget thiếu tính năng viết yêu cầu gửi đội code widget" (Task 5). → Đủ điều kiện sang B5.

## B5 Claim + cách ly (ghi khi thực hiện)

## Đánh giá tổng thể

Khả thi: DB + ingest + news đã có, widget contract đã đọc tận `d.ts`. Blocker duy nhất đã biết là xác minh đường gọi widget (Task 0) — xong Task 0 thì Task 1/Task 3 hết rủi ro kiến trúc. Ưu tiên: Task 0 → 1 → 3 → 4 → 5; Task 2 MỞ (release `:1935` có hiệu lực, slice claim riêng sau Task 1). Không bật overlay rỗng (giữ đúng cam kết "không nói dối" của `VNStockChartPanel.js:503-506`).
