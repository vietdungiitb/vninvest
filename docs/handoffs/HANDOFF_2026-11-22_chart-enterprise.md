# HANDOFF — Chart Enterprise Always-On Demo (2026-11-22)

- **Branch:** `feat/chart-enterprise-demo` (HEAD `042037f3a` + B9 docs)
- **Trạng thái:** `done` — B1–B9 hoàn tất, B8 `AGREE`, deploy staging xanh
- **Owner:** vietdungiitb · **Slice:** chart-enterprise-demo

## Kết quả

- Chart widget local **0.4.7 @ ddc947dd** (cùng commit demo `charts.edusuccess.vn`) thay cho 0.4.4 registry.
- **Enterprise luôn bật** trên staging qua server-side entitlement: `GET /api/v1/entitlement`
  → `tier_code=enterprise`, `status=active`, hạn `2126-10-29`. PAT server-only nằm file root-only trên VPS.
- Preload entitlement trước first render (không flash FREE); `enterpriseBinding` cho widget render
  6 dock tab; code tự vẽ được thay bằng capability widget.
- D4b: widget-pro bị defer (pin widget 0.4.3), dùng stub Vite; Pine/Strategy/Replay chưa có.

## Evidence (`file:line`)

- `docs/PLAN_CHART_ENTERPRISE_CLOSED_LOOP_20261122.md` — kế hoạch 9 bước, 10 task.
- `docs/evidence/chart-enterprise/PLAN_AUDIT_20261122.md` — B3 3 vòng → `AGREE`.
- `docs/evidence/chart-enterprise/CONSENSUS_20261122.md` — B4 + D1–D7, D2b/D4b.
- `docs/evidence/chart-enterprise/REGISTRY_PROBE_20261122.md` — lý do dùng tarball local.
- `docs/evidence/chart-enterprise/JOURNAL_20261122.md` — TDD RED/GREEN + deploy.
- `docs/evidence/chart-enterprise/REAUDIT_FINAL.md` — B8 `AGREE` + 3 reservation đã đóng.
- `docs/CODE_CHANGE_AUDIT_LEDGER.md#Entry-612` — code + deploy + verify.

## Kiểm chứng

`vitest 8/8` · `vitest hồi quy 29/29` · `tsc 0` · `npm run build 0` · `pre-push-gate 36 PASS` ·
deploy VPS 12 container healthy · `check-staging.mjs` → `STAGING_OK commit=042037f3a dirty=false`.

## Còn lại / next steps

1. **E2E browser có đăng nhập: ĐÃ CHẠY** (`e2e-enterprise.png`, `data-tier=enterprise`, 0 runtime error, chart render đầy đủ). Badge toolbar widget vẫn `FREE` — giới hạn của npm package (không export server-tier channel như demo build); mọi capability enterprise đã active. Chi tiết `JOURNAL_20261122.md` mục E2E.
2. Rotate `GITHUB_TOKEN` đã lộ trong chat.
3. PR merge → `dev`, rồi cleanup branch/worktree widget `vninvest-widget-ddc947dd`.
4. Khi widget team publish bản tương thích: mở lại D4b (widget-pro) + thay `PortfolioChart` ECharts (D5/Wave 1).
