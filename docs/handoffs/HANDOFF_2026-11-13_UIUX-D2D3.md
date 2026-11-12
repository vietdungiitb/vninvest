# HANDOFF 2026-11-13 — UI/UX D2/D3 + tickets + VPS verify (Owner uy quyen, solo)

> **Pham vi:** D2 go recharts → RechartsCompat shim · D3 split i18n (101 ns) · ticket 1/2/3 ·
> C1 perf baseline · VPS verify (BE check+smoke, axe 5 route, D2 render that) · axe follow-up fix.
> **Branch:** `dev` (3 commit + 2 fix/ledger commit, da push). **Trang thai:** `done`.
> **Lesson rut ra (ghi ngay trong phien):** PowerShell 5.1 `Get-Content`+`WriteAllText` = mojibake
> vinh vien (chi dung `edit`); axe PASS ma khong doi content = vacuous; baseline visual theo OS;
> PS 5.1 parse file UTF-8 khong BOM nhu Windows-1252 (them BOM de fix).

## 1. Da lam (evidence: file:line tren dev @ `5c422ef0b`)

| # | Viec | Ket qua | Gate chay that |
|---|---|---|---|
| D2 | Go `recharts` ^2.12.7 → `RechartsCompat.tsx` shim (echarts treeshake). 10 file doi 1 dong import. Xoa dep khoi `package.json` + regen lock | `check-tokens` PASS · tsc 0 · lint 0 err · vitest 5/5 (shim) + 60/60 (4 test file mock) · build PASS (khong con chunk recharts, shim 6.9KB) | `packages/web/src/components/charts/RechartsCompat.tsx` (moi) + `__mocks__` + test |
| D3 | Split `vi.js`/`en.js` monolith → `locales/vi|en/*.js` (101 ns moi ben) + barrel giu shape | deep-equal JSON 2 ben · dup-pin test mo rong van bat 6 known dups (10/10) · tsc 0 · vitest i18n 72/72 · build PASS | `packages/web/src/i18n/locales/` (202 file) |
| T1 | `ai-cc-i18n-clean` | 7/7 PASS, khong can sua | — |
| T2 | `auth-forms-rhf-extra` treo >180s: mock tu fire onVerify trong effect + inline arrow → loop vo han. Fix: mock giong widget that (nut click) | 3/3 PASS trong 4.75s | test file |
| T3 | `new-agent.ps1` parse FAIL tren PS 5.1: ROOT CAUSE la thieu BOM (parser doc nhu Win-1252). Fix: BOM + viet lai dong `$row` + assign-truoc-if | 4/4 scripts parse OK tren 5.1 | `scripts/new-agent.ps1` |
| C1 | Perf baseline: dashboard/Portfolio initial keo echarts 711KB; TenantAdminHome 2100KB; AdminAnalytics khong keo | `docs/evidence/uiux-remediation/PERF_BASELINE_20261113.md` | measure-route-graph |
| A2 | Light theme (b) — tat option Sang, force dark (quyet dinh Owner truoc phien) | tsc 0, PR #354 merged | `UserSettingsPage.tsx`, `main.tsx` |

## 2. VPS verify (scratch `/root/vninvest-verify`, DA XOA + token da thu hoi vi tri)

- BE: `manage.py check` 0 issues · `test market_serving` 26/26 OK (trong container staging).
- FE build tren VPS (Linux): `recharts` KHONG con trong node_modules; `npm run build` PASS 34.5s.
  (Can GITHUB_TOKEN cho registry — Owner cap qua chat; khong commit. Rotate token sau phien.)
- Axe 5 route @390x851: lan 1 VACUOUS (chua doi bootstrap) → lan 2-3 that: `aria-required-children`
  (nav>h3) + `color-contrast` (nut retry bootstrap 3.61:1). Fix: group+aria-hidden h3, cyan-700/800.
  **Lan 4: 6/6 PASS, 0 critical/serious/minor.**
- D2 render that: probe doi canvas → `canvas=1` tren /tenant-admin/home (echarts ve duoc qua shim).
- Visual baseline: tenant-admin spec fail hang loat — NGUYEN NHAN: snapshot chi co ban win32
  (Linux khong co baseline) + bootstrap cham 5-10s qua proxy (spec doi 1s) + tenant data toan 0.
  KHONG phai loi render. Khong update baseline win32 tu Linux.

## 3. Con lai (can Owner / VPS / slice rieng)

- **C3** i18n lazy namespace (can async loader + Suspense) · **C4** (da xong trong D2: go recharts) ·
  **C2 chart-defer** (lazy chart blocks, ~-700KB initial) · **4 nut `bg-cyan-600`** tuong tu trong
  advisory (BentoHeader:74, OrderTicket:106, AlertDialog:107, OrderFlowRadar:207).
- **Full vitest** tren VPS (chua chay — dai) · **deploy staging** (can Owner chot, anh huong shared).
- **3 worktree/agent khac KHONG DUNG TOI**: `vninvest-wt-bespec` (chart-widget-team, in-progress),
  `vninvest-wt-b1` (detached, khong ro owner — giu nguyen), untracked docs PLAN_*/evidence/* (cua agent khac).
- **GITHUB_TOKEN (ghp_...) da dung xong**: Owner NEN ROTATE/REVOKE ngay (da paste trong chat + dung tren VPS shared).

## 4. Next steps / owner

1. Rotate/revoke GITHUB_TOKEN vua cap (uu tien P0 ve secret).
2. Quyet dinh visual baseline win32: chay tren may dev (Windows) sau khi pull dev moi nhat.
3. Chot deploy staging (rebuild image tu dev hien tai).
4. Mo slice: C2 chart-defer + 4 nut advisory contrast + C3 lazy i18n (co the gop 1 slice M).
