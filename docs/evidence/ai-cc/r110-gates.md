# R1.10 gates — quota labels + countdown (2026-10-16)

Branch `feat/ai-r110-quota` ← `dev`. Claim `ai-r110`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:720-741`.

## Fail-before
- BE (VPS): thiếu `used_today`/`source` cả GET+PUT (2 failed).
- FE: text cũ "0 lượt / 5 lượt" (chạy RED qua stash page).

## Thực hiện
- BE: GET/PUT += `fallback_quota_used_today` (0 khi chưa có cred) +
  `fallback_quota_source` (personal_key/system). Không migration (model R0.7 có sẵn).
- FE 1 dòng: `t(quotaLine{remaining,max,used}) · t(quotaResetIn{h,m}) · source`;
  đếm ngược tới nửa đêm (tính lúc render, không timer mới); bar đỏ + cảnh báo
  khi 0 (có sẵn quotaFillEmpty/fallbackExhausted).
- 4 key i18n vi+en; sửa test cũ :182 theo contract mới.

## Gates (EXIT=0)
- BE VPS: mới **2/2** + policy **9/9** + mgmt **30/30**.
- FE: page suite PASS (AC2/AC4/AC5) · `tsc` 0 · `eslint` 0 · `check-ai-cc` SẠCH ·
  `build` PASS · multi-agent 0 lỗi.

## CHƯA CHẠY
- 3 ảnh trạng thái quota · full BE · ruff · E2E · staging.
