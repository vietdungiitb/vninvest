# Phase B S1 — ServiceRunLog lookup dùng cột phẳng (gates)

- **Plan**: `docs/PLAN_FAST_DATA_SERVICE_20261121.md` REV.2 · **Claim**: `fast-data-b` · **Branch**: `feat/fast-data-b`

## Thay đổi

- `models.py`: +3 cột (`trigger`, `queue_tier`, `parent_run_log_id`) + 3 index + `save()` dual-write (choke point duy nhất — không có bulk path nào, đã grep).
- `migrations/0014`: AddField + RunPython backfill batched 2000, idempotent, **`atomic = False`** (O1 — không giữ lock DDL suốt backfill 1.78M row).
- `migrations/0015`: 3× `AddIndexConcurrently`, `atomic = False` (bảng 1.2GB).
- 5 lookup đổi sang cột: `tasks.py:787,912,927` + `dataops_market_data.py:596,810`.
- Test mới `test_run_log_columns.py` (5 test: functional + index tồn tại).

## Gates (VPS, DB tạm `fastdata_b`, direct core-db)

| Gate | Kết quả |
|---|---|
| fail-before (base, symbol absent) | 0 hit → 4 errors đỏ |
| pass-after (branch) | 5/5 OK (S1) · 76 tests OK (S1 + test_soc_tasks + scheduler_s04) |
| makemigrations --check | clean (state khớp, không thiếu migration) |
| EXPLAIN | `Index Scan using runlog_svc_trg_tier_time_idx` (bật khi tắt seqscan trên bảng test rỗng; bảng prod 1.78M row sẽ dùng index theo stats) |
| system-design --check | SẠCH (regen catalog 143 migration, C-003 143) |
| pre-push-gate | 36 PASS (lần push S1) |

## B8 re-audit

- Vòng 1: NEED_REVISION (O1 major: 0014 thiếu atomic=False; O2/O3 minor runbook; O4 index test).
- Vòng 2 (sau fix): PASS. O1 đóng (atomic=False + comment idempotent). O4 đóng (test introspection).

## CHƯA CHẠY / lưu ý deploy

- Đo mean pg_stat sau deploy 1h (mục tiêu < 50ms) — bằng chứng hiệu quả thật.
- Backfill 1.78M row chạy trong entrypoint migrate (one-time, ~phút). Re-run an toàn (idempotent) nếu fail.
- CONCURRENTLY fail → runbook: kiểm tra INVALID index + DROP CONCURRENTLY rồi migrate lại.
- **Sự cố deploy thật 2026-11-21**: 0014 gộp (AddField+backfill, atomic=False) bị kill giữa backfill → rerun crash `column "trigger" already exists` → api crash-loop. ĐÃ SỬA: tách 0014 DDL-only (atomic) + 0015 backfill (atomic=False, idempotent) + 0016 CONCURRENTLY; staging DROP 3 cột partial rồi deploy lại chuỗi sạch. Catalog 144 migration.

## B8 vòng 3 (migration tách) — PASS. O1 đóng (atomic=False + comment idempotent). O4 đóng (test introspection).

## Deploy #2 + sự cố backfill thứ 2 (pgbouncer server cursor)

- Deploy 0014→0015→0016: 0014 OK; 0015 backfill crash `InvalidCursorName` — `qs.iterator()` mở server-side cursor, chết giữa chunk qua pgbouncer transaction mode. Containers crash-loop.
- Fix repo (0015): keyset pagination (`pk__gt` + LIMIT, không server cursor).
- Fix staging: single-statement SQL UPDATE (1.233.565 row / 1m45s) — chứng minh lock DB trực tiếp rẻ hơn ORM loop qua pooler hàng chục lần.
- Verify sau fix: mismatch = 0; 3 index VALID + đúng định nghĩa; duration_ms percentile + Playwright E2E chạy sau deploy sạch.

## Next

- PR `feat/fast-data-b` → merge → deploy staging → đo pg_stat + verify E2E (Owner-gated).
- Sau đó Phase C (S2 self-throttle) — slice riêng.
