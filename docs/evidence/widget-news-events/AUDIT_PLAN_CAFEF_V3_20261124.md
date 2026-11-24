# Audit v3 — plan CafeF OHLC ingest (2026-11-24)

> Auditor độc lập phiên mới, chỉ đọc, tự mở XLSX thật + tự chạy strptime + tự convert unit.
> Verdict: **AGREE (+reservation)** — không blocker/major mới.

## Kiểm chứng
- XLSX TPB 2022: 249 rows; ALL 2022: 101.756 rows.
- `04/01/2022 → 2022-01-04 / 42.75 / 17.94 / 11.034.900 / 467.26 / O41.5-H43.25-L41.3`; `01/04/2022 → 41.25` ✅
- `strptime('%d/%m/%Y')` đúng; dùng `%m/%d/%Y` thì golden kép bắt được swap.
- Trên 101.756 rows: 0 duplicate `(symbol,date)`, 0 date parse-fail, 0 ô số không-numeric.
- Golden 7 unit convert khớp (467,26×1e9 = 467.260.000.000).
- Model/migration (`makemigrations`, head `0009`)/admin (`market_data/admin.py:11`)/inventory hardcode (`dataops_inventory.py:61,90`) — không mâu thuẫn.

## Reservation (không chặn phê duyệt)
- Owner chốt ToS/rate-limit + `openpyxl` vào `requirements.txt` (deny-list) trước C2.
- Perf parse chưa đo — phải đo thật trên VPS trước khi báo PASS (L-V01).

## Kết luận
O8 đóng. Plan REVISION 2 đủ điều kiện chuyển B5 (claim + branch riêng) khi owner cho phép. Không viết file trong audit này.
