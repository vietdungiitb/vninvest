# Kế hoạch xoá `DailyPrice.close` (2026-11-28)

**Lessons:** [L-V01, L-V02, L-V04, L-T01]. Quyết định Owner: thêm `raw_close`, bỏ `close`, `adj_close` SSOT.

## Hiện trạng
- `models.py:74` close NOT NULL, 4.608.523 dòng; ~65 điểm đọc close trong backend (grep `values('close')`/`.close`).
- `CafefDailyPrice.close_raw` 2.308.756 dòng → backfill `raw_close` được ~50%; phần còn lại để NULL (trung thực).
- Flag `PRICE_ADJUSTED_DISPLAY=1` đã bật.

## Nguyên tắc migration
1. **Contract ngoài giữ nguyên key `close`** trong payload API/serializer, nhưng giá trị lấy từ `adj_close`.
2. **DB không còn cột `close`**: model bỏ field, migration `AddField raw_close` + `RemoveField close` (do `makemigrations` sinh); backup bảng ops `dailyprice_close_backup_20261128` (id, close, adj_close, price_source) **trước** drop trên staging.
3. Mọi truy vấn `.values('close')`/`values_list('close')` đổi sang `adj_close` rồi alias lại key `close` ở payload.
4. `open/high/low` vẫn là giá provider adjusted; `adj_factor` là factor bổ sung theo `base_as_of` — không scale chéo.

## AC
- **AC1**: model `DailyPrice` có `raw_close` nullable, **không còn field `close`**; `makemigrations --check` sạch.
- **AC2**: payload `/chart/`, `/ohlcv/`, `DailyPriceSerializer` vẫn trả key `close` = `adj_close` (test contract xanh).
- **AC3**: mọi consumer BE (advisory, screener, portfolio, market_serving, rebase, integrity, persistence, seed) không query cột `close`; grep còn lại chỉ là alias payload/tên test.
- **AC4**: FE `chartAdapter.js` vẫn nhận `close` từ payload — không đổi contract FE.
- **AC5**: TDD fail-before; `pre-push-gate`; B8 audit; **không drop cột staging** trong slice code — cần backup + deploy riêng.

## SCOPE / LIMIT / rollback
~20 file backend + migration + test. Rollback: khôi phục cột từ bảng backup nếu cần (trước khi drop), sau drop chỉ restore từ DB snapshot. LIMIT 3 vòng; STOP nếu test contract cũ phản đối không có rationale.
