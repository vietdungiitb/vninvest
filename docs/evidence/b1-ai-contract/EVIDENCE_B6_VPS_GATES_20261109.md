# B6/B7 — evidence VPS + gates (b1-ai-contract) — 2026-11-09

**Revision**: `2554484af` · **Branch**: `feat/b1-ai-contract` · Base: `3e2f1870e`.

## B6 — TDD (chạy thật trên VPS staging `@5f9422694`)

1. **RED (fail-before)**: file `tests/test_b1_contract.py` mới (4 tests RED-a/RED-b): `B1TasksStructuredContractTests` (`posture`+`levels`, không `signal`/`recommendation`/`target_price`, coercion, legacy signal→BEARISH) + `B1OrchestratorResultContractTests` (helper `_assemble_advisory_result`, không 4 key legacy). Chạy qua `manage.py test tests.test_b1_contract` → **FAILED (errors=4)** với `KeyError: 'posture'`, `KeyError: 'levels'`, `ImportError _assemble_advisory_result`.
2. **GREEN**: tách logic return của orchestrator thành helper module-level `_assemble_advisory_result` (return thuần posture+levels+summary/confidence/rationale/risk_level — không signal/target_price/recommendation); mock branch (is_mock) cũng trả posture (BULLISH/BEARISH/NEUTRAL từ trend_label); `tasks._build_structured_output` lấy posture từ result, fail-closed theo `"posture" == "UNKNOWN"`; serializer `AdvisoryRecordSerializer` Meta fields bỏ `signal`/`recommendation`/`target_price`, thêm `posture`/`levels`, giữ `side` derived từ posture qua normalize_signal; `views._extract_backtest_side` loop ('posture','signal'); `portfolio_analytics_views` fallback `posture or signal` cho side/signal.
3. **Full file** (VPS, pgbouncer bypass per-exec): `tests.test_advisory_orchestrator_contract`, `tests.test_advisory_api_contract`, `tests.test_advisory_backtest`, `tests.test_advisory_ssot`, `tests.test_advisory_runtime_integrity`, `tests.test_ai_trace` → **Ran 58 tests → OK** (message các suite cuối), TEST_EXIT 0 sau khi fix fail-closed theo posture.
4. **Runtime integrity loader NOT FOUND đầu tiên** là lỗi khi bypass pgbouncer + thiếu file trong container (`/app/src/tests/` chưa có) — đã copy test vào container trong lần đổ **`docker cp` mới lần 2 không khổ** — 3 test files + runtime (4 files) copy lại → vẫn ModuleNotFoundError ở đầu là do **container chưa Restart** (bytecode cache) — restart chỉ khi cần. Akhir lần chạy (lần đủ kế tiếp) → **OK 58 tests** trên cả 6 files.
5. **Test expectations cập nhật** theo posture (contract shift có chủ đích):
   - `test_advisory_orchestrator_contract`: FULL structured/tests `_BuildStructuredOutputTests` đổi assert signal→posture.
   - `test_advisory_api_contract`: FULL_STRUCTURED sang posture+levels; fields assert posture/levels + assertNotIn 'signal','recommendation','target_price'; side derive posture; thêm `test_side_derived_from_legacy_signal`, `test_posture_only_record_derives_side`, list items posture.
   - `test_advisory_ssot`: mock orchestrator.run đổi signal→posture; expect components 2 (không còn RECOMMENDATION); structured['posture']=='BULLISH' + assertNotIn signal/recommendation/target_price; unparseable giữ FAILED.
   - `test_advisory_backtest`: helper `_make_record(..., posture=None)`; posture posttest; existing _extract_backtest_side loop đổi.
   - `test_ai_trace` SYNTH_OK posture BULLISH + levels (giữ 4 trace).
   - `test_advisory_runtime_integrity` N2: assert `data["signal"]` → replaced bằng check trên `posture`.
6. **Restore**: bản gốc từ `git show HEAD` trên VPS cho orchestrator, serializer? (không commit staging image — thực ra không thay staging image; chỉ docker cp tạm + restart, compare md5 đã lưu trước — cả 5 files md5 khớp bản bake `5f9422694`), `rm -rf /app/src/tests`, `/tmp` trên VPS đã xóa; `git status` VPS chỉ còn dirty sẵn có.

## B7 — Gates (sau rebase/sửa)

| Cổng | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng |
| `node scripts/check-lessons.mjs` | **PASS** — 57/60 |
| `node scripts/normalize-eol.mjs` | **OK** |
| `node scripts/check-experiment-env.mjs` | **PASS** |
| `node scripts/pre-push-gate.mjs` | **2 FAIL / 32 PASS / 2 SKIP** — giống baseline, pre-existing |
| `git diff --numstat` | chỉ file BE + test |

## B8

Auditor độc lập kiểm trên revision `2554484af` (0 major?) — em sẽ ghi file riêng nếu verdict NEED_REVISION. (Người check: process B8 có thể NEED_REVISION.)
## CHƯA CHẠY (ghi rõ)
- FE: `ai-cc-i18n-clean` vitest, vi/en labels cho posture/levels, disclaimer UI — **CHƯA CHẠY** theo scope đợt này (FE-i18n tuân tuân §3, filer staled).
- `tsc` FE build: **CHƯA CHẠY** (không có node_modules máy host; VPS image mới là BE; Webapps-image package `web` xong). Đánh dấu CHƯA CHẠY thay vì PASS giả.
- BE suite đầy đủ ngoài phạm vi test_contract: **CHƯA CHẠY** ngoài 6 files ở trên.
- Full app E2E Playwright: **CHƯA CHẠY**.

---
**Lessons áp dụng** [L-001, L-002, L-003, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01]: multi-agent.md, verification.md, tooling-traps.md (đã đọc).
