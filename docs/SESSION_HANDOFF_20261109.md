# Handoff — Docs audit + plan P0→A→B đóng vòng (2026-11-09)

**Phiên này đóng vòng kín cho slice `docs-audit-plan-1109` (branch `feat/docs-audit-plan-1109` → PR).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 427–430) + `git log origin/dev` + `docs/CLAIMS.md` (claim `docs-audit-plan-1109` = done) + `docs/evidence/docs-audit-plan/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `84970950c` | Claim riêng (`docs/CLAIMS.md` +1 dòng, `in-progress`) |
| `9de12316d` | Docs: `EVALUATION_HANDOFF_20261109.md` + `PLAN_NEXT_DIRECTION_20261109.md` + `AUDIT_VPS_STAGING_VS_LOCAL_20261109.md` + ledger Entry 427/428/429 + evidence B1/B3/B4 |
| *(B9)* | Claim `done` + `AUDIT_B8_20261109.md` (PASS) + handoff này + ledger Entry 430 |

Gates B7 (sau rebase, `behind=0/ahead=2`): `check-multi-agent` **PASS** (0 lỗi) · `check-lessons` 57/60 sạch · `check-experiment-env` PASS · `normalize-eol` OK. `pre-push-gate` 2 FAIL/32 PASS/2 SKIP — **chứng minh pre-existing** bằng worktree `D:\tmp-baseline-check` tại `origin/dev` sạch (cùng 2 FAIL: `i18n-strict-selftest` + `tsc` thiếu `node_modules/typescript`). **CHƯA CHẠY**: tsc / suite / BE / VPS verify / E2E (docs-only, staging đang crash-loop AUD-01 — không giải quyết ở đây vì `requirements.txt` là deny-list, coordinator only).

B3: v1 NEED_REVISION (5 OBJ) → v2 NEED_REVISION (2 OBJ) → v3 **PASS** (3 vòng, `AUDIT_PLAN_20261109_v1/v2/v3_B4.md`). B8: **PASS** 0 blocker/0 major (`AUDIT_B8_20261109.md`).

## 2. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01 (coordinator, deny-list, không tự sửa)**: `packages/core/backend/requirements.txt:9` `redis>=5.0,<6.0` → `redis>=6.1.0` (verify `channels-redis>=4.1,<5.0`), rebuild staging, RestartCount=0. Blocker mọi BE test.
2. **P0-2/3**: patch `deploy-staging.sh --verify` check RestartCount; pull staging `5f9422694` → `26e44d203` (stash hotfix secret trước).
3. **A1 re-verify-first** (`PLAN_NEXT_DIRECTION` rev3): chạy `test_no_timezone_utc.py` + `test_api_envelope_schema.py` trên VPS; xanh → đóng "không còn bug" (OBJ-2 đã refute `pricing.py:160`), đỏ → mới sửa. **Không bịa fail-before.**
4. **A5/B1/B2 song song 2 lane** + B3/B4/B5 (xem lane table trong plan). A2 coordinator-only (không tự sửa dòng claim người khác).
5. **T3 infra**: `agent-sync.ps1` parse lỗi PS 5.1 (tự tái hiện phiên này `MissingEndCurlyBrace :118`) — sửa trước T2.
6. **Owner Q1–Q8** (`EVALUATION_HANDOFF §J`, `PLAN §Câu hỏi`): SAML, broker 2 tầng, free, LLM cost, xoá `contracts/admin_ops`…, rotate/CI [X].

## 3. Quy tắc không quên

- Không commit thẳng `dev`; branch `feat/<tên-agent>` đúng ký tự (L-M02), claim trước dòng đầu tiên (L-002, đã vi phạm 1 lần và khai ở B1).
- Mọi audit/review phải thành file (`docs/evidence/<slice>/`), verdict văn bản trước B5.
- P0-1 là deny-list — agent ghi vào claim + báo coordinator, không tự sửa `requirements.txt`.
