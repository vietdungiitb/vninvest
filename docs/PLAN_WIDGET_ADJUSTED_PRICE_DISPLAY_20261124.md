# Plan — Widget hiển thị giá đã điều chỉnh theo sự kiện doanh nghiệp (2026-11-24)

> Trạng thái: **DRAFT — chờ audit độc lập B3/B4. KHÔNG sửa code khi chưa có verdict PASS/AGREE.**
> Owner chốt 2026-11-24: "lập thành plan sửa repo widget rõ ràng, audit độc lập, không tự ý sửa".

## 0. Bối cảnh đã kiểm chứng (không suy diễn)

| Sự thật | Bằng chứng |
|---|---|
| BE tự tính `adj_close` và đã có 2.254.058/4.584.956 `DailyPrice` có giá điều chỉnh | `market_data/corporate_actions/adjustment.py:26-104`; đo staging 2026-11-23 |
| `/bars/` trả `adj_close` + `adjusted` + `note`; `/chart/` (host đang dùng) **không** trả field | `stock_mgmt_native_views.py:4071-4072, 4398-4416`; curl staging |
| Host `chartAdapter.js:42-54 mapToBar` bỏ `adj_close` | đọc file |
| Widget `DataEnvelope.ts:139-155 normalizeBar` **đã đọc** `adj_close → adjClose` nhưng chỉ dùng cho CSV (`chartCsv.ts:111`) | đọc file |
| Widget bundle `0.4.7-ent`: `fetchAdjustedBars` 2 lần, `adjClose` 2 lần — **không có consumer render** | `npm pack` tarball, grep dist |
| Badge "Chưa điều chỉnh" là presence-probe `typeof adapter.fetchAdjustedBars === "function"` | `ForkEngineSurface.tsx:147-149` |
| Sửa parser / fail-closed BE bị audit chặn (`factor_total=1` ≠ vô hại) | `docs/evidence/widget-news-events/AUDIT_PLAN_CA_NOOP_20261123.md` |

**Kết luận:** muốn chart vẽ giá điều chỉnh phải sửa **widget**, không phải vninvest.

## 1. Mục tiêu
Khi host cung cấp bar có `adjClose` (từ `/bars/`), widget vẽ nến/chỉ báo theo giá đã điều chỉnh và badge "Chưa điều chỉnh" biến mất **chỉ khi** dữ liệu điều chỉnh thực sự được dùng — không phải presence-probe giả.

## 2. Thiết kế (quyết định rõ, không đoán)

1. **Opt-in, mặc định TẮT.** Prop mới `priceAdjustmentMode?: 'raw' | 'adjusted'` (default `'raw'`). Lý do: đổi mặc định sẽ đổi nghĩa mọi chart đang dùng và phá contract test hiện có.
2. **Nguồn giá:** host truyền `adjClose` trên mỗi bar. Widget **không tự fetch** `fetchAdjustedBars` trong slice này (interface đã có nhưng vô dụng).
3. **Công thức back-adjust:** với bar có `adjClose` và `close > 0`:
   `factor = adjClose / close`; `open' = open*factor`, `high' = high*factor`, `low' = low*factor`, `close' = adjClose`; `volume` giữ nguyên (BE `apply_adjustments` ghi rõ "không ghi đè close thô", volume không bị scale).
   Guard: bỏ qua bar nếu `adjClose` không phải số hữu hạn > 0 hoặc `close <= 0`; log 1 lần/duplicate, không ném exception.
4. **Điểm cắm:** transform TRƯỚC `enrichDataWithCanonicalStore` ở `useWidgetData.ts:275` (`canaryFilteredBars`) → `useWidgetData.ts:1304-1314`. Không đụng `normalizeBar` (đã đúng). Indicator/replay/scales tự động dùng bar đã transform vì `plotData` dẫn từ đây (`useWidgetData.ts:1329`).
5. **Badge:** đổi điều kiện từ presence-probe sang "có ít nhất 1 bar dùng adjustment" (`ForkEngineSurface.tsx:147-149`). Không implement `fetchAdjustedBars` chỉ để làm badge xanh.
6. **Giá cuối / realtime:** last-price line và tick realtime vẫn là giá thô. Bắt buộc hiển thị rõ nhãn "đã điều chỉnh" trên statusline khi mode='adjusted' để tránh hiểu nhầm — **cần owner chốt copy** (xem §6).

## 3. Phạm vi file

### Repo `vninvestcharts-widget`
- `src/widget/hooks/useWidgetData.ts` — transform bar theo mode (§2.4).
- `src/widget/components/fork/ForkEngineSurface.tsx` — điều kiện badge (§2.5).
- `src/widget/i18n/messages.vi.ts` + `messages.en.ts` — nhãn mode + copy statusline.
- `src/widget/components/settings/model/chartSettingsSchema.ts` + `defaultSettings.ts` — prop kiểu mới (nếu đưa vào settings thay vì prop).
- Test mới: `src/widget/hooks/__tests__/adjustedPriceBars.test.ts` + cập nhật contract test bị ảnh hưởng.

### Repo `vninvest` (host, slice riêng sau khi widget xong)
- `packages/web/src/adapters/chartAdapter.js:42-54` — `mapToBar` giữ `adjClose`.
- `packages/web/src/adapters/core/market.js:238-247` hoặc dùng `/bars/` — lấy payload có `adj_close`.
- `packages/web/src/components/VNStockChartPanel.js` — truyền `priceAdjustmentMode='adjusted'` khi tier/flag cho phép.
- `packages/web/package.json` + lock — trỏ tarball mới (đây là file shared/deny-list ⇒ cần coordinator + trailer `Claim-Deny-List:`).

## 4. Tiêu chí nghiệm thu (Given/When/Then)
- Given bar `{close:100, open:98, high:105, low:95, adjClose:80}`, When mode='adjusted', Then plot bar = `{close:80, open:78.4, high:84, low:76, volume:giữ nguyên}`.
- Given `adjClose=null`, When mode='adjusted', Then bar giữ nguyên, không NaN, không exception.
- Given mọi bar thiếu adjClose, When mode='adjusted', Then badge **vẫn hiện** (không false green).
- Given mode='raw' (default), When render, Then hành vi y hệt hiện tại — full contract suite xanh.
- E2E staging: chart VNM (có adj_close thật) so sánh nến trước/sau, badge mất; chart VIC (0 adj_close) badge vẫn hiện.

## 5. Gate & Rollout
1. Widget repo: `npm test`, `tsc --noEmit`, `npm run build` — chạy trên môi trường widget (không local Docker theo runbook).
2. `npm pack` → tarball mới → thay `vendor/vninvestcharts-widget-0.4.7-ent.tgz` (đổi tên version, **giữ tarball cũ để rollback**).
3. Host: `npx tsc --noEmit`, `npm run build`, deploy `vninvest-staging-frontend`, verify asset + E2E Playwright trên VPS `14.225.255.47`.
4. Claim/ledger/PR ở **cả 2 repo**, không commit thẳng vào `dev`.

**LIMIT:** mỗi repo tối đa 3 vòng sửa/bước; quá ⇒ blocker + dừng.

## 6. Câu hỏi cần owner chốt trước khi code
1. Copy statusline khi mode='adjusted' (đề xuất: "Giá đã điều chỉnh theo sự kiện doanh nghiệp — giá gần nhất vẫn là giá thô").
2. Có bật mode='adjusted' mặc định cho chart vninvest không, hay chỉ toggle trong Settings? (Khuyến nghị: toggle, default tắt.)
3. Khi nào rebuild tarball: đợi widget publish bản mới lên GitHub hay dùng bản local ent như hiện tại?

## 7. Non-goals / Rollback
Không sửa parser, fail-closed BE, rights issue policy, ESOP. Không đổi volume. Không tự động fetch `fetchAdjustedBars`.
Rollback: trả prop về `'raw'` (widget) + trỏ lại tarball cũ (host) — không cần migrate DB.

## 8. Lessons áp dụng
`[L-V02, L-V04, L-V01, L-002, L-M02, L-V03]` — phản chứng mọi root cause kế thừa (đã refute 2 lần trong phiên), assert giá trị thật + test dương tính, control biết đáp án cho phép đo, claim trước code, tên branch đúng agent, `git status` sau lệnh có side effect (npm pack).
