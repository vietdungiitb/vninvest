# R2.2 gates — factory + AiClient (2026-10-17)

Branch `feat/ai-r22-factory` ← `dev`. Claim `ai-r22`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:798-829`.

## Fail-before
- `ModuleNotFoundError: advisory.ai_clients` trên dev (chạy thật VPS).
- AC3 grep `if provider ==` còn 2 chỗ (test loại comment để khỏi báo giả).

## Thực hiện
- `ai_clients/{__init__,base,openai_compat}.py`: interface complete/probe/catalog,
  FactoryError loud, registry module-convention (provider mới = 1 file + 1 dòng).
- `_resolve_chat_endpoint` + SSRF guard chuyển sang adapter; orchestrator
  re-export (test R0.6 không sửa). `_extract_usage` canonical ở base, alias ở
  orchestrator (test R0.7 không sửa).
- Orchestrator: sub-agent + synthesis qua `client.complete()`; bỏ `is_local`,
  `provider != 'local'`, `async with httpx`; giữ nguyên retry/error/usage/message.
- Deviations: (1) base.complete() single-attempt (retry ở orchestrator như cũ;
  R2.9 mới đưa vào base); (2) provider lạ (openclaw/copilot/claude) → FactoryError
  loud thay vì rơi OpenAI-401 (đúng AC4).

## Gates (VPS Postgres thật, EXIT=0)
- Mới **6/6** · usage 6/6 · mgmt 30/30 · r06 5/5 · config 9/9 · policy 9/9 · r04_r05 4/4.
- `makemigrations --check` 0 (không đổi model) · multi-agent 0 lỗi.

## CHƯA CHẠY
- full BE ngoài scope · ruff · E2E · staging deploy · probe thật provider.
