# Re-verify điều chỉnh giá TPB bằng nến cũ (2026-11-24) — ĐÍNH CHÍNH kết luận trước

> Owner chỉ ra: so sánh ngày gần đây vô nghĩa vì sau ex-date cuối, giá điều chỉnh = giá thô. Phải so sánh nến vài năm trước.
> Phương pháp làm lại: lấy nến TPB 2022 từ CafeF (nguồn internet độc lập, có cả 2 cột **Đóng cửa** = giá thật và **Điều chỉnh** = giá đã hiệu chỉnh) qua endpoint `PriceHistory.ashx` bằng Playwright cùng-origin; đối chiếu với `DailyPrice` staging.

## Kết quả (CafeF đơn vị nghìn VNĐ → nhân 1000)

| Ngày | CafeF `GiaDongCua` (thô) | CafeF `GiaDieuChinh` (đã chỉnh) | DB `close` | DB `adj_close` |
|---|---|---|---|---|
| 04/01/2022 | 42.750 | 17.940 | **16.723,81** | 5.159,60 |
| 05/01/2022 | 42.000 | 17.630 | **16.430,41** | 5.069,08 |
| 30/12/2022 | 21.050 | 8.830 | **8.234,77** | 2.540,58 |

Tỉ lệ `DB close / CafeF GiaDieuChinh` = 0,9322 / 0,9320 / 0,9326 — **nhất quán** Across cả năm.
Tỉ lệ `DB close / CafeF GiaDongCua` = 0,39 / 0,39 / 0,39 — không khớp.

## Kết luận (đính chính)
1. **Owner đúng:** nguồn VCI/KBS trả giá **đã hiệu chỉnh**. `DB close` (và `/chart/`) gần với `GiaDieuChinh` của CafeF, không phải giá thô 42.750. Kết luận "chart đang hiện giá thô" trong `TPB_ADJUSTED_PRICE_COMPARISON_20261124.md` **SAI** — do so sánh nhầm ngày gần ex-date cuối.
2. **Pipeline adj_close đang điều chỉnh THÊM lần 2 (double-adjust):** `DB adj_close = DB close × 0,3085` (tích các factor từ 2023→2026). So với giá đã chỉnh của CafeF thì thấp hơn ~3,5 lần.
3. Hệ quả: Plan `PLAN_WIDGET_ADJUSTED_PRICE_DISPLAY_20261124.md` (đã BLOCKED) nếu triển khai sẽ cho widget vẽ **giá bị điều chỉnh hai lần** — sai hơn hiện tại. Cần đổi mục tiêu: không nên đổ `adj_close` ra chart; thậm chí cần rà soát lại việc materialize `adj_close` hiện có.
4. Badge "Chưa điều chỉnh" của widget là presence-probe (`fetchAdjustedBars`) — **không phản ánh sự thật** vì dữ liệu nguồn đã chỉnh. Đây là vấn đề copy/semantic, không phải thiếu dữ liệu.

## Lệnh tái tạo
- Playwright local: `C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\cafef_tpb.js` (fetch cùng-origin `https://cafef.vn/du-lieu/Ajax/PageNew/DataHistory/PriceHistory.ashx?ExchangeType=HOSE&Symbol=TPB&StartDate=01/04/2022&EndDate=01/06/2022&...`).
- DB: `manage.py shell` query `market_data.DailyPrice` với `date` tương ứng.
