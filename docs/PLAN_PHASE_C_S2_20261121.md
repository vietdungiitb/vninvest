# PLAN Phase C S2 — coverage refresh tự throttle phía callee (slice `phase-c-s2`)

- **Date**: 2026-11-21 · **Vòng loop**: workflow-dev-loop B1→B9 · **Base**: `docs/PLAN_FAST_DATA_SERVICE_20261121.md` REV.2 §Phase C/S2.
- **Lessons áp dụng**: [L-001, L-002, L-003, L-008, L-M02, L-A01, L-T01, L-F07, L-B01, L-B02, L-B03, L-V01, L-V02, L-V04].

## 1. Mục tiêu

Diệt storm 12.6M SELECT + 12.4M UPDATE từ vòng lặp coverage refresh sau mỗi ingest, bằng cách cho `refresh_global_symbol_coverage` tự skip khi coverage vừa verify — không đổi signature, không chạm caller (đặc biệt `data_ingest/tasks.py` do `vet-finish` giữ `in-progress`).

## 2. Bằng chứng đã tự mở đọc (B1)

- `packages/core/backend/src/market_data/global_symbol_coverage.py:466-489` — `refresh_global_symbol_coverage` build 5 payload/mã, mỗi payload gồm aggregate Min/Max + `.first()` + `.count()` trên bảng triệu row (`_build_daily_prices_payload:361,378`; `_build_intraday_payload:387-389,408`; `_build_snapshot_payload:415-416,433`; `_build_session_facts_payload:441-442,459`) + 5 upsert (`_upsert_coverage_row:334-356`).
- `packages/core/backend/src/data_ingest/tasks.py:270-302` (CHỈ ĐỌC — vet-finish giữ) — loop từng mã ingest gọi refresh với `as_of=now` ⇒ recompute toàn bộ dù không đổi.
- `packages/core/backend/src/market_serving/session_facts_engine.py:393-396` — caller thứ 2, theo từng mã upsert, `as_of=None`.
- `packages/core/backend/src/market_data/promotion_fast_path.py:60-79` — reader fail-safe: coverage None/MISSING/STALE ⇒ plan repair (`True`); FRESH ⇒ skip. Skip giữ state cũ ⇒ planner dùng state cũ để lập plan: MISSING/STALE ⇒ vẫn plan repair (không mất việc); FRESH giữ FRESH ⇒ trễ repair ≤ T nếu truth vừa tụt (O9, bound ghi ở evidence B7).
- `packages/core/backend/src/market_data/tests/test_global_symbol_coverage.py` — mọi test hiện tại gọi refresh **1 lần/registry** (dòng 87, 144, 224-225, 269-270, 319, 354, 452, 521) ⇒ throttle theo `last_verified_at` không vỡ test cũ (fail-before sẽ chứng minh).
- `packages/core/backend/src/vninvest_core/settings.py:746-756` — nhịp ingest nhanh nhất 60s (mặc định env 180s); rotation coverage ~9 phút (`:749`).

## 3. Thiết kế (REV.1 — sửa theo audit B3 NEED_REVISION vòng 1: O1–O4)

Trong `refresh_global_symbol_coverage`, sau `_resolve_registry` + tính `verified_at` + `reference_trade_date`:

1. Đọc 1 query indexed `GlobalSymbolCoverage.objects.filter(registry=registry, dataset__in=DATASET_ORDER)` lấy `(dataset, last_verified_at, freshness_state, detail)`.
2. Ngưỡng `T = getattr(settings, 'GLOBAL_MARKET_DATA_COVERAGE_THROTTLE_SECONDS', 600)` (mặc định 600s; amendment O5: REV.2 ghi "= nhịp ingest nhanh nhất" nhưng bound 600s nằm trong mọi fresh-window — ghi amendment ở evidence B7).
3. Skip (không recompute, **không gọi** `refresh_global_symbol_registry`, trả về rows hiện có sắp theo DATASET_ORDER) **khi và chỉ khi cả 3 điều kiện**:
   a. **(O1)** đủ 5 dataset rows **và** mọi `detail.reference_trade_date == reference_trade_date.isoformat()` (cached, 0 query thêm; row legacy thiếu key ⇒ recompute). `detail` phải là `dict` (defensive, **O8**);
   b. **(O3)** mọi `freshness_state` cached thuộc `{FRESH, WARM}` (0 query thêm; MISSING/ERROR/STALE/UNKNOWN ⇒ recompute để không pin repair thừa/thiếu);
   c. **(O4/O8)** `T > 0` (short-circuit: T≤0 ⇒ không bao giờ skip) **và** mọi `last_verified_at` thỏa `age < T` với `age = (verified_at - last_verified_at).total_seconds()` (strict `<`; `last_verified_at` None ⇒ recompute).
   - **(O7)** Skip path fetch full model instances (không `.values()`, giữ kiểu `list[GlobalSymbolCoverage]` như full path) rồi sắp theo DATASET_ORDER.
4. Ngược lại: chạy full path cũ (5 payload + upsert + registry tail) — không đổi hành vi.
5. Log `logger.debug` khi skip (symbol, min-age giây) để đo hiệu quả staging.
6. Không đổi signature (settings-driven); test điều khiển T bằng `override_settings`.

## 4. AC (Given/When/Then)

- **AC1 (O2/O7)**: Given coverage 5 rows vừa verify (<T), cùng reference date, state FRESH/WARM, When gọi refresh lại, Then 0 query nặng — assertNumQueries ≤ 2 với input `str` (registry resolve + coverage lookup; registry tail cũng skip), ≤ 1 với input instance; trả về đúng 5 model instances theo DATASET_ORDER.
- **AC1b (O1)**: Given rows verify 1 phút trước nhưng `reference_trade_date` hôm qua, When refresh với today, Then recompute đầy đủ (không skip qua midnight rollover / target_date khác).
- **AC1c (O3)**: Given 1 dataset MISSING (4 còn lại FRESH, vừa verify), When refresh, Then recompute (không pin MISSING ⇒ không đẻ repair thừa; không pin FRESH quá T).
- **AC2**: Given chưa có row (mã mới), When gọi refresh, Then compute đầy đủ 5 rows (không skip) — fail-safe bootstrap.
- **AC3**: Given rows cũ hơn T, When gọi refresh, Then recompute đầy đủ.
- **AC4 (O4)**: Given T=0 (override_settings), When gọi 2 lần liên tiếp cùng `as_of`, Then lần 2 vẫn recompute (strict `age < T` tắt throttle được).
- **AC5**: Toàn bộ test cũ `test_global_symbol_coverage.py` + `test_gap_inventory.py` xanh (không sửa test cũ).
- **AC6 (staging, Owner-gated)**: sau deploy, pg_stat coverage SELECT/UPDATE giảm ≥ 80% trong 1h; không dispatch storm; E2E stock cải thiện (đo, không suy).

## 5. SCOPE / LIMIT / Non-goals / Rollback

- **SCOPE**: `packages/core/backend/src/market_data/global_symbol_coverage.py` (1 hàm + hằng số T) + `packages/core/backend/src/market_data/tests/test_global_symbol_coverage.py` (chỉ THÊM test mới, không sửa test cũ) + `docs/evidence/perf/phase-c-s2-gates.md` + ledger Entry.
- **LIMIT**: tối đa 3 vòng sửa/bước; không migration (không đổi model).
- **Non-goals**: KHÔNG chạm `data_ingest/tasks.py` (vet-finish giữ), deny-list, `CONN_MAX_AGE`, daphne settings; KHÔNG throttle `refresh_gap_scores` (slice khác nếu cần); KHÔNG đổi signature (settings-driven).
- **Rollback**: revert 1 hàm (pure logic + test mới), không đụng DB.

## 6. Gates

`check-multi-agent` · `agent-preflight --staged` trước mỗi commit · `normalize-eol --fix` + `git diff --numstat` sau mỗi lần ghi file · BE test trên VPS DB tạm (`phasec_s2`, DROP sau) · `makemigrations --check` (kỳ vọng no-changes) · `tsc --noEmit` (FE không đổi — chạy để chắc) · pre-push-gate 36/36 · B8 re-audit độc lập.
