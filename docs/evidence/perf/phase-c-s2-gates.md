# Phase C S2 — gates evidence (slice `phase-c-s2`)

- **Date**: 2026-11-21 · **Branch**: `feat/phase-c-s2` · **Plan**: `docs/PLAN_PHASE_C_S2_20261121.md` REV.1 (+O7/O8/O9 patch) · **Audit**: `docs/evidence/perf/phase-c-s2-plan-audit.md` (B3 NEED_REVISION → REV.1 → round 2 AGREE).

## B1 baseline (đọc code, không đoán)

- Storm: `refresh_global_symbol_coverage` (`global_symbol_coverage.py:466-489` cũ) build 5 payload/mã (aggregate + first + count trên bảng triệu row) + 5 upsert; caller `data_ingest/tasks.py:270-302` loop từng mã mỗi ingest (file vet-finish — chỉ đọc), caller 2 `session_facts_engine.py:393-396`.
- Readers fail-safe: `promotion_fast_path.py:60-79` (None/MISSING/STALE → plan repair; FRESH → skip).
- Nhịp ingest nhanh nhất 60-180s (`settings.py:746-756`); T mặc định 600s.
- Tests cũ: mọi test gọi refresh đúng 1 lần/registry (test file dòng 87, 144, 224-225, 269-270, 319, 354, 452, 521).

## Fail-before (RED) — VPS, DB tạm `phasec_s2`, đã DROP + remove worktree (verify độc lập)

- `manage.py test market_data.tests.test_global_symbol_coverage.GlobalSymbolCoverageThrottleTestCase` trên code cũ: **2 fail đúng như thiết kế**:
  - `test_second_immediate_refresh_skips_heavy_queries`: `AssertionError: 22 != 2` (22 queries: resolve + 13 payload + 5 get_or_create lookup + 2 tail + savepoints).
  - `test_second_refresh_with_registry_instance_uses_single_query`: `AssertionError: 21 != 1`.
  - 4 guard tests (AC1b/1c/3/4) pass trên code cũ (đúng vai trò guard).

## Vòng sửa 1 — atomic trong persist path

- Lần chạy pass đầu (code S2 chưa tách atomic): skip đúng nhưng `assertNumQueries` đếm SAVEPOINT/RELEASE của TestCase (4≠2, 3≠1).
- Fix: tách `_persist_coverage_payloads` bọc `@transaction.atomic`, `refresh_global_symbol_coverage` không decorator ⇒ skip path 0 transaction overhead. Không đổi hành vi recompute.

## Pass-after (GREEN) — VPS, DB tạm `phasec_s2`, đã DROP + remove worktree (verify độc lập)

- `manage.py test market_data.tests.test_global_symbol_coverage market_data.tests.test_gap_inventory`: **30/30 OK / 1.5s** (24 cũ + 6 mới).
  - AC1: refresh lần 2 (str) đúng 2 queries; instance đúng 1 query; trả về 5 model instances theo DATASET_ORDER.
  - AC1b: đổi reference date (dù T=1e9) ⇒ recompute, `detail.reference_trade_date` cập nhật.
  - AC1c: cached MISSING ⇒ recompute.
  - AC3: rows cũ hơn T ⇒ recompute. AC4: T=0 ⇒ luôn recompute.
  - AC5: toàn bộ test cũ xanh (không sửa test cũ).

## Gates khác

- `check-multi-agent`: PASS (320 claims; warnings tiền lệ, không chặn).
- `agent-preflight --staged`: OK trước mỗi commit.
- `normalize-eol --fix`: đã chuẩn hóa 2 file (test + code, blob LF); numstat khớp (test 142/1, code 78/0 + 13/6).
- `makemigrations --check`: **No changes detected** (không migration mới).
- `tsc --noEmit`: exit 0 (FE không đổi).
- `pre-push-gate`: **36/36 PASS** mỗi lần push.

## O5 amendment (đóng tại B7 theo hẹn audit)

- T=600 lệch chữ REV.2 ("= nhịp ingest nhanh nhất", env default 180s) nhưng nằm trong mọi fresh-window (`_SNAPSHOT_FRESH_WINDOW` 15m, `_INTRADAY_FRESH_WINDOW` 1h, `_SESSION_FACTS_FRESH_WINDOW` 30m) ⇒ bound an toàn.
- Worst-case đã lượng hóa (audit round 2): truth tụt FRESH→STALE trong cửa sổ T ⇒ trễ repair ≤ 600s, không mất hẳn (planner + promotion đọc state cũ, fail-safe hướng repair).
- Registry summary (`freshness_state_summary`) có thể stale ≤ T — chỉ là dữ liệu hiển thị; planner/promotion đọc coverage trực tiếp.

## CHƯA CHẠY

- Deploy staging + verify pg_stat/queue-depth/E2E (AC6) — Owner-gated (cần merge PR + `deploy-staging.sh`).
