# M5c — FE chart cutover + payload flag (2026-11-25)

> Branch `feat/price-mig-cutover` · Entry 635 · Plan `PLAN_PRICE_MIGRATION_CUTOVER_20261125.md` AGREE.
> **Chỉ chuẩn bị code — KHÔNG bật flag, KHÔNG invalidate/resume beat staging.**

## 1. Thay đổi
| File | Thay đổi |
|---|---|
| `stock_mgmt_native_views.py` (`/chart`) | payload thêm `adjusted_display: pilot_adjusted_enabled()` (mặc định `false`). |
| `packages/web/src/adapters/chartAdapter.js` | `mapToBar(p,i,adjusted)`: khi flag on + `price_source='cafef'` + có `adj_factor`/`adj_close` ⇒ `close=adj_close`, `O/H/L=raw×factor`. `parseBars` lọc bỏ dòng `unmapped_cafef` khi adjusted + ghi `state.priceBasis`. Adapter exposes `getPriceBasis()`. |
| `packages/web/src/components/VNStockChartPanel.js` | `nextBar`: nếu `adapter.getPriceBasis()==='adjusted'` ⇒ **không push nến realtime raw** vào indicator window (đóng reservation 1 của plan M5). |
| `packages/web/src/adapters/__tests__/chartAdapter.adjusted.component.test.ts` (mới) | 2 test: flag off giữ raw; flag on scale O/H/L/C + bỏ `unmapped_cafef` + legacy fallback raw. |

## 2. Gate
- FE: `npx vitest run …chartAdapter.adjusted.component.test.ts` ⇒ **2/2 PASS**; `npx tsc --noEmit` ⇒ exit 0; `npm run build` ⇒ exit 0 (chỉ chunk-size warning có sẵn).
- BE: copy view vào container, chạy 15 test (M5a 7 + M5b 8) ⇒ **OK**; `pilot_adjusted_enabled()` với env `true` ⇒ `True`, mặc định `False`.
- Test FE nằm trong `src/**/*.component.test.*` theo `vitest.config.ts` (include pattern).

## 3. Chưa làm — gate runtime (BẮT BUỘC trước khi bật flag)
- R1/R2/R3 từ audit M5b (`docs/evidence/widget-news-events/m5b-domain-consumers.md`) **chưa đóng**: fallback raw cho `unmapped_cafef`, `price_basis` trên AdvisoryRecord/ScreenerRunHistory, NAV quantity time-series.
- Chưa bật `PRICE_ADJUSTED_DISPLAY=1` staging; chưa invalidate cache bulk-technicals/SOC inventory; chưa recompute `SymbolSnapshot` + coverage; chưa resume 5 beat job; chưa E2E Playwright chụp ảnh mở xem.
- Chưa apply M4 cho HNX/UPCOM/các năm khác — scope pilot vẫn ~2% data.
⇒ Cutover runtime là một **ops window riêng**, chỉ mở sau khi đóng R1/R2/R3 và có backup/rollback sẵn.
