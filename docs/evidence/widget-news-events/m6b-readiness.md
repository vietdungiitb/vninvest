# M6b — Pilot readiness: R1/R2/R3/R-B (2026-11-25)

> Branch `feat/price-mig-readiness` · Entry 638 · Claim `price-mig-readiness`.
> Flag `PRICE_ADJUSTED_DISPLAY` vẫn off. Đây là gate trước ops window.

## 1. Đóng reservation audit M5b/M5c
| ID | Thay đổi |
|---|---|
| **R1** | `market_data/pricing.py`: `effective_close`/`effective_ohlc` trả **None** cho dòng `price_source='unmapped_cafef'` khi flag on ⇒ consumer **loại** dòng đó khỏi cửa sổ adjusted (không thay raw 42750). NAV/advisory/screener skip dòng None. FE `chartAdapter` đã lọc từ M5c. |
| **R2** | Thêm `price_basis` (default `'raw'`, db_index) vào `AdvisoryRecord` + `ScreenerRunHistory`; migration do `makemigrations` sinh: `advisory/0024_advisoryrecord_price_basis.py`, `user_workspace/0031_screenerrunhistory_price_basis.py`. Gán `'adjusted'` tại 2 creation site khi flag bật. |
| **R3** | `_ledger_quantity_deltas()` tính quantity theo ngày từ `LedgerEntry` (BUY/SPLIT/BONUS +, SELL −); dùng trong `PortfolioEquityCurveView` + `_nav_series` khi có portfolio, fallback holdings hiện tại khi không có entry. |
| **R-B** | `chartAdapter` thêm `subscribePriceBasis()` + notify khi basis đổi; `VNStockChartPanel` dùng state reactive thay vì đọc method trong `useMemo`. |

## 2. Gate
- BE: `market_data.tests.test_m6b_pricing_skip`, `test_m6b_readiness`, `user_workspace.tests.test_m5b_nav_adjusted`, `test_m5b_consumers`, `user_workspace.tests.test_m6b_r3_quantity` ⇒ **15 test OK**.
- **Audit NEED_REVISION → đã sửa**: O1 `pilot_adjusted_enabled` chưa import trong `portfolio_analytics_views.py` ⇒ **NameError 500** mọi lần tạo `ScreenerRunHistory` (dù flag off) — đã import. O2 `_ledger_quantity_deltas` không cộng baseline entry trước cửa sổ ⇒ qty=0 cho vị thế cũ — thêm `_advance_quantity()` cộng mọi delta `date <= day` (kể cả trước cửa sổ + ngày không có price row); test R3 mới cover đúng baseline `1000 × 100` và SELL trong cửa sổ `(1000-200) × 110`.
- FE: `vitest run …chartAdapter.adjusted.component.test.ts` ⇒ **4/4 PASS** (thêm test R-B notify); `npx tsc --noEmit` exit 0; `npm run build` exit 0 (chunk warning có sẵn).
- Container core-api lúc đầu OOM exit 137 do limit **512 MB** — đã `docker update --memory 2g` trước khi chạy lại.

## 3. Còn lại
Apply M4 các lô HOSE/HNX/UPCOM còn lại (đang chạy driver riêng), invalidate cache, recompute snapshot, resume beat, E2E, bật flag.
