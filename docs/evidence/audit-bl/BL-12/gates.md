# BL-12 gates — E2E critical smoke trong CI (2026-09-24)

## Change
- New `packages/web/tests/visual/ci-critical.spec.ts`: 6 tests backend-tolerant (login render, 4 guard fail-closed → /login, unknown-route no-blank-crash), không screenshot.
- New job `e2e-critical` trong `.github/workflows/web-ci.yml` (sau build): chromium + `--no-deps`, hard-gate (fail thật), artifacts luôn upload.

## Gates (chạy local, preview build có sẵn)
- `playwright test --project=chromium --no-deps ci-critical.spec.ts`: **6 passed / 15.2s** (dưới ngưỡng 15 phút).
- Negative test (break selector cố ý): **1 failed đúng chỗ**, revert sạch (grep 0 sót).
- Debug notes: setup-project đòi backend thật (fail không backend — đúng thiết kế, CI dùng `--no-deps`); `.auth/user.json` token cũ làm sai guard → spec tự clear storage ở `beforeEach` (mô phỏng fresh-CI).

## Chưa làm (theo DoD, cần vòng CI thật)
- [ ] 3 lần xanh liên tiếp trên GitHub Actions (chạy local 1 lần xanh + 1 negative đỏ).
- Full-state flows (CRUD/run/ack với API sống) ở lại nightly/manual QA — ghi rõ trong spec header.

## DoD tick
- [x] 5+ flows · [x] chromium · [x] artifacts · [x] <15 phút · [x] negative-test · [ ] 3 green runs CI (chờ push).
