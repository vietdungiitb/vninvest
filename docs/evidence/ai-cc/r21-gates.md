# R2.1 gates — deployments (2026-10-17)

Branch `feat/ai-r21-deployments` ← `dev`. Claim `ai-r21`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:774-796`.

## Fail-before
- `ImportError: cannot import name 'AIDeployment'` trên code dev (chạy thật VPS).
- AC4 cần savepoint bọc IntegrityError (đúng hành vi, không phải bug code).

## Thực hiện
- `AIDeployment` + `AIFallbackChain` + `active_deployment` FK nullable +
  resolver (`pick_active_deployment`, `resolve_fallback_chain`, `pick_deployment`).
- Deviations có lý do: (1) migration 1 file 0014 (makemigrations quyết, không
  0014+0015 như plan); (2) unique (name,scope,user,tenant) + `nulls_distinct=False`
  (PG16) thay vì (name,scope) — plan sẽ cấm 2 user trùng tên nhau (sai isolation);
  (3) `COPILOT` vẫn gỡ khỏi ProviderChoices (R2.4 thêm lại qua migration riêng).
- Admin + serializer (không trả secret) + system-design regen (126 mig, 112 model,
  1496 route — admin URLs; workaround `PYTHONUTF8=1` cho bug cp1252).

## Gates (EXIT=0, VPS Postgres thật)
- Mới **5/5** · config_isolation **9/9** (plan ghi 8, thực tế 9 — xanh hết).
- `makemigrations --check` 0 · system-design SẠCH · multi-agent 0 lỗi.

## CHƯA CHẠY
- full BE ngoài scope · ruff · E2E · staging deploy.
