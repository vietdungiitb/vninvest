# BL-18 gates — lint baseline + no-increase CI (2026-09-24)

## Baseline
- `npm run lint` full: **0 errors, 3515 warnings** (2 lần chạy liên tiếp cùng số — ổn định).
- `packages/web/.eslint-baseline` = `3515`. Web-CI step "Lint warning budget (BL-18)": fail khi count > baseline.

## Policy
- Không mass `eslint-disable` (grep count làm chứng mỗi sprint); giảm 15%/sprint khi chạm file (boy-scout), cập nhật baseline file khi giảm thật.

## DoD tick
- [x] baseline số · [x] CI gate · [ ] giảm sprint đầu tiên (ongoing).
