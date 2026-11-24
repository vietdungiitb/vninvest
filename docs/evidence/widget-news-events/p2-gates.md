# Gates P2 — dual-write mapper + parity mock (2026-11-24)

Branch `feat/cafef-dual-write` · base P0 (đã pin `vnbroker==3.9.0`). 5 điều kiện owner: `docs/DECISION_SSOT_OWNER_ITEMS_20261124.md`.

## RED → GREEN
- RED: 3 test `AttributeError: _daily_bars doesn't exist`.
- GREEN: **13/13 OK** trên VPS `14.225.255.47`, DB riêng `vnsaas_core` (`--keepdb`, kết nối tạm vào `vnsaas-staging_data`, đã ngắt) — gồm 4 test P2 mới + 9 test P0 (không regression).

## Thay đổi
- `market_data/cafef_dual_write.py` (mới): `map_frame_to_rows(frame, symbol)` — map frame vnbroker 3.9.0 (`close_raw`, `close_adjusted`, `open/high/low_raw`, `volume`, `value`, `source`, `price_basis`, `coverage`) → dict chuẩn; `coverage='missing'` ⇒ `[]` rõ ràng.
- `market_data/vnbroker_adapter.py`: `_daily_bars()` thin wrapper tới `Vnbroker().daily_bars(..., basis='both')` (mockable seam) + `fetch_dual_write_bars()` với flag `DUAL_WRITE_PRICE_ENABLED` (default tắt).

## Mock, không fetch thật
- **0 request CafeF thật** — ToS chờ owner ký trước bulk (P2 chỉ mock).
- Golden TPB `04/01/2022 → 42750 / 17940 / 11034900 / 467260000000`.
- Parity **3 mã × 3 năm** (TPB/2011, VNM/2015, VIC/2022) qua mock; assert `close_raw`, `close_adjusted`, `symbol`.
- Test `coverage='missing'` ⇒ `[]`; flag OFF ⇒ `_daily_bars` không được gọi.

## Chưa làm / reservation
- Chưa ghi vào `DailyPrice` (chỉ mapper; dual-write persistence + ngắt ghi đè là bước sau khi ToS ký).
- Container staging vẫn chạy vnbroker **3.8.2** — pin trong requirements đã có (P0), chưa reinstall image; mapper dùng mock nên không phụ thuộc runtime.
- UI default giữ provider-adjusted tới P3.
- 1,4% DB-only (2022/3 sàn) chưa xử lý; ô CHƯA ĐO các năm sâu chỉ chặn mở rộng.
