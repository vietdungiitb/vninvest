# M5a — BE read contracts cho adjusted price (2026-11-25)

> Branch `feat/price-mig-cutover` · Entry 633 · Plan `PLAN_PRICE_MIGRATION_CUTOVER_20261125.md` AGREE.
> **Chỉ mở rộng contract đọc — chưa đổi consumer, chưa scale nến, chưa bật flag pilot.**

## 1. Thay đổi
| File | Thay đổi |
|---|---|
| `market_data/serializers.py:19-26` | `DailyPriceSerializer` thêm `adj_close`, `adj_factor`, `price_source`. |
| `stock_mgmt_native_views.py:984-999` | `_serialize_price_point` nhận 3 tham số optional; trả thêm 3 key (intraday ⇒ `None`). |
| `:995-1045` | `_aggregate_daily_rows` D: truyền field từ row; W/M: mang field từ **phiên cuối bucket** (reservation 5). |
| `:4061-4074` | `_ohlcv_bar_from_daily`: thêm `adj_factor`, `price_source` khi `CORPORATE_ACTIONS_ENABLED=true`. |
| `:4076-4125` | `_aggregate_daily_to_ohlcv_bars`: mang field từ phiên cuối, expose cùng flag. |

`/bars` metadata `adjusted` giữ nguyên nhánh `_corporate_actions_enabled()` (`:4398-4417`) — không đổi logic.

## 2. Golden value đối chiếu DB staging (lệnh tái tạo)
```
SELECT date,close,adj_close,adj_factor,price_source FROM market_data_dailyprice
 WHERE symbol='TPB' AND EXTRACT(YEAR FROM date)=2022 ORDER BY date LIMIT 3;
```
Output dán thật:
```
[["2022-01-04", "42750.00", "17940.00", "0.4196491228", "cafef"],
 ["2022-01-05", "42000.00", "17630.00", "0.4197619048", "cafef"],
 ["2022-01-06", "42000.00", "17630.00", "0.4197619048", "cafef"]]
```
Khớp golden plan: `close=42750`, `adj_close=17940`.

## 3. Gate
- **RED → GREEN**: 6 test mới (`test_m5_serializer.py` 2 + `test_m5_chart_points.py` 4). RED: `TypeError: unexpected keyword argument 'adj_close'` + `KeyError: 'adj_close'`. GREEN: 6/6.
- **Full suite `market_data`**: 264 test, **1 fail** — `test_stock_management_technicals_bulk_returns_compatible_technical_payload` (`rsi_14` None). **Pre-existing**: chạy lại với `stock_mgmt_native_views.py` nguyên HEAD (git show) vẫn fail ⇒ không phải do M5a. Ghi nhận, không sửa trong slice này.
- Container staging có sẵn `CORPORATE_ACTIONS_ENABLED=true` ⇒ 1 test cũ `test_weekly_bar_flag_off_keeps_old_contract` fail do env contamination; chạy lại với `-e CORPORATE_ACTIONS_ENABLED=false` ⇒ pass. Không phải lỗi code.
- Test DB Django không chạy qua pgbouncer (`/dev/shm` 64MB + DB `test_*` không được pgbouncer route); dùng `docker exec -e DATABASE_URL=...@172.19.0.7:5432/...`.

## 4. Phạm vi / chưa làm
Chưa đụng FE (`chartAdapter.js`, `VNStockChartPanel.js`), chưa scale O/H/L/C, chưa lọc `unmapped_cafef` ở FE, chưa bật `PRICE_ADJUSTED_DISPLAY`, chưa invalidate cache/recompute snapshot, chưa resume beat. Các item đó thuộc M5b/M5c.
