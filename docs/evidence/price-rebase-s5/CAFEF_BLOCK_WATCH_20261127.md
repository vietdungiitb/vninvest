# THEO DÕI — CafeF block VPS IP, cần kiểm tra/tính lại hôm nay (2026-11-27)

**Trạng thái**: `OPEN` — chờ kiểm tra lại trong ngày 2026-11-27. Owner yêu cầu "quay lại vấn đề này sau".

## Vấn đề cần nhớ

- CafeF từ **IP VPS `14.225.255.47`** trả **400/503** (XLSX export + JSON fallback) khi gọi `bulk_year` / per-symbol. Từ **IP local** cùng endpoint trả **200** (HOSE ALL 2026 = 3.734.885 bytes; TPB 220 dòng).
- Hệ quả: job `rebase_symbol_from_cafef` trả `fetch_error` / `halted_data_error`, **không ghi** `adj_close` mới. Không có auto-fallback sang VCI/KBS (`vnbroker/reference/cafef.py:26-27` cố tình không vào AUTO pool; `data_ingest/tasks.py:3550-3558` không thử provider khác).
- Dòng 2026 trên staging hiện **0 dòng `price_source='cafef'`**; `PRICE_ADJUSTED_DISPLAY=0` nên chart vẫn đọc raw, chưa blank. Nếu bật flag khi chưa backfill → `chartAdapter` lọc unmapped → blank.
- Đã dọn 433.373 dòng `adj_close` tàn dư (có bảng rollback `market_data_legacy_adj_backup_20261126`).

## Kết quả kiểm tra 2026-11-27

- Probe đơn lẻ từ container VPS: `HOSE ALL 2026` → **200 / 3.735.439 bytes / PK**; `TPB 2026` → **200 / 12.232 bytes / PK**. ⇒ IP không bị chặn cứng.
- Tuy nhiên `bulk_year('HOSE', 2026, end_date=2026-11-27, use_cache=False)` → **"failed after 3 attempts"** (503) khi chạy ngay sau đó; `run_import` fallback sang local `fetcher.fetch_xlsx` cũng 503 (EndDate `12/31/2026` — lỗi đã biết). Kết luận: **bị rate-limit theo tần suất**, chưa tải được toàn bộ dữ liệu để backfill.
- Phát hiện và sửa lỗi đi kèm: `market_data/cafef/importer.py` gọi `CafefDailyPrice(**row)` với frame vnbroker 3.10 (có `time/open/high/low/close/put_through_*/price_basis/coverage/fetched_at`) ⇒ `TypeError`. Đã thêm `normalize_row()` lọc field model; TDD 1/1. Đây là blocker đã cảnh báo từ trước, giờ mới lộ ra khi thật sự chạy import 2026.

## Việc phải làm hôm nay (checklist)

- [x] 1. Probe lại từ VPS: 200/3.735.439 bytes (ALL), 200/12.232 bytes (TPB) — ghi ở trên. Bulk vẫn 503 ⇒ chuyển tiếp mục 2.
- [ ] 2. Nếu VPS **vẫn bị block**: chọn một trong hai đường:
  - (a) fetch từ **local IP** rồi đẩy dữ liệu theo lô vào `CafefDailyPrice`/`DailyPrice` (đã fetch thật được 88.879 dòng HOSE 2026); hoặc
  - (b) implement fallback `VCI.quote.history(adjusted=True)` ghi `price_source='vnbroker_fallback'` (thiết kế tại `CAFEF_FALLBACK_ANALYSIS_20261127.md`).
- [ ] 3. **Tính lại** `adj_close`/`adj_factor` cho các mã có sự kiện mới kể từ 2026-11-26; chạy `rebase_symbol_from_cafef` tới khi trả `status='applied'`.
- [ ] 4. Backfill 2011–2026 cho HOSE/HNX/UPCOM; verify `cafef_2026 > 0`, `legacy_with_adj = 0`.
- [ ] 5. Chỉ sau đó mới cân nhắc bật lại `PRICE_ADJUSTED_DISPLAY=1`.

## Lệnh tái tạo (nhanh)

```powershell
# Từ VPS
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 'docker exec vninvest-core-api python -c "import requests; u=\"https://cafef.vn/du-lieu/Ajax/PageNew/DataHistory/PriceHistoryExport.ashx\"; r=requests.get(u,params={\"ExchangeType\":\"HOSE\",\"Symbol\":\"ALL\",\"StartDate\":\"01/01/2026\",\"EndDate\":\"11/27/2026\"},timeout=60); print(r.status_code, len(r.content))"'
```
(200 + vài MB = hết block; 400/503 = vẫn block.)

## Tiêu chí đóng

- Có kết quả probe ghi rõ ngày/giờ + status/bytes.
- Có ít nhất một mã rebase `status='applied'` với dữ liệu thật sau khi CafeF hết block (hoặc fallback có nhãn).
- `cafef_2026 > 0` trong DB staging.
- Cập nhật trạng thái file này thành `DONE` + ledger Entry mới.

## Liên quan

- `docs/evidence/price-rebase-s5/CAFEF_FALLBACK_ANALYSIS_20261127.md`
- `docs/evidence/price-rebase-s5/E2E_20261126.md`
- `docs/evidence/price-rebase-s2/E2E_20261126.md`
