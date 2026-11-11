# PLAN — Pro lên staging docker.edusuccess.vn + xác nhận chạy (2026-11-11)

> Lessons áp dụng: [L-001, L-002, L-G01, L-G02, L-S01, L-S02, L-V01, L-V02]
> Slice: `staging-pro-jwk` · Branch: `feat/staging-pro-jwk` -> `dev`

## 1. Mục tiêu + bằng chứng đã tự mở đọc

- Staging = VPS `14.225.255.47`, repo `/opt/vninvest` branch `dev`,
  deploy `bash scripts/deploy-staging.sh` (`STAGING_VPS_RUNBOOK.md:10-25`).
- Blocker đã biết: staging chạy `dev` = widget 0.4.1/engine 0.5.5
  (bump 0.4.4/0.5.6 còn nằm trên `feat/widget-bump-044` chưa merge):
  0.4.1 không có import widget-pro/register build vẫn xanh NHƯNG engine 0.5.5
  thiếu W1 product alias ⇒ key `p=vninvestcharts_widget` verify NULL dù có JWK.
  ⇒ **Không merge bump thì staging không thể Pro bằng key này.**
- App đã sẵn: `VNStockChartPanel.js:45,292` nhận `licenseKey` và forward cho widget;
  `StockDetailPage.tsx:279-293` render panel NHƯNG chưa truyền `licenseKey`.
  App chưa import `engine-core` ở đâu (grep 0 hit) — thêm mới là lần đầu.
- Pattern build-arg đã có: `Dockerfile:16-27` ARG+ENV `VITE_*`;
  `docker-compose.staging.yml:113-119` truyền `VITE_API_URL`, `VITE_TURNSTILE_SITE_KEY`
  (lấy từ `compose.staging.env` trên VPS — secret không vào repo).
- JWK `kid=primary` là PUBLIC (vnsaas đã share) ⇒ được nhúng thẳng vào source.

## 2. SCOPE / LIMIT / non-goals

- SCOPE (code): `src/lib/licenseTrustAnchor.js` (mới: JWK + `ensureLicenseTrustAnchor()`
  gọi `addLicensePublicKey`, idempotent) · `VNStockChartPanel.js` (+import, +gọi 1 lần ở
  module scope) · `StockDetailPage.tsx` (truyền `licenseKey: import.meta.env.VITE_VNINVEST_LICENSE_KEY ?? undefined`)
  · `packages/web/Dockerfile` (+ARG/ENV `VITE_VNINVEST_LICENSE_KEY`)
  · `docker-compose.staging.yml` (+build.arg từ `${VITE_VNINVEST_LICENSE_KEY:-}`)
  · `compose.staging.env.example` (+dòng `VITE_VNINVEST_LICENSE_KEY=` trống theo pattern
  Turnstile — B3 O1, file example không chứa secret)
  · test mở rộng `vnstock-chart-panel.data-unlock.component.test.ts` (fail-before).
  SCOPE (vận hành, Owner làm): merge PR bump → thêm key vào `compose.staging.env` trên VPS → deploy → cùng verify.
- LIMIT: 3 vòng/sửa. `package-lock.json`, `compose.*.env`, `.npmrc` KHÔNG đụng.
- Non-goals: không sửa engine/widget; không revoke/rotate key; không đụng prod.

## 3. Nghiệm thu (Given/When/Then)

- G1: Given code chưa sửa, When chạy test mới, Then FAIL (chưa có trust-anchor call + chưa truyền licenseKey).
- G2: Given merge xong + key trong staging env + deploy, When mở `/stocks/<mã>` trên
  `docker.edusuccess.vn`, Then tier observables = Pro (dock pro mở, nudge=0) qua
  Playwright đo thật (không đoán DOM bằng mắt).
- G3: Mỗi bước thiếu (chưa merge/chưa key/chưa deploy) → ghi CHƯA CHẠY + lý do.

## 4. Gates + thứ tự (phụ thuộc Owner)

1. B3 audit plan → B4 đồng thuận → B5 claim+branch → B6 code+TDD → tsc → build local.
2. Mở PR bump (nếu chưa có) + PR slice này; **Owner merge** (tôi không merge).
3. Owner đặt key vào `/opt/vninvest/compose.staging.env` (KHÔNG qua chat/shell của tôi).
4. Deploy staging (`deploy-staging.sh`, SSH từ máy này — key `~/.ssh/id_ed25519` có sẵn)
   rồi `--verify`; Playwright đo tier thật.
5. B8 re-audit → claim done → ledger → PR.

## 5. Câu hỏi cần Owner chốt (hỏi sau B3)

- Q1: merge-first (sạch: merge PR bump + PR này rồi deploy `dev`) vs deploy nhánh feat
  qua `REPO_BRANCH` override để verify trước (nhanh nhưng staging lệch `dev` tạm thời)?
- Q2: ai đặt key vào `compose.staging.env` (Owner tự làm vs cho phép tôi SSH làm)?
