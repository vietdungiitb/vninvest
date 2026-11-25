# M5b — BE domain consumer dùng giá điều chỉnh (2026-11-25)

> Branch `feat/price-mig-cutover` · Entry 634 · Plan `PLAN_PRICE_MIGRATION_CUTOVER_20261125.md` AGREE.
> Scope pilot: flag `PRICE_ADJUSTED_DISPLAY` **mặc định off**; chỉ dòng `price_source='cafef'` + `adj_factor` có mới dùng adjusted.

## 1. Thay đổi
| File | Thay đổi |
|---|---|
| `market_data/pricing.py` (mới) | `pilot_adjusted_enabled()`, `effective_close(row)`, `effective_ohlc(row)`. Flag off / legacy / `unmapped_cafef` / factor NULL ⇒ **raw** (hành vi cũ). Adjusted: `close=adj_close`, `O/H/L=raw×adj_factor`. |
| `user_workspace/portfolio_analytics_views.py` (`PortfolioEquityCurveView` + `_nav_series`) | `Decimal(str(p.close))` → `effective_close(p)`. Sửa lỗi NAV dùng quantity hiện tại × close lịch sử: sau chia 2:1, `2 × adj_close(17940) = 35880` đúng, thay vì `2 × 42750 = 85500` (nhảy giả). |
| `advisory/advisory_helpers.py:214-237` | `build_ohlcv_lookback_context` dùng `effective_ohlc` cho cả 4 cột O/H/L/C. |
| `user_workspace/screener_helpers.py:368-...` | `_screener_build_technical` dùng `effective_ohlc` cho `history_list`; quote realtime (raw `snap.price`) được **scale bằng `adj_factor` mới nhất** để không trộn basis (reservation 1/2 plan M5). |

## 2. Gate
- **M5b1 NAV**: RED `85500.0 != 35880.0` → GREEN. 44 test (mới + `NavSeriesTests` + `test_review_findings_wave2`) OK.
- **M5b2 advisory/screener**: RED 2 fail → GREEN **8/8** (sau khi thêm R4: assert `price_vs_sma20_pct`/`price_vs_sma50_pct` = 0% với 51 phiên — nếu quote không scale sẽ ra 100%).
- **Regression lớn**: `advisory` + `user_workspace` = **826 test**, 7 fail + 15 error. **Đều pre-existing**: swap về HEAD (git show) chạy subset `test_ledger_migration_backfill` + `test_schema_not_polluted_by_migration_tests` + `test_capability_matrix_pav` ⇒ cùng 7 fail + 14 error (lỗi migration/schema ledger, không liên quan pricing). Không sửa trong slice này.
- Test chạy qua `docker exec -e DATABASE_URL=...@172.19.0.7:5432/...` (pgbouncer không route DB `test_*`).

## 3. Gate BẮT BUỘC trước khi bật flag (auditor M5b reservation)
- **R1**: `pricing.py` hiện fallback **raw** cho dòng `unmapped_cafef`/factor NULL; plan `PLAN_PRICE_MIGRATION_CUTOVER_20261125.md:45` yêu cầu **loại dòng đó khỏi cửa sổ adjusted**. Flag off nên hiện vô hại — phải owner chốt định nghĩa + đổi helper/consumer cho phù hợp trước khi bật flag.
- **R2**: `price_basis` trên `AdvisoryRecord` / `ScreenerRunHistory` **chưa gắn** (plan `:12,:36`) — phải thêm trước khi bật flag.
- **R3**: `_nav_series` vẫn dùng quantity hiện tại (đã nhất quán adjusted qua `adj_close` nhưng chưa đúng literal "chuỗi quantity theo Transaction/LedgerEntry", plan `:24,:46`).
- Flag `PRICE_ADJUSTED_DISPLAY` vẫn **off** staging — chưa đổi runtime production.
- Snapshot recompute / invalidate cache / resume beat / FE chartAdapter — thuộc M5c.
- Chưa apply M4 cho HNX/UPCOM và các năm khác — scope pilot vẫn ~2% dữ liệu.
