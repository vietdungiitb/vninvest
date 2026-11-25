# Runbook — Ops window cutover giá CafeF (2026-11-25)

> File này là **kế hoạch vận hành**, không phải bằng chứng đã chạy. Mọi bước phải ghi log/output thật vào evidence trước khi báo xong.

## 0. Điều kiện trước (gate)
- [x] Backup S0 `/opt/backups/price-migration-20261124/before_20261124.dump` (99 MB, sha256 `6c5a7e05…c19691`).
- [x] M3 pause flag + M6a guard `price_source in ('cafef','unmapped_cafef')`.
- [x] M6b R1/R2/R3/R-B code xong (PR #542).
- [ ] Driver apply M4 **tất cả lô** HOSE/HNX/UPCOM 2011–2026 (trừ 7 lô lỗi nguồn CafeF đã ghi) xong, mọi `status=applied`.
- [ ] Đối chiếu DB cuối: số dòng `cafef` theo (sàn, năm) khớp tổng `expected_cafef_rows` từ report.
- [ ] Disk ≥20 GB, DB container memory ≥8 GB, core-api ≥2 GB.

## 1. Apply (đang chạy)
Driver: `/tmp/m4_driver_vps.py` trên VPS. Mỗi lô `docker exec` riêng, pacing 1s, `--apply` với `PRICE_MIGRATION_PAUSED=1`, report `/tmp/m4_<EXCHANGE>_<YEAR>.json`, kết quả `/tmp/m4_host_results.json`. Retry lỗi bằng cách xoá entry `error` khỏi results rồi chạy lại (command upsert idempotent).

## 2. Verify DB cuối
```sql
SELECT s.exchange, EXTRACT(YEAR FROM d.date)::int, d.price_source, count(*)
FROM market_data_dailyprice d
JOIN market_data_stockprofile s ON s.symbol = d.symbol
GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT count(*) FROM market_data_dailyprice WHERE price_source='cafef' AND adj_factor IS NOT NULL;
```
Đối chiếu `cafef` == `adj_factor IS NOT NULL` (hoặc chênh đúng số dòng cafef không có factor — phải = 0).

## 3. Cutover (respect flag)
1. Giữ `PRICE_MIGRATION_PAUSED=1` tới khi xong bước 4.
2. Invalidate cache: bulk-technicals (300s), SOC inventory (3600s), screener scan cache, corporate actions cache.
3. Recompute `SymbolSnapshot` + pre-open + `refresh_global_symbol_coverage`.
4. Bật `PRICE_ADJUSTED_DISPLAY=1` cho scope pilot (flag global — đã derive basis theo dữ liệu thực ở BE/FE).
5. Resume 5 beat job + anomaly 5m: bỏ `PRICE_MIGRATION_PAUSED` khỏi compose env, `docker compose up -d --force-recreate`.
6. E2E Playwright staging: mở chart TPB 2022, assert nến adjusted (`42750 → 17940`), chụp ảnh + **mở ảnh xem** (L-V05), assert indicator không trộn basis.

## 4. Rollback chọn lọc
- Theo `inserted_keys` (`--inserted-keys-out`) cho dòng CafeF-only.
- Khôi phục toàn bộ từ S0 nếu cần (`pg_restore`), chỉ khi có owner sign-off.
- Tắt `PRICE_ADJUSTED_DISPLAY`, khôi phục `PRICE_MIGRATION_PAUSED=1`.

## 5. Bằng chứng
Mọi output dán vào `docs/evidence/widget-news-events/`, cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` Entry kế tiếp + handoff trên `main`.
