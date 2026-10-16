# R1.6 gates — chart token + bảng số (2026-10-16)

Branch `feat/ai-r16-chart` ← `dev`. Claim `ai-r16`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:626-648`.

## Fail-before: 5 AC RED (assertion thật, không import-error)
AC1 hex chart / AC3 thiếu srOnly / AC5 toLocaleString trần / AC6 $0.010000 /
AC4-contract thiếu css block.

## Thực hiện
- Dashboard: `chartToken(name)` (computed style + fallback = màu cũ, zero drift)
  + `STATUS_TONE` union + `usd4` (1 chỗ 4dp, CSV + card + bảng) + `formatDateTime`
  + chart `aria-hidden` + bảng số `.srOnly` + summary nhận filter (giữ từ R1.5).
- Page: viewer/historyRow vào css; quota width inline GIỮ (dynamic theo %,
  không phải hardcode) + root :213 để R1.8.
- CSS block `/* R1.6 chart */` (srOnly/promptViewer/historyRow/statusDefault), 0 hex.
- `check-ai-cc.mjs` +AC7 (hex/rgba ngoài allowlist block FALLBACK + dòng
  chartToken(); self-test 8/8, bắt đột biến).

## Sửa test/code trong lúc GREEN
- Test AC1/AC4 marker khớp block thật (lỗi cho phép giống R1.2).
- Shadowing `formatDateTime` (import + destructure) → bỏ destructure (tsc bắt).
- Ghi đè mất `usageClient` (bắt ở tsc) → khôi phục + tsc lại.

## Gates (EXIT=0)
- vitest mới **5/5** (AC2 ảnh CHƯA CHẠY) · hồi quy dashboard/page/parity/form/smoke
- `tsc` 0 · `eslint` 0 · `check-ai-cc` SẠCH + self-test 8/8 · `build` PASS
- `check-multi-agent` 0 lỗi (pre-commit).

## CHƯA CHẠY
- AC2 2 ảnh light + AC4 đo contrast pixels · full BE · ruff · E2E · staging.
