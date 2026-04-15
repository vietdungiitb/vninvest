# Off-Peak Vnstock Ingest Implementation Plan (2026-04-16)

## 1) Muc tieu
- Bo sung luong ingest du lieu vnstock vao DB (DailyPrice) trong khung gio off-peak.
- Dong thoi refresh cache ticker trong Redis tu du lieu DB moi nhat de phuc vu API realtime fallback nhanh.
- Ho tro trigger thu cong tu admin-ops (sync/async) de van hanh va debug.

## 2) Pham vi trien khai
- Backend Celery task moi: offpeak_vnstock_ingest.
- Celery Beat schedule moi cho off-peak ingest (co the tat/mo qua env).
- Admin API moi: POST /api/admin-ops/prefetch/offpeak-ingest/.
- Test API admin cho mode async + sync.
- Cap nhat compose.dev.env de de cau hinh tren dev stack.

## 3) Thiet ke ky thuat
- Symbol universe:
  - Tai su dung bo loc symbol hien co (_collect_prefetch_symbols) de lay tracked/watchlist/alert/holding.
  - Co gioi han max symbols de tranh over-call provider.
- DB ingest:
  - Goi fetch_and_save_daily_prices(symbol, start_date, end_date) theo so ngay cau hinh.
  - Thu thap metrics: success/error, tong ban ghi created/updated.
- Redis refresh:
  - Lay DailyPrice moi nhat cua moi symbol sau ingest.
  - Cap nhat cache key ticker:{symbol} voi source=offpeak_db_ingest.
- Trigger mode:
  - sync: chay ngay trong request (debug/verify).
  - async: queue Celery task.

## 4) Cau hinh
- OFFPEAK_VNSTOCK_INGEST_ENABLED=true|false
- OFFPEAK_VNSTOCK_INGEST_CRON_HOUR=18
- OFFPEAK_VNSTOCK_INGEST_CRON_MINUTE=10
- OFFPEAK_VNSTOCK_INGEST_DAYS=5
- OFFPEAK_VNSTOCK_INGEST_MAX_SYMBOLS=300

## 5) API contract
- Endpoint: POST /api/admin-ops/prefetch/offpeak-ingest/
- Query/body:
  - mode=async|sync (default async)
  - days (optional, int >=1)
  - max_symbols (optional, int >=1)
- Response:
  - async: queued=true, task_id
  - sync: queued=false, ok=true|false, result payload

## 6) Rollout
1. Merge code len branch dev.
2. Rebuild backend + celery_worker + celery_beat tren dev stack.
3. Trigger endpoint sync de smoke test.
4. Theo doi admin runtime-kpi + logs task.

## 7) Rollback
- Tat schedule qua OFFPEAK_VNSTOCK_INGEST_ENABLED=false.
- Khong goi endpoint manual.
- Neu can, revert commit.

## 8) Verification
- Unit test API admin mode async/sync pass.
- Sync mode tra payload co tong hop DB ingest va Redis refresh.
- DailyPrice duoc update/create cho symbols duoc ingest.
- Redis cache ticker:{symbol} duoc cap nhat voi source=offpeak_db_ingest.
