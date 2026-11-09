# PLAN — B1 AI contract BE core (W1.1) — 2026-11-09 (B2 REV2)

> **For agentic workers:** REQUIRED SUB-SKILL: `workflow-dev-loop` — B3/B4 verdict bằng văn bản trước claim. **Plan này là B2 REV2 — chưa B3 v2/B4 v2, chưa claim, chưa viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6). B3 vòng 1 NEED_REVISION (5 OBJ); rev2 này đóng cả 5 OBJ.**

**Goal:** BE trả hợp đồng kỹ thuật-only (`posture` BULLISH/BEARISH/NEUTRAL + `levels` support/resistance), không còn `signal/target_price/recommendation` trong orchestrator return schema, structured_output mới, và advisory API response. `side` **giữ lại** dạng derived từ `posture` (không phải read `signal`) để không phá FE chưa cập nhật — ghi rõ trong Acceptance (B3 OBJ-1).

**Architecture:** (1) Orchestrator `:863-891` bỏ 4 keys cũ, chỉ trả `posture` (chuẩn hoá enum) + `levels` + `summary`/`confidence_score`/`rationale`/`risk_level`. (2) Tasks `_build_structured_output` lấy `posture` từ result (không còn `signal`/`recommendation` fallback), fail-closed khi posture thiếu/illegal. (3) Serializers đọc `structured_output.posture` + derive `side` từ posture qua `normalize_signal` (backfill dữ liệu cũ chỉ có `signal` bằng SSOT — đọc posture trước, fallback signal cũ qua normalize). (4) `portfolio_analytics_views.py:3252-3253` fallback `structured.get('posture')` trước `get('signal')` để endpoint symbol-stats không thành UNKNOWN (B3 OBJ-2). (5) `advisory/views.py:912` `_extract_backtest_side` thêm key `'posture'` ở đầu loop, bỏ `'recommendation'` (B3 OBJ-3). Không đụng `signal_norm.py`. FE/i18n/disclaimer defer.

**Tech Stack:** BE only (Django + DRF), VPS staging (`docker cp` + restore).

**Spec:** `docs/PLAN_NEXT_DIRECTION_20261109.md` §B1 + `docs/evidence/b1-ai-contract/B1_MEASURE_20261109.md`.

## Global Constraints

- Không `npm/pip install` · không migration · không chạm deny-list.
- **Không sửa FE/i18n** (`vi.js`, `en.js` stale claims :1237,:1239,:1625,:1695,:1726,:1831 — tuân thủ §3; ghi claim + deferred).
- Không đọc tiếng Việt qua console shell (luật cứng #4) — đọc bằng tools đọc file.
- Mọi số kèm lệnh tái hiện; chưa chạy = `CHƯA CHẠY`.

## Review Focus

- **L-V02**: posture đã đúng JSON ở `orchestrator.py:722-726`; không tái hiện toàn bộ LLM, chỉ unit-test `_build_structured_output` + serializer qua fixture.
- **L-V04**: không assert None-get; phải có test cả hai chiều (posture→side có/không).
- Không đổi `signal_norm.py` (SSOT giữ nguyên, có `BULLISH→BUY`, `BEARISH→SELL`, `NEUTRAL→HOLD` tại `:39,44,48`).
- Dữ liệu cũ chỉ có `signal`: backfill qua `signal_norm` ở serializer (không ghi mới).

---

## Baseline exit-code tại HEAD (B2 REV2)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** |
| Lessons | `node scripts/check-lessons.mjs` | **PASS** (14 file, 57/60) |
| EOL | `node scripts/normalize-eol.mjs` | **OK** (0 thay đổi) |
| Baseline pytest (B2) | `python -m pytest packages/core/backend/tests/test_advisory_orchestrator_contract.py packages/core/backend/tests/test_advisory_api_contract.py -q --tb=no` | **16/16 PASS** (trước thay đổi) |
| Audit claims | tra `CLAIMS.md` cho 3 file | **không có in-progress** — `check-multi-agent` PASS; `portfolio_analytics_views.py` có `in-progress` claim tại `CLAIMS.md:962` (Opencode file-disjoint check sẽ chặn nếu chạm mà không claim — tới vòng claim sẽ ghi claim cho 2 file cross-consumer rõ ràng) |

**Lessons áp dụng:** [L-001, L-002, L-003, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01]

## SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE:** `packages/core/backend/src/advisory/orchestrator.py` + `tasks.py` + `serializers.py` + `packages/core/backend/src/advisory/views.py` + `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` + `packages/core/backend/tests/test_advisory_orchestrator_contract.py` + `test_advisory_api_contract.py` + `test_advisory_ssot.py` + `test_advisory_backtest.py` + `test_ai_trace.py` + `test_advisory_runtime_integrity.py` + `docs/PLAN_B1_AI_CONTRACT_20261109.md` + `docs/evidence/b1-ai-contract/*`.
- **LIMIT:** Chỉ BE; không sửa FE `signal` rendering (FE còn đọc `side` — side giữ derived để không vỡ).
- **Non-goals:** Không sửa FE/i18n/disclaimer; không sửa demand util; không xóa `signal_norm.py`.
- **Rollback:** revert PR (merge-commit). **Môi trường:** VPS staging (`docker cp` + exec test, restore md5 như A5/B2).

## Việc

### B1-1: orchestrator return schema + tasks structured output (B3 OBJ-4 RED riêng)

- [ ] **Step 1 RED-a (orchestrator literal):** Thêm test nhỏ trong `test_advisory_orchestrator_contract.py` — class mới `test_b1_orchestrator_return_no_legacy_keys`: build fixture JSON text (mô phỏng `parsed_json` tại `orchestrator.py:766`) bằng cách import hàm phụ trách parse nếu có, hoặc gọi trực tiếp logic return tại `:863-891`. Assert result **không có** `'signal','signal_raw','recommendation','target_price'` và **có** `'posture'` (+ normalized enum) + `'levels'`. Chạy trên VPS (docker cp) trước sửa → **FAIL** (fail-before).  
  Lưu ý (B3 OBJ-4): hàm `_build_structured_output` thuộc **`tasks.py:104`**, không phải orchestrator — RED này cho orchestrator, RED-b cho tasks (dưới đây).
- [ ] **Step 1 RED-b (tasks):** Test `_build_structured_output({'posture':'BULLISH','levels':{'support':10,'resistance':20}}, '')` → assert `'posture'=='BULLISH'`, `'levels'={'support':10.0,'resistance':20.0}`, **không có** `'signal','recommendation','target_price'`. Thay RED cũ chỉ assert signal. Chạy trên VPS (docker cp) trước sửa → **FAIL** (vì `_build_structured_output` hiện trả `'signal'`).
- [ ] **Step 2 GREEN:** Sửa `orchestrator.py:845-891` — bỏ key `'recommendation'`,`'signal'`,`'signal_raw'`,`'target_price'`; giữ `'posture'` (chuẩn hoá enum BULLISH/BEARISH/NEUTRAL, fallback signal qua normalize nếu raw=False), `'levels'`. Sửa `tasks.py` `_build_structured_output`: không lấy `result.signal`/recommendation — lấy `posture` từ result (normalize enum), `'levels'` coerce float; fail-closed: posture thiếu/illegal ⇒ SIGNAL_UNKNOWN (giữ nguyên tên mã nhưng posture quyết). `REQUIRED_STRUCTURED_KEYS` thêm `'posture'`, bỏ `'signal','recommendation','target_price'`.
- [ ] **Step 3:** Chạy trên VPS: RED-b + RED-a PASS + `tests.test_advisory_orchestrator_contract` + `tests.test_advisory_api_contract` toàn bộ PASS (restore + gates).

### B1-2: serializer + cross-consumer fallback (B3 OBJ-1/2/3) + posture contract

- [ ] **Step 1 RED:** Sửa `test_advisory_api_contract.py::AdvisoryRecordContractTests.test_all_new_fields_present` assert `'posture'` + `'levels'` có + **không có** `'signal','recommendation','target_price'`. Thêm `test_posture_and_levels_exposed`. Thêm `test_side_derived_from_posture` (`structured={'posture':'BULLISH'}` → `side=='BUY'`). Thêm test legacy `structured={'signal':'SELL'}` → `side=='SELL'` (backfill qua normalize). Thêm `test_posture_only_record_derives_side` trong `test_advisory_api_contract.py::AdvisorySymbolStatsTests` (record posture-only → endpoint `ai-advisory-symbol-stats/` ra rows `side=='BUY'`; không UNKNOWN) — B3 OBJ-2. Thêm test `_extract_backtest_side` posture-only trong `test_advisory_backtest.py` (record posture-only → `side == 'BUY'` qua call `_extract_backtest_side`; chạy VPS trước sửa BE → FAIL) — B3 OBJ-3. Chạy trên VPS (docker cp) → FAIL (vì serializer hiện emit `signal`).
- [ ] **Step 2 GREEN:** Sửa `serializers.py::AdvisoryRecordSerializer` — **chốt chọn (a)**: bỏ field `signal`/`recommendation`/`target_price` (không còn emit), **giữ field `side`** derived từ `structured.posture` qua `normalize_signal` (không phải read `signal`). `get_side` đọc posture trước; nếu thiếu posture thì fallback qua `signal` cũ bằng `normalize_signal` (dữ liệu legacy vẫn hiển thị đúng). Thêm field `posture` (đọc `structured.posture`, fallback normalize posture fallback nếu không có ⇒ null), `levels` (đọc `structured.levels`, fallback `{support,resistance}` riêng cho compat). `get_components` bỏ check `signal` UNKNOWN → check `posture` (fallback signal cũ nếu không có posture để không phá record cũ). Sửa `views.py:902-919` `_extract_backtest_side` loop đầu thêm key `'posture'`, bỏ `'recommendation'`. Sửa `portfolio_analytics_views.py:3252-3253` fallback `structured.get('posture')` trước `structured.get('signal')` cho side/signal derivations (B3 OBJ-2) — thực hiện trong cùng commit: nếu test endpoint side thành UNKNOWN sẽ fail → phải lập tức xử lý.
- [ ] **Step 3:** Chạy trên VPS: api_contract PASS + orchestrator_contract PASS + ssot PASS + backtest PASS + runtime_integrity PASS + ai_trace PASS → restore + gate `check-multi-agent`/`check-lessons`.

Acceptance: **Given** user gọi advisory qua orchestrator, **When** `_build_structured_output` chạy, **Then** nhận `posture` (enum BULLISH/BEARISH/NEUTRAL) + `levels` (dict 2 keys float/None) + `summary`/`confidence_score`/`rationale`/`risk_level` + **không** `signal`/`recommendation`/`target_price`. **Given** serializer render record, **Then** payload có `'posture'`/`'levels'` thật và **assertNotIn** `'signal'`,`'target_price'`,`'recommendation'`; **Given** record legacy chỉ có `signal`, **Then** `side` vẫn ra đúng (backfill, không ghi mới). **Given** endpoint `ai-advisory-symbol-stats`, **When** record mới chỉ có `posture`, **Then** `side` derive đúng (không UNKNOWN-danh-pường — B3 OBJ-2).

## Hạ tầng & cửa sổ staging API (B3 OBJ-5)

- `docker cp` các file test+src thay đổi vào container staging đã bake; sau cp **restart container** để reload bytecode (`docker restart vninvest-core-api` — thời gian degraded vài giây) trước khi chạy test; restart cũng làm fresh bytecode interpreter.
- Test DB isolation: Django test DB riêng `test_vninvest_core` (bypass pgbouncer qua `core-db:5432` per-exec như A5), không dùng chung DB staging; sau test Django tự DROP; celery worker staging không đọc dữ liệu test (test DB biệt danh).
- Restore: chép lại bản gốc từ `git show HEAD` trên VPS + `rm -rf /app/src/tests` + verify md5 + `git status` VPS chỉ còn dirty sẵn có. Ghi rõ cửa sổ staging API vài phút đọc file copy trong lúc test.

## Bàn giao

Plan là **B2 REV2**. B3 cần auditor độc lập ghi `docs/evidence/b1-ai-contract/AUDIT_PLAN_20261109_v2.md` (sau REV2) + B4 verdict trước claim (luật cứng #6). Agent đề xuất: `b1-ai-contract` → `feat/b1-ai-contract`.
