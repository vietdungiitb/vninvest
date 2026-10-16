# R1.1 gates — 13 token `--ai-*` ra `:root` (2026-10-16)

Branch `feat/ai-r11-tokens` ← `dev @ 8b78660c`. Claim `ai-r11` (in-progress → done).
Plan: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:503-524`.

## Fail-before (RED, EXIT=1)
- `npx vitest run src/components/__tests__/ai-settings-tokens.component.test.ts`
  → 2 failed (AC1, AC1b) | 3 passed (AC2, AC3, AC4).

## Fix
- `packages/web/src/components/aiSettings.module.css`: 13 token `--ai-*`
  từ `.page` ra block `:root` mới (byte-identical values) + comment lý do.
  Diff tối thiểu: `git diff --numstat` = **7+/1-** (token lines trùng → context).
- Không sửa hub (đã verify hub không dùng `styles.page`).

## GREEN + gates (EXIT=0 hết)
- vitest new file: **5/5** (log `$env:TEMP/vit-r11-green.log`)
- vitest hồi quy AI CC (contract-smoke + form-parity + i18n-parity): **13/13**
- `npx tsc --noEmit`: **0 lỗi**
- `npx eslint` (test mới): **0**
- `node packages/web/scripts/check-ai-cc.mjs`: **SẠCH**
- `npm run build`: **PASS 48.68s** (chunk-size warning có sẵn, không phải lỗi)
- `check-multi-agent` (pre-commit hook): **0 lỗi, 0 trùng migration**

## Phát hiện khi verify (L-V02)
1. Plan phản biện "không rule nào ngoài module dùng `--ai-*`" — **sai nhẹ**:
   `AICommandCenterPage.tsx:353,387` dùng `var(--ai-border)` inline mà không có
   tổ tiên `.page` → trước fix rơi về currentcolor. Ra `:root` chữa luôn.
2. Plan AC4 tưởng hub còn dùng `styles.page` — **code đã không dùng**
   (root `shellPage` từ trước) → AC4 GREEN sẵn, ghi nhận không sửa.
3. `Edit` tool flip toàn file LF→CRLF (numstat 1004/998) — phát hiện nhờ
   `git diff --numstat`, khôi phục từ `git show HEAD:` + redo bằng Node (L-G05/L-T01).

## CHƯA CHẠY
- AC5 visual QA 6 ảnh (3 route × 2 theme) — không có browser/Playwright ở máy này.
- Full BE / ruff / E2E UI (ngoài scope slice FE).
