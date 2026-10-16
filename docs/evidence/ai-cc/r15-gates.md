# R1.5 gates — usage filters nhất quán (2026-10-16)

Branch `feat/ai-r15-usagefilter` ← `dev`. Claim `ai-r15`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:602-624`.

## Fail-before (VPS, Postgres thật, DB tạm ai_r15): FEF.F
- AC1 FAIL (5 != 4), AC2 ERROR KeyError 'status', AC3 FAIL, AC5 FAIL (3 != 1).
- AC4 PASS sẵn (isolation R0.7 còn nguyên).

## Quyết định PM (ghi rõ)
- Summary thiếu cột model/status ⇒ AC2 không thể đạt nếu không đổi schema.
  Chọn migration 0003 (makemigrations sinh, deps 0002): +model/+status,
  unique_together mới. Staging 0 row (đo thật cả 2 bảng) nên an toàn, không backfill.
- BE không chạy được local (không Docker/PG) ⇒ pipeline one-off trên VPS:
  worktree /tmp/ai-r15 + DB ai_r15 + `docker run --entrypoint python` image
  staging (secret chỉ server-side, không vào log). Xóa worktree/DB khi xong.

## Thực hiện
- `views.py`: helper `_scope_to_requester` + `_apply_common_filters`
  (model/status/action) + `_parse_int` cho cả 3 view; summary +pagination
  (total/limit/offset, additive).
- `tasks.py rollup`: grain (user,action,model,status).
- `serializers.py`: summary +user/model/status.
- `AIUsageDashboard.tsx`: summary nhận đủ filter (model/status); test AC6 mới.
- system-design regen (migration 125, model catalog 110) — gate pre-push bắt.

## Gates (EXIT=0)
- BE VPS: mới **5/5** + R0.7 instrumentation **6/6** + permissions **12/12**.
- FE: dashboard suite PASS (AC6 RED→GREEN qua stash) + tsc 0 + eslint 0 +
  check-ai-cc SẠCH + build PASS.
- `makemigrations --check` 0 · `check-multi-agent` 0 lỗi.

## CHƯA CHẠY
- Ảnh trước/sau lọc (plan) · full BE ngoài scope · ruff · E2E UI · staging deploy.
