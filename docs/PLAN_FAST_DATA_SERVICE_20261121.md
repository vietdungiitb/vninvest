# PLAN — Dịch vụ dữ liệu nhanh nhất (`/stocks/:symbol` + toàn API)

- **Ngày**: 2026-11-21 · **Agent**: (khai ở B5) · **Vấn đề**: API 5–12s/request, stock ~30s. F-07 đã xong (hết 301).
- **Lessons áp dụng**: [L-001, L-002, L-003, L-G01, L-G02, L-B01, L-T01, L-T02, L-V01, L-V02, L-V04, L-S02]
- **B1 baseline (đo thật, read-only)**: view query ORM 2–14ms (control) · `duration_ms` p50 10–17s mọi path · pg_stat: JSONB tier-run lookup 31.286 calls × 6,2s (53,5h tổng) · coverage SELECT 12,6M + UPDATE 12,4M · DailyPrice COUNT(*) 2,5M · audit INSERT 353k calls · 2 daphne proc, sync `thread_sensitive=True` (Entry 754) · CONN_MAX_AGE=0 giữ nguyên (by design).

## Mục tiêu (Given/When/Then) — BẢN SỬA REV.2 sau audit độc lập (verdict NEED_REVISION)

Thứ tự thực thi sửa theo audit O3: **Phase A (request path) → Phase B (DB saturation) → Phase C (background)**.

### Phase A — request path (làm trước)

**S3 — audit INSERT rời critical path** (Owner đã duyệt có điều kiện):
- Given `RequestTraceMiddleware:74` ghi sync mỗi request; When chuyển sang executor **có giới hạn (bounded)** + fallback sync khi reject + log (không drop âm thầm), và update `cross_ref_pat_audit_events` (`identity_access/tasks.py:507-551`) + test `tenantreg_b` (`:446,455,711-753` assert đồng bộ → chuyển sang chờ executor drain trong test); Then client p50 giảm, ACCESS rows vẫn đủ.
- AC: test tenantreg_b xanh sau update; probe 1h không mất dòng ACCESS nào (đếm request vs rows).

**S0 — đo memory/pool** (read-only, xong trước khi đụng S4): container api memory headroom, pgbouncer `SHOW POOLS` (nếu có creds, không thì ghi CHƯA XÁC MINH).

### Phase B — DB saturation

**S1 — `_get_latest_queue_tier_run` hết scan JSONB** (bổ sung sau O2):
- Thêm cột thật `trigger`, `queue_tier` + composite index; **data migration backfill** từ `input_summary` (bắt buộc — cột NULL ⇒ scheduler coi tier due ⇒ dispatch storm); **dual-write** tại mọi creation site (`tasks.py:352,1234+`, `global_symbol_planner.py:362-374`); đổi query `tasks.py:787-792` sang cột mới; **sibling lookups** cùng đợt: `tasks.py:912,927` (`parent_run_log_id`), `dataops_market_data.py:596,810-811` (request path); index tạo bằng `CONCURRENTLY` nếu bảng lớn (đo size trước, phối hợp VPS).
- AC: pg_stat mean < 50ms sau 1h; BE test service_ops xanh; không dispatch storm sau deploy (giám sát queue depth 30 phút).

### Phase C — background

**S2 — coverage refresh tự throttle phía callee** (sửa scope sau O1 — KHÔNG chạm `data_ingest/tasks.py`):
- `refresh_global_symbol_coverage` tự đọc coverage hiện tại: skip nếu `last_verified_at` mới hơn ngưỡng **T** (mặc định = chu kỳ ingest nhanh nhất, ghi rõ) VÀ `freshness_state` không đổi hướng xấu; không đổi signature, không cần caller flag.
- Readers đã re-check: `promotion_fast_path.py:66-77` (FRESH/dedup-age ⇒ fail-safe: skip ⇒ state cũ ⇒ plan thêm việc, không mất repair), planner `coverage_ok`, SOC UI, gap inventory. O5: ngưỡng T + danh sách readers ghi trong evidence.
- AC phụ O6: DailyPrice COUNT(*) 2.5M chủ yếu từ `_build_daily_prices_payload:378` (`detail.row_count`) ⇒ S2 throttle cũng diệt; nếu còn hot query request-path khác thì mở slice mới (không nhồi).

**S4/S5**: daphne workers (sau S0) · FE bootstrap (slice riêng). **Verify E2E**: mục tiêu `auth/me` p50 < 2s, overview p50 < 3s.

## SCOPE (file được chạm) — REV.2

- Phase A: `packages/core/backend/src/ops_audit/middleware.py` (bounded executor + fallback) + `identity_access/tasks.py:507-551` + test tenantreg_b (update sync→drain)
- Phase B: `packages/core/backend/src/service_ops/models.py` (2 field + index) + migration schema + **data migration backfill** + `service_ops/tasks.py:787-792,912,927` + creation sites dual-write + `service_ops/dataops_market_data.py:596,810-811` + test BE
- Phase C: `packages/core/backend/src/market_data/global_symbol_coverage.py` (self-throttle trong callee, KHÔNG chạm `data_ingest/tasks.py`)
- `packages/core/backend/src/ops_audit/middleware.py` + `identity_access/tasks.py:507-551` + test tenantreg_b
- `docs/PLAN_*.md`, `docs/evidence/perf/*`, ledger Entries

## Non-goals / LIMIT

- KHÔNG chạm: `data_ingest/tasks.py` (vet-finish giữ), deny-list, `CONN_MAX_AGE`, settings daphne khi chưa có số liệu
- KHÔNG tự đặt số migration; KHÔNG `npm/pip install`; tối đa 3 vòng sửa/bước
- BE test + migration trên VPS staging (DB tạm riêng), theo runbook §12

## Rollback

- S1/S3: revert code + migration (giữ DB, không mất dữ liệu — chỉ thêm cột/index)
- S2: revert 1 hàm (pure function, có test)
