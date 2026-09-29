# VNInvest Enterprise UI Consistency Audit — 2026-09-24

> **Auditor**: Principal Frontend Architect / Lead Design System Engineer  
> **Scope**: Full `packages/web/src` (pages, components, layouts, SOC, admin, tenant, auth, workspace, dashboard)  
> **SSOT**: `packages/web/src/theme/tokens.css`, `packages/web/src/index.css` (`@theme` block), `packages/web/src/theme/theme.module.css`  
> **Method**: Static analysis + regex + AST scan across 100+ files; 3 parallel scan agents; independent review

---

## SSOT TOKEN REFERENCE

**Typography scale**: `--fs-2xs:11px, --fs-xs:12px, --fs-sm:13px, --fs-md:14px, --fs-lg:16px, --fs-xl:18px, --fs-2xl:22px`

**Spacing (8pt grid)**: `--sp-1:0.25rem(4px), --sp-2:0.5rem(8px), --sp-3:0.75rem(12px), --sp-4:1rem(16px), --sp-5:1.25rem(20px), --sp-6:1.5rem(24px)`

**Radius**: `--r-sm:6px, --r-md:8px, --r-lg:12px, --r-pill:999px`

**Colors**: `--text-primary:#f1f5f9, --text-muted:#64748b, --text-secondary:#94a3b8, --accent-cyan:#06b6d4, --accent-emerald:#10b981, --accent-rose:#ef4444, --accent-amber:#f59e0b, --bg-panel:#0f172a, --border-default:#1e293b`

**Tailwind @theme**: `text-slate-100..950, text-cyan-400..900, text-emerald-400..500, text-amber-400..500, text-rose-400..500, bg-slate-.., border-slate-..`; `--radius-sm..2xl`; `--space-1..16`; `--shadow-sm..2xl`

---

## PART I: EXECUTIVE INCONSISTENCY MATRIX

| ID | File | Component/Violation | Code (Lỗi) | Token Chuẩn | Mức | Regression |
|---|---|---|---|---|---|---|
| ERR-01 | `components/ShellPageTemplate.module.css` | `.title` font-size | `font-size: 34px` | `--fs-2xl:22px` | Critical | Low |
| ERR-02 | `components/ShellPageTemplate.module.css` | `.description` | `font-size: 15px` | `--fs-lg:16px` or `--fs-md:14px` | High | Low |
| ERR-03 | `components/aiSettings.module.css` | `.pageTitle` | `font-size: 28px` | `--fs-2xl` (extend scale) | High | Low |
| ERR-04 | `components/aiSettings.module.css` | `.metricValue` | `font-size: 24px` | `--fs-2xl:22px` | Medium | Low |
| ERR-05 | `components/soc/soc.components.css` | `.panelTitle` | `font-size: 21px` | `--fs-2xl:22px` | Medium | Low |
| ERR-06 | `pages/commercial/BillingCenterPage.tsx` | Multiple | `font-size: 9px,15px,24px,11px,13px,18px` | `--fs-2xs..--fs-xl` | Critical | Low |
| ERR-07 | `pages/commercial/PaymentReturnPage.tsx` | Multiple | `font-size: 24px,13.5px,14.5px` | `--fs-2xl`, `--fs-sm` | High | Low |
| ERR-08 | `pages/ScreenerPage.tsx` | Multiple | `fontSize:'20px','11px','12px'` | `--fs-xl`, `--fs-2xs`, `--fs-md` | High | Low |
| ERR-09 | `pages/admin/AdminCorePATsPage.tsx` | `text-[10px]` | `className="text-[10px]..."` | `--fs-2xs:11px` | Medium | Low |
| ERR-10 | `pages/admin/AdminCoreUsagePage.tsx` | `text-[10px]` | Same pattern | `--fs-2xs:11px` | Medium | Low |
| ERR-11 | `pages/admin/AdminCoreServiceAccountsPage.tsx` | `text-[10px]` | Same pattern | `--fs-2xs:11px` | Medium | Low |
| ERR-12 | `pages/admin/ShellOperationsCenterPage.tsx` | `fontSize:0.68rem` | ~10.88px | `--fs-xs:0.75rem` | Medium | Low |
| ERR-13 | `pages/admin/AdminAnalyticsPage.tsx` | `text-[11px]` x4 + `fontSize:11` | arbitrary | `--fs-xs` | Low | Low |
| ERR-14 | `pages/admin/adminUi.tsx` | `text-[11px]` x2 | arbitrary | `--fs-xs` | Low | Low |
| ERR-15 | `components/soc/SocDataOpsPanel.tsx` | `fontSize:"0.7rem"` | 11.2px not on grid | `--fs-2xs:11px` | Medium | Low |
| ERR-16 | `components/soc/SocDataOpsMonitorSection.tsx` | `fontSize:"0.7rem","0.6rem","0.72rem"` | 11.2/9.6/11.5px | `--fs-2xs` | Medium | Low |
| ERR-17 | `components/soc/SocRetentionHealthPanel.tsx` | `fontSize:"0.82rem","0.80rem","0.65rem"` | 13.1/12.8/10.4px | `--fs-md`, `--fs-2xs` | Medium | Low |
| ERR-18 | `components/soc/SocVnbrokerPanel.tsx` | `fontSize:"0.7rem"` x3 | 11.2px | `--fs-2xs` | Medium | Low |
| ERR-19 | `components/soc/SocOverviewPanel.tsx` | `fontSize:"0.7rem","0.75rem"` | 11/12px | `--fs-2xs`, `--fs-xs` | Medium | Low |
| ERR-20 | `components/soc/SocDataOpsOperationsSection.tsx` | `fontSize:"0.78rem","0.68rem"` | 12.5/10.9px | `--fs-sm`, `--fs-xs` | Medium | Low |
| ERR-21 | `components/soc/SocDataInventorySection.tsx` | `fontSize:"0.7rem","0.7rem"` | 11.2px | `--fs-2xs` | Medium | Low |
| ERR-22 | `components/soc/SocDataOpsPlannerConsole.tsx` | `fontSize:"0.7rem"` | 11.2px | `--fs-2xs` | Medium | Low |
| ERR-23 | `components/dashboard/CoreDashboardPositionDeck.tsx` | `text-[10px]` x6, `text-[11px]` x3 | arbitrary | `--fs-2xs` | Medium | Low |
| ERR-24 | `pages/UpgradePage.tsx` | `text-[11px]` | arbitrary | `--fs-xs` | Low | Low |
| ERR-25 | `components/soc/soc.components.css` | `.tabBar` | `gap:0.35rem` (5.6px) | `var(--sp-1)` or `var(--sp-2)` | Medium | Low |
| ERR-26 | `components/soc/soc.components.css` | `.tabButton` | `padding:0.55rem 0.9rem` (8.8/14.4px) | `var(--sp-2) var(--sp-3)` | Medium | Low |
| ERR-27 | `components/soc/soc.components.css` | `.tabButton` | `gap:0.4rem` (6.4px) | `var(--sp-2)` | Medium | Low |
| ERR-28 | `components/ShellPageTemplate.module.css` | `.bodyGrid`, `.stack` | `gap:18px` | `var(--sp-4)` (16px) | High | Low |
| ERR-29 | `pages/ScreenerPage.tsx` | Inline styles | `padding:'6px 16px'`, `marginBottom:'4px'` | `var(--sp-2) var(--sp-4)`, `var(--sp-1)` | Medium | Low |
| ERR-30 | `components/soc/SocQueueTierFieldSet.tsx` | tierIconMap gap | `gap:6px` | `var(--sp-2)` | Medium | Low |
| ERR-31 | `components/ShellPageTemplate.module.css` | `.shellPage` border-radius | `28px` | `var(--r-lg:12px)` or `var(--r-pill)` | High | Low |
| ERR-32 | `components/ShellPageTemplate.module.css` | `.metric`, `.panel` | `20px`, `24px` radius | `var(--r-lg:12px)` | High | Low |
| ERR-33 | `components/ShellPageTemplate.module.css` | `.surfaceCard`, `.button` | `18px`, `14px` radius | `var(--r-lg)`, `var(--r-md)` | High | Low |
| ERR-34 | `components/aiSettings.module.css` | `.hubNav`, `.metricCard`, `.input` | `border-radius:10px` (~18 occurrences) | `var(--r-md:8px)` or `var(--r-lg:12px)` | High | Low |
| ERR-35 | `components/soc/soc.components.css` | `.sectionCard` | `border-radius:10px` | `var(--r-md:8px)` | Medium | Low |
| ERR-36 | `components/soc/soc.components.css` | `.actionBtnPrimary` | `color:#fff` | `var(--color-text-inverse)` | High | Medium |
| ERR-37 | `components/soc/SocOverviewPanel.tsx` | `dotColor` hardcoded | `"#10b981","#f59e0b","#ef4444","#94a3b8"` | `var(--accent-emerald)`, `var(--accent-amber)`, etc. | High | Medium |
| ERR-38 | `components/soc/SocDataOpsPanel.tsx` | `HERO_METRIC_COLORS` | `"#22d3ee","#fbbf24","#34d399","#f87171"` | `var(--accent-cyan)`, `var(--accent-amber)`, etc. | High | Medium |
| ERR-39 | `components/soc/SocQueueTierFieldSet.tsx` | tierIconMap colors | `"#f59e0b","#22d3ee","#94a3b8","#a855f7"` | tokens + purple needs new token | High | Medium |
| ERR-40 | `components/soc/SocOverviewPanel.tsx` | `METRIC_COLORS` / `METRIC_BORDER_COLORS` | hardcoded hex/rgba | CSS variables | High | Medium |
| ERR-41 | `components/soc/SocDataInventorySection.tsx` | Inline `#000`, `#fff`, `rgba(...)` | `color:"#000"`, `rgba(16,185,129,0.08)` | `var(--color-text-inverse)`, etc. | High | Medium |
| ERR-42 | `components/soc/SocDataOpsOperationsSection.tsx` | `linear-gradient(90deg, #34d399, #22d3ee)` | hardcoded gradient | `linear-gradient(90deg, var(--accent-emerald), var(--accent-cyan))` | High | Medium |
| ERR-43 | `components/soc/SocDataOpsMonitorSection.tsx` | Gradient fallback | `var(--accent-cyan, #06b6d4)` | `var(--accent-cyan)` | Medium | Low |
| ERR-44 | `components/soc/SocScreenerRuleModal.tsx` | Inline `rgba(15,23,42,0.6)`, `#fff` | hardcoded | `var(--bg-panel)`, `var(--color-text-inverse)` | High | Medium |
| ERR-45 | `components/soc/SocDataOpsConfigSection.tsx` | `rgba(22,215,160,0.2)` | hardcoded rgba | `rgba(var(--soc-rgb-10b981) / 0.2)` | Medium | Medium |
| ERR-46 | `pages/commercial/BillingCenterPage.tsx` | CSS gradients | `linear-gradient(90deg, #00b4d8, #0077b6)`, `linear-gradient(135deg, #ff7f50, #ffb347)` | `--accent-shell`, `--accent-signal` | High | Medium |
| ERR-47 | `pages/commercial/PaymentReturnPage.tsx` | CSS gradients + hardcoded colors | `#4ade80`, `#fb7185`, `#166534`, `#991b1b` | `var(--accent-emerald)`, `var(--accent-rose)` | High | Medium |
| ERR-48 | `pages/ScreenerPage.tsx` | Many inline `#4ade80`, `#fca5a5`, `#3b82f6`, gradients | hardcoded | CSS variables | High | Medium |
| ERR-49 | `components/aiSettings.module.css` | `:root` dark palette | `--ais-c-0b0f19:#0b0f19` etc. | `var(--bg-panel)` with `[data-theme="light"]` | Critical | High |
| ERR-50 | `components/ShellPageTemplate.module.css` | `:root` dark palette | `--sh-c-0b0f19:#0b0f19` etc. | `var(--bg-panel)` with `[data-theme="light"]` | Critical | High |
| ERR-51 | `pages/commercial/BillingCenterPage.tsx` | `border-radius: 20px, 99px, 16px` | non-scale values | `var(--r-lg)`, `var(--r-pill)`, `var(--r-md)` | Medium | Low |
| ERR-52 | `pages/commercial/PaymentReturnPage.tsx` | `border-radius: 20px` | non-scale | `var(--r-lg)` | Medium | Low |
| ERR-53 | `components/Toast.tsx` | `bg-slate-900`, `bg-emerald-900/50` | dark-only Tailwind | `bg-[var(--bg-panel)]` with dark variant | High | Medium |
| ERR-54 | `components/ShellToast.tsx` | `bg-slate-900/95`, `border-emerald-500/30` | dark-only | `bg-[var(--bg-panel)]` | High | Medium |
| ERR-55 | `components/soc/SocDataInventorySection.tsx` | Raw `<button>` | `createElement("button", {className: styles.actionBtn})` | `<Button>` component | Medium | Low |
| ERR-56 | `components/soc/SocDataOpsOperationsSection.tsx` | Raw `<button>` x2 + inline `fontSize:"0.7rem"` | `createElement("button")` | `<Button>` | Medium | Low |
| ERR-57 | `components/soc/SocDataOpsPlannerConsole.tsx` | Raw `<button>` x2 | `createElement("button")` | `<Button>` | Medium | Low |
| ERR-58 | `components/soc/SocDataOpsMonitorSection.tsx` | Raw `<button>` x4 + inline `fontSize:"0.7rem"` | `createElement("button")` | `<Button>` | Medium | Low |
| ERR-59 | `components/soc/SocOverviewPanel.tsx` | Raw `<button>` x3 | `createElement("button")` | `<Button>` | Medium | Low |
| ERR-60 | `components/soc/SocSchedulerBoard.tsx` | Raw `<button>` close icon | `createElement("button", {...})` + `"✕"` | `<Button variant="ghost">` | Low | Low |
| ERR-61 | `components/soc/SocScreenerRuleModal.tsx` | Raw `<button>` x2 + inline styles | `createElement("button")` heavy inline | `<Button>` | Medium | Low |
| ERR-62 | `components/soc/SocScreenerPanel.tsx` | Raw `<button>` x4 pagination | `createElement("button", {className: styles.pageBtn})` | `<Button>` or `<PaginationBar>` | Medium | Low |
| ERR-63 | `components/ShellEmptyState.tsx` | Raw `<button>` + inline `fontSize:13` | `createElement("button", {style: {fontSize:13}})` | `<Button>` | Medium | Low |
| ERR-64 | `components/soc/SocDataInventorySection.tsx` | Raw `<button>` retry | `createElement("button", {className: styles.actionBtn})` | `<Button>` | Medium | Low |
| ERR-65 | `components/soc/soc.tokens.css` | `:root` dark-only tokens | All colors hardcoded hex | Dual-theme `[data-theme="light"]` overrides | Critical | High |

**Summary by Type**:

| Type | Count | Severity Breakdown |
|---|---|---|
| **A — Typography** | ~35+ findings | 3 Critical, 8 High, 24 Medium |
| **B — Color tokens** | ~40+ findings | 5 Critical, 25 High, 10 Medium |
| **C — Spacing/Layout** | ~20+ findings | 2 Critical, 8 High, 10 Medium |
| **D — Component inconsistency** | ~15+ findings | 0 Critical, 5 High, 10 Medium |
| **E — Dark mode** | ~12+ findings | 5 Critical, 7 High |
| **TOTAL** | **~122 unique findings** | |

---

## PART II: DETAILED TICKETS (SAMPLE — Top 10 by Severity)

### [ERR-49/50/65] Chuẩn hóa Theme: `:root` dark palette không adapt với `data-theme="light"`

- **Scope File(s)**:
  - `packages/web/src/components/aiSettings.module.css` (`:root` block lines 7-28)
  - `packages/web/src/components/ShellPageTemplate.module.css` (`:root` block lines 5-7)
  - `packages/web/src/components/soc/soc.tokens.css` (`:root` block lines 5-72)
- **Danh sách điểm lệch chuẩn (Defects)**:
  1. *Defect 1*: `--ais-c-0b0f19: #0b0f19` etc. defined in `:root` — only dark values, no `[data-theme="light"]` override
  2. *Defect 2*: `linear-gradient(160deg, var(--ais-c-0b0f19)...)` uses dark-only tokens — light theme gets dark backgrounds
  3. *Defect 3*: `soc.tokens.css` `:root` has hardcoded hex for all semantic tokens — no theme switching mechanism
- **Kế hoạch Refactor**:
  - **Current Code Snippet**:
    ```css
    :root { --ais-c-0b0f19: #0b0f19; --ais-c-111827: #111827; }
    .background { background: linear-gradient(160deg, var(--ais-c-0b0f19), var(--ais-c-111827)); }
    ```
  - **Target Code Diff**:
    ```diff
    - :root { --ais-c-0b0f19: #0b0f19; --ais-c-111827: #111827; }
    + :root { --ais-bg-primary: var(--color-bg-primary, #020617); --ais-bg-panel: var(--bg-panel, #0f172a); }
    + [data-theme="light"] { --ais-bg-primary: var(--color-bg-secondary, #0f172a); --ais-bg-panel: var(--color-slate-50, #f8fafc)); }
    - background: linear-gradient(160deg, var(--ais-c-0b0f19), var(--ais-c-111827));
    + background: linear-gradient(160deg, var(--ais-bg-primary), var(--ais-bg-panel));
    ```
- **Acceptance Criteria**:
  - [ ] **AC-1**: Switch `data-theme="light"` → all backgrounds adapt, no dark colors leaked
  - [ ] **AC-2**: `grep "#0b0f19\|#111827"` in component CSS = 0 hits
  - [ ] **AC-3**: Computed `background-color` differs between `data-theme="dark"` and `data-theme="light"`
  - [ ] **AC-4**: No visual regression in dark mode

---

### [ERR-36/37/38/39/40] Chuẩn hóa Color Tokens: Hardcoded hex trong TSX/JS

- **Scope File(s)**:
  - `SocOverviewPanel.tsx` (METRIC_COLORS line 88-100, dotColor line 501)
  - `SocDataOpsPanel.tsx` (HERO_METRIC_COLORS line 28-33)
  - `SocQueueTierFieldSet.tsx` (tierIconMap line 114-119)
  - `SocDataInventorySection.tsx` (inline styles lines 44, 127, 156)
- **Danh sách điểm lệch chuẩn**:
  1. `const dotColor = streamStatus === "open" ? "#10b981" : ...` → should use `var(--accent-emerald)` etc.
  2. `totalRows: "#22d3ee"` → should use CSS variable
  3. `color: "#000"` in `createElement("mark")` → should use `var(--color-text-inverse)`
  4. `#a855f7` (purple) → not in token system at all
- **Target Code Diff**:
  ```diff
  - const dotColor = streamStatus === "open" ? "#10b981" : ...
  + const dotColor = streamStatus === "open" ? "var(--accent-emerald)" : ...
  - totalRows: "#22d3ee", queuePending: "#fbbf24"
  + totalRows: "var(--accent-cyan)", queuePending: "var(--accent-amber)"
  ```
- **AC**: Zero `#[0-9a-fA-F]{3,6}` in JS logic (excluding CSS variables); purple token added to `tokens.css` if needed

---

### [ERR-46/47/48] Chuẩn hóa Gradient Colors: Hardcoded hex gradients

- **Scope**: `BillingCenterPage.tsx`, `PaymentReturnPage.tsx`, `ScreenerPage.tsx`
- **Defect**: `linear-gradient(90deg, #00b4d8, #0077b6)` → should use `var(--accent-shell)` tokens
- **Target**:
  ```diff
  - background: linear-gradient(90deg, #00b4d8, #0077b6);
  + background: linear-gradient(90deg, var(--accent-shell), var(--accent-secondary));
  ```

---

### [ERR-48] Chuẩn hóa Color trong ScreenerPage.tsx — Nhiều hardcode nhất

- **Scope**: `packages/web/src/pages/ScreenerPage.tsx` (lines 548, 628, 652, 660, 752, 791 etc.)
- **Defect**: `#4ade80`, `#fca5a5`, `#3b82f6`, `#86efac`, inline `rgba(...)`, `fontSize: '12px'`
- **Target**: Replace all with CSS variable references + `--fs-xs`/`--fs-2xs` tokens

---

### [ERR-31/32/33/34/35] Chuẩn hóa Border-Radius: Không nhất quán

- **Scope**: `ShellPageTemplate.module.css` (28px/24px/20px/18px/14px), `aiSettings.module.css` (10px x18), `soc.components.css` (10px)
- **Defect**: Multiple radii across similar containers; 10px ∉ scale {6,8,12,999}
- **Target**: `border-radius: var(--r-md, 8px)` or `var(--r-lg, 12px)` depending on container type

---

### [ERR-55-64] Chuẩn hóa Component: Raw `<button>` thay vì `<Button>`

- **Scope**: SOC components — `SocDataInventorySection`, `SocDataOpsOperationsSection`, `SocDataOpsPlannerConsole`, `SocDataOpsMonitorSection`, `SocOverviewPanel`, `SocSchedulerBoard`, `SocScreenerRuleModal`, `SocScreenerPanel`, `ShellEmptyState`
- **Defect**: `createElement("button", {className: styles.actionBtn, ...})` instead of `<Button>` component
- **Target**: Import `<Button>` from `./ui/Button`; use `variant="primary"|"secondary"|"ghost"|"danger"`

---

### [ERR-01/02/03/04/05/06/07/08] Chuẩn hóa Typography: Font-size ngoài scale

- **Scope**: `ShellPageTemplate.module.css` (34px/21px/15px), `aiSettings.module.css` (28px/24px), `soc.components.css` (21px), `BillingCenterPage.tsx` (9/15/24/11/13/18px), `PaymentReturnPage.tsx` (24/13.5/14.5px), `ScreenerPage.tsx` (20/11/12px)
- **Target**: Map to `--fs-*` tokens; extend scale if >22px needed

---

### [ERR-09/10/11/12/13/14] Chuẩn hóa `text-[10px]` / `text-[11px]` trong Admin Pages

- **Scope**: `AdminCorePATsPage.tsx`, `AdminCoreUsagePage.tsx`, `AdminCoreServiceAccountsPage.tsx`, `ShellOperationsCenterPage.tsx`, `AdminAnalyticsPage.tsx`, `adminUi.tsx`, `AdminCoreAuditTracePage.tsx`, `AdminBillingFleetPage.tsx`, `AdminCoreOverviewPage.tsx`, `AdminCoreJobsPage.tsx`, `AdminCoreTenantsPage.tsx`, `AdminCoreBillingPage.tsx`
- **Defect**: `text-[10px]` (∉ scale) and `text-[11px]` (arbitrary class vs CSS var)
- **Target**: Replace with `text-xs` (12px) or `var(--fs-xs)` / `var(--fs-2xs)` via CSS

---

### [ERR-25/26/27/28/29/30] Chuẩn hóa Spacing: Không trên 8pt grid

- **Scope**: `soc.components.css` (gap 0.35rem/0.4rem, padding 0.55rem/0.9rem), `ShellPageTemplate.module.css` (gap 18px), `ScreenerPage.tsx` (padding 6px/20px), `SocQueueTierFieldSet.tsx` (gap 6px), `SocDataOpsMonitorSection.tsx` (fontSize 0.6rem)
- **Target**: All spacing → `var(--sp-N)` or Tailwind `p-N`/`gap-N` multiples of 0.25rem

---

### [ERR-44/53/54] Chuẩn hóa Dark Mode: `bg-slate-900` hardcoded

- **Scope**: `Toast.tsx`, `ShellToast.tsx`, `SocScreenerRuleModal.tsx`
- **Defect**: `bg-slate-900/95`, `bg-emerald-900/50` — dark-only, breaks in `data-theme="light"`
- **Target**: `bg-[var(--bg-panel)]` with appropriate CSS variable fallbacks

---

## PART III: ROLLOUT TIMELINE

### Wave 1 — Foundation & Shared Primitives (Priority: Critical)

| Ticket | File(s) | Scope | Effort |
|---|---|---|---|
| **W1-1** | `aiSettings.module.css`, `ShellPageTemplate.module.css`, `soc/tokens.css` | Fix `:root` dark palette → dual-theme `[data-theme="light"]` | 1–2d |
| **W1-2** | `soc/tokens.css` | Add missing tokens (purple `--accent-purple`, `--soc-c-*` helpers) | 0.5d |
| **W1-3** | `soc.components.css` | Fix `border-radius: 10px` → `var(--r-md)` / `var(--r-lg)` | 0.5d |
| **W1-4** | `soc.components.css` | Fix `gap: 0.35rem/0.4rem` → `var(--sp-1)`/`var(--sp-2)` | 0.5d |
| **W1-5** | `theme.module.css` | Fix `border-radius` non-scale values, `font-size: 34px` | 1d |

**Gate**: `npx tsc --noEmit` 0; `npm run build` PASS; `data-theme="light"` visual verify

### Wave 2 — High-Traffic SOC Components (Priority: High)

| Ticket | File(s) | Scope | Effort |
|---|---|---|---|
| **W2-1** | `SocOverviewPanel.tsx` | Fix hardcoded colors (dotColor, METRIC_COLORS), `fontSize:"0.7rem"` | 1d |
| **W2-2** | `SocDataOpsPanel.tsx` | Fix HERO_METRIC_COLORS hex, `fontSize:"0.7rem"` | 0.5d |
| **W2-3** | `SocQueueTierFieldSet.tsx` | Fix tierIconMap hardcoded hex, `#a855f7` purple | 0.5d |
| **W2-4** | `SocDataInventorySection.tsx` | Fix inline `#000`, `#fff`, `rgba(...)`, raw `<button>` | 1d |
| **W2-5** | `SocDataOpsOperationsSection.tsx` | Fix gradient hex, raw `<button>`, `fontSize:"0.68rem"` | 1d |
| **W2-6** | `SocDataOpsMonitorSection.tsx` | Fix `fontSize:"0.7rem"/"0.6rem"`, hardcoded rgba | 1d |
| **W2-7** | `SocRetentionHealthPanel.tsx` | Fix `fontSize:"0.82rem"/"0.65rem"`, hardcoded rgba | 1d |
| **W2-8** | `SocScreenerRuleModal.tsx`, `SocDataOpsConfigSection.tsx` | Fix inline `rgba(...)`, `#fff`, raw `<button>` | 0.5d |

**Gate**: `grep "#[0-9a-fA-F]{3}"` in SOC components = 0; vitest SOC tests PASS

### Wave 3 — SOC Panel + Dashboard (Priority: High)

| Ticket | File(s) | Scope | Effort |
|---|---|---|---|
| **W3-1** | `SocVnbrokerPanel.tsx`, `SocDataOpsPlannerConsole.tsx` | Fix `fontSize:"0.7rem"`, hardcoded rgba, raw `<button>` | 1d |
| **W3-2** | `SocScreenerPanel.tsx` | Fix raw `<button>` x4, `fontSize:'12px'`, inline hex | 0.5d |
| **W3-3** | `SocSchedulerBoard.tsx`, `ShellEmptyState.tsx` | Fix raw `<button>`, inline `fontSize` | 0.5d |
| **W3-4** | `CoreDashboardPositionDeck.tsx` | Fix `text-[10px]` x6, `text-[11px]` x3 | 0.5d |

**Gate**: vitest dashboard + soc tests PASS

### Wave 4 — Page-Level (Priority: Medium)

| Ticket | File(s) | Scope | Effort |
|---|---|---|---|
| **W4-1** | `BillingCenterPage.tsx`, `PaymentReturnPage.tsx` | Fix font-size 9/15/24/13/18px, hardcoded gradients/colors, non-scale border-radius | 1.5d |
| **W4-2** | `ScreenerPage.tsx` | Fix all inline hex + fontSize + non-scale padding | 1.5d |
| **W4-3** | `AdminCorePATsPage.tsx`, `AdminCoreUsagePage.tsx`, `AdminCoreServiceAccountsPage.tsx` | Fix `text-[10px]` → `text-xs` | 0.5d |
| **W4-4** | `ShellOperationsCenterPage.tsx`, `AdminAnalyticsPage.tsx`, `adminUi.tsx` + 10 other admin pages | Fix `text-[11px]`, `fontSize:11`, remaining hardcodes | 1d |
| **W4-5** | `TenantAdmin*.tsx` (7 pages), `Toast.tsx`, `ShellToast.tsx` | Fix hardcoded hex in inline styles, dark-only `bg-slate-900` | 1d |

**Gate**: `npx tsc --noEmit` 0; `npm run lint` 0 errors; build PASS

### Wave 5 — Edge Cases & Polish (Priority: Low)

| Ticket | File(s) | Scope | Effort |
|---|---|---|---|
| **W5-1** | `aiSettings.module.css` | Fix `border-radius: 10px` x18 → `var(--r-md)` | 0.5d |
| **W5-2** | `Commercial pages` | Fix remaining `border-radius: 20px/16px` → `var(--r-lg)` | 0.5d |
| **W5-3** | Final scan + regression | Re-scan all files; verify zero hardcode | 0.5d |

**Gate**: Full `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run vitest`, `npm run check:shell` — all green

---

## Architectural Rationale

1. **Wave 1 first**: The `:root` dark palette issue is systemic — it affects every component that uses CSS custom properties inherited from those roots. Fixing it first prevents cascading rework in Waves 2-5.
2. **Tokens before components**: Adding missing tokens (purple, `--soc-c-*`) before replacing hardcoded values ensures all replacements have valid references.
3. **SOC before admin**: SOC components have 5× more findings than admin; fixing them first delivers the largest visual consistency improvement per effort unit.
4. **Preserve business logic**: All changes are CSS/styling-only. No React state, API calls, or navigation logic touched per Zero-Question principle.
5. **8pt grid enforcement**: All spacing must be multiples of 0.25rem (4px). Values like `0.35rem`, `6px`, `10px` break the visual rhythm and cause pixel misalignment at 1.5x/2x DPI scaling.
