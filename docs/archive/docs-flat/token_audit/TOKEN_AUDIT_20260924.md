# VNInvest Design Token Audit Report — 2026-09-24

## Scope
All files in `packages/web/src/pages/admin/`, `packages/web/src/pages/tenant-admin/`, `packages/web/src/pages/auth/`, `packages/web/src/pages/AdminCrawlControlPage.tsx`, `packages/web/src/pages/system/`, `packages/web/src/pages/vip/`, `packages/web/src/components/TenantAdmin*.tsx`, `packages/web/src/pages/admin/socCsv.ts`, and all `pages/admin/` subdirectories.

## SSOT Token Reference
- **Colors**: `--text-primary: #f1f5f9`, `--text-muted: #64748b`, `--text-secondary: #94a3b8`, `--accent-cyan: #06b6d4`, `--accent-emerald: #10b981`, `--accent-rose: #ef4444`, `--accent-amber: #f59e0b`, `--bg-panel: #0f172a`, `--border-default: #1e293b`
- **Typography**: `--fs-2xs=11px, --fs-xs=12px, --fs-sm=13px, --fs-md=14px, --fs-lg=16px, --fs-xl=18px, --fs-2xl=22px`
- **Spacing**: multiples of 0.25rem (4px)
- **Radius**: `--r-sm=6px, --r-md=8px, --r-lg=12px, --r-pill=999px`

---

## ANTI-PATTERN A: TYPOGRAPHY

### A1 — `text-[10px]` NOT in typography scale (10px ∉ {11,12,13,14,16,18,22})

| # | FILE | LINE | CODE | TOKEN |
|---|------|------|------|-------|
| A1-1 | `packages/web/src/pages/admin/AdminCorePATsPage.tsx` | 443,447,451,455 | `className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"` | `var(--fs-2xs, 11px)` |
| A1-2 | `packages/web/src/pages/admin/AdminCoreUsagePage.tsx` | 287,292,296,300 | `className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"` | `var(--fs-2xs, 11px)` |
| A1-3 | `packages/web/src/pages/admin/AdminCoreServiceAccountsPage.tsx` | 402,406,410,414 | `className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"` | `var(--fs-2xs, 11px)` |

**Total A1: 12 occurrences**

### A2 — `fontSize: "0.68rem"` (~10.88px) NOT in scale

| # | FILE | LINE | CODE | TOKEN |
|---|------|------|------|-------|
| A2-1 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 119 | `fontSize: "0.68rem"` | `var(--fs-2xs, 11px)` |
| A2-2 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 121 | `fontSize: "0.68rem"` | `var(--fs-2xs, 11px)` |

**Total A2: 2 occurrences**

### A3 — `text-[11px]` uses arbitrary Tailwind instead of CSS variable (11px IS in scale but hardcoded)

| # | FILE | LINE | CODE |
|---|------|------|------|
| A3-1 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 107,111,115,119 | `text-[11px]` |
| A3-2 | `packages/web/src/pages/admin/AdminCoreAuditTracePage.tsx` | 223 | `text-[11px]` |
| A3-3 | `packages/web/src/pages/admin/AdminBillingFleetPage.tsx` | 94 | `text-[11px]` |
| A3-4 | `packages/web/src/pages/admin/AdminCorePATsPage.tsx` | 138 | `text-[11px]` |
| A3-5 | `packages/web/src/pages/admin/AdminCoreUsagePage.tsx` | 124 | `text-[11px]` |
| A3-6 | `packages/web/src/pages/admin/AdminCoreOverviewPage.tsx` | 87 | `text-[11px]` |
| A3-7 | `packages/web/src/pages/admin/AdminCoreServiceAccountsPage.tsx` | 131 | `text-[11px]` |
| A3-8 | `packages/web/src/pages/admin/AdminCoreJobsPage.tsx` | 161 | `text-[11px]` |
| A3-9 | `packages/web/src/pages/admin/AdminCoreTenantsPage.tsx` | 156 | `text-[11px]` |
| A3-10 | `packages/web/src/pages/admin/AdminCoreBillingPage.tsx` | 93 | `text-[11px]` |
| A3-11 | `packages/web/src/pages/admin/adminUi.tsx` | 30 | `text-[11px]` |
| A3-12 | `packages/web/src/pages/admin/adminUi.tsx` | 72 | `text-[11px]` |

**Total A3: 15 occurrences** — *Style deviation (arbitrary class vs CSS variable), not scale violation*

### A4 — `fontSize: 11` in recharts `tick` prop (11px IS in scale but JS number not CSS var)

| # | FILE | LINE | CODE |
|---|------|------|------|
| A4-1 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 89,90 | `tick={{ fontSize: 11 }}` |
| A4-2 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 277,278 | `tick={{ fontSize: 11, fill: "#94a3b8" }}` |
| A4-3 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 89,90 | `tick={{ fontSize: 11, fill: "#94a3b8" }}` |
| A4-4 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 568,571 | `tick={{ fontSize: 11, fill: "#94a3b8" }}` |

**Total A4: 12 occurrences**

---

## ANTI-PATTERN B: COLOR TOKENS

### B1 — Hardcoded hex colors in inline styles (`#[0-9a-fA-F]{3,8}`)

| # | FILE | LINE | CODE | TOKEN |
|---|------|------|------|-------|
| B1-1 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 92 | `background: "#1e293b"` | `var(--bg-panel, #0f172a)` |
| B1-2 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 93 | `labelStyle={{ color: "#cbd5e1" }}` | `var(--text-secondary, #94a3b8)` |
| B1-3 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 95 | `fill="#3b82f6"` | `var(--accent-cyan, #06b6d4)` |
| B1-4 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 359 | `style={{ color: invoice.status === "paid" ? "#22c55e" : "#ef4444" }}` | `var(--accent-emerald, #10b981)` / `var(--accent-rose, #ef4444)` |
| B1-5 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 264 | `color: "#f1f5f9"` | `var(--text-primary, #f1f5f9)` |
| B1-6 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 277 | `fill: "#94a3b8"` | `var(--text-secondary, #94a3b8)` |
| B1-7 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 278 | `fill: "#94a3b8"` | `var(--text-secondary, #94a3b8)` |
| B1-8 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 282 | `color: "#f1f5f9"` | `var(--text-primary, #f1f5f9)` |
| B1-9 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 386,394 | `style={{ color: ... ? "#94a3b8" : ... }}` | `var(--text-secondary, #94a3b8)` |
| B1-10 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 319 | `color: "#10b981"` | `var(--accent-emerald, #10b981)` |
| B1-11 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 444 | `color: "#94a3b8"` | `var(--text-secondary, #94a3b8)` |
| B1-12 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 538,539,542 | SVG `stopColor="#00b4d8"`, `stopColor="#10b981"` | `var(--accent-cyan, #06b6d4)` / `var(--accent-emerald, #10b981)` |
| B1-13 | `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx` | 362 | `rgba(34,197,94,...)` | `rgba(34,197,94,0.15)` → `var(--accent-emerald)` with opacity |
| B1-14 | `packages/web/src/pages/tenant-admin/TenantAdminRolesPage.tsx` | 343 | `color: "var(--ta-c-ef4444, #ef4444)"` | `var(--accent-rose, #ef4444)` |
| B1-15 | `packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.tsx` | 250 | `rgba(0,180,216,...)` | `rgba(0,180,216,0.15)` → `var(--accent-cyan)` |
| B1-16 | `packages/web/src/pages/tenant-admin/TenantAdminCapabilitiesPage.tsx` | 142 | `fillColor = item.value > 0 ? "#00b4d8" : "#94a3b8"` | `var(--accent-cyan, #06b6d4)` / `var(--text-secondary)` |
| B1-17 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 62 | `color = score >= 80 ? "#10b981" : ...` | `var(--accent-emerald, #10b981)` etc. |
| B1-18 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 288,353,366,370 | Various `#22c55e`, `#ef4444`, `#f59e0b` inline | respective accent tokens |
| B1-19 | `packages/web/src/pages/tenant-admin/TenantAdminWebhooksPage.tsx` | 308,362 | `style={{ color: config.is_active ? "#10b981" : "#ef4444" }}` | respective accent tokens |
| B1-20 | `packages/web/src/pages/tenant-admin/TenantAdminUsagePage.tsx` | 570 | `style={{ color: ... }}` with hex | respective token |
| B1-21 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 321,353,361 | `ta.aud_10` etc. CSS classes with hex colors in module | respective tokens |
| B1-22 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 92-95 | `fill="..."` in `<Bar>` with hex | respective accent tokens |
| B1-23 | `packages/web/src/pages/AdminCrawlControlPage.tsx` | 29-34 | `bg-gray-100 text-gray-700` (Tailwind gray, not slate) | `var(--accent-emerald)`, `var(--accent-amber)` etc. |

**Total B1: ~23+ distinct locations** (many with multiple lines each)

### B2 — `rgb()`/`rgba()` in inline styles

| # | FILE | LINE | CODE |
|---|------|------|------|
| B2-1 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 263 | `background: "rgba(15,23,42,0.95)"`, `border: "1px solid rgba(255,255,255,0.08)"` |
| B2-2 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 120 | `boxShadow: "0 0 0 4px rgba(16,185,129,0.15)"` |
| B2-3 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 92 | `background: "#1e293b"` (hex, see B1-1) |

### B3 — Hardcoded hex in CSS modules (`TenantAdmin.module.css`)

| # | FILE | LINE | CODE |
|---|------|------|------|
| B3-1 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 5-40 | 26+ CSS custom property definitions like `--ta-c-ef4444: #ef4444` |

> **Note**: The CSS variable definitions in `TenantAdmin.module.css` are the *source* of design tokens (S9 extraction), not anti-patterns per se. The anti-pattern is that `.tsx` files reference these via `var(--ta-c-*)` while hardcoding hex in inline `style={{}}`. The CSS file itself is the token registry — this is acceptable.

### B4 — Tailwind arbitrary colors `text-[#...]` / `bg-[#...]`

| # | FILE | LINE | CODE |
|---|------|------|------|
| B4-1 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 139 | `className={`font-semibold ${a.severity === 'critical' ? ...}` with hardcoded severity colors |

**Total B4: 1+ locations**

---

## ANTI-PATTERN C: SPACING/LAYOUT (8pt grid violations)

Spacing must be multiples of 0.25rem (4px). Values NOT in {4,8,12,16,20,24,28,32,...}px are violations.

| # | FILE | LINE | CODE | ISSUE |
|---|------|------|------|-------|
| C1-1 | `packages/web/src/pages/admin/ShellMailConfigPage.tsx` | 301,311,321 | `padding: "6px 12px"` | `6px` ∉ 8pt grid |
| C1-2 | `packages/web/src/pages/admin/ShellMailConfigPage.tsx` | 353 | `fontSize: "13px"` (OK), but `padding: "6px 12px"` | `6px` ∉ 8pt grid |
| C1-3 | `packages/web/src/pages/admin/ShellMailConfigPage.tsx` | 562 | `marginTop: "4px"` | OK (4px) |
| C2-1 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 69 | `gap: 14px` | `14px` ∉ 8pt grid |
| C2-2 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 80 | `margin-top: 2px` | `2px` ∉ 8pt grid |
| C2-3 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 101 | `padding: 10px 16px` | `10px` ∉ 8pt grid |
| C2-4 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 110 | `padding: 10px 16px` | `10px` ∉ 8pt grid |
| C2-5 | `packages/web/src/pages/tenant-admin/TenantAdmin.module.css` | 129 | `padding: 24px` | OK (24px) |
| C3-1 | `packages/web/src/pages/AdminCrawlControlPage.tsx` (via BillingCenterPage) | 38,136,142,206,216 | `padding: 22px 18px`, `padding: 14px 16px`, `padding: 4px 10px`, `margin-top: 14px` | Multiple non-grid values |
| C3-2 | `packages/web/src/pages/AdminCrawlControlPage.tsx` (via PaymentReturnPage) | 39,49,69,87,90,98,117,128 | `padding: 30px 10px`, `margin-bottom: 30px`, `gap: 12px`, `padding-bottom: 10px` | `30px`, `10px` ∉ 8pt grid |
| C3-3 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 443 | `style={{ marginBottom: 12 }}` | OK (12px) |
| C3-4 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 444 | `style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}` | `6px` ∉ 8pt grid |
| C3-5 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 370 | `style={{ fontSize: 11, padding: "4px 8px", ... }}` | OK (4px, 8px) |

**Total C: 15+ violations across 5 files**

---

## ANTI-PATTERN D: COMPONENT INCONSISTENCY

### D1 — Raw `<button>` / `createElement("button", ...)` with inline styles instead of component library

| # | FILE | LINE | CODE |
|---|------|------|------|
| D1-1 | `packages/web/src/pages/admin/ShellMailConfigPage.tsx` | 298-325 | `createElement("button", { style: { padding: "6px 12px", fontSize: "13px" } }, ...)` — 4 buttons |
| D1-2 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 419,456,459 | `<button onClick={...} style={{...}}>` with inline styles |
| D1-3 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 349 | `<button onClick={handleExportCsv} disabled={...}>` |

### D2 — Inline-styled `<span>` / `<div>` instead of styled components

| # | FILE | LINE | CODE |
|---|------|------|------|
| D2-1 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | 119-121 | `createElement("span", { style: { fontSize: "0.68rem", ... } })` |
| D2-2 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 318-319 | `<span style={{ fontSize: 11, color: "#10b981" }}>` |
| D2-3 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 444 | `<label style={{ fontSize: 12, color: "#94a3b8" }}>` |

### D3 — Inconsistent border-radius across cards

| # | FILE | LINE | CODE |
|---|------|------|------|
| D3-1 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 68,103,125 | `rounded-3xl` (cards) vs `rounded-2xl` (inner) — inconsistent |
| D3-2 | `packages/web/src/pages/admin/AdminBillingFleetPage.tsx` | 89,100 | `rounded-3xl` (card) vs `rounded-xl` (inner month) |
| D3-3 | `packages/web/src/pages/admin/AdminCoreAuditTracePage.tsx` | 51 | `rounded-2xl` vs `rounded-3xl` elsewhere |

**Total D: ~8+ locations across 3 files**

---

## ANTI-PATTERN E: DARK MODE

### E1 — Hardcoded light colors without `dark:` adaptation

| # | FILE | LINE | CODE |
|---|------|------|------|
| E1-1 | `packages/web/src/pages/admin/AdminCoreAuditTracePage.tsx` | 236,242 | `className="rounded-full border border-white/15 bg-white/10 px-4"` — `bg-white/10` should be `dark:bg-white/10` or use token |
| E1-2 | `packages/web/src/pages/admin/AdminBillingFleetPage.tsx` | 93 | `bg-slate-50` with `dark:bg-slate-950/60` — OK |
| E1-3 | `packages/web/src/pages/AdminCrawlControlPage.tsx` | 29-34 | `bg-gray-100 text-gray-700` — uses Tailwind gray, NOT design tokens; dark mode uses `dark:bg-gray-800 dark:text-gray-300` — should use `dark:text-slate-400` etc. |
| E1-4 | `packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx` | 92 | `contentStyle={{ background: "#1e293b" }}` — hardcoded, no dark mode variant needed (already dark) but should use `var(--bg-panel)` |
| E1-5 | `packages/web/src/pages/tenant-admin/TenantAdminAuditLogsPage.tsx` | 263 | `contentStyle={{ background: "rgba(15,23,42,0.95)" }}` — hardcoded dark bg |
| E1-6 | `packages/web/src/pages/tenant-admin/TenantAdminHomePage.tsx` | 319 | `color: "#10b981"` — static color, no dark mode consideration needed for accent colors |

### E2 — Tailwind `text-slate-500` without `dark:text-slate-400` fallback

| # | FILE | LINE | CODE |
|---|------|------|------|
| E2-1 | `packages/web/src/pages/admin/AdminBillingFleetPage.tsx` | 94 | `className="text-[11px] text-slate-500"` — missing `dark:text-slate-400` |
| E2-2 | `packages/web/src/pages/admin/AdminAnalyticsPage.tsx` | 123 | `className="mt-3 text-xs text-slate-500"` — missing `dark:text-slate-400` |
| E2-3 | `packages/web/src/pages/admin/AdminBillingFleetPage.tsx` | 144 | `className="text-xs text-slate-500"` — missing `dark:text-slate-400` |

**Total E: ~8+ locations**

---

## SUMMARY

| Type | Description | File Count | Finding Count |
|------|-------------|-----------|---------------|
| **A** | Typography (hardcoded sizes outside scale or arbitrary classes) | 8 | ~31 |
| **B** | Color tokens (hardcoded hex/rgb/rgba in inline styles) | 12 | ~23 |
| **C** | Spacing/Layout (non-8pt-grid values) | 5 | ~15 |
| **D** | Component inconsistency (raw elements, inline styles) | 4 | ~16 |
| **E** | Dark mode (missing dark variants, non-token colors) | 5 | ~8 |
| **TOTAL** | | **~25 files** | **~93 findings** |

### Files Most Violated
1. **`TenantAdminHomePage.tsx`** — 6+ findings (B1, C3, D1, D2)
2. **`TenantAdminBillingPage.tsx`** — 5+ findings (B1, C, D)
3. **`TenantAdminAuditLogsPage.tsx`** — 4+ findings (B1, A4)
4. **`ShellMailConfigPage.tsx`** — 4+ findings (C, D1)
5. **`AdminCorePATsPage.tsx` / `AdminCoreUsagePage.tsx` / `AdminCoreServiceAccountsPage.tsx`** — 3+ findings each (A1)
6. **`BillingCenterPage.tsx` / `PaymentReturnPage.tsx`** — 3+ findings each (C3)

### Priority Recommendations
1. **P0**: Replace all hardcoded hex colors (`#[0-9a-fA-F]{3,8}`) in `style={{}}` with CSS variables (`var(--text-primary)`, `var(--accent-cyan)`, etc.)
2. **P1**: Fix 8pt grid violations in `TenantAdmin.module.css` (`gap: 14px`→`12px`, `padding: 10px`→`8px` or `12px`, `margin-top: 2px`→`0` or `4px`)
3. **P1**: Replace `text-[10px]` with `text-[11px]` (or CSS variable) in the 3 AdminCore pages
4. **P2**: Convert raw `<button>` elements in `ShellMailConfigPage.tsx` to use `styles.button*` classes without inline `style`
5. **P2**: Add `dark:text-slate-400` fallback to `text-slate-500` instances missing dark mode

---

*Generated 2026-09-24 by Enterprise UI Consistency Auditor. Covers 25+ files, ~93 findings across 5 anti-pattern groups.*
