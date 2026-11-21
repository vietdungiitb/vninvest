# B8 re-audit độc lập — slice `phase-c-s2` (callee-side self-throttle coverage refresh)

- **Ngày**: 2026-11-21 · **Auditor**: subagent độc lập (chỉ đọc, không sửa code)
- **Branch**: `feat/phase-c-s2` @ `91ac1023a` · **Plan**: `docs/PLAN_PHASE_C_S2_20261121.md` REV.1
- **Audit plan**: `docs/evidence/perf/phase-c-s2-plan-audit.md` (Round 2 AGREE + reservation O7–O9)
- **Gates evidence**: `docs/evidence/perf/phase-c-s2-gates.md`
- **Verdict**: **PASS** — 0 blocker, 0 major, 1 minor (M1, không chặn) → đóng B8, sang B9.

## 1. Code `global_symbol_coverage.py` — khớp toàn bộ checklist S2

- Hằng số: `COVERAGE_THROTTLE_SETTING` (`global_symbol_coverage.py:475`), default 600 (`:476`), comment bound 600s ≥ nhịp ingest 60–180s và ≈ rotation 9 phút ✓.
- `_SKIP_ELIGIBLE_STATES = {FRESH, WARM}` (`:478-484`) — MISSING/ERROR/STALE/UNKNOWN ⇒ recompute, đúng O3/REV.2 ✓.
- `_resolve_coverage_throttle_seconds` try/except → default (`:487-491`) ✓.
- `_should_skip_coverage_refresh` (`:494-520`) đủ cả 3 điều kiện + guards:
  - `T <= 0 ⇒ False` short-circuit (`:502-503`) — O8a, AC4 cùng `as_of` (age=0, `0<0=False`) ⇒ luôn recompute ✓;
  - đủ 5 rows (`:504-505`) + `seen_datasets == set(DATASET_ORDER)` (`:520`, chặt hơn plan — chống duplicate dataset) — AC2 bootstrap (0 rows ⇒ recompute) ✓;
  - `isinstance(row.detail, dict)` defensive (`:508`) — O8b ✓;
  - mọi `detail.reference_trade_date == requested` (`:509-510`) — O1, legacy thiếu key (`None != iso`) ⇒ recompute fail-safe ✓;
  - state ∈ {FRESH,WARM} (`:511-512`) — O3 ✓;
  - `last_verified_at None ⇒ False` (`:513-515`) ✓;
  - strict `age < T` (`:516-518`, viết `if not age < T: return False` ≡ `age >= T`) — O4 ✓.
- Skip path (`:551-566`): không recompute, **không gọi** `refresh_global_symbol_registry`, trả full model instances (không `.values()`) sắp theo `DATASET_ORDER` — O7 ✓; `logger.debug` symbol + min-age + T (`:561-566`) ✓.
- `refresh_global_symbol_coverage` **không đổi signature** (`:536-541`) ✓; `@transaction.atomic` chỉ còn trên `_persist_coverage_payloads` (`:523`), skip path 0 transaction overhead (vòng sửa 1, đã ghi ở gates.md — behavior-preserving, không phải lệch plan) ✓.
- Không migration: không đụng `models.py`; lookup dùng index `mktdata_gsc_reg_dataset_idx` có sẵn ✓.
- Thứ tự payloads full path (daily, snapshot, bars, ticks, session_facts — `:567-573`) khớp `DATASET_ORDER` (`:25-31`) ✓.

## 2. Tests — `GlobalSymbolCoverageThrottleTestCase` (`test_global_symbol_coverage.py:548`), 6/6 đạt yêu cầu

| Test | Dòng | AC | Nhận xét |
|---|---|---|---|
| `test_second_immediate_refresh_skips_heavy_queries` | `:580-602` | AC1 str ≤ 2 | `assertNumQueries(2)` exact + assert 5 rows + cùng `dataset` order + cùng `pk` set ⇒ skip trả đúng rows cũ ✓ |
| `test_second_refresh_with_registry_instance_uses_single_query` | `:604-615` | AC1/O7 instance ≤ 1 | `assertNumQueries(1)` exact ✓ |
| `test_refresh_recomputes_when_reference_date_changes` | `:617-635` | AC1b/O1 | T=1e9 vẫn recompute khi đổi ngày; assert `>2` queries + mọi row `detail.reference_trade_date == next_day` (bao phủ cả nội dung, không chỉ đếm query) ✓ |
| `test_refresh_recomputes_when_cached_state_missing` | `:637-659` | AC1c/O3 | setup chỉ 1 DailyPrice cũ ⇒ daily STALE + snapshot MISSING; assert `>2` + snapshot vẫn MISSING ✓ |
| `test_throttle_disabled_when_T_zero` | `:661-673` | AC4/O4+O8 | T=0, cùng `as_of` ⇒ recompute ✓ |
| `test_stale_verified_rows_recomputed` | `:675-687` | AC3 | 9:00 → 14:30 (5.5h = 19800s > T=600) ⇒ recompute ✓ |

- **L-V04 dương tính đi kèm**: CÓ — 2 test skip dương chứng minh cơ chế tồn tại + 4 guard âm chứng minh tính chọn lọc; vai trò fail-before đúng (2 skip fail `22≠2`/`21≠1` trên code cũ, 4 guard pass trên code cũ) ✓.
- **Xanh giả**: KHÔNG ở cấp suite — skip path instance=1 / str=2 query nên guard `>2` chỉ pass khi recompute thật; ngược lại AC1 exact `2`/`1` chỉ pass khi skip thật. Hai chiều khóa nhau; AC1b/AC1c còn assert nội dung rows ✓.
- **Không sửa test cũ**: diff chỉ append `142/1` (1 deletion là newline-at-EOF dòng 546), 11 test cũ nguyên vẹn ✓ — tiền đề AC5 đứng vững.

## 3. Plan REV.1 + O7/O8/O9 — implementation khớp, không lệch chưa ghi

- §3.3a (5 rows + ref-date + `isinstance dict` O8) → code `:504-510` ✓; §3.3b ({FRESH,WARM} O3) → `:511-512` ✓; §3.3c (T>0 + `age<T` + None→recompute) → `:502-503,:513-518` ✓; §3 O7 (skip registry tail, full instances, DATASET_ORDER) → `:548-566` ✓.
- O9: prose §2 dòng 15 đã sửa 2 chiều bounded ≤T; gates.md §O5 amendment gộp đủ 3 bounds (T=600 vs REV.2, trễ-repair ≤T, registry-summary stale ≤T) — O5 đóng đúng hẹn B7 ✓.
- Tách `_persist_coverage_payloads` + dời `atomic`: có ghi ở gates.md "Vòng sửa 1", không đổi hành vi recompute — không phải lệch ✓.

## 4. Gates evidence — số liệu nhất quán với code, không claim vượt bằng chứng

- Fail-before `22≠2`/`21≠1`: khớp cấu trúc full path (resolve 1 + ~13 payload aggregate/first/count + 5 upsert lookup + tail 2 + savepoints) ✓.
- Pass-after `30/30 (24 cũ + 6 mới)`: đếm thật — file này 17 methods (11 cũ + 6 mới) + `test_gap_inventory.py` 13 methods = 24 cũ + 6 mới = 30 ✓ khớp từng con số.
- Numstat gates (`test 142/1`, `code 78/0 + 13/6`) khớp `git diff --numstat` từng commit (`c6611bac2` test 142/1; `18d98e0e2` code +78; `91ac1023a` code +13/-6) ✓.
- `makemigrations --check` no-changes: tin được (không đụng models) ✓. AC6 ghi rõ **CHƯA CHẠY** Owner-gated — trung thực, không claim pg_stat/E2E ✓.
- Gates process (`pre-push-gate 36/36`, `tsc`, `check-multi-agent`) kế thừa theo lời evidence, không có gì mâu thuẫn với diff; B8 read-only không re-chạy BE (ghi nhận, không trừ điểm).

## 5. Scope — không chạm file agent khác

- `git diff origin/dev --stat`: đúng 5 files (CLAIMS 1 row `phase-c-s2` + PLAN + plan-audit + code + test) + 1 untracked (`phase-c-s2-gates.md`); `data_ingest/tasks.py` 0 lines ✓.

## M1 (minor, không chặn — ghi nhận cho B9/theo dõi)

- `M1`: age âm khi `T > 0` vẫn skip (`:516-518`: `verified_at` sớm hơn `last_verified_at` ⇒ age âm `< T` ⇒ skip). Production không gặp (`as_of=None ⇒ now()` ở cả 2 caller; clock-skew vài giây trả rows mới hơn — vô hại), AC4 cùng `as_of` ⇒ age=0 ⇒ recompute đúng. O8 chỉ yêu cầu short-circuit `T<=0` (đã có `:502-503`). Không cần sửa ở slice này; tùy chọn pin thêm `age >= 0` nếu muốn chặt tuyệt đối.
