# BL-11 gates — env preflight CI matrix (2026-09-24)

## Change
- New `packages/core/backend/scripts/preflight_prod_env.py`: 7-case matrix over `manage.py check` in prod mode (scrubbed env, no secrets in logs).
- Wired into `.github/workflows/core-api.yml` (after BL-06 guard, before tests).

## Gates (run local 2026-09-24)
- `python scripts/preflight_prod_env.py`: **7/7 PASS** (full-valid exit 0 + `no issues`; 4 missing-var cases exit 1 đúng message; 2 insecure-override cases exit 1 `must be true in production`).

## DoD tick
- [x] 6+ fail cases đúng message · [x] đủ env xanh · [x] chạy trong core-api.yml · [x] không leak secret (chỉ log tên case + fragment).
