# AUDIT — Giao diện frontend (UI/UX) vninvest — hiện trạng chi tiết & roadmap nâng cấp chuẩn công nghiệp

> **Scope:** `packages/web` (React 19 + Vite 5 + Tailwind v4 + Radix) — toàn bộ giao diện: shell/navigation/routing, design system (token + Tailwind), trang thị trường/danh mục/broker, trang cài đặt/tenant-admin/platform-admin, Operations Center (SOC), trang AI (Command Center/Advisory/Usage/Audit/Traces/SLO), i18n, a11y, responsive, hiệu năng bundle.
> **Ngày:** 2026-10-30. **Phương pháp:** static analysis trên codebase (đọc file thật, grep counts, chạy gate). Không chạy E2E/ảnh chụp (chưa deploy bản mới; staging là `docker.edusuccess.vn`). Bám khung audit của `AGENTS.md` §"AI Audit/Research Framework" + impeccable `audit`.
> **Lessons áp dụng:** [L-V01] không dùng số đo chưa đối chứng · [L-V02] mọi "gốc rễ" kế thừa phải có phản chứng · [L-F03] token→`soc.tokens.css`, class→`soc.components.css`, KHÔNG `soc.module.css` (barrel) · [L-F06] heuristic cửa sổ dòng phải xác minh tay · [L-F08] màu tăng/giảm chuẩn Bloomberg (xanh=tăng, đỏ=giảm) **đúng, không báo sai** · [L-F11] không kết luận "CSS module không map class" từ source · [L-F12] bảng không dan nền cho 1 ô.
> **Owner/Next:** coordinator + agent FE; gate chạy trên VPS staging (`bash scripts/deploy-staging.sh --verify`).

---

## 0. Tóm tắt 5 phát hiện nghiêm trọng nhất

1. **Theming chưa là token swap thật sự.** Dark là mặc định; light-mode được vá bằng **các khối override theo page** trong `index.css` (`.advisory-page` dòng 335-445, `.core-dashboard-page` dòng 395-445) thay vì đổi token ở `soc.tokens.css`. Hard-hex rò rỉ 141+ chỗ (`check:tokens` **FAIL** — `soc.components.css`, `light-theme.css`, `brokerData.css`). → Light mode dễ vỡ, contrast trượt.
2. **Form UX không chuẩn hoá.** Chỉ **1 file** dùng `react-hook-form` và **1 file** dùng `zodResolver` trên 124 trang → validation tự dựng, thông báo lỗi không nhất quán, BE error hiển thị ad-hoc.
3. **3 stack chart song song** (widget 4 file, echarts 24 file, recharts 12 file) → bundle phình, visual không đồng nhất; advisory chunk đã từng 623 KB.
4. **i18n chưa phủ hết.** `vi.js` 7348 dòng / `en.js` 7316 dòng (monolith), lint báo **4417 warning** `react/jsx-no-literals` (nhiều là text tiếng Việt hardcode trong JSX, không qua `t()`). Scanner chỉ quét 5 file (`check:i18n-hardcoded` trong `package.json`).
5. **Navigation/admin naming gây nhầm.** Nhóm nav `admin` mang label `layout.nav.soc` (Operations Center) nhưng chứa `admin-users`, `advertising-admin` (`navigationCatalog.js:28-33`) → người dùng không biết đang vào khu vực nào.

---

## 1. Bản đồ kiến trúc (A)

### 1.1 Shell & layout

| Thành phần | File | Ghi chú |
|---|---|---|
| Entry | `src/main.tsx:274-304` | `createRoot` bọc `QueryProvider → PortfolioProvider → LangProvider → ToastProvider → ConfirmProvider → RealtimeProvider → App` |
| Layout | `src/layouts/AppShell.tsx:7-9` → `src/layouts/full/FullLayout.tsx` | Sidebar + Header + `<main id="main-content" tabIndex={-1} role="main">` (skip-link target), content `max-w-[80rem]` (dòng 102) |
| Theme boot | `src/main.tsx:260-272` | Đọc `localStorage 'vninvest-theme'`, set `data-theme="light"` trước first paint (tránh FOUC) |
| Providers context | `src/context/LangContext.js`, `PortfolioContext`, `RealtimeContext` | LangContext có fallback hằng số module (dòng 113-131) để tránh infinite re-render |
| Skip link / reduced-motion / touch targets | `src/index.css:777-799, 810-819, 901-926` | Đã có baseline a11y tốt |

### 1.2 Routing

- `src/app/routeCatalog.js` (809 dòng): **~65 route entry**, mỗi entry có `id, path, titleKey, group, buildTargets, requiredCapabilities, adapter, status`, một số có `staffOnly`, `deprecated/redirectTo`, `externalEntry`.
- `src/main.tsx:142-257`: khai báo `<Route>` thủ công + `ProtectedRoute` (xử lý auth state error + retry) + `StaffRoute`/`TenantRoute` guard.
- Redirect giữ query/hash: `RedirectPreserveQuery` (dòng 68-72), dùng cho `/whale-alerts`, `/ai-command-center`, `/portfolios/manage/broker`.
- Deep-link portfolio 5 tab (`/portfolios/:id/{overview,holdings,allocation,analytics,activity}`) — mỗi tab 1 URL (S-11).

### 1.3 Navigation

- `src/app/navigationCatalog.js` (57 dòng): **6 group** `workspace, signals, system, admin, tenant, vip-local` (dòng 6-48). Nhóm `admin` label `layout.nav.soc` chứa `operations-center, operations-center-mail-config, advertising-admin, admin-users`.
- Capability-based filtering; build-target filtering (saas/vip).

### 1.4 Quy mô codebase FE

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| Page files (.tsx/.jsx) | 124 | glob `src/pages` |
| CSS files | 23 | glob `src/**/*.css` |
| CSS modules | 9 | glob `*.module.css` |
| Locale lines | vi 7348 / en 7316 | `wc` (Measure-Object) |
| Chart libs (số file dùng) | widget 4 · echarts 24 · recharts 12 · klinecharts 0 · lightweight-charts 0 | Select-String |
| Form libs (số file dùng) | react-hook-form 1 · zodResolver 1 | Select-String |
| Radix (số file dùng) | 16 | Select-String |
| Lint | 0 errors / 4417 warnings | `npm run lint` (2026-10-30) |
| tsc | 0 errors | `npx tsc --noEmit` (2026-10-30) |

---

## 2. Luồng dữ liệu đã trace (B)

### 2.1 Luồng đổi theme (light/dark)

1. Boot: `main.tsx:261-272` đọc `localStorage 'vninvest-theme'` → set `data-theme="light"` trước paint.
2. User đổi trong `UserSettingsPage` → `applyUserTheme()` (`UserSettingsPage.tsx:13-27`) set attribute + persist.
3. Token swap: `soc.tokens.css:142-217` `:root[data-theme="light"]` remap `--text-*`, `--bg-panel`, `--pf-*`, `--soc-c-*`, `--soc-rgb-*`.
4. **Nhưng** nhiều component dùng Tailwind hardcode `bg-slate-900/30`, `text-slate-100` không đổi theo token → vá bằng override khối trong `index.css:335-445` (`.advisory-page`, `.core-dashboard-page`). → fragile, dễ sót class mới.

### 2.2 Luồng render 1 trang (Dashboard)

1. Route `/dashboard` → `resolvePageComponent('dashboard')` → registry `core-dashboard` (`main.tsx:24,53`).
2. `DashboardPage.tsx` dùng `useCoreDashboardData` (react-query) + `useRealtimeFeedFromManager`.
3. Render: `SmartStatsHeader`, `PortfolioHeatmap`, `UnifiedAlertCenter`, `CoreDashboardPositionDeck` trong bento grid (`index.css:489-526`, breakpoints 1279/1099px).
4. Loading/empty: phụ thuộc hook; có `PageErrorBoundary` (`DashboardPage.tsx:17`).
5. Charts: treemap/heatmap ECharts (`.echarts-tooltip-dark` override `index.css:680-710`).

---

## 3. CONTRADICTIONS — claim/doc vs code (C)

| # | Claim (nguồn) | Thực tế (code) | Tác động |
|---|---|---|---|
| C1 | `AGENTS.md`: "`soc.module.css` chỉ barrel 3 dòng, 0 token, 0 class" | Verified — file đúng 3 dòng re-export | Quy tắc thi hành được; token/class PHẢI vào `soc.tokens.css`/`soc.components.css` |
| C2 | `PLAN_UI_REDESIGN_20261021.md`: `SocVnbrokerPanel.tsx` 1382d, `SocBrokerPanel.tsx` 505d | Chưa re-verify trong audit này (L-V02) — cần đo lại trước khi dùng số | Tránh báo cáo sai kích thước |
| C3 | `AUDIT_UIUX_DASHBOARD_20260926.md` có thể đã liệt kê issue đã fix | Chưa đối chiếu từng item; audit này chỉ dùng làm lead, không tái sử dụng kết luận | Tránh lặp finding đã đóng |
| C4 | `navigationCatalog.js` nhóm `admin` label `layout.nav.soc` nhưng chứa `admin-users`, `advertising-admin` | Label "SOC" không phản ánh nội dung | Wayfinding sai |
| C5 | `check:i18n-hardcoded` chỉ quét 5 file (package.json) nhưng repo có 124 page | Coverage i18n hardcoded rất hẹp | Finding P1 #16 |

---

## 4. Findings (D)

### 4.1 P0 — Blocking (fix ngay)

| ID | Issue | Location | Impact / Standard | Đề xuất |
|---|---|---|---|---|
| P0-1 | Theming = override theo page thay vì token swap; hard-hex rò rỉ 141+ chỗ | `src/index.css:335-445`, `src/components/soc/soc.components.css` (nhiều hex), `src/theme/light-theme.css` | Light mode vỡ, contrast trượt; WCAG 1.4.3 | Gom override vào `soc.tokens.css :root[data-theme="light"]`; migrate hex → token; chạy `check:tokens` xanh |
| P0-2 | `check:tokens` FAIL (hard hex ngoài allowlist) | output gate 2026-10-30: `brokerData.css: #c4b5fd`, `soc.components.css: #047857/#0e7490/...`, `light-theme.css` | Gate UI không xanh | Allowlist chỉ status/chart/private; migrate còn lại |
| P0-3 | Form không chuẩn hoá (1 file RHF, 1 file zod) | grep counts: `react-hook-form` 1 file, `zodResolver` 1 file trên 124 page | Validation không nhất quán, UX lỗi khác nhau | Chuẩn hoá RHF+zod cho form mới + shared `FormField` primitive; migrate form lớn (login/register/reset, portfolio manage, settings) |
| P0-4 | Chart stack phân mảnh (3 lib) | counts: widget 4 · echarts 24 · recharts 12 | Bundle phình (advisory từng 623 KB), visual không đồng nhất | Consolidate: widget cho market chart, echarts cho dashboard, loại recharts nơi widget đã phủ; lazy-load heavy chart |
| P0-5 | i18n monolith (vi 7348 / en 7316 dòng) | `src/i18n/vi.js`, `src/i18n/en.js` | Merge conflict, dead key, editor chậm | Split theo namespace (common, routes, pages/*) với i18next namespaces |

### 4.2 P1 — Major (fix trước release)

| ID | Issue | Location | Impact / Standard | Đề xuất |
|---|---|---|---|---|
| P1-6 | Hardcoded text tiếng Việt trong JSX (4417 lint warning `react/jsx-no-literals`) | `npm run lint` 2026-10-30 (0 err / 4417 warn) | i18n coverage không đầy đủ; WCAG 3.1 (ngôn ngữ) | Tách warning thực sự (text) khỏi prop literal (`type=`, `key=`); migrate text → `t()` |
| P1-7 | i18n hardcoded scan chỉ 5 file | `package.json:33` `check:i18n-hardcoded` | Coverage hẹp | Mở rộng scan sang `src/pages` + `src/components` |
| P1-8 | Tables dựng tay thay vì shared primitive | `SocVnbrokerPanel.tsx:11` dùng `CommercialTable` (tốt); nhiều admin page tự dựng `<table>` | UX không đồng nhất | Áp `CommercialTable` + `AdminPanel` cho mọi bảng; thêm sticky header + responsive scroll |
| P1-9 | States (loading/empty/error) không đồng nhất | `UserSettingsPage.tsx:58-76` tự `setLoading`; `AlertCenterPage.tsx:6-7` dùng `ShellSkeleton` | Trải nghiệm không nhất quán | Chuẩn hoá `ShellSkeleton`/`ShellEmptyState`/`ShellPanel` states trên mọi trang |
| P1-10 | A11y ARIA gaps (icon-only buttons, table caption/th scope) | Chưa verify tay từng file (L-F06) — cần audit selector-level | WCAG 1.3.1/4.1.2 | Chạy axe + Playwright a11y; thêm `aria-label` cho icon button; `scope="col"` cho th |
| P1-11 | Responsive fixed min-width có thể overflow mobile | `soc.tokens.css:125-126` `--vnb-tile-min: 260px`, `--vnb-kpi-min: 150px` | Horizontal scroll trên 320px | Dùng `min()`/`clamp()`; test viewport 390px |
| P1-12 | Navigation/admin naming gây nhầm | `navigationCatalog.js:28-33` group `admin` label `layout.nav.soc` chứa `admin-users`, `advertising-admin` | Wayfinding sai | Đổi label thành "Quản trị" và tách "Operations Center" riêng |
| P1-13 | Bundle/perf chưa lazy-load đủ | `AICommandCenterPage.tsx:20-22` lazy `AIAuditLogsPanel`; widget/charts chưa lazy đồng bộ | TTI chậm, chunk lớn | Mở rộng `lazy()` cho trang chart heavy; verify `measure-route-graph.mjs` |
| P1-14 | Light-mode override theo class page (`.advisory-page`, `.core-dashboard-page`) | `index.css:335-445` | Class mới không được phủ; dễ sót | Override theo nhóm utility đã làm; thêm checklist khi thêm class mới |

### 4.3 P2 — Minor (pass sau)

| ID | Issue | Location | Đề xuất |
|---|---|---|---|
| P2-15 | 3 thang spacing song song | `index.css:96-107` (`--space-*`), `soc.tokens.css:24-28` (`--sp-*`), `index.css:108-116` (`--layout-*`) | Consolidate về 1 scale (4/8/12/16) |
| P2-16 | Type scale phân mảnh | `soc.tokens.css:74-77` (`--fs-*`), `adminUi.tsx:30` (`--fs-2xs`), Tailwind `text-xs..2xl` | Một type scale duy nhất |
| P2-17 | Status color định nghĩa 2 nơi | `index.css:46-54` semantic + `soc.tokens.css:135-139` `--soc-status-*` | Dùng 1 nguồn |

### 4.4 P3 — Polish (nếu còn thời gian)

| ID | Issue | Location | Đề xuất |
|---|---|---|---|
| P3-18 | SOC panels dùng `soc.module.css` (barrel) — verify class có resolve không | `SocVnbrokerPanel.tsx:13` `import styles from "./soc.module.css"` | Đọc CSS build (`dist/assets/soc-*.css`) tìm `_metricCard_<hash>` trước khi kết luận (L-F11); migrate sang `soc.components.css` class |
| P3-19 | Skip link trong `index.html` chưa verify tồn tại | `index.css:777-799` định nghĩa `.skip-link` | Verify `index.html` có `<a class="skip-link" href="#main-content">` |

---

## 5. Quality gates (E)

| Gate | Kết quả 2026-10-30 | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` | ✅ 0 errors | packages/web |
| `npm run lint` | ✅ 0 errors / ⚠ 4417 warnings | Chủ yếu `react/jsx-no-literals` |
| `npm run check:shell` | ❌ fail tại `check:tokens` | Hard hex ngoài allowlist (141+). Các bước sau (contrast, i18n scan strict, i18n-hardcoded) **CHƯA CHẠY** vì gate dừng sớm |
| `npm run check:contrast` | CHƯA CHẠY | Script chỉ kiểm adminTone pairs (emerald/amber/rose/sky/cyan/violet/slate) ≥4.5:1 cả 2 mode |
| `npm run i18n:scan:strict` | CHƯA CHẠY | — |
| `npm run check:i18n-hardcoded` | CHƯA CHẠY | Chỉ quét 5 file |
| `npm run check:dom-landmarks` | ✅ PASS (trong check:shell trước khi fail) | ShellPageChrome `<div>` not `<main>`; FullLayout 1 `<main>`; overflow-auto page scroll owner |
| `npm run test` / `test:components` | CHƯA CHẠY | Baseline đã biết: BE 602 test (10 fail/3 err); FE 1 flaky pre-existing (`useAlertCenterSnapshot.pagination`) — không quy cho code mới |
| `npm run build` (vite) | CHƯA CHẠY | Cần để đo bundle/chunk size (perf audit) |

> Quy tắc (AGENTS.md): không báo "PASS" cho thứ chưa chạy — đã ghi "CHƯA CHẠY" rõ ràng.

---

## 6. Câu hỏi cần làm rõ (F)

1. Light mode có phải mục tiêu chính (owner dùng light?) hay dark-first là chủ đích? Ảnh hưởng ưu tiên P0-1.
2. Form standardization: có chấp nhận thêm dependency `react-hook-form` (đã cài) + `zod` (đã cài) không? Cả hai đã trong `package.json` — không cần cài thêm.
3. Chart consolidation: có thể gỡ `recharts` sau khi migrate 12 file không? Cần owner xác nhận không có consumer ngoài (vip-app?).
4. i18n split namespace: có breaking change cho test đang import `vi.js` trực tiếp không? Cần audit test imports trước.
5. Navigation label `layout.nav.soc`: đổi sang "Quản trị" có ảnh hưởng i18n key không (thêm key mới vs rename)?

---

## 7. Đánh giá tổng thể (G)

### 7.1 Audit Health Score (impeccable, 0-4 mỗi chiều)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Baseline tốt (focus-visible, skip link, reduced-motion, touch 44px, safe-area); gaps ARIA chưa verify tay |
| 2 | Performance | 2 | 3 chart stack, lazy-load partial, echarts heavy |
| 3 | Theming | 2 | Token tồn tại nhưng hard-hex rò rỉ 141+, override theo page |
| 4 | Responsive | 3 | Dashboard bento responsive, touch targets; fixed min-width rủi ro mobile |
| 5 | Implementation Integrity | 2 | Forms hand-rolled, i18n monolith, nhưng primitives/gates tốt |
| **Total** | | **12/20** | **Acceptable (significant work needed)** |

Rating band: 10-13 = Acceptable, significant work needed. Recent standardization (W0/W1 adminUi kit, check gates) đã nâng từ mức thấp hơn; còn P0/P1 cần xử lý trước release.

### 7.2 Implementation Integrity Verdict

**Partially coherent.** Hệ thống có SSOT rõ (routeCatalog, navigationCatalog, adminUi kit, Commercial primitives, soc tokens, check gates) nhưng có **repeated shortcuts**: form tự dựng, 3 chart stack, i18n monolith, light-mode override theo page. Không phải "systemic drift" nhưng chưa "coherent and intentional" toàn diện. Verdict: **PASS có điều kiện** — cần đóng P0 trước khi coi UI đạt chuẩn công nghiệp.

---

## 8. Recommended Actions (ưu tiên P0 → P1 → P2 → P3)

1. **[P0] `/impeccable colorize`** — migrate hard-hex → token, đóng `check:tokens` (context: `soc.components.css`, `light-theme.css`, `brokerData.css`).
2. **[P0] `/impeccable adapt`** — consolidate light-mode overrides vào token layer, sửa contrast light.
3. **[P0] `/impeccable harden`** — chuẩn hoá form (RHF+zod), loading/empty/error states, i18n coverage.
4. **[P0] `/impeccable optimize`** — lazy-load chart heavy, consolidate chart stack, đo bundle.
5. **[P1] `/impeccable audit`** — ARIA + responsive manual verification (icon buttons, table scope, fixed min-width).
6. **[P1] `/impeccable clarify`** — rename nav group + i18n keys.
7. **[P1] `/impeccable layout`** — consolidate spacing scale.
8. **[P2] `/impeccable typeset`** — unify type scale.
9. **[P3] `/impeccable document`** — sinh `DESIGN.md` từ code (tokens + components) làm SSOT.
10. **[final] `/impeccable polish`** — pass cuối cùng sau khi fix.

---

## 9. Roadmap nâng cấp UI/UX đạt chuẩn công nghiệp (phased)

- **Phase A — Foundation (1-2 sprint):** đóng `check:tokens` xanh; gom light-mode overrides vào `soc.tokens.css`; chạy `check:contrast` + `check:light-theme` (nếu có); verify trên staging VPS.
- **Phase B — Consistency (2-3 sprint):** form standard (RHF+zod + `FormField`); tables (`CommercialTable`/`AdminPanel`); states (`ShellSkeleton`/`ShellEmptyState`); icon-button `aria-label`.
- **Phase C — Performance & bundle (1-2 sprint):** lazy-load chart heavy; consolidate chart stack; split i18n namespace; đo bằng `measure-route-graph.mjs` + `npm run build`.
- **Phase D — A11y & responsive (1-2 sprint):** axe scan; keyboard nav audit; `min()`/`clamp()` cho fixed widths; breakpoint consolidation.
- **Phase E — Polish & SSOT (1 sprint):** `DESIGN.md` + extract design system; visual regression baseline (`test:visual` Playwright) trên staging.

Mỗi phase: claim vào `docs/CLAIMS.md`, gate `node packages/web/scripts/check-multi-agent.mjs`, PR qua `scripts/agent-pr.ps1`, verify staging `bash scripts/deploy-staging.sh --verify`.

---

## 10. Tests / validation cần thêm

- `check:tokens` phải xanh (gate).
- Mở rộng `check:i18n-hardcoded` sang `src/pages` + `src/components`.
- A11y: thêm Playwright axe scan trên route công khai (`/login`, `/register`) + 3 route bảo vệ (dashboard, settings, operations-center) ở viewport 390×851.
- Visual regression: cập nhật baseline Playwright sau khi đổi theme (L-V03: review ảnh phát sinh trước commit).
- Contrast: thêm pair cho SOC status badge ở light mode (gate mới).
- Form: unit test validation cho login/register/reset/password-change.

---

## 11. Owner / next steps

- **Owner:** chốt câu hỏi §6 (đặc biệt Q1 light-mode priority, Q3 gỡ recharts).
- **Coordinator:** phân slice theo Phase A→E, claim trong `docs/CLAIMS.md`, không commit file shared (AGENTS.md §2).
- **Agent FE:** bắt đầu Phase A (P0-1, P0-2) — slice nhỏ, gate `npx tsc --noEmit` + `npm run check:tokens`.
- **Verify:** staging VPS `14.225.255.47` (`/opt/vninvest`, branch `dev`) qua `bash scripts/deploy-staging.sh --verify`.

---

*Audit này là nghiên cứu tĩnh trên codebase; mọi số đo chưa chạy (build/test/lint i18n/contrast) đã ghi "CHƯA CHẠY". Khi chạy gate, cập nhật §5 và ledger.*