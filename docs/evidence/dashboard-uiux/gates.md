# Gates — Dashboard P0 Remediation (branch `feat/dash-p0-uiux`)

> **Phạm vi / ngày:** 2026-11-18 · 6 P0 trên `/dashboard` · base `dev @ 577ddf646`.
> **Revision cuối đã audit:** `96eee2765` (`pwsh -File scripts/agent-sync.ps1` chạy sau commit, rebase no-op vì `origin/dev` không tiến).
> Mọi con số dưới đây kèm lệnh tái tạo. Không báo PASS cho thứ chưa chạy.

## 1. TDD fail-before → pass-after

| Lệnh | Kết quả |
|---|---|
| `cd packages/web && npx vitest run <6 file test trong plan §4>` (trước sửa code) | **6 file fail / 16 test fail / 17 pass** — RED đúng chỗ: `Header AC-B'''` pathname `/` thay vì `/stocks/VCB`; `heatColorContinuous(0) === '#334155'`; `formatAlertMetric is not a function`; `resolveTileSize is not a function`; navigate CTA không được gọi; call-site P0-6 vẫn đánh index thẳng. |
| cùng lệnh sau khi sửa | **6 file pass / 35 test pass / 0 fail** |

File test: `src/layouts/full/vertical/header/__tests__/Header.component.test.tsx` (sửa), `src/components/dashboard/__tests__/heatmap-scale.component.test.ts` (sửa), `src/components/dashboard/__tests__/{alert-format,heatmap-sizing,smart-stats-cta}.component.test.*` (mới), `src/pages/__tests__/dashboard-first-symbol.component.test.ts` (mới).

Regression check: `npx vitest run src/components/alert-center/AlertCard.component.test.tsx src/features/dashboard/__tests__/dashboard_lifecycle.test.js` → **7 pass** (4 assertion cũ của `collectUniqueSortedSymbols` vẫn xanh — contract chuỗi giữ nguyên).

## 2. Static gates (chạy thật tại `packages/web`)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit **0** |
| Lint | `npm run lint` | exit **0** — **0 errors**, 4629 warnings (baseline cả repo; 7 file đổi đóng góp 56 warnings, auditor B8 tự đếm) |
| Tokens | `npm run check:tokens` | PASS — 79 hex allowlisted, 0 violation |
| i18n scan | `npm run i18n:scan:strict` | exit **0** — chỉ warning `loadError`/`cancel`/`delete`… đã có từ trước, không phải key mới |
| i18n hardcode | `npm run check:i18n-hardcoded` | exit **0** — 19 file / 0 chuỗi Việt cứng. ⚠ **Giới hạn gate:** `package.json:33` chỉ quét 5 path (`components/advisory`, `WhaleBubbleChart.jsx`, `FactsFirstWhaleBubbleChart.jsx`, `dashboard/WhaleAnalyticsTab.jsx`, `pages/signals/WhaleAdvisoryPage.tsx`) — **không phủ 6 file đổi**. Auditor B8 đã mở trực tiếp `vi/en/heatmap.js` xác nhận 3 key legend `≤ -7% / 0% / ≥ +7%` + key mới `sizeFallbackCap` có đủ 2 locale. |
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0 lỗi, 0 trùng số migration — PASS** (201 cảnh báo stale claim từ lịch sử, không chặn) |
| EOL | `node scripts/normalize-eol.mjs --fix` + `git diff --numstat` | đã chuẩn hoá 12 file CRLF→LF sau lần commit đầu bị gate chặn (L-T01); số dòng diff giữ nguyên dự kiến |

## 3. Sync / build (repo script)

`pwsh -File scripts/agent-sync.ps1` → `SYNC_EXIT=0`: rebase no-op · `✓ built in 39.83s` (vite build OK) · OpenCore doc sync PASS · large-file guard **cảnh báo có sẵn trên `dev`** (SocDataOpsConfigSection.tsx 971 dòng, AICommandCenterForm.tsx 948, … — không phải file slice này, không chặn).

## 4. CHƯA CHẠY (không suy diễn)

- Full `npm run test:components` toàn bộ 167 file / 1134 test và `npm run test` — theo runbook chỉ chạy trên **VPS staging** `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`), không local.
- Visual QA / screenshot sau đổi màu Heatmap (P0-2) — cần chạy staging và **mở ảnh ra xem** (L-V05), không tin exit code.
- E2E Playwright `/dashboard` + `/alert-center` — CHƯA CHẠY.
- `check-a11y-runtime` cho dropdown gợi ý mới — CHƯA CHẠY (jsdom test chỉ phủ role/option, không đo focus ring thật).

## 5. Ghi chú citation (auditor B8, L-T02)

Do thêm comment khi sửa, số dòng thực tế lệch nhẹ so với plan: legend inline `PortfolioHeatmap.js:642` (plan ghi `:609`), P0-6 call-site `DashboardPage.tsx:320` (`:319` là dòng comment). Nội dung đúng; tra cứu nên tìm theo tên helper `heatmapLegendGradient()` / `collectUniqueSortedSymbols(...).split('|')[0]` thay vì số dòng cứng.

## 6. Reservation từ B4 đã đóng

- S2: `PortfolioHeatmap.js:642` gọi thẳng `heatmapLegendGradient()` (không inline `HEAT_STOPS.map`).
- S3: helper nằm ở `utils/alertCenterFormat.ts` (extension `.ts` đúng như glob của auditor).
