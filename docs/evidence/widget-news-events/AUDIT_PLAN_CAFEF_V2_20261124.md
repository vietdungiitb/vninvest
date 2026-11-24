# Audit v2 — plan CafeF OHLC ingest (2026-11-24)

> Auditor độc lập phiên mới, chỉ đọc. Verdict: **NEED_REVISION** — O1–O7 đóng, còn O8 (major) + reservation.

## Đã đóng
O1 bảng riêng `CafefDailyPrice` · O2 không đụng apply_adjustments/nightly · O3 unique riêng · O4 fan-out mở rộng · O5 228 MB + ToS chờ owner · O7 openpyxl blocker · 101.756 data rows đúng.

## O8 (MAJOR) — nhầm format request vs response
- Request = `MM/DD/YYYY` (`12/31/2022`); response XLSX = `DD/MM/YYYY` (`30/12/2022`, `04/01/2022`).
- XLSX chứa **cả** `01/04/2022` (giá 41,25) và `04/01/2022` (giá 42,75) → swap vẫn nằm trong range; validate range không đủ.
- Golden test cũ chỉ assert giá, không assert ngày ⇒ swap PASS.
- Control bắt buộc: reject `31/12/2022` trước network; mock 246 dòng 2026 → reject; assert `04/01→2022-01-04/42750` và `01/04→2022-04-01/41250`.

## Reservation đã đưa vào REVISION 2
- Admin register `market_data/admin.py:11`; SOC inventory hardcoded dailyprice → cố ý không hiện.
- 3 cột `Thay đổi`/`KL thỏa thuận`/`GT thỏa thuận` → drop rõ.
- Unit golden đủ 7 giá trị (`467,26×1e9 = 467.260.000.000`; OHLC ×1000).
- Exchange list chỉ HOSE/HNX/UPCOM; VN30/HNX30 out of scope.
- Perf đo thật trước khi PASS (L-V01).
