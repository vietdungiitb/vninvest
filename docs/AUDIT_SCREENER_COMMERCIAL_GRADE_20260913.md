# AUDIT — Screener (`/screener`) — Tính năng, giao diện, bug & kế hoạch lên chuẩn thương mại

> Ngày: 2026-09-13 · Phạm vi: `packages/web` (ScreenerPage + 7 components screener) ↔ `packages/core` backend (`user_workspace` screener) · Chuẩn khung audit AGENTS.md (không viết code, chỉ phân tích).
> Route: `packages/web/src/app/routeCatalog.js:107-115` (`/screener`, capability `workspace.screener.read`) · Live check: `GET http://localhost/screener → 200`, `GET /core/v1/screener/templates/` yêu cầu auth (đúng).

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **[F1-ERROR] Scan đồng bộ, gọi financials từng mã trong request loop** — `portfolio_analytics_views.py:1427` gọi `get_company_financials_response(sym)` cho **mọi mã** trong vòng lặp quét đồng bộ, cộng `compute_ai_advisory` từng dòng (`:1473-1476`): quét toàn universe dễ timeout/chậm; không phân trang server, không cache, không celery.
2. **[F2-ERROR] Điều kiện lọc "chết lặng" khi thiếu SessionFacts** — allowlist `screener_helpers.py:5-29` cho phép ~12 field whale/dark (`whale_buy_value`, `whale_buy_pct`, …) nhưng nhánh `else` (`portfolio_analytics_views.py:1454-1463`) không populate chúng → `row.get(field)` = None → `_apply_screener_condition` (`screener_helpers.py:55-56`) trả False: user lọc mà không hiểu vì sao 0 kết quả, không có cảnh báo nào.
3. **[F3-ERROR] Export CSV/Excel sai** — `ScreenerExport.tsx:23,39` xuất header là **i18n key thô** (`screener.columns.symbol`) thay vì text đã dịch; nút "Excel" (`:109-113`) đặt tên file `.xlsx` nhưng nội dung là SpreadsheetML XML (Excel hiện cảnh báo); CSV không BOM → tiếng Việt vỡ font trong Excel.
4. **[F4-GAP] Field-picker là điều khiển chết + validation unreachable** — checkbox trong `ScreenerFilterBuilder.tsx:190-197` có `onChange: () => {}` (noop); input value `parseFloat(...) || 0` (`:113`) khiến mọi giá trị thành number, làm nhánh `valueRequired`/`valueNumber` ở `ScreenerPage.tsx:31-34` **không bao giờ chạm tới** (nhập rỗng âm thầm thành 0).
5. **[F5-GAP] "Áp dụng mẫu" spam rule** — `ScreenerPage.tsx:155-185` mỗi click tạo **1 rule mới** rồi mới chạy: dùng 10 mẫu vài lần là danh sách rule ngập bản trùng, không idempotency, không confirm, không preview trước khi lưu.

---

## A. Bản đồ kiến trúc

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `packages/web/src/pages/ScreenerPage.tsx` | 357 | Page: CRUD rule, chạy quét, ghép Templates + History | Inline style 100%, state tay (`useState/useEffect`), chưa React Query |
| `packages/web/src/components/screener/ScreenerFilterBuilder.tsx` | 206 | Dựng điều kiện AND/OR/NOT, field-picker | `createElement`, checkbox picker noop (F4) |
| `packages/web/src/components/screener/ScreenerResultsTable.tsx` | 311 | Bảng kết quả: sort client, phân trang 25 cố định, chọn cột, export | Không sticky header, không persist prefs |
| `packages/web/src/components/screener/ScreenerTemplates.tsx` | 113 | Grid 10 mẫu có sẵn theo category | Nút apply → tạo rule mới (F5) |
| `packages/web/src/components/screener/ScreenerHistory.tsx` | 266 | Lịch sử quét + win-rate "backtest" đơn giản | Refresh giá = N request lẻ (F9) |
| `packages/web/src/components/screener/screenerHistoryStore.ts` | 84 | Lưu lịch sử localStorage (tối đa 20) | Chỉ local, không sync server (F9) |
| `packages/web/src/components/screener/ScreenerScoreCard.tsx` | 97 | Badge điểm AI + action + risk | `title` tooltip synthesis, cursor help |
| `packages/web/src/components/screener/ScreenerExport.tsx` | 153 | Xuất CSV + "Excel" | Header key thô, sai đuôi file (F3) |
| `packages/web/src/types/screener.ts` | 159 | Registry field/op/logic + row/result types (runtime) | Trùng lặp với `.d.ts` (C3) |
| `packages/web/src/types/screener.d.ts` | 162 | Types + **bản copy** registry field (label Việt cứng) | 2 nguồn sự thật (C3) |
| `packages/web/src/adapters/core/workspace.js` | 547-574 | Adapter đúng: `GET/POST /screener/rules/`, `POST …/run/`, `GET /screener/templates/` | Khớp `user_workspace/urls.py:78-81` qua base `/core/v1` |
| `packages/web/src/adapters/core/screener.js` | 48 | Adapter admin/global screener (`/portfolio/screener/...`) | **Chết**: route không tồn tại (F11) |
| `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` | 1365-1509 | `POST /screener/rules/<pk>/run/`: quét toàn universe đồng bộ | Nút thắt hiệu năng (F1, F6-F8) |
| `packages/core/backend/src/user_workspace/screener_helpers.py` | 410 | Validate rule, tính 30+ chỉ báo (RSI/Stoch/ATR/ADX/BB/VWAP/MFI/MACD + 6 fundamental) | Công thức tự viết, bản rút gọn (F12) |
| `packages/core/backend/src/user_workspace/screener_templates.py` | 106 | Catalog 10 mẫu (ngôn ngữ-agnostic, i18n key) | Tốt; mẫu toàn 1-2 điều kiện |
| `packages/core/backend/src/user_workspace/views.py` | 461-485 | List/create rule (validate + tenant scope) | Không lọc `is_active` (F12) |
| `packages/core/backend/src/user_workspace/models.py` | 500-532 | `ScreenerRule` (user+tenant, name≤100, rules_json, is_active) | Ổn; thiếu index/db-constraint cho name |
| `packages/core/backend/src/user_workspace/serializers.py` | 78-81 | Expose `is_active` | UI không dùng (F12) |
| `packages/web/src/i18n/vi.js` | 2360-2533 | i18n user screener | ~20 key thiếu dấu (F10) |
| `packages/web/src/i18n/en.js` | 2362-2535 | Bản EN đầy đủ, khớp key 1-1 | Tốt |
| `frontend/src/pages/Screener.jsx` | 414 | Legacy screener (13 field, AND thuần) | Bản mới đã superset (parity OK) |
| CSS riêng cho screener | — | **KHÔNG TỒN TẠI** — toàn bộ inline style, không file `.css`/`.module.css` | Khó theming/responsive tập trung |

## B. Luồng dữ liệu đã trace (use-case: tạo rule "RSI<30" → chạy → export)

1. `ScreenerPage.tsx:230-239` click "Tạo rule" → `RuleEditor` (`:21-89`) mặc định `[{field:'rsi_14',op:'lt',value:30}]` → `handleSave` (`:124-137`) `POST /core/v1/screener/rules/` (adapter `workspace.js:553-555` → view `views.py:472-484` validate bởi `screener_helpers.py:32-52`).
2. `handleRun` (`:187-213`) `POST /core/v1/screener/rules/<id>/run/` (`workspace.js:567-570`) → `PortfolioScreenerRuleRunView.post` (`portfolio_analytics_views.py:1369`): lấy snapshot phiên mới nhất (`:1391`), toàn bộ `SymbolSnapshot` (`:1403`), `SessionFacts` (`:1406`), 90 ngày `DailyPrice` **toàn universe 1 query** (`:1415-1420`), rồi **lặp từng mã**: gọi financials vnbroker (`:1427`), tính metrics (`:1429`), dựng 30+ chỉ báo (`:1434`), ghép flow facts (`:1436-1470`, nhánh thiếu `else :1454-1463`), tính AI advisory (`:1473-1476`), đánh giá AND/OR/NOT (`:1479-1499`), sort theo **giá đóng cửa giảm dần** (`:1501`), trả toàn bộ `matched` (`:1503-1509`).
3. Kết quả render ở `ScreenerResultsTable.tsx:86-311` (sort client `:103-118`, trang 25 cố định `:48,120-123`), symbol link `/stocks/<symbol>` (`:272`, route tồn tại `routeCatalog.js:87-89`), export qua `ScreenerExport.tsx:102-113` (lỗi F3), đồng thời lưu entry rút gọn vào localStorage (`ScreenerPage.tsx:194-206` → `screenerHistoryStore.ts:33-42`).

## C. CONTRADICTIONS (doc/adapter/UI vs code thực tế)

| # | Khẳng định (file:line) | Thực tế (file:line) | Tác động |
|---|---|---|---|
| C1 | Adapter expose `runScreener`/`getScreenerResults` (`adapters/core/screener.js:33-42`) | Không route `/portfolio/screener/*` nào tồn tại (`user_workspace/urls.py:78-81`, `service_ops/urls.py:88-98` là `/api/soc/...`) | Ai gọi sẽ 404; bẫy cho dev mới |
| C2 | Label "Điều kiện lọc (AND logic)" (`vi.js:2366`, `en.js:2368`) | Engine + UI hỗ trợ AND/OR/NOT (`portfolio_analytics_views.py:1485-1493`, `screener.ts:84-88`) | User hiểu sai capability |
| C3 | 2 registry field: `screener.ts:1-74` (EN key) vs `screener.d.ts:73-146` (label Việt cứng) | Chỉ `.ts` được import runtime (`ScreenerFilterBuilder.tsx:4`); `.d.ts` chứa `const` runtime trong file khai báo | Sửa field phải nhớ 2 nơi; rủi ro lệch |
| C4 | Nút "Excel" + file `.xlsx` (`ScreenerExport.tsx:109-113`) | Nội dung là SpreadsheetML XML (`toExcel :37-88`) | Excel cảnh báo định dạng; automation đọc lỗi |
| C5 | Validate `valueRequired`/`valueNumber` (`ScreenerPage.tsx:31-34`) | Input ép `parseFloat\|\|0` (`ScreenerFilterBuilder.tsx:113`) | Nhánh lỗi unreachable; rỗng → 0 âm thầm |
| C6 | Kế thừa legacy AND-thuần (`frontend/src/pages/Screener.jsx:42`) | Engine mới đính `logic` vào condition hiện tại, condition đầu bị bỏ qua logic | Ngữ nghĩa NOT gây nhầm lẫn (ghi chú F12) |

## D. Findings

- **[F1] ERROR · Hiệu năng scan** — `portfolio_analytics_views.py:1391-1476`: loop đồng bộ toàn universe + financials từng mã + AI advisory từng dòng; không cache/celery/phân trang. *Tác động*: timeout khi universe lớn, phí tài nguyên/BE mỗi click "Chạy". *Fix*: batch prefetch financials, cache kết quả theo `(rule_version, session_date)`, chuyển run dài sang celery + polling, giới hạn universe + `limit` param.
- **[F2] ERROR · Field cho phép nhưng không bao giờ khớp** — `screener_helpers.py:5-29` vs `portfolio_analytics_views.py:1454-1463`: các field `whale_buy_value/sell/unknown_*`, `whale_*_pct`, `whale_trade_count`, `whale_whale/shark/small_value` vắng mặt khi thiếu facts → luôn False. *Fix*: populate đủ field (0 có chủ đích) + tách "không có dữ liệu" (null→loại khỏi đánh giá + badge thiếu dữ liệu trên UI).
- **[F3] ERROR · Export hỏng** — `ScreenerExport.tsx:23,39,109-113`. *Fix*: resolve `t(labelKey)` trước khi xuất, CSV thêm BOM `\uFEFF`, Excel hoặc xuất `.xls` đúng chuẩn hoặc dùng SheetJS tạo xlsx thật, quote header.
- **[F4] GAP · Picker chết + validation chết** — `ScreenerFilterBuilder.tsx:190-197,113`; `ScreenerPage.tsx:29-37`. *Fix*: checkbox thêm/xóa condition thật (hoặc bỏ block), giữ `NaN`/rỗng tới lúc save để validate hoạt động, thêm kiểm tra miền giá trị (RSI 0-100…).
- **[F5] GAP · Template spam rule** — `ScreenerPage.tsx:155-185`. *Fix*: "Dùng thử" (run preview không lưu) + "Lưu thành rule" riêng; hoặc dedupe theo hash `rules_json` + confirm.
- **[F6] GAP · Xếp hạng vô nghĩa** — `portfolio_analytics_views.py:1501` sort theo `close` desc. *Fix*: param `sort` (ai_score/momentum/rvol…), mặc định AI score desc.
- **[F7] GAP · Không phân trang server + trang client cố định** — `portfolio_analytics_views.py:1503-1509`; `ScreenerResultsTable.tsx:48`. *Fix*: `?page&limit&sort` server-side; client thêm chọn 25/50/100.
- **[F8] RISK · Tải bộ nhớ/CPU** — `portfolio_analytics_views.py:1415-1420` (90d全 universe 1 query) + `:1474` AI từng dòng. *Fix*: chỉ query mã trong universe + window đủ cho chỉ báo dài nhất (50+), tính AI lazy/theo yêu cầu.
- **[F9] GAP · Lịch sử local-only + refresh N+1** — `screenerHistoryStore.ts:1-42`; `ScreenerHistory.tsx:60-82` (`limit:5` backend có thể bỏ qua do cursor page 50 — `market.js:191-198`, `settings.py:212-214`); `buildTrades :52-84` coi mọi dòng BUY/SELL là 1 lệnh, key `${symbol}-${entry}` dễ đụng. *Fix*: endpoint batch giá hiện tại, persist lịch sử server, backtest có kỳ nắm giữ + lợi nhuận %, nút xóa history.
- **[F10] GAP · i18n thiếu dấu + label stale** — `vi.js:2389,2399-2400,2461-2466,2490,2492-2522` (`Diem AI`, `Cot`, `Gia & Khoi luong`…) trái quy định AGENTS.md "full dấu"; `2366` ghi AND-only. *Fix*: bổ dấu toàn block, sửa label theo logic thực.
- **[F11] RISK · Adapter chết + trùng registry** — `adapters/core/screener.js:29-42`; `screener.ts` vs `screener.d.ts`. *Fix*: xóa/sửa endpoint chết, gộp 1 registry runtime duy nhất, `.d.ts` chỉ giữ type.
- **[F12] GAP/RISK · Độ chính xác & parity thương mại** — chỉ báo tự viết bản rút gọn (`_compute_rsi :74-90` dùng SMA thay vì Wilder; `_compute_adx :138-172` trả DX 1 kỳ thay vì ADX mượt; `_compute_mfi :202-222` cộng dồn toàn lịch sử thay vì window; `_compute_vwap` window 20 không phải session-VWAP — `screener_helpers.py`);spielen `is_active` expose mà list/run bỏ qua (`views.py:464-470`, `serializers.py:78-81`); `NOT` nhị phân khó hiểu; whale/dark null hiển thị "—"/0 không giải thích; thiếu: lưu lịch chạy tự động, alert từ dòng kết quả, thêm vào watchlist, share URL, sort server, ý kiến phân kỳ thời gian thực, backtest đa kỳ, preset cộng đồng, kiểm định ngoài giờ (phiên không giao dịch quét snapshot cũ mà không banner ngày dữ liệu — `ScreenerResultsTable` có cột date nhưng page không nhấn mạnh staleness). *Fix theo P1-P3 dưới.*

## E. Quality gates audit

- **Lint** (`packages/web`, scoped screener): `npx eslint src/components/screener/ src/pages/ScreenerPage.tsx src/types/screener.ts` → **0 errors**, 5 warnings (`react/jsx-no-literals`: id/name/htmlFor `ScreenerPage.tsx:45,49,50`, ký tự `✕` `:252`, `' · '` `:295`). Không chặn.
- **Type-check**: `npx tsc --noEmit` (packages/web) → **exit 0**.
- **i18n**: key `screener.*` resolve đủ 2 ngôn ngữ (group/logic/fields/columns/templates/history/errors đối chiếu `vi.js:2360-2533` ↔ `en.js:2362-2535`); nợ chất lượng là thiếu dấu (F10), không phải thiếu key. `npm run i18n:scan` không chạy (tránh side-effect ghi file).
- **Test**: **0 test** cho user-screener (grep `ScreenerPage|ScreenerResultsTable|buildTrades|saveScreenerRun` trong `*.test.*` = không kết quả; backend chỉ có test cho SOC variant `service_ops/tests/test_screener_rule_crud.py`, không có test cho `PortfolioScreenerRuleRunView`). Khoảng trống lớn nhất.
- **CSS/config**: không file CSS screener (toàn inline style) — theming qua `var(--bg-panel…)` có fallback, nhưng responsive/mobile chưa có pass riêng; table có `overflowX:auto` (`ScreenerResultsTable.tsx:212`), template grid `auto-fill minmax(260px,1fr)` — desktop ổn, mobile cần kiểm thủ công.
- **Coupling ngoài**: web↔core qua `workspace.js` khớp contract (`urls.py` + base `/core/v1` — `transport.js:47-60`); không phụ thuộc `vninvestcharts-widget` ở màn này (không có chart) — điểm cộng.

## F. Câu hỏi cần làm rõ

1. Universe quét chuẩn là gì (HOSE+HNX+UPCoM toàn bộ hay whitelist thanh khoản)? Có giới hạn số mã/scan mục tiêu không?
2. Whale/Dark facts thiếu cho bao nhiêu % mã — chấp nhận ẩn cột hay hiển thị "thiếu dữ liệu"?
3. Công thức chỉ báo có yêu cầu khớp vendor (FireAnt/TradingView) hay nội bộ tự định nghĩa là đủ?
4. Export Excel cần `.xlsx` thật (thêm lib) hay `.csv` BOM là đủ cho người dùng?
5. Lịch sử/backtest lưu server theo user hay giữ local (liên quan quota + privacy)?
6. Có cho phép user đặt lịch quét tự động + alert (đụng SOC global screener) hay giữ quét thủ công?

**Quyết định (2026-09-13, user chốt cả 6 — ghi ledger Entry 64):**

| # | Câu hỏi | Quyết định | Tác động |
|---|---|---|---|
| Q1 | Universe | **Toàn bộ 3 sàn** (HOSE+HNX+UPCoM ~1200 mã) | P1 phải batch/celery + phân trang server; ko giới hạn mục tiêu |
| Q2 | Whale/Dark thiếu | **Hiển thị "thiếu dữ liệu"** (badge —), không ẩn cột | P0.1 badge "thiếu dữ liệu" bắt buộc cho mọi field facts-rỗng |
| Q3 | Công thức | **Nội bộ + tư liệu công thức**: nội bộ là chuẩn dùng, ghi chú công thức trong tooltip/doc để đối soán sau | P0/P1/P2 dùng bản nội bộ, P3 mới calibrate vendor |
| Q4 | Export | **Cả hai**: CSV BOM là mặc định + nút Export Excel riêng cho `.xlsx` thật (SheetJS) | P0.2 làm cả 2 path |
| Q5 | History/backtest | **Server theo user+tenant** (bảng `screener_run_history`): chia sẻ, đồng bộ, cần quota | P2.5 server-side history + quota |
| Q6 | Lịch tự động | **Có lịch + alert**: user đặt lịch hàng ngày sau đóng phiên + thông báo mã mới khớp, phân biệt user-schedule vs SOC global | P2.4 celery schedule user-scoped |

## G. Đánh giá tổng thể + Kế hoạch nâng cấp lên chuẩn thương mại

**Đánh giá**: nền tảng tốt (30+ field, templates, AI score, history, export, tenant-scope, tsc/lint xanh) nhưng **chưa đạt chuẩn thương mại**: 3 lỗi đúng-nghĩa (F1-F3), picker/validation/template gây bực mình hằng ngày (F4-F5), hiệu năng + backtest + chia sẻ là khoảng cách lớn nhất với TradingView/FireAnt/StockEdge (bảng parity ở §H). Không blocker kiến trúc — implementable theo phase dưới. Thứ tự ưu tiên: **P0 correctness (1 sprint) → P1 performance (1 sprint) → P2 UX/workflows (2 sprint) → P3 depth/moat (backlog)**.

### P0 — Đúng trước đã (F2, F3, F4, F5, F10, F11, F12-nhỏ)

1. Populate đủ field flow-facts + badge "thiếu dữ liệu" (F2); banner staleness ngày snapshot khi phiên cũ.
2. Sửa export: label đã dịch, CSV BOM, Excel `.xls` đúng chuẩn hoặc SheetJS (F3).
3. Field-picker hoạt động thật (thêm/xóa) hoặc gỡ bỏ; giữ rỗng/NaN tới save + validate miền (RSI 0-100…) (F4).
4. Template: "Chạy thử" không lưu + "Lưu thành rule" (dedupe hash) (F5).
5. Bổ dấu toàn block `vi.js:2360-2533`, sửa `conditionsLabel`, `columnsBtn:'Cột'` (F10).
6. Xóa endpoint chết `screener.js:29-42`, gộp registry field 1 nơi (F11); list/run tôn trọng `is_active` (F12).
7. Test: unit `buildTrades` + validate rules + component test table sort/paging + API test run-view (lấp khoảng E).

### P1 — Hiệu năng (F1, F6, F7, F8)

1. `GET run` thêm `?page&limit&sort&fields=`; mặc định sort AI score; chỉ trả cột được chọn.
2. Prefetch financials theo batch + cache `(tenant, rule_hash, session_date)` (TTL theo phiên); AI advisory lazy (chỉ top-N hoặc toggle).
3. Run > ngưỡng (số mã × điều kiện) → celery + polling tiến trình, giữ sync cho rule nhẹ.
4. Giới hạn window DailyPrice theo chỉ báo dài nhất; rà soát index `(symbol, date)`, `(session_date, symbol)`.
5. Rate-limit endpoint run (đắt) chống spam/abuse.

### P2 — UX & workflow chuẩn thương mại (parity §H)

1. URL state (`?rule=<id>&run=<ts>`) — share MEGAlink, back/forward giữ kết quả.
2. Migrate page sang React Query (cache/retry/skeleton thống nhất TenantAdmin), toast thay banner lỗi tay.
3. Bảng: sticky header, chọn page-size, persist cột+mật độ, giữ state khi sang `/stocks/:symbol` (open tab mới), thêm hàng loạt vào watchlist, tạo alert giá từ dòng.
4. Lịch quét tự động (hằng ngày sau đóng phiên) + thông báo khi có mã mới khớp (phân biệt rõ user-schedule vs SOC global).
5. Backtest v2: kỳ nắm giữ 5/20/60 phiên, lợi nhuận % trung vị, max drawdown, tách BUY/SELL, biểu đồ equity — thay win-rate ngây thơ hiện tại.
6. Mobile pass + a11y (label cho select builder — legacy `Screener.jsx:53-57` đã có `sr-only`, bản mới thiếu), visual test Playwright cho 3 viewport.

### P3 — Moat (backlog)

Preset cộng đồng/chuyên gia, so sánh chéo preset, realtime intraday screening trong phiên, парный screener đa khung thời gian, kiểm định công thức với vendor + công bố methodology, preset theo dòng tiền khối ngoại/tự doanh (thế mạnh dữ liệu nội bộ).

## H. Bảng parity thương mại (hiện tại → mục tiêu)

| Năng lực (TradingView / FireAnt / StockEdge có) | Hiện tại | Sau P0-P2 |
|---|---|---|
| Universe lớn + quét nhanh, phân trang/sort server | Chậm, sync, sort close (F1,F6,F7) | Nhanh, celery+cached, sort ý nghĩa |
| Bộ lọc biểu thức + validate + preset | Điều kiện đơn, picker chết (F4), 10 mẫu đơn (F5) | Builder hoàn chỉnh, preset phong phú, share URL |
| Cột tùy biến, export tin cậy | Cột OK, export hỏng (F3) | Export chuẩn, cột persist |
| Backtest/đánh giá | Win-rate ngây thơ (F9) | Backtest đa kỳ + equity |
| Workflow: alert/lịch/watchlist | Không có | Đủ 3 |
| Tin cậy dữ liệu (staleness, thiếu DL) | Im lặng (F2) | Badge + banner rõ ràng |
| Mobile/a11y/test | 0 test, chưa pass (E) | Có coverage + visual |

## I. Rủi ro khi không làm

- F1+F8: càng nhiều user quét, BE càng dễ quá tải giờ cao điểm (sau đóng phiên).
- F2: user mất niềm tin ("lọc cá voi ra 0 mã") mà không có manh mối.
- F3: file export lỗi định dạng lan truyền ra ngoài, ảnh hưởng uy tín.
- F9-backtest ngây thơ có thể bị hiểu là "khuyến nghị đầu tư" — cân nhắc disclaimer rủi ro khi nâng cấp P2.
