# R1.8 gates — AiHubNav + 1 hệ token (2026-10-16)

Branch `feat/ai-r18-hubnav` ← `dev`. Claim `ai-r18`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:673-695`.

## Fail-before thật (stash code, giữ test + file mới): 4/4 RED
AC1 style root / AC2 không AiHubNav / AC3 thiếu p / AC4 mất filter.

## Thực hiện
- `AiHubNav.tsx` mới: 3 tabs + `aria-current` + giữ param theo grain đích.
  Sửa bug thiết kế giữa chừng (bắt ở AC4): tab Usage mang `?page=` của audit sang
  (grain khác nhau) ⇒ tab Tổng quan dùng snapshot sessionStorage (panel ghi mỗi
  khi filter đổi), tab Usage không mang page.
- Hub: AiHubNav + anchor nav riêng; root inline → `.hubPage`; bỏ 2 route links.
- Sub-pages: AiHubNav thay back-link + h1/p (dùng description keys sẵn có).
- Xóa `aiCommandCenter.backToHub` vi+en (giữ invariant 0 key chết của R1.3).
- CSS `.hubPage` + comment bridge (`--text-*/--accent-*...` từ theme/tokens.css,
  đã verify tồn tại) vs local (`--ais-*`).
- Gate `check-ai-cc` +AC8a/b/c (1 hệ token/route; self-test 11/11).

## Gates (EXIT=0)
- vitest mới **4/4** · hồi quy hub/page/nav1/dashboard/audit/parity/chart ·
  `tsc` 0 · `eslint` 0 · `check-ai-cc` SẠCH · `build` PASS · multi-agent 0 lỗi.

## CHƯA CHẠY
- 6 ảnh 3 route × 2 theme · AC4 đo contrast · full BE · ruff · E2E · staging.
