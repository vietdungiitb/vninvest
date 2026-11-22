# PLAN — Chart TPB "Chưa có dữ liệu": backfill giá + hiện lỗi thật (thay vì im lặng)

- **Date**: 2026-11-22 · **Tiếp nối**: Entry 600-602 (slice click→bubble đã merge #503, deploy staging).
- **Lessons áp dụng**: [L-V02, L-V04, L-F12, L-T01, L-F07, L-B01, L-B04]
- **Trạng thái vòng kín**: B1 đo lường xong → B2 plan (file này) → chờ B3 audit độc lập + B4 đồng thuận.

## B1. Kết quả đo lường (lệnh thật, staging 2026-11-22)

| Kiểm tra | Lệnh / cách đo | Kết quả |
|---|---|---|
| DB staging TPB | `psql market_data_dailyprice / market_data_intraday_bar / profile WHERE TPB` | **0 / 0 / 0 dòng**. DB có 4,5M daily rows / 1899 mã nhưng toàn penny/small-cap (REE, SAM...); blue-chip (TPB/VCB/HPG/FPT/VIC/BID/CTG/ACB) = 0 |
| Chart HTTP 72h | `docker logs vninvest-core-api --since 72h \| grep chart` | **0 cuộc gọi** (ngoài probe 401 của auditor). Trong khi overview/whale/feed/orderflow cùng session đều 200 |
| Widget có hiểu `timeframe='1d'`? | source widget dist `index.js` (`nF`/`fR` switch) | CÓ (`case "1d": case "1D": return 365`) → loại giả thuyết timeframe |
| Adapter khớp interface? | `engine-core/dist/index.d.ts:842` (`StockDataAdapter`) vs `chartAdapter.js` | KHỚP (`fetchBarsInRange/Before`, `subscribeToBar/Trades/Orderbook`, `searchSymbols`, `getSourceSemantics`) → loại giả thuyết sai contract |
| Text "Chưa có dữ liệu" từ đâu? | node scan toàn bộ `widget/dist` | KHÔNG có trong widget → box trống do app render (WidgetEmptyState qua `emptyStateNode(false, null, null)` của panel, copy từ `messages`) |
| `/bars/` 100 hits VIC/VHM | grep FE `/bars/` | FE không gọi → client khác (không phải TPB path), bỏ qua |
| BE route chart | `stock_mgmt_native_views.py:1871-1949` | ĐÚNG (`date` ISO, `D`→daily, fallback 404 khi symbol vô danh). Contract FE↔BE khớp |

**Kết luận B1 (2 lớp, đã đo — không đoán)**:
- **Lớp DATA (chắc chắn)**: staging thiếu toàn bộ giá TPB → dù widget có fetch cũng 404/empty. Nguyên nhân gốc thuộc ingest (VCI 418 từng chặn backfill — Entry 595).
- **Lớp FE im lặng (chưa đóng)**: widget không hề gọi chart API mà cũng không báo lỗi; panel vứt widget (và UI lỗi của nó) whenever `internalBars` rỗng + không truyền `onError` (dù dts có `onError?: (error) => void`) → mọi lỗi fetch đều thành "trống" chung chung (fail-open hiển thị, vi phạm tinh thần L-B04).

## Slices

### S1 (P0-data, ops — không đổi code) — backfill TPB staging + verify có points

- Chạy entry `backfill_daily_prices(symbols=[...])` (`data_ingest/tasks.py:2093-2099`; impl nhận list `tasks.py:1644-1649`, worker bucket `tasks.py:740-814`) cho TPB (+blue-chip tối thiểu nếu rẻ) trên staging, qua Django shell/celery trên VPS.
- **Ràng buộc provider (đã verify)**: `_fetch_daily_history_with_retry` (`tasks.py:653-685`) chỉ retry cùng provider (3 lần, backoff 0.5–2s); chia cross-provider là bucket round-robin cứng (`tasks.py:1801-1808`, không tham số provider) → 1 symbol rơi vào đúng 1 bucket. VCI 418 = bucket đó fail, **phải chạy lại thủ công** (không tự fallback). Bước chạy ghi rõ provider dùng cho TPB; fail thì đổi provider chạy lại, tối đa 3 lần thử tổng.
- **AC**: `SELECT count(*) DailyPrice TPB > 0`; `GET /chart/?timeframe=D&days=30` (có auth hợp lệ) trả 200 với `points.length > 0`.
- Rollback: không có (thêm dữ liệu đúng thì giữ; sai thì xóa theo symbol+date).
- LIMIT: 3 lần thử tổng; VCI vẫn 418 toàn provider → ghi blocker + dừng (không đốt quota).

### S2 (P0-FE) — panel không nuốt lỗi widget nữa + phát hiện "không gọi API"

**SCOPE**: `packages/web/src/components/VNStockChartPanel.js`, test mới `vnstock-chart-panel-error.component.test.jsx` (mock widget).
- (a) Truyền `onError` cho widget (dts `VNInvestChartsProps.d.ts:208`) → state `widgetError` → `emptyStateNode` hiện message thật + nút thử lại (dùng `retryKey` đã có). Giữ nguyên mọi hành vi khác; không đụng adapter/BE/widget version (L-F12).
- (b) **Thừa nhận giới hạn (OB-1)**: `onError` chỉ bắn khi fetch LỖI; nhánh "widget không gọi API" (0 HTTP như staging TPB) vẫn im lặng. Nên panel bọc adapter đã tạo bằng wrapper đếm lượt gọi `fetchBarsBefore/fetchBarsInRange` (không đổi logic, chỉ đếm + timestamp lần gọi cuối); khi `loading=false`, `internalBars` rỗng, không error mà lượt gọi = 0 → hiện trạng thái chẩn đoán riêng ("biểu đồ chưa yêu cầu dữ liệu — bấm thử lại hoặc xem console") thay vì "Chưa có dữ liệu" chung chung. Test assert cả 3 trạng thái: error thật / zero-call / có bars.
- **AC (fail-before)**: test đỏ trên code cũ (onError bị bỏ qua; zero-call vẫn "trống" chung); xanh sau sửa (hiện đúng lỗi; zero-call hiện copy chẩn đoán; retry remount).
- LIMIT: 3 vòng.

### S3 (P1-verify) — deploy + kiểm staging, đóng câu hỏi "sao không gọi API"

- Deploy FE (nếu S2 đổi code) → staging: mở `/stocks/TPB` → chart HTTP **phải xuất hiện** trong access log + nến hiển thị + click nến → bubble đổi (checklist B7 cũ).
- Nếu chart vẫn trống **và** vẫn 0 HTTP → STOP, yêu cầu console browser của user (bước này không đoán tiếp — L-V02). Ghi blocker, không sửa mù.
- LIMIT: verify 1 vòng; không đạt → ticket follow-up với evidence console.

## Non-goals

- Không sửa adapter/BE/contract (đã khớp), không đổi version widget, không migration, không deny-list, không `npm install`.
- Không backfill toàn bộ 1899 mã (chỉ TPB + vài blue-chip nếu rẻ; toàn bộ là ticket ingest riêng).

## Gates mỗi slice (chạy lại sau mọi rebase/sửa)

`node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` · `npx eslint` file chạm · `npx vitest run` suite liên quan + test mới · `npm run i18n:scan` nếu thêm key (ưu tiên `defaultValue`-only). BE test chỉ chạy trên VPS Postgres DB riêng (L-B01); cổng nào không chạy → `CHƯA CHẠY`.

## MANDATORY CHECKLIST

- [ ] L-V02: S1 đo count trước/sau backfill; S3 không kết luận khi thiếu console evidence
- [ ] L-V04: test assert message lỗi THẬT tới UI + nút retry hoạt động (không assert rỗng)
- [ ] L-F12: không đổi version widget; mọi prop đối chiếu d.ts 0.4.4
- [ ] L-T01: `git diff --numstat` sau mỗi lần ghi file; giữ LF (`normalize-eol --fix` khi hook chặn)
- [ ] L-F07: exit code đọc tách khỏi pipeline
- [ ] L-B04: lỗi fetch phải hiển thị (fail-visible), không nuốt thành "trống"
- [ ] Mọi citation `file:line` đã tự mở đọc
- [ ] Verdict B3/B4 + re-audit B8 thành văn bản trước khi qua bước tiếp theo
