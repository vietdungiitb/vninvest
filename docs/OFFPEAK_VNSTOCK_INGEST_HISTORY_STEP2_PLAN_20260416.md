# Off-Peak Ingest Step 2 Plan (2026-04-16)

## 1) Muc tieu
- Bo sung API admin de xem lich su lan chay off-peak ingest gan day.
- Ho tro theo doi production nhanh: latest run, danh sach run gan nhat, status, chi so tong hop.

## 2) Pham vi
- Luu meta ket qua task offpeak_vnstock_ingest vao cache sau moi lan chay.
- Tao endpoint GET /api/admin-ops/prefetch/offpeak-ingest/history/.
- Bo sung test auth + payload cho endpoint moi.
- Cap nhat audit ledger theo quy dinh.

## 3) Thiet ke
- Cache keys:
  - ticker:offpeak:ingest:latest
  - ticker:offpeak:ingest:history
- History ring buffer:
  - Luu toi da 20 entry moi nhat.
  - Moi entry co: generated_at, status, trigger, symbols_ingested, db_created, db_updated, db_errors, cache_refreshed.
- API response:
  - ok, latest, history, total_entries, limit.

## 4) Rollout
1. Merge len dev.
2. Restart backend/celery.
3. Trigger offpeak ingest sync/async.
4. Goi endpoint history de verify.

## 5) Rollback
- Khong dung endpoint moi.
- Revert commit neu can.

## 6) Verification
- Test endpoint pass (401/403 cho unauthorized, 200 cho admin).
- Payload co latest va history dung format.
