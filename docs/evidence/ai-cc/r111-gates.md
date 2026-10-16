# R1.11 gates — agent panel (slice cuối R1, 2026-10-16)

Branch `feat/ai-r111-agentpanel` ← `dev`. Claim `ai-r111`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:743-764`.

## Fail-before: AC1/AC2/AC4 RED (AC3 greenfield, AC5 gate)
- AC1 không nút "saving", AC2 không role=status, AC4 default openai cứng.

## Thực hiện
- Nút Lưu `saving ? t(saving) : t(save)` + tái sinh key `saving` (R1.3 xóa đúng
  lúc đó vì chết; R1.11 cần → thêm lại + xóa khỏi danh sách 22→21 trong test R1.3).
- Notice `role=status` + tự tắt 4s (timer ref + cleanup) + nút × `dismissNotice`.
- `parseCapabilities`/`formatCapabilities` → `src/lib/capabilities.ts` + test.
- Defaults từ `PROVIDER_MODELS` (openclaw/gpt-4o-mini); provider-change giữ model
  cũ nếu provider chỉ có custom (form này không có ô custom).
- Deviation có chủ đích: GIỮ `type*` (R1.3 đã ship + test), KHÔNG đổi sang
  `agentTypes.*` như phản biện R1.11 gợi ý (đổi tên key đã dùng = churn).

## Gates (EXIT=0)
- vitest mới **4/4** + capabilities **4/4** + i18n-clean + AISliceE.
- `tsc` 0 · `eslint` 0 warning panel (AC5) · `check-ai-cc` SẠCH · `build` PASS.

## CHƯA CHẠY
- full BE · ruff · E2E · staging.
