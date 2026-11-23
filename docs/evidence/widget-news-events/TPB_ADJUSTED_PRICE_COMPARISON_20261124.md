# Đối chiếu giá TPB: BE tính lại vs internet vs chart (2026-11-24)

## Nguồn & lệnh
- Staging VPS `/opt/vninvest`, `manage.py shell` query `market_data.DailyPrice/AdjFactor/CorporateAction`.
- Internet: chính hàm fetch của app `market_data.vnbroker_adapter.fetch_daily_history('TPB', start_date=2026-09-29, end_date=2026-10-03)` — lấy từ provider VN thực (không phải DB).
- API: curl `/bars/?timeframe=1D&before=2026-10-02&limit=3` và `/chart/?timeframe=1D&days=60` với PAT tạm (đã thu hồi).

## Kết quả đo

| Ngày | Internet (provider, close thô) | DB `close` | DB `adj_close` | `/chart/` (chart dùng) | `/bars/` |
|---|---|---|---|---|---|
| 2026-09-29 | 12.184 | 12.184 | 10.156,98 | 12.184 (thô) | close 12.184 / adj 10.156,98 |
| 2026-09-30 | 12.142 | 12.142 | 10.121,97 | 12.142 (thô) | close 12.142 / adj 10.121,97 |
| 2026-10-01 | 12.100 | 12.100 | 10.086,96 | 12.100 (thô) | close 12.100 / adj 10.086,96 |

- TPB có **1.259/2.147** `DailyPrice` có `adj_close`; 10 factor `computed`, 3 `partial` (đều `factor_total=1`).
- Sự kiện 2026-10-02: ISS 15% + DIV 500 ⇒ `factor_total=0,8336327704`; `12.100 × 0,8336327704 = 10.086,96` ✓ khớp định nghĩa back-adjust.
- `/bars/` vẫn trả `adjusted:false` + note 3 ex_date chưa parse (2018-06-15, 2020-12-01, 2021-09-14) — đúng fail-closed.
- `/chart/` **không có field `adj_close`**. FE bundle staging chỉ có 1 lần `adj_close` — trong danh sách cột CSV export (`RightSidebarDockHost-*.js`), không phải render. `chartAdapter.js:42-54 mapToBar` bỏ field.

## Kết luận
Service tính lại giá **chạy đúng và có dữ liệu thật** (`adj_close` khác giá thô đúng hệ số sự kiện). Nhưng **chart vninvest đang hiển thị giá thô**, khớp internet, không khớp `adj_close`. Nếu thấy TPB "đã tính lại" thì đó là `/bars/` hoặc DB, không phải nến trên chart. Đây đúng là nội dung plan `PLAN_WIDGET_ADJUSTED_PRICE_DISPLAY_20261124.md` đang bị BLOCKED.
