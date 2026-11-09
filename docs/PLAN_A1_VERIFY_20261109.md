# PLAN — A1 re-verify trên VPS (không sửa code nếu xanh) — 2026-11-09 (B2)

> **For agentic workers:** REQUIRED SUB-SKILL: `workflow-dev-loop` B3/B4 verdict bằng văn bản trước claim. **Plan này là B2 — chưa B3/B4, chưa claim.**

**Goal:** Chạy lại 2 test A1 trên VPS staging và đóng A1 bằng evidence — xanh thì "không còn bug", đỏ thì mới sửa theo Step 2. Không giả fail-before (L-V02).

**Architecture:** Chỉ DOC + VPS read-only (`docker exec vninvest-core-api python /app/src/manage.py test ...`). Không build image, không deploy, không đụng deny-list.

**Tech Stack:** VPS `14.225.255.47`, container `vninvest-core-api`, Django test runner, `node` gate nhẹ.

**Spec:** `docs/PLAN_NEXT_DIRECTION_20261109.md` (A1 rev3) + `docs/evidence/a1-verify/B1_MEASURE_20261109.md`.

## Global Constraints

- Không `npm/pip install` · không migration · không chạm deny-list. Không local Docker — **chỉ VPS** (AGENTS + RUNBOOK §12).
- ЧƯA CHẠY trung thực nếu test không chạy được; không bịa PASS (L-007).

## Review Focus

- Test sẽ chạy ở HEAD staging cũ `5f9422694` (tre 26 commits so với `dev`) — kết quả chỉ nói về code staging, không nói hết `dev` (ghi rõ trong evidence).
- Nếu test đòi DB Postgres riêng, chỉ chạy đúng 2 test class, không full suite.
- Fail-before: nếu xanh hết thì Step 2 bỏ qua (không bịa RED).

---

## Baseline exit-code tại HEAD (B2, B1)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng |
| VPS check | `docker exec vninvest-core-api python /app/src/manage.py check` | **PASS** — exit 0, 1 warning (BROKER_SECRET_KEY) |
| VPS test 2 lớp | `docker exec ... test vninvest_core.tests.test_no_timezone_utc vninvest_core.tests.test_api_envelope_schema.HandlerResolvabilityTest` | **CHƯA CHẠY** trong phiên lập plan (B6) |
| Git | `git status --short` | Sạch tại `0096f84b7` |

**Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01]

## SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE:** Chạy 2 test VPS + viết evidence + ledger + handoff. Chỉ sửa code nếu Step 1 đỏ.
- **Non-goals:** Không sửa P0-1 (deny-list), không sửa broker envelope ngoài A1, không pull/deploy staging, không sửa Pricing (đã refute).
- **Rollback:** revert PR (merge-commit). VPS read-only không cần rollback.
- **Môi trường:** Chỉ VPS; không local Docker.

## Việc

### A1-1: Re-verify 2 test trên VPS

- [ ] **Step 1 (re-verify-first):** Trên VPS chạy 2 class trên (lệnh ở Baseline), ghi output. Cả 2 xanh → đóng "không còn bug" (không bịa fail-before, L-V02). Đỏ → sang Step 2.
- [ ] **Step 2 (chỉ nếu Step 1 đỏ):** Sửa đúng root cause, không nới assertion (L-V04). Nếu xanh hết thì bỏ qua.
- [ ] **Step 3:** Chạy lại 2 class PASS + `makemigrations --check` không đổi. Commit `test(be): re-verify A1` (nếu có sửa) hoặc đóng bằng evidence không sửa + ledger. Acceptance: Given VPS staging, When chạy 2 class, Then có output PASS/FAIL rõ ràng.

## Bàn giao

Plan là **B2**. B3 cần auditor độc lập ghi `docs/evidence/a1-verify/AUDIT_PLAN_*.md` trước claim (luật #6). Agent đề xuất: `a1-verify` → `feat/a1-verify`.
