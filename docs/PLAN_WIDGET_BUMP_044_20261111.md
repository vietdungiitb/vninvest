# PLAN — Bump @vninvestcharts/* lên bản mới để chạy tier pro (2026-11-11)

> Lessons áp dụng: [L-001, L-002, L-G01, L-G02, L-F04, L-T01]
> Slice: `widget-bump-044` · Branch: `feat/widget-bump-044` -> `dev`

## 1. Mục tiêu + bằng chứng đã tự mở đọc

- Registry GH (`npm.pkg.github.com`, lệnh `npm view ... versions`, chạy thật 2026-11-11):
  `widget`: 0.4.1/0.4.2/0.4.3/**0.4.4** (`0.4.4` lúc `2026-11-11T00:16:58Z`);
  `widget-pro`: 0.4.1/**0.4.3**; `engine-core`/`engine-drawing`/`engine-react`: …/**0.5.6**.
- Pin hiện tại (`packages/web/package.json:73-75,108-109`, đã đọc):
  engine-core/drawing/react `0.5.5`, widget `0.4.1`, widget-pro `0.4.1`.
- Tarball `widget@0.4.4` đã verify (`C:\Temp\wverify044`, node scan thật):
  `.d.ts` có `fetchSubscriptionTier`/`fetchSaasBillingTier`/`ensureMachineActivationOnce`/`showLegend`;
  JS runtime có `billing/subscription` 3 hits, `/api/v1/activations` 3 hits,
  `saas-billing` 3, `Idempotency-Key` 3, `showLegend` 18, `vninvestcharts_widget` 5.
- App chỉ import `@vninvestcharts/widget` (lazy `VNStockChartPanel.js:100`,
  `WatchlistDetailPanel.tsx:7`); `widget-pro` không ai import nhưng vẫn bump đồng bộ
  (0.4.1 → 0.4.3, bundle inline widget cũ nếu để lại sẽ lệch).
- Tier wiring app-side đã sẵn: `VNStockChartPanel.js:38-70` (`tier` prop → `useTenantTier()`,
  fail-closed free) + `licenseKey` prop (`:45,:290`, test `data-unlock...test.ts:81-95`
  cấm `tenantPat/client`, cho `licenseKey`). Bump là đủ, không sửa code.

## 2. SCOPE (file chạm) / LIMIT / non-goals

- SCOPE: `packages/web/package.json` (5 dòng version) + `docs/CLAIMS.md` (1 dòng claim)
  + ledger Entry + plan này. Rollback: revert commit.
- LIMIT: 3 vòng sửa. `package-lock.json` KHÔNG sửa trong slice này
  (deny-list + cần `npm install`,junction dùng chung — phải hỏi trước).
- Non-goals: không sửa wiring tier, không đụng kid/server (V1a của quyết định unified),
  không E2E (staging VPS, ticket riêng sau khi Owner duyệt install).

## 3. Nghiệm thu (Given/When/Then)

- G1: Given registry có 0.4.4/0.5.6, When đọc `package.json` sau sửa,
  Then 5 pins = `engine-*: 0.5.6`, `widget: 0.4.4`, `widget-pro: 0.4.3` (exact, không `^`).
- G2: Given edit xong, When `npx tsc --noEmit` (packages/web),
  Then exit 0 (baseline: sẽ đo trước edit để so).
- G3: Given chưa `npm install`, When kết phiên, Then ghi rõ `CHƯA CHẠY: npm install/build/E2E`
  + lý do (junction dùng chung, chờ Owner duyệt), không báo PASS giả.

## 4. Gates

`check-multi-agent` (đã PASS exit 0 trước sửa — cảnh báo stale pre-existing) ·
`git diff --numstat` sau edit (kỳ vọng 5 insertions/5 deletions đúng 1 file) ·
`npx tsc --noEmit` · `pre-push-gate` trước push. Claim → `done`, ledger Entry, PR merge-commit.
