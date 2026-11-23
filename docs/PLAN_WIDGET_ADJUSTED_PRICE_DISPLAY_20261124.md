# Plan — Widget hiển thị giá đã điều chỉnh theo sự kiện doanh nghiệp (2026-11-24)

> Trạng thái: **REVISION 1 sau audit NEED_REVISION — chờ audit vòng 2. KHÔNG sửa code.**
> Owner chốt: "lập plan rõ ràng, audit độc lập, không tự ý sửa".
> Audit v1: `docs/evidence/widget-news-events/AUDIT_PLAN_ADJUSTED_PRICE_V1_20261124.md`.

## 0. Bối cảnh đã tự kiểm chứng (không suy diễn)

| Sự thật | Bằng chứng |
|---|---|
| BE tự tính `adj_close`: 2.254.058/4.584.956 `DailyPrice` có giá điều chỉnh | `market_data/corporate_actions/adjustment.py:26-104`; đo staging 2026-11-23 |
| `/bars/` trả `adj_close` + `adjusted` + `note`; `/chart/` (host dùng) **không** có field | `stock_mgmt_native_views.py:4071-4072, 4398-4416` |
| Host `chartAdapter.js:42-54 mapToBar` bỏ `adj_close` | đọc file |
| **Bar host đi qua `normalizeExternalBar` — hàm này bỏ hoàn toàn `adj_close`/`adjClose`** | `useWidgetData.ts:250,253`; `history/externalBarsNormalization.ts:18-65` |
| `DataEnvelope.normalizeBar` có đọc `adjClose` nhưng **không nằm trên đường host controlled** | `DataEnvelope.ts:139-155` |
| CSV hiện hard-code `adjClose:null` — không dùng adjClose thật | `VNInvestCharts.tsx:1011-1025` |
| Bundle `0.4.7-ent`: `fetchAdjustedBars` 2 lần, `adjClose` 2 lần — không có consumer render | grep tarball dist |
| Badge là presence-probe `typeof adapter.fetchAdjustedBars === "function"` | `ForkEngineSurface.tsx:147-149` |
| Sửa parser / fail-closed BE bị audit chặn (`factor_total=1` ≠ vô hại) | `AUDIT_PLAN_CA_NOOP_20261123.md` |

**Kết luận:** muốn chart vẽ giá điều chỉnh phải sửa widget, và **điểm cắm đầu tiên là external-bar normalizer**, không phải `enrichData`.

## 1. Mục tiêu
Khi host truyền bar có `adjClose`, widget vẽ nến/chỉ báo theo giá đã điều chỉnh và badge biến mất **chỉ khi** có ít nhất 1 bar thực sự được adjust. Không presence-probe giả, không tự fetch.

## 2. Thiết kế (REVISION 1)

1. **Đường dữ liệu: host `data` prop** (chọn thay vì widget tự fetch). Lý do: host đã có BE + PAT; `VNInvestClient.ts:153-155` tự fetch sẽ nhân đôi request/auth. Hệ quả: bắt buộc sửa normalizer ở §3.1.
2. **Kiểu dữ liệu:** `OHLCVBar` đến từ `@vninvestcharts/engine-core` (`src/lib/types/ohlcv.ts:1`) — **không sửa engine package**. Định nghĩa widget-local `AdjustableBar = OHLCVBar & { adjClose?: number | null }`, dùng ở `externalBarsNormalization.ts` và transform.
3. **Opt-in, mặc định TẮT:** prop `priceAdjustmentMode?: 'raw' | 'adjusted'` (default `'raw'`). Không đổi hành vi mặc định.
4. **Công thức:** `factor = adjClose / close`; `open'=open*factor`, `high'=high*factor`, `low'=low*factor`, `close'=adjClose`. Guard: `Number.isFinite(factor) && factor > 0`, `adjClose > 0`, `close > 0`. **Cho phép `factor > 1`** (reverse-split / `stock_ratio_pct` âm có thật theo `adjustment.py:52`). Test so sánh với **tolerance 0.01** do `Q2` rounding (`adjustment.py:11,100`).
5. **Volume / side effects — tách bạch rõ (chờ owner chốt §6):**
   - Volume: **giữ nguyên** ở bản đầu (BE không scale volume), nhưng phải ghi rõ rủi ro turnover tại `useWidgetData.ts:1283-1289` (`useAsyncVolumeProfiles`).
   - Compare bars (`useWidgetData.ts:1168-1281`) vẫn **raw** → trộn 2 hệ giá. Khuyến nghị: khi mode='adjusted' **tắt compare** hoặc áp cùng transform cho compare bars — **owner chọn**.
   - Drawings lưu toạ độ giá thô → lệch khi adjust. Khuyến nghị: giữ drawings trên hệ giá thô và ghi cảnh báo; không tự chuyển toạ độ.
   - Export CSV (`VNInvestCharts.tsx:1011-1025`): khi mode='adjusted', điền `adjClose` thật vào cột `adj_close` thay vì hard-code `null`, còn `open..close` là giá đã adjust. Cần AC riêng.
6. **Điểm cắm:** `normalizeExternalBar` (`externalBarsNormalization.ts:18-65`) giữ `adjClose` → transform tại `useWidgetData.ts:275` trước `enrichDataWithCanonicalStore` (`:1304-1314`) → `plotData` (`:1329`). Worker `externalBarsNormalization.worker.ts` dùng chung hàm, structured-clone số được.
7. **Badge SSOT — chọn "data thực tế" thay vì capability presence:**
   - `ForkEngineSurface.tsx:147-149`: `showAdjustedBadge = !hasAdjusted` → đổi thành `!usedAdjustedBars` (có ≥1 bar dùng adjustment).
   - Phải đồng bộ 4 chỗ: `capabilityProbe.ts:217-220` (`adjusted_bars` verdict), `CapabilityResolver.ts:187,266`, `conformanceContract.test.ts:14`, `CapabilityResolver.test.ts:162,199-214`, `ChartStatusLine.adjusted.test.tsx` Case C (`:72`). Không được để badge và resolver lệch nhau.

## 3. Phạm vi file

### Repo `vninvestcharts-widget`
- `src/widget/history/externalBarsNormalization.ts` — giữ `adjClose` (blocker v1).
- `src/widget/hooks/useWidgetData.ts:275,1304-1314` — transform opt-in.
- `src/widget/components/fork/ForkEngineSurface.tsx:147-149` — badge theo data thực.
- `src/widget/components/canvas/ChartStatusLine.tsx` + i18n `messages.vi.ts`/`messages.en.ts` — nhãn mode.
- `src/widget/VNInvestCharts.tsx:1011-1025` — CSV `adjClose` thật.
- `src/widget/capabilities/{capabilityProbe.ts,CapabilityResolver.ts}` + 3 file test được liệt kê ở §2.7.
- Test mới: `src/widget/history/__tests__/externalBarsNormalization.adjClose.test.ts`, `src/widget/hooks/__tests__/adjustedPriceBars.test.ts`.

### Repo `vninvest` (host — slice riêng SAU khi widget xong)
- `packages/web/src/adapters/chartAdapter.js:42-54` — `mapToBar` giữ `adjClose`.
- `packages/web/src/adapters/core/market.js:238-247` — dùng `/bars/` (có `adj_close`) thay `/chart/`.
- `packages/web/src/components/VNStockChartPanel.js` — truyền `priceAdjustmentMode`.
- `packages/web/package.json` + lock — trỏ tarball mới (**shared/deny-list ⇒ coordinator + trailer `Claim-Deny-List:`**).

## 4. Tiêu chí nghiệm thu (Given/When/Then)
- Given bar `{close:100, open:98, high:105, low:95, volume:10, adjClose:80}`, When mode='adjusted', Then plot `{close:80, open:78.4, high:84, low:76, volume:10}` (tolerance 0.01).
- Given `adjClose=null` hoặc `factor ≤ 0`, When mode='adjusted', Then bar giữ nguyên, không NaN, không exception.
- Given `factor > 1` (reverse-split), When mode='adjusted', Then vẫn áp dụng (có AC riêng) — chờ owner xác nhận §6.
- Given mọi bar thiếu adjClose, When mode='adjusted', Then badge **vẫn hiện**.
- Given mode='raw' (default), When render, Then toàn bộ contract suite hiện có xanh.
- CSV: cột `adj_close` có giá thật, không còn hard-code `null`.
- E2E staging: VNM (có adj_close) nến đổi + badge mất; VIC (0 adj_close) badge vẫn hiện.

## 5. Gate & Rollout
1. Nạp `project-lessons`; chạy `node scripts/check-lessons.mjs` khi đụng docs/LESSONS.
2. Widget repo: `npm test`, `tsc --noEmit`, `npm run build`; BE/FE test & build **chỉ trên VPS staging** (`14.225.255.47`), cấm local Docker.
3. `agent-sync.ps1` (rebase → check migration → gate) + `node scripts/check-multi-agent.mjs` trước mỗi commit; claim tên agent = tên branch; không commit thẳng `dev`.
4. `npm pack` → tarball mới, giữ tarball cũ để rollback; host cập nhật package.json/lock qua coordinator.
5. Deploy `vninvest-staging-frontend`, verify asset + E2E Playwright.
6. Mỗi repo tối đa 3 vòng sửa/bước; quá ⇒ blocker + dừng. Ledger Entry riêng cho mỗi repo.

## 6. Câu hỏi bắt buộc chốt trước khi code (owner / coordinator)
1. **Volume:** giữ nguyên hay scale theo factor? (Khuyến nghị giữ, nhưng turnover profile sẽ lệch.)
2. **Compare bars:** tắt khi mode='adjusted' hay áp cùng transform?
3. **Drawings:** giữ toạ độ giá thô + cảnh báo, hay chuyển toạ độ?
4. **`stock_ratio_pct` âm / `adjClose > close`:** có chấp nhận trong hệ thống không (xác nhận với BE)?
5. Copy statusline + có bật mode='adjusted' theo default cho chart vninvest không? (Khuyến nghị toggle, default tắt.)
6. Rebuild tarball local hay đợi widget publish bản mới?

## 7. Non-goals / Rollback
Không sửa parser, fail-closed BE, rights issue policy, ESOP. Không tự fetch `fetchAdjustedBars`. Không sửa engine-core.
Rollback: prop về `'raw'` + trỏ tarball cũ — không cần migrate DB.

## 8. Lessons áp dụng
`[L-V02, L-V04, L-V01, L-002, L-M02, L-V03]` — phản chứng root cause kế thừa (đã refute 3 lần), assert giá trị thật + AC dương tính, control biết đáp án, claim trước code, tên branch đúng, `git status` sau `npm pack`.
