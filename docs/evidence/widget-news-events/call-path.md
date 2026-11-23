# Task 0 — Đường gọi widget cho news & events (kết quả probe source thật)

> Ngày: 2026-11-23 · Người probe: `widget-news-events` · Nguồn duy nhất: `packages/web/node_modules/@vninvestcharts/widget/dist/index.js` (bundle ESM mà app import, 1.279.153 bytes) + `dist/vninvestchart.iife.js` + các `.d.ts`.
> Vì bundle đã minify nên citation dùng `file@byte-offset` + tên hàm minified (`V_`, `pK`, `F_`) thay cho `file:line`.

## Kết luận (chốt phương án wiring)

- **Corporate events: phương án B (adapter-driven) CHẠY NGAY không cần sửa widget.** Host chỉ cần implement `adapter.fetchCorporateEvents(symbol, fromMs, toMs)`; widget tự gọi theo visible range. Đồng thời giữ đường host-driven (`corporateEvents` prop) làm dự phòng vì prop thắng adapter.
- **News: hạ tầng có, UI tiêu thụ KHÔNG có trong bundle.** Cung cấp `fetchSymbolNews` trên enterprise adapter chỉ bật presence (`kind:"host"`), chưa có panel nào gọi → ghi REQ sang đội widget (Task 5, `docs/REQ_WIDGET_NEWS_EVENTS_20261123.md`).

## Bằng chứng corporate events (dist/index.js)

1. Helper gọi adapter — `@824025` `async function V_(e,t,n,r,o=[],a={})`:
   - Symbol không hợp lệ (`!uK(t)`) → `[]`.
   - Adapter thiếu `fetchCorporateEvents` → `allowMockEvents ? F_(plotData)` (mock) : warn + `[]`. Chế độ `live` (mặc định, `corporateEventsMode !== "demo"`) KHÔNG bao giờ bịa.
   - Ngược lại `await e.fetchCorporateEvents(t,n,r)` (t=symbol, n=fromMs, r=toMs) → chuẩn hóa qua `pK`.
2. Chuẩn hóa — `@824141` `function pK(e,t)` (t = plotData):
   - `timestamp` = số ms có sẵn, nếu không parse `date`, cuối cùng `Date.now()`.
   - `timeIndex` = index nến có `|bar.date - timestamp|` nhỏ nhất; plotData rỗng → fallback index trong mảng. **Widget tự điền `timeIndex` — mapper FE chỉ cần đưa `timestamp` (ms) + `date` (ISO).**
   - `id` fallback `evt-${r}-${o}`; `type` chỉ nhận `D|E|N|S`, còn lại → `"N"`; `title` mặc định `"Sự kiện doanh nghiệp"`; `label`/`description`/`data` đều có fallback.
3. Effect tiêu thụ — `@855651` (deps: `e.corporateEvents, Ge.showCorporateEvents, e.corporateEventsMode, ne.activeSymbol, nn, e.adapter`):
   - `e.corporateEvents` (prop) có → dùng prop, KHÔNG gọi adapter (host-driven thắng).
   - `showCorporateEvents === false` → `[]`.
   - `plotData.length < 50` (`nn = length >= 50`) → `[]` **ngay cả khi adapter có dữ liệu** — hành vi có chủ ý của widget, host không phân biệt được "không có event" vs "bị gate <50 bars".
   - Còn lại gọi `V_(adapter, activeSymbol, firstBarMs, lastBarMs, plotData, {allowMockEvents: corporateEventsMode === "demo"})`.
4. Chữ ký-state khớp `.d.ts`: `fetchCorporateEvents?(symbol, from, to): Promise<any[]>` (`engine-core/dist/index.d.ts:855`); `CorporateEvent` (`widget/.../CorporateEventsOverlay.d.ts:1-11`); props `:83-89` + `corporateEventsMode?: "live"|"demo"` (`VNInvestChartsProps.d.ts`).

## Bằng chứng news (không có consumer)

- `DF` (`@153976` index.js) liệt kê `"fetchSymbolNews"` trong 10 method enterprise để `eg()` nhận presence `kind:"host"` — chỉ là checklist, không phải lời gọi.
- `MultiSourceDataAdapter.fetchSymbolNews(t,n)` (`vvia iife.js@2505803`) chỉ route sang `_enterpriseFor(t,"fetchSymbolNews")` rồi `null` khi thiếu.
- Grep toàn `dist/index.js`: `fetchSymbolNews(` (kèm ngoặc gọi) = **0 hit** ngoài định nghĩa router + reference `CryptoCompareDataAdapter` (`iife.js@2518138` gọi `client.fetchNews`). Không dock/panel nào trong bundle ESM gọi nó.

## Bảng map chốt cho Task 3 (không đổi so plan)

| BE `CorporateAction` | `CorporateEvent` | Ghi chú |
|---|---|---|
| `DIV` | `D` | Cổ tức tiền mặt |
| `ISS` | `S` | Phát hành / cổ phiếu thưởng |
| event profile khác (vnbroker `Company.events`, không phải DIV/ISS) | `N` | Không đưa vào overlay đợt này (giữ tab Hồ sơ) |
| (để dành) | `E` | Earnings — chưa có nguồn, không bịa |

- `timestamp` = 00:00 `ex_date` giờ Asia/Ho_Chi_Minh → ms; `date` = `YYYY-MM-DD`; `id` = `source:source_event_id` (unique sẵn); `data` giữ nguyên các field số/parse để tooltip/debug.
- `showCorporateEvents: true` + `corporateEventsMode: "live"` sau Task 1 là trung thực (nguồn tồn tại toàn cục); symbol không có event → `[]` là sự thật, không phải "nói dối". Symbol <50 bars → widget tự `[]` (ghi rõ trong test để khỏi tưởng regression).

## Lệnh tái hiện

```powershell
python3 -c "d=open('packages/web/node_modules/@vninvestcharts/widget/dist/index.js',encoding='utf-8').read(); print(d.find('async function V_('),d.find('function pK('))"
python3 -c "import re; d=open('packages/web/node_modules/@vninvestcharts/widget/dist/index.js',encoding='utf-8').read(); print('fetchSymbolNews call sites:',len(re.findall('fetchSymbolNews'+chr(40),d)))"
```
