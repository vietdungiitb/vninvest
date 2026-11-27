# Kế hoạch triển khai SSOT adj_close — chương trình 6 Phase (2026-11-27)

**Lessons áp dụng:** [L-V01, L-V02, L-V04, L-002, L-003, L-007, L-T01] · FILES READ: `docs/LESSONS/verification.md`, `docs/LESSONS/multi-agent.md` (phiên này).

## 1. Mục tiêu & nguồn thiết kế

Thực thi `SSOT_ADJUSTMENT_DESIGN_REV2_20261127.md` (D-01..D-07) + `SSOT_DECISIONS_REV2_20261127.md` (D-08 Anchor A, D-09 DNSE Tier 2). Nguyên tắc: `adj_close` SSOT; CafeF chỉ đối chiếu; tự tính toàn chuỗi khi có event; bulk nhiều provider song song; 429/418 failover trong cùng batch.

## 2. Baseline đo được (lệnh tái hiện)

| Hạng mục | Lệnh tái hiện | Kết quả (tại `feat/ssot-phase1` claim commit `1af793bd5`) |
|---|---|---|
| HEAD 2 repo | `git log --oneline -1` ở mỗi repo | vninvest `1af793bd5` (plan + evidence **đang untracked**: `?? docs/PLAN_SSOT_IMPLEMENTATION_20261127.md`, `?? docs/evidence/ssot-implementation/`), vnbroker `b171b23` (branch `feat/ssot-phase1`, sạch sau claim) |
| Sync | `pwsh -File scripts/agent-sync.ps1` | OK, 0 trùng migration |
| Gate | `node scripts/pre-push-gate.mjs` | 36 PASS / 0 FAIL |
| Unit trước đó | `python -m pytest packages/core/backend/src/market_data/tests/test_price_integrity.py packages/core/backend/src/market_data/tests/test_cafef_importer_normalize.py packages/core/backend/src/market_data/tests/test_cafef_paced_fetch.py packages/core/backend/src/market_data/tests/test_cafef_fetcher_end_date.py packages/core/backend/src/market_data/tests/test_check_price_integrity_command.py packages/core/backend/src/market_data/tests/test_cafef_integrity_task.py packages/core/backend/src/market_data/tests/test_cafef_fallback.py packages/core/backend/src/market_data/tests/test_rebase_fallback_task.py -q` | 32 + 22 + 9 passed (các lần chạy trước, đã log trong ledger Entry 661–674; không chạy lại trong slice này) |
| BE full local | `python -m pytest packages/core/backend/src/market_data/tests/ -q` | **CHƯA CHẠY** — `OperationalError: connection timeout expired` |
| literal 418 | PowerShell: `Set-Location 'D:\Mujoco Projects\vnbroker'; grep -r "418" vnbroker --include=*.py -l` | 0 hit |
| retry async | `Select-String -Path async_client.py -Pattern '_is_retryable_status'` | `:314` = `status_code == 429 or status_code >= 500` |
| bulk futures | `Select-String -Path bulk_router.py -Pattern 'max_workers=len|_fetch_batch'` | `:150` + `:153` = 1 future/provider, `parallel=True` bên trong |

## 3. SCOPE / LIMIT / non-goals / rollback

- **SCOPE chương trình**: 6 Phase như bảng §4. Slice hiện tại = **Phase 1 (vnbroker)** + tài liệu kế hoạch.
- **LIMIT**: tối đa 3 vòng sửa/bước; quá → blocker + dừng. Mỗi Phase là 1 claim + PR riêng.
- **Non-goals**: backfill CafeF, đổi flag, lưu secret, đụng dữ liệu staging trước Phase 2 có backup.
- **Rollback**: `git show HEAD:<file> > <file>` (KHÔNG `git checkout --`, L-A01); file LF, `git diff --numstat` khớp dự kiến.

## 4. Chương trình 6 Phase (theo Rev.2)

| Phase | Repo | Việc | Exit gate |
|---|---|---|---|
| 0 | vninvest+VPS | probe phủ 1834 mã + benchmark ≥100 mã (VCI/KBS/DNSE ramp) | Có số liệu VPS; STOP nếu phủ <95% |
| **1 (slice này)** | vnbroker | D-05: `RateLimitError` cho 418+429; bỏ 429 khỏi retry async; limiter protocol sync+async; work-queue per-symbol + requeue; luôn gắn `attrs['symbol']` | TDD fail-before mock 418/429 giữa batch → provider khác gánh 100%, 0 `"unknown"`; pytest/ruff/mypy |
| 2 | vninvest | D-01/D-03/D-08: migration `base_as_of`/`adj_basis`/rights; anchor A; backup + rollback | `adj_close IS NULL=0`, integrity 0, đối chiếu anchor vs CafeF |
| 3 | vninvest | D-02/D-04: `AdjustmentService` DIV/ISS/Rights + sample return-ratio | FPT ex-date = 43500; recompute 2 lần cùng kết quả; PARTIAL fail-closed |
| 4 | vninvest | Phần app của D-05 (Redis limiter inject) + D-06 consumer | benchmark VPS; chart không cắt 2026; tsc/build/gate |
| 5 | vninvest | CafeF chỉ đối chiếu; freshness SLO; dọn legacy sau 7 ngày | 7 ngày integrity ok + freshness ≥99,5% |

## 5. AC chi tiết — Phase 1 (fail-before)

- **AC1** (Given response 418 hoặc 429 / When sync `client.py` hoặc async `async_client.py:314` xử lý / Then) ném `RateLimitError` **có `retry_after`**, **không retry cùng provider**; `exceptions.py:292` phải xử lý `RateLimitError` **trước** `ConnectionError` ở `dnse/quote.py:139-140`.
- **AC2** (Given 1 provider dính rate-limit giữa batch 100 mã / When `BulkRouter.fetch_history()` (`bulk_router.py:95`) qua façade `BulkAPI.history()` (`api/bulk.py:41`) / Then) symbol chưa xong được provider khác xử lý **trong cùng lời gọi**, `symbols_missing=0`. Bắt buộc sửa luồng nuốt lỗi `vci/quote.py:439-442`, `vci/quote.py:496-507`, `kbs/quote.py:261-262`, `kbs/quote.py:266-269` để exception tới `bulk_router.py:460`/`:267-270`.
- **AC3** (Given provider trả ít frame hơn số symbol / When gom kết quả / Then) mỗi frame có `attrs['symbol']` đúng, **0 frame `"unknown"`** — sửa `api/bulk.py:108` và nhánh `len(frames)!=len(symbols)` tại `bulk_router.py:512-520`.
- **AC4** (Given limiter đã cấu hình / When sync + async gửi request / Then) cùng **1 per-provider budget** (không double-throttle); protocol inject được, mặc định in-memory.
- **AC5** (DNSE, D-09): mock DNSE trả 418 và 429 → cooldown + requeue; `_FAILOVER_MARKERS` (`dnse/quote.py:125-129`) có `"418"`; `dnse/quote.py:462-470` không nuốt `RateLimitError`; **deep backfill không gọi DNSE**, cap 1–2 worker + budget riêng.
- **AC6**: `tests/examples/vci_perf_benchmark.py` đếm cả `418` vào `throttled_responses`.
- **AC7 (sửa vòng 3 + reservation R1, backward-compatible)**: **giữ nguyên** `apply_profile()` (`performance_profiles.py:92-98`) và 3 caller cũ `tests/examples/perf_profile_runner.py:36,41`, `tests/examples/auto_source_benchmark.py:333`, `tests/unit/core/test_performance_profiles.py:28-31` — không đổi hợp đồng public. **Tái dùng `get_profile(name)` có sẵn** (`performance_profiles.py:83-89`, đã trả dict thuần) cho đường bulk mới (`BulkRouter`/client inject), **không thêm `profile_values`**, không đọc/ghi `os.environ` trong đường mới. Vì thế không có caller cũ nào im lặng hết tác dụng.

### 5.1 File bắt buộc chạm trong Phase 1 (bổ sung theo audit)
`core/exceptions.py` · `core/utils/client.py` · `core/utils/async_client.py` · `core/bulk_router.py` · `api/bulk.py` · `explorer/vci/quote.py` · `explorer/kbs/quote.py` · `explorer/dnse/quote.py` · `core/performance_profiles.py` (**chỉ dùng `get_profile`, giữ `apply_profile`**) · `tests/examples/vci_perf_benchmark.py` · tests fail-before tương ứng. **Giữ nguyên, không sửa**: `tests/examples/perf_profile_runner.py`, `tests/examples/auto_source_benchmark.py`, `tests/unit/core/test_performance_profiles.py`. Không đụng migration, không file deny-list của vninvest.

## 6. Checklist lessons

- [x] L-V01: mọi số kèm lệnh; control = test fail-before thật.
- [x] L-V02: phản biện audit đã tự kiểm chứng bằng source trước khi code.
- [x] L-V04: assert có giá trị thật (`symbols_missing=0`, `attrs['symbol']`), không assert rỗng.
- [x] L-002/L-M02: claim branch `feat/ssot-phase1` khớp tên agent `ssot-phase1`.
- [x] L-003: sync chạy trước gate.
- [x] L-007: BE full suite local ghi `CHƯA CHẠY`.
- [x] L-T01: normalize EOL + numstat sau mỗi lần ghi.

## 7. B3/B4

Audit kế hoạch do subagent read-only (model khác) thực hiện 3 vòng: `docs/evidence/ssot-implementation/AUDIT_PLAN_PHASE1.md` (NEED_REVISION), `AUDIT_PLAN_PHASE1_V2.md` (NEED_REVISION), `CONSENSUS_PHASE1_20261127.md` (**AGREE** + R1–R3 đã áp dụng). B4→B5 đã mở.

## 8. Trạng thái

Phase 1: **in-progress** — chờ audit kế hoạch.
