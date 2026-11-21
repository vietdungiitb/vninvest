# Phase A — S3 bounded async audit write + S0 đo (gates)

- **Plan**: `docs/PLAN_FAST_DATA_SERVICE_20261121.md` REV.2 · **Claim**: `fast-data-a` · **Branch**: `feat/fast-data-a`
- **Lessons**: [L-001, L-002, L-003, L-G01, L-G02, L-B01, L-T01, L-T02, L-V01, L-V02, L-V04]

## S0 — đo memory/pool VPS (read-only, 2026-11-21)

| Container | CPU | MEM | Nhận xét |
|---|---|---|---|
| vninvest-core-api | 0.10% | 343.9/512MiB (67%) | chật — không chỗ cho thêm daphne proc |
| vninvest-core-db | 10.37% | 686MB/2GB | bận sustained (khớp bão hòa bởi background loops) |
| vninvest-pgbouncer | 26.57% | 7.8/64MB | rất cao cho pooler — churn + volume query lớn |
| vninvest-core-redis | 0.88% | 841.8MB/1GB (84%) | chật |
| prefetch worker | 8.89% | 612MB/2GB | — |

- `SHOW POOLS`: CHƯA XÁC MINH (không có admin creds, không đoán).
- Kết luận S0: S4 (tăng daphne worker trong container api) KHÔNG khả thi với headroom hiện tại → S4 hoãn, cần container riêng hoặc tuning khác (ghi backlog).

## S3 — implement + test (TDD)

- Fail-before: symbol `flush_audit_events`/`audit_executor` = 0 hit trên code base (`origin/dev`) → test mới đỏ.
- Pass-after (VPS, DB tạm `fastdata_a`, direct core-db, `--keepdb`): **68 tests OK / 2.163s** (`test_async_audit_write` 4 + `test_tenantreg_b` 64).
- Warnings trong output là log paths có chủ đích (fallback + worker-error tests).
- Phát hiện khi test: worker thread dùng connection riêng → INSERT không rollback theo TestCase ⇒ test dùng resource_id duy nhất + tearDown dọn (đã fix, commit riêng).

## cross_ref — KHÔNG cần đổi code (đính chính claim)

Claim ghi "cross_ref compat" nhưng diff không chạm `identity_access/tasks.py`: đúng là không cần — task chạy mỗi 60s trên dữ liệu ≤1h, delay sub-second của async write không ảnh hưởng matching (±10s window). Ghi nhận để claim khớp diff.

## B8 re-audit: PASS (0 blocker, 0 major)

- Executor bounded (2), fallback sync + log, failure log không nuốt, flush không race, tenantreg_b không sót assert sync.
- 1 minor follow-up (backlog, không chặn merge): cap backpressure hàng đợi (`_pending_futures` vô hạn) — burst 10k+ có thể phình memory.

## CHƯA CHẠY

- Full BE suite, E2E Playwright percentile sau deploy (cần merge + deploy staging — Owner-gated).
- `SHOW POOLS` (không creds).
