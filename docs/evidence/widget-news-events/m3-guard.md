# M3 — Guard ingest + pause writer (2026-11-25)

Branch `feat/price-mig-guard` · base dev `d00729613` (sau PR #527) · Entry 630.

## Thay đổi
1. `data_ingest/tasks.py`:
   - `_classify_daily_price_rows`: skip row có `existing['price_source'] == 'cafef'` (dùng `.get` nên không KeyError với caller cũ) ⇒ nightly VCI/KBS **không ghi đè** dòng đã chuẩn hóa. `skipped_existing += 1`.
   - Query existing `:782-784` thêm `'price_source'`.
   - `backfill_daily_prices` task: guard đầu hàm — nếu `PRICE_MIGRATION_PAUSED=1` ⇒ `return {'skipped': True, 'reason': 'price_migration_paused'}`, **chặn mọi callsite** (5 beat + 4 on-demand) không cần sửa từng nơi.
2. `vninvest_core/settings.py`: sau `CELERY_BEAT_SCHEDULE`, nếu flag pause bật ⇒ pop 5 job: `daily-backfill-prices-1700`, `deep-history-bootstrap-weekly`, `pre5y-history-backfill-weekly`, `sync-corporate-actions-nightly`, `detect-market-anomaly-alerts-5m`. `ingest-daily-prices-1705` **không pause** (`enabled: False` sẵn — `settings.py:841`).

## TDD
- RED: `test_cafef_row_is_skipped` fail (`objs=[DailyPrice(...)]` thay vì `[]`).
- GREEN: **7/7 OK** (4 guard + 3 pause) trên VPS, không cần DB.
- Regression `data_ingest.tests` 50 test: 1 fail `test_warm_intraday_universe_consumes_plan_items_and_persists_rows` — **đã chứng minh pre-existing**. Lệnh tái tạo (trên VPS, DB riêng `vnsaas_core`): copy `git show HEAD:packages/core/backend/src/data_ingest/tasks.py` vào container rồi `docker exec -e CORE_DATABASE_URL=postgresql://...@172.22.0.4:5432/vnsaas_core -w /app/src vninvest-core-api python manage.py test data_ingest.tests.test_tasks.DataIngestBackfillTaskTests.test_warm_intraday_universe_consumes_plan_items_and_persists_rows --keepdb -v 1` → **`Ran 1 test ... FAILED (failures=1)`**, assertion `'warm' != GlobalSymbolCoverage.FreshnessChoices.FRESH`. Corroborate: `docs/evidence/corporate-actions/ALL_SYMBOLS_SYNC_20261121.md:38` ghi test này fail trên baseline sạch `165cdc8d2`. M3 chỉ sửa `_classify_daily_price_rows`/`backfill_daily_prices` — disjoint với đường `warm_intraday_universe`. Đã khôi phục `tasks.py` M3 trong container sau thử nghiệm.

## Chưa làm / forward
- Flag `PRICE_MIGRATION_PAUSED` mặc định '0' — chỉ bật trong maintenance window S3c–S5. Không ghi dữ liệu giá, không đổi consumer, không bulk CafeF.
- **R3 (audit, forward)**: guard hiện chỉ chặn `price_source == 'cafef'`. Dòng `unmapped_cafef` sẽ tạo ở M4 (`PLAN...:48`) — phải审视 lại ở M4 để không bị VCI ghi đè; không thuộc AC M3.
