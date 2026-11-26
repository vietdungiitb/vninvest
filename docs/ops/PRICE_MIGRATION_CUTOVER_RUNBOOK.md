# Runbook — Ops window cutover giá CafeF (2026-11-25)

> File này là **kế hoạch vận hành**, không phải bằng chứng đã chạy. Mọi bước phải ghi log/output thật vào evidence trước khi báo xong.

## 0. Điều kiện trước (gate)
- [x] Backup S0 `/opt/backups/price-migration-20261124/before_20261124.dump` (99 MB, sha256 `6c5a7e05…c19691`).
- [x] M3 pause flag + M6a guard `price_source in ('cafef','unmapped_cafef')`.
- [x] M6b R1/R2/R3/R-B code xong (PR #542).
- [x] Driver apply M4 **tất cả lô** HOSE/HNX/UPCOM 2011–2026 xong — `m4-apply-all-and-cutover.md:14-24`; 4 lô lỗi nguồn giữ `vnbroker_legacy`, 5 lô có 0 dòng nguồn.
- [x] Đối chiếu DB cuối: `cafef=1.904.487`, `bad_cafef=0`, `bad_unmapped=0` — `m4-apply-all-and-cutover.md:26-43`.
- [x] Disk ≥20 GB, DB container memory 12 GB, core-api 4 GB — Entry 641.

## 1. Apply (đã xong)
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
3. `SymbolSnapshot` tự được beat `materialize_symbol_snapshot` recompute trong ~60s sau khi resume — không cần gọi thủ công (`materializers.py:25-35`).
4. Deploy code mới trước khi bật flag: `bash scripts/deploy-staging.sh` (pull dev + build + migrate 0024/0031). `CORPORATE_ACTIONS_ENABLED=true` đã có trong `compose.staging.env:111`.
5. Bật `PRICE_ADJUSTED_DISPLAY=1` (thêm vào `compose.staging.env`), bỏ `PRICE_MIGRATION_PAUSED=1` (dòng 112) để resume 5 beat job + anomaly 5m, rồi `docker compose up -d --force-recreate` core-api + worker + beat.
6. E2E Playwright staging: mở chart TPB 2022, assert nến adjusted (`42750 → 17940`), chụp ảnh + **mở ảnh xem** (L-V05), assert indicator không trộn basis.

## 4. Rollback chọn lọc
- Theo `inserted_keys` (`--inserted-keys-out`) cho dòng CafeF-only.
- Khôi phục toàn bộ từ S0 nếu cần (`pg_restore`), chỉ khi có owner sign-off.
- Tắt `PRICE_ADJUSTED_DISPLAY`, khôi phục `PRICE_MIGRATION_PAUSED=1`.

## 5. Bằng chứng
Mọi output dán vào `docs/evidence/widget-news-events/`, cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` Entry kế tiếp + handoff trên `main`.
