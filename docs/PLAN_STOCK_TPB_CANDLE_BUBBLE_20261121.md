# PLAN — Sửa lỗi click nến không đổi bubble chart (/stocks/:symbol)

- **Date**: 2026-11-21 · **Audit gốc**: `docs/AUDIT_STOCK_TPB_CANDLE_BUBBLE_20261121.md` · **Ledger**: Entry 598.
- **Lessons áp dụng**: [L-V02, L-V04, L-F09, L-F12, L-T01, L-F07]
- **Trạng thái vòng kín**: B1 đo lường xong → B2 plan (file này) → chờ B3 audit độc lập + B4 đồng thuận trước khi B5 claim/code.

## B1. Kết quả đo lường (lệnh thật, 2026-11-21)

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Branch/status | `git rev-parse --abbrev-ref HEAD` + `git status --short` | `docs/tcbs-close`; chỉ `M docs/CODE_CHANGE_AUDIT_LEDGER.md` + `?? docs/AUDIT_STOCK_TPB_CANDLE_BUBBLE_20261121.md` (audit trước) |
| Claim xung đột | grep `in-progress` trong `docs/CLAIMS.md` đối chiếu `stock-detail\|StockDetail\|WhaleBubble\|VNStockChart\|TPB\|candle\|bubble` | Không có claim `in-progress` nào giữ file luồng này (`ws-ticket-s1`, `uiux-ssot-w0`, `header-realtime-status`, `dataops-inventory-cold`… đều khác phạm vi) |
| Worktree song song | `git worktree list` | 2 cây (`vninvest` + `wt/ws-ticket-machine`), không chạm file này |
| Gate song song | `node packages/web/scripts/check-multi-agent.mjs` | PASS (0 lỗi, chỉ cảnh báo claim cũ trỏ file không tồn tại) |
| Baseline type/i18n | `npx tsc --noEmit`, `npm run i18n:scan` trong `packages/web` | exit 0 / exit 0 |
| Baseline lint/test luồng | `npx eslint` 4 file + `npx vitest run` 2 file stock-detail | 0 error (chỉ warning) · 12/12 pass |

**Kết luận tầng**: T0/T1 — docs + plan read-only, chưa sửa source, không migration, không deny-list. Chưa cần claim/worktree riêng cho tới khi B5.

## Mục tiêu

Khi click 1 cây nến trên chart chính của `/stocks/:symbol`, bubble chart hiển thị đúng phiên của nến đó (header nêu ngày, loading khi đổi ngày, empty-state trung thực khi phiên cũ không còn intraday ticks). Không phá lane hiện tại (banner session, whale feed, advisory vẫn đúng).

## Bằng chứng đã tự mở đọc (không tin lại audit cũ)

- `packages/web/src/pages/StockDetailPage.tsx:302-306` — render `WhaleBubbleChart` thiếu session.
- `packages/web/src/components/WhaleBubbleChart.jsx:663-686` — fetch deps `[symbol, timeframe]`, không `tradeDate`.
- `packages/web/src/components/VNStockChartPanel.js:353-364` — `handleClick` map `currentItem.date`.
- `packages/web/src/adapters/core/market.js:386-400` — adapter đã hỗ trợ `tradeDate → ?trade_date=`.
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py:2704-2710,2790-2807` — BE nhận `trade_date`.
- Widget 0.4.4 `VNInvestChartsProps.d.ts:142-147` + `calculators/types.d.ts:1-6,210` — `onClick({currentItem?: EnrichedDatum})`, `EnrichedDatum.date: Date`.

## Slice thực hiện (3 slice, tối đa 3 vòng sửa/slice)

### S1 (P0) — Nối session vào bubble + fetch theo `trade_date` + test fail-before

**SCOPE (chạm)**:
- `packages/web/src/pages/StockDetailPage.tsx` (forward `tradeDate={selectedSession?.tradeDate ?? null}` cho `WhaleBubbleChart`)
- `packages/web/src/components/WhaleBubbleChart.jsx` (nhận prop `tradeDate`, đưa vào `fetchOrders` + deps, reset `internalOrderData` khi đổi ngày, header in ngày đang xem, empty-state nêu ngày)
- Test mới: `packages/web/src/components/__tests__/whale-bubble-tradedate.component.test.tsx` (mock adapter, assert query có `trade_date=`) + bổ sung `StockDetailPage.component.test.tsx` (assert bubble nhận đúng `tradeDate` từ `selectedSession`)
- i18n key mới nếu cần (qua `t(key, {defaultValue})` đúng pattern B2 trong file)

**AC (Given/When/Then)**:
- AC1: Given `selectedSession=null`, When render trang, Then bubble fetch **không** có `trade_date` (giữ hành vi hôm nay, BE fallback phiên mới nhất).
- AC2: Given click nến ngày D (widget bắn `currentItem.date=D`), When `onSessionChange` chạy, Then bubble refetch với `trade_date=D` và header hiện `Phiên D`.
- AC3: Given `tradeDate=D` mà BE trả rỗng, When render, Then empty-state ghi rõ ngày D + gợi ý (không phải "Không có dữ liệu" chung chung).
- AC4 (fail-before): test S1 chạy trên code **chưa sửa** phải ĐỎ (bubble không nhận prop / không gửi `trade_date`); sau sửa XANH.

**LIMIT**: ≤ 3 vòng sửa; không đổi adapter/BE; không đụng URL query; không dọn dead-code (để S3).

### S2 (P1) — Verify sự kiện click + guard + timezone + quyết định blocking lane

**SCOPE (chạm)**:
- Repro staging trước (log `moreProps` khi click nến TPB, có/không drawing-tool bật) — kết quả ghi vào `docs/evidence/stock-tpb-candle-bubble/click-repro.md`.
- `packages/web/src/components/VNStockChartPanel.js` (guard `!item?.date || isNaN → return`, format ngày theo `Asia/Ho_Chi_Minh`)
- Test `handleClick`: date hợp lệ → `YYYY-MM-DD` đúng múi giờ VN; date invalid → không gọi `onSessionChange`.
- Quyết định blocking lane (`useStockDetailPageModel.js:116-168` có đưa `selectedSession` vào không) — ghi ADR ngắn trong plan PR; nếu đưa vào thì thêm test fetch kèm `session_date/trade_date`.

**AC**:
- AC1: click vùng trống (không `currentItem`) không set session rác.
- AC2: nến lúc 00:00Z biên ngày map đúng ngày phiên VN (test biên).
- AC3: repro staging xác nhận widget 0.4.4 bắn `onClick` khi click nến (PASS) hoặc ghi `CHƯA XÁC MINH + blocker` nếu không (L-V02 — không sửa theo suy đoán).

**LIMIT**: ≤ 3 vòng; repro là bắt buộc trước code S2 (L-V02).

### S3 (P2) — UX + dọn

- Affordance click (cursor/tooltip, nếu widget cho phép), spec timeframe khi click ở khung `1H/15m` (resolve về ngày), dọn dead code F-08 (`whaleTimes`, unused imports — PR riêng, không lẫn S1).
- Non-goal S3 không làm: session lên URL (quyết định còn mở — nếu làm phải tuân L-F09: gộp 1 patch `setSearchParams`, kèm probe trên `react-router-dom` hiện tại).

## Non-goals (toàn plan)

- Không sửa BE, migration, deny-list, `package.json` script (cần thì ghi claim + báo coordinator).
- Không `npm install` khi chưa hỏi. Không commit thẳng `dev`/`main`.
- Không đổi version widget.

## Rollback

- Mỗi slice 1 commit riêng trên `feat/<slice>-<agent>`; revert từng commit độc lập (S1 không phụ thuộc S2/S3 runtime; S2 guard tương thích S1).

## Gates mỗi slice (chạy lại sau rebase/sửa)

`node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` (packages/web) · `npx eslint` các file chạm · `npx vitest run` suite stock-detail + test mới · `npm run i18n:scan` nếu thêm key. Gate nào không chạy được → ghi `CHƯA CHẠY`, không PASS giả (L-F07: đọc `$LASTEXITCODE` tách khỏi pipeline).

## B7. Verify staging (khi loop tới B7, sau B6 code xong)

- Môi trường duy nhất được dùng: VPS staging `14.225.255.47` (`https://docker.edusuccess.vn`), theo `docs/STAGING_VPS_RUNBOOK.md`; **cấm local Docker** (kể cả `docker ps`).
- Kiểm thủ công `/stocks/TPB`: click 3 nến (gần nhất / giữa / xa) → banner session + bubble + whale feed cùng ngày; F5 giữ hay mất theo quyết định mục F của audit gốc.
- BE test / FE build / E2E chạy trên staging; cổng nào không chạy được → `CHƯA CHẠY` + lý do.

## MANDATORY CHECKLIST (tick trước khi coi slice xong)

- [ ] L-V02: repro/fail-before chạy trên code chưa sửa trước (đỏ mới được sửa)
- [ ] L-V04: assert giá trị thật đi tới fetch (`trade_date=` trong query), có test dương tính; không assert rỗng/`None`
- [ ] L-F09: nếu đụng URL query, 1 handler = 1 patch full-state, đã probe
- [ ] L-F12: không đổi version widget trong plan này; mọi prop widget đối chiếu d.ts 0.4.4
- [ ] L-T01: sau mỗi lần ghi file, `git diff --numstat` khớp số dòng dự kiến; giữ LF
- [ ] L-F07: exit code đọc tách khỏi pipeline
- [ ] Mọi citation `file:line` đã tự mở đọc, không sao chép từ audit cũ mà chưa verify tồn tại
- [ ] Verdict B3/B4 và re-audit B8 thành văn bản trong repo trước khi qua bước tiếp theo
