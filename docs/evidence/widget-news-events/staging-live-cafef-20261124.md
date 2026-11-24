# Chạy thật CafeF trên staging (2026-11-24) — sau owner waiver ToS

> Owner chỉ đạo "làm luôn đi, ký gì nữa" ⇒ waiver ToS ghi tại `DECISION...md` §5b / Ledger Entry 619. Pacing ≥1 s/req.

## Deploy
- Merge PR #521 (P0), #522 (cafef-ref), #523 (P2) → dev `e0fd1f32f`; VPS `/opt/vninvest` fetch+reset về HEAD đó.
- `deploy-staging.sh` lần 1 **FAIL** `no space left on device` (disk 98%). Dọn `docker builder prune -af` (36,9 GB) + `image prune -af` (17,85 GB) ⇒ 49 GB trống. Deploy lần 2 **thành công**, services up.
- Verify container: `vnbroker __version__ = 3.9.0`; `Vnbroker().daily_bars('TPB','2022-01-04','2022-01-06', basis='both')` → 3 dòng, `close_raw=42750`, `close_adjusted=17940`, `coverage='ok'`.
  - Lưu ý: `hasattr(Vnbroker, 'daily_bars')` trên **class** trả False (lazy proxy), trên **instance** trả True — seam trong `vnbroker_adapter._daily_bars()` dùng instance nên đúng, không cần sửa.

## Chạy thật (bảng đối chiếu, KHÔNG đụng DailyPrice)
- `preview_import('HOSE', 2022)` → **101.756 dòng / 0 reject / source=live_fetch** (XLSX thật, ~30 s).
- `run_import('HOSE', 2022, dry_run=False)` → `inserted=101756, updated=0`.
- `CafefDailyPrice.objects.count() = 101756`.
- TPB 2022-01-04: CafeF `close_raw=42750.00 / close_adjusted=17940.00`; DB `DailyPrice.close=16783.00 / adj_close=5159.60` — chênh đúng bước nhảy đã cảnh báo (O-3): ~2,55× và ~3,48×.

## Chưa làm (tuần tự an toàn)
- Chưa dual-write vào `DailyPrice` (cần backup + persist step, flag `DUAL_WRITE_PRICE_ENABLED` mới chỉ ở mapper).
- Chưa đổi UI default (P3) — giữ provider-adjusted.
- Chưa bulk HNX/UPCOM và các năm sâu (độ phủ HOSE-only 27,2% 2022).
- Chưa reinstall/verify shape `coverage` dạng cột (đang thấy `attrs['coverage']='ok'` — khớp mapper).

## Kết luận
Pipeline CafeF thật chạy được end-to-end tới bảng đối chiếu. Dữ liệu `DailyPrice` hiện vẫn là nguồn VCI/KBS đã điều chỉnh + `adj_close` sai đã bị P0 ngừng ghi mới. Bước persist/cutover cần backup + plan riêng; không tự ghi đè trong phiên này.
