# Gates FE — mbw3-fe (Wave 3)

Ngày: 2026-10-15 · Nhánh: `feat/mbw3-fe` · HEAD khi đo: `9427f0038`
(đo lại sau mỗi push; số cũ `1a98db915` chỉ còn giá trị lịch sử trong `vps-fe-probe.md`)

## 1. Local (§12.2 — được phép)

| Gate | Lệnh | Exit | Nơi chạy |
|---|---|---|---|
| type-check | `npx tsc --noEmit` (packages/web) | 0, không output | local |
| lint | `npx eslint` 9 file slice (adapter, BindingsPanel + test, ScopedWatchlist, sourceBadge, Holdings, UserSettings, routeCatalog, vi/en) | 0 (65 dòng warning `react/jsx-no-literals`, cùng họ với code cũ, 0 error) | local |
| DUPID gate thật | `Select-String 'id: "portfolios-manage"' routeCatalog.js` | == 1 (dòng 202; `portfolios-manage-broker` là id khác) | local |
| titleKey AC6 | entry `portfolios-manage` → `portfoliosManage.title`; `main.tsx:33` map `portfolios-manage` → `core-portfolios`; route `/portfolios/manage` giữ | khớp, đọc tay | local |
| grep link chết FE-MERGE | `BrokerSettingsSection` trong `UserSettingsPage.tsx` = 0 hit; redirect `portfolios/manage/broker` → `/broker` còn trong `main.tsx:173` | 0 sót | local |
| grep `soc.module` trong 2 file mới | 0 hit (dùng `brokerData.css` + SOC tokens/classes hiện có) | đạt | local |
| i18n key tay | 36 key `msg("…")` trong BindingsPanel + 8 key ScopedWatchlist + holdings/settings key trực tiếp — tất cả có mặt trong cả `vi.js` và `en.js` khối `brokerWave3` | đủ | local |

## 2. VPS staging (§12.4 — bắt buộc, worktree `/tmp/wt-mbw3-fe-vps`)

| Gate | Lệnh | Exit | Nơi chạy |
|---|---|---|---|
| vitest 5 file mới | `corepack npm run test:components -- <5 file>` (log `/tmp/mbw3-fe-tests2.log`) | 0 — **5 files / 20 tests passed** | VPS |
| control xanh | `... -- src/components/BrokerSettingsSection.component.test.tsx` (log `/tmp/mbw3-fe-control.log`) | 0 — **1 file / 5 tests passed** | VPS |
| fail-before ĐỎ | worktree `/tmp/wt-mbw3-red` @ `8c9922375`, cùng 5 file (log `/tmp/mbw3-fe-red.log`, đã dọn worktree) | 1 — **5/5 files failed** (import-error ×2 + assertion ×2 + TypeError ×1) | VPS |
| i18n strict | `corepack npm run i18n:scan:strict` (log `/tmp/mbw3-fe-i18n.log`) | 0 | VPS |
| build | `corepack npm run build` = `tsc && vite build` (log `/tmp/mbw3-fe-build.log`) | 0, 31.99 s | VPS |
| bundle /broker | `node scripts/measure-route-graph.mjs BrokerHubPage` trên `dist/` VPS | **1361.0 KB** (16 chunk, không gzip) ≤ 1450 ✅ | VPS |
| bundle /broker/accounts/:accountId | `... BrokerAccountPage` | **1356.5 KB** (17 chunk) ≤ 1450 ✅ | VPS |

## 3. CHƯA CHẠY (ghi rõ, không báo PASS)

- E2E 2 SubAccount thật — ngoài wave (ticket riêng TEST-E2E, plan §0 non-goals).
- Regression BE trên DB tạm — thuộc slice BE (`feat/mbw3-be`), không phải việc FE.
- Full FE suite (`test`, `test:components` toàn bộ) — chỉ chạy 5 file mới + 1 control theo phạm vi slice; full suite là việc Pha 3 của supervisor.
