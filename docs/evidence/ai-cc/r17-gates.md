# R1.7 gates — useRetryableAsync (2026-10-16)

Branch `feat/ai-r17-retry` ← `dev`. Claim `ai-r17`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:650-671`.

## Fail-before: 5/5 RED (kể cả retry-preservation — hành vi cũ khác thật)

## Thực hiện
- Hook viết lại: AbortController/lượt + requestId (lượt cũ abort + kết quả cũ
  không apply) + `mountedRef=false`/abort/backoff-cleanup khi unmount +
  `asyncFn(signal?)` tương thích ngược (fn cũ không tham số vẫn chạy).
- Giữ API (execute/retry/reset/retryCount) — chỉ dashboard bỏ `retryLoadData`
  kẹp trong nút Refresh (giờ đúng 1 request).
- Consumer duy nhất là dashboard (grep toàn repo) ⇒ AC5 = dashboard suite xanh.

## Gates (EXIT=0)
- vitest mới **5/5** · dashboard suite PASS · `tsc` 0 · `eslint` 0 ·
  `check-ai-cc` SẠCH · `build` PASS · `check-multi-agent` 0 lỗi.

## CHƯA CHẠY
- full BE · ruff · E2E UI · staging · test từng consumer khác (không có consumer khác).
