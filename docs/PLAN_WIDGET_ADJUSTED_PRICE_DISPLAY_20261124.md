# Plan — Widget hiển thị giá đã điều chỉnh theo sự kiện doanh nghiệp (2026-11-24)

> Trạng thái: **BLOCKED — audit vòng 3/3 vẫn NEED_REVISION (O6). KHÔNG sửa code.**
> Theo workflow-dev-loop B3/B4: quá 3 vòng ⇒ dừng, cần owner cho phép vòng 4 hoặc thu hẹp scope.
> Verdict v3: `docs/evidence/widget-news-events/AUDIT_PLAN_ADJUSTED_PRICE_V3_20261124.md`.
> O6: transform tại `setBars:838` bị warmup/live tick ghi đè từ `historyChunkStoreRef` (bar thô) — phải cắm trong wrapper `useWidgetData.ts:254-263` / trước khi vào store.
> Owner chốt: "lập plan rõ ràng, audit độc lập, không tự ý sửa".
> Audit v1/v2: `docs/evidence/widget-news-events/AUDIT_PLAN_ADJUSTED_PRICE_V{1,2}_20261124.md`.

## 0. Bối cảnh đã tự kiểm chứng

| Sự thật | Bằng chứng |
|---|---|
| BE có `adj_close`: 2.254.058/4.584.956 `DailyPrice` | `market_data/corporate_actions/adjustment.py:26-104`; đo staging |
| `/bars/` trả `adj_close`; `/chart/` (host dùng) không có | `stock_mgmt_native_views.py:4071-4072,4398-4416` |
| Host/chart đi đường **uncontrolled**: không truyền prop `data` | `VNStockChartPanel.js:452-545`; `useWidgetData.ts:171 hasExternalData = Array.isArray(data)` |
| Đường thật: `chartAdapter.mapToBar:42-54` → `VNInvestClient.normalizeChartPoint:152-168` (bỏ `adjClose`) → `coordinatedFetch` (`useWidgetData.ts:781`) → `setBars` (`:838`) → `canaryFilteredBars:275` → `plotData:1329` | đã mở đọc từng file |
| `externalBarsNormalization` chỉ dùng cho controlled mode — **không phải đường production của vninvest** | `useWidgetData.ts:250` |
| Bundle `0.4.7-ent`: `fetchAdjustedBars`/`adjClose` chỉ plumbing + CSV, không consumer render | grep dist |
| Badge là presence-probe | `ForkEngineSurface.tsx:147-149` |
| Sửa parser/fail-closed BE bị audit chặn | `AUDIT_PLAN_CA_NOOP_20261123.md` |

**Kết luận:** phải sửa cả 3 lớp: BE endpoint host dùng, adapter host, widget client + transform. Không đổi sang controlled mode (quá lớn, không cần).

## 1. Mục tiêu
Host lấy `/bars/` có `adj_close` → widget giữ field qua adapter/client → transform có opt-in → nến/chỉ báo dùng giá điều chỉnh → badge biến mất **chỉ khi** có bar thực sự được adjust.

## 2. Thiết kế REVISION 2

1. **Đường dữ liệu = uncontrolled/adapter path** (giữ nguyên kiến trúc hiện tại). Không thêm prop `data` vào host; không đụng `externalBarsNormalization`.
2. **Kiểu:** mở rộng `ChartPoint` trong `VNInvestClient.ts` thành `& { adjClose?: number | null }`; không sửa engine-core (`OHLCVBar` là interface, intersection hợp lệ).
3. **Opt-in, default tắt:** prop `priceAdjustmentMode?: 'raw' | 'adjusted'`.
4. **Công thức:** `factor = adjClose / close`; scale OHLC, volume giữ nguyên. Guard `Number.isFinite(factor) && factor > 0`, `adjClose > 0`, `close > 0`. Cho phép `factor > 1` (`stock_factor = 1/(1+ratio/100)` với `ratio ∈ (-100,0)` — `adjustment.py:45-51`; dòng `:52` là guard loại).
   Tolerance: `0.01` với `close ≥ 10`; với `close < 10` dùng **`0.01 × (10/close)`** hoặc test riêng — do `adj_close = quantize(close×product, Q2)` (`adjustment.py:11,100`). Ưu tiên `adj_factor` nếu BE trả (`DataEnvelope.ts:152`) — hiện `/bars/` **không** trả, nên chưa dùng.
5. **Điểm cắm DUY NHẤT:** transform ngay tại ranh giới `setBars` (`useWidgetData.ts:838`) — tức là mọi bar vào store đã nhất quán. Hệ quả: `canaryFilteredBars:275`, MTF `:1316-1327`, volume profile `:1283-1289`, replay (`VNInvestCharts.tsx:561`) đều thấy cùng một hệ giá. Volume không scale → turnover profile vẫn là rủi ro đã nêu ở §6.1.
6. **Badge SSOT — TÁCH semantic (theo O5):**
   - `ForkEngineSurface.tsx:147-149`: `showAdjustedBadge = !(mode === 'adjusted' && usedAdjustedBars)`.
   - `usedAdjustedBars` được tính trong `useWidgetData` (có ≥1 bar có `adjClose` hợp lệ) và trả trong `dataResult`; `VNInvestCharts.tsx` truyền xuống `ForkEngineSurface` qua props (thêm 1 prop).
   - **Giữ nguyên** `capabilityProbe.ts:217-220`, `CapabilityResolver.ts:187,266`, `scripts/conformance/contract.json:16-18` — chúng trả lời "backend có khả năng không", khác câu hỏi "dataset này đã adjust chưa". Không đổi 3 chỗ này.
7. **Plumbing/SSOT phải sửa:** `ForkPaneTooltips.tsx:70,96,139` (pass-through `showAdjustedBadge`), `ChartStatusLine.adjusted.test.tsx` (viết lại nhánh dương tính: adapter có method + dataset có adjClose ⇒ badge `toBeNull()`), test mới cho `usedAdjustedBars`.

## 3. Phạm vi file

### Repo `vninvestcharts-widget`
- `src/widget/adapters/VNInvestClient.ts:152-168` — giữ `adjClose` trong `ChartPoint`.
- `src/widget/hooks/useWidgetData.ts:838` — transform tại `setBars`; return `usedAdjustedBars`.
- `src/widget/VNInvestCharts.tsx` — truyền `usedAdjustedBars` + CSV `adjClose` thật (`:1011-1025`).
- `src/widget/components/fork/ForkEngineSurface.tsx:147-149`, `components/ForkPaneTooltips.tsx:70,96,139`, `components/canvas/ChartStatusLine.tsx`, i18n `messages.{vi,en}.ts`.
- `src/widget/components/canvas/__tests__/ChartStatusLine.adjusted.test.tsx` — rewrite positive branch.
- Test mới: `src/widget/hooks/__tests__/adjustedPriceBars.test.ts`.

### Repo `vninvest` (host — slice riêng sau)
- `packages/web/src/adapters/core/market.js:238-247` — gọi `/bars/`.
- `packages/web/src/adapters/chartAdapter.js:42-54` — `mapToBar` giữ `adjClose`.
- `packages/web/src/components/VNStockChartPanel.js:452-545` — truyền `priceAdjustmentMode`.
- `packages/web/package.json` + lock — tarball mới (**shared/deny-list ⇒ coordinator + `Claim-Deny-List:` trailer**).

## 4. Tiêu chí nghiệm thu
- Given `{close:100,open:98,high:105,low:95,volume:10,adjClose:80}`, When mode='adjusted', Then plot `{close:80,open:78.4,high:84,low:76,volume:10}`, tolerance 0.01.
- Given close nhỏ (`<10`), When so sánh, Then tolerance theo §2.4 — có AC riêng với control biết đáp án (L-V01).
- Given `factor>1` (reverse-split), When mode='adjusted', Then áp dụng đúng.
- Given `adjClose=null` / `factor≤0`, Then bar giữ nguyên, không NaN/exception.
- Given mọi bar thiếu adjClose, Then badge vẫn hiện; adapter có `fetchAdjustedBars` cũng **không** làm badge mất (phản lại presence-probe cũ).
- Given mode='raw' (default), Then toàn bộ contract suite hiện có xanh.
- CSV: `adj_close` có giá thật, không còn `null` hard-code.
- E2E staging: VNM nến đổi + badge mất; VIC (0 adj_close) badge vẫn hiện.

## 5. Gate & Rollout
1. Nạp `project-lessons`; `check-lessons.mjs` nếu đụng docs/LESSONS.
2. `agent-sync.ps1` (rebase → check migration → gate) + `check-multi-agent.mjs` trước mỗi commit; claim tên agent = tên branch; không commit thẳng `dev`.
3. Widget repo: `npm test`, `tsc --noEmit`, `npm run build`. BE/FE test + build **chỉ trên VPS staging** `14.225.255.47`, cấm local Docker.
4. `npm pack` tarball mới, giữ bản cũ để rollback; host đổi package.json/lock qua coordinator.
5. Deploy FE staging, verify asset + E2E Playwright; mỗi repo tối đa 3 vòng sửa/bước, quá ⇒ blocker dừng. Ledger Entry riêng mỗi repo.

## 6. Câu hỏi owner (chốt trước code)
1. Volume giữ nguyên hay scale? (Giữ ⇒ turnover profile lệch.)
2. Drawings toạ độ giá thô: giữ + cảnh báo hay chuyển?
3. `stock_ratio_pct` âm / `adjClose > close` có được phép trong hệ thống không?
4. Copy statusline + có bật `adjusted` làm default cho chart vninvest không? (Khuyến nghị toggle, default tắt.)
5. Rebuild tarball local hay đợi widget publish?

## 7. Non-goals / Rollback
Không sửa parser, fail-closed BE, ESOP/rights policy, engine-core, controlled-mode path, capability resolver/contract.json.
Rollback: prop về `'raw'` + tarball cũ — không migrate DB.

## 8. Lessons áp dụng
`[L-V02, L-V04, L-V01, L-002, L-M02, L-V03]` — phản chứng root cause kế thừa (đã refute 3 lần), assert giá trị thật + AC dương tính, control biết đáp án, claim trước code, tên branch đúng, `git status` sau `npm pack`.
