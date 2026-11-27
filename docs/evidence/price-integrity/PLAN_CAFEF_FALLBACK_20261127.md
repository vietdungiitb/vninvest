# Kế hoạch — fallback khi CafeF mất kết nối lâu dài (2026-11-27)

**Lessons áp dụng:** [L-V01, L-V02, L-V04, L-002, L-003, L-007] · FILES READ: `docs/LESSONS/verification.md`, `docs/LESSONS/multi-agent.md` (đọc trong phiên này).

## Bằng chứng B1 (lệnh tái hiện có trong evidence)

- VPS: `SINGLE ALL/TPB 503`, `bulk_year(...) failed after 3 attempts`, `cafef_2026=0` (`CAFEF_PROBE_20261127_R2.md`).
- KBS/VCI `adjusted=False` **vẫn route sang CafeF** (`kbs/quote.py:438-445`, `vci/quote.py:578-585`) ⇒ không có raw khi CafeF chết.
- `KBS history(adjusted=True)` local trả `['time','open','high','low','close','volume']`, TPB 2026-01-05 `close=13949` (đơn vị ×1000, khớp `DailyPrice.close` staging `13934.04` cho VCI).
- FE đã có nhãn `provider_adjusted_fallback` (`chartAdapter.js:90`) — **không sửa FE**.

## Thiết kế

1. `market_data/cafef/fallback.py` (mới):
   - `fetch_provider_series(symbol, exchange, from_year, provider='KBS')` → list dict `date, close` từ `history(adjusted=True)`, chuẩn hoá timezone → `date`.
   - `validate_fallback(old_rows, new_rows)` → (ok, reason): coverage ≥95%, không có dòng `price_source='cafef'` (không trộn basis), factor=1 hợp lệ.
2. `data_ingest/tasks.py::rebase_symbol_from_cafef`: khi `bulk_year` lỗi → gọi fallback; nếu hợp lệ ghi `adj_close=provider_close`, `adj_factor=1`, `is_adjusted=True`, `price_source='vnbroker_fallback'`, `adj_as_of=now`, `adj_version=F+1`; audit `status='applied_fallback'`.
3. `models.py::PriceRebaseRun.Status` thêm `APPLIED_FALLBACK` (chỉ choices — **không migration**).
4. FE giữ nguyên: `price_source != 'cafef'` ⇒ `mapToBar` dùng `close` làm giá đã điều chỉnh; với `adjusted_display=1` FE hiện nhãn `provider_adjusted_fallback`.

## AC (Given/When/Then)

- **AC1** Given CafeF lỗi / When rebase chạy / Then fallback được gọi, `status='applied_fallback'`, **0 dòng** `price_source='cafef'` bị ghi đè.
- **AC2** Given vẫn còn dòng `cafef` / When fallback / Then `halted_data_error`, reason `cafef_rows_present` — không trộn.
- **AC3** Given provider trả <95% số ngày / When validate / Then `insufficient_coverage`, **0 UPDATE**.
- **AC4** Given deploy staging / When chạy fallback thật 1 mã / Then `adj_close>0`, `price_source='vnbroker_fallback'`, gate `check_price_integrity` vẫn ok.

## SCOPE / LIMIT / non-goals / rollback

- SCOPE: `market_data/cafef/fallback.py`, `data_ingest/tasks.py`, `market_data/models.py` (choices), test + evidence.
- LIMIT: 3 vòng sửa/bước. Non-goals: backfill CafeF 2011–2026, sửa FE, đổi `PRICE_ADJUSTED_DISPLAY`.
- Rollback: `git show HEAD:<file> > <file>` (không `git checkout --`, L-A01); fallback chỉ ghi `adj_*`/`price_source`, có thể đưa về `unmapped_cafef` bằng SQL backup nếu cần.
