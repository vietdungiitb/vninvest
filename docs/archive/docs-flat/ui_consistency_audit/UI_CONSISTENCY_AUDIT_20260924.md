# Enterprise UI Consistency Audit & Refactoring Plan

> **Date**: 2026-09-24  
> **Auditor**: Principal Frontend Architect / Lead Design System Engineer  
> **Scope**: `packages/web/src/` — all pages, layouts, components  
> **Tech Stack**: React 19.2.7 + Vite 5.3.1 + Tailwind CSS v4 (`@tailwindcss/vite` plugin) + CSS Modules + SOC glassmorphism  
> **Theme Source of Truth**: `packages/web/src/index.css` (`@theme` block) + `packages/web/src/theme/tokens.css` + `packages/web/src/components/soc/soc.tokens.css`  
> **Method**: Static analysis (grep regex + AST pattern matching), no runtime execution  

---

## PHẦN I: MA TRẬN ĐỐI CHIẾU LỆCH CHUẨN (EXECUTIVE MATRIX)

### 0. Theme Token Baseline (Tham chiếu)

| Token Category | Global `theme/tokens.css` | Tailwind `@theme` (`index.css`) | SOC `soc.tokens.css` | Notes |
|---|---|---|---|---|
| Font family | `"Inter", "Segoe UI", system-ui` | `system-ui, -apple-system...` | `ui-sans-system...` | 3 definitions khác nhau |
| `--fs-sm` / `text-sm` | `0.8125rem (13px)` | không định nghĩa rõ | `0.75rem (12px)` | MISMATCH 13px vs 12px |
| `--fs-md` / `text-base` | `0.875rem (14px)` | không định nghĩa rõ | `0.85rem` | MISMATCH |
| `--fs-lg` / `text-lg` | `1rem (16px)` | không định nghĩa rõ | `1rem` | OK |
| `--r-sm` / `radius-sm` | `6px` | `0.25rem (4px)` | `6px` | **MISMATCH nghiêm trọng** |
| `--r-md` / `radius-md` | `8px` | `0.375rem (6px)` | `8px` | **MISMATCH nghiêm trọng** |
| `--r-lg` / `radius-lg` | `12px` | `0.5rem (8px)` | `12px` | **MISMATCH nghiêm trọng** |
| `--sp-4` | `1rem` | `--space-4: 1rem` | `1rem` | OK |
| `--text-primary` | `#f1f5f9` | `#f1f5f9` | `var(--soc-c-f1f5f9)` | OK (alias) |
| `--bg-panel` | `#0f172a` | `#0f172a` | `rgba(...)` | OK |

### 1. Executive Inconsistency Matrix

| ID | File Path | Thành phần vi phạm | Code hiện trạng (Lỗi) | Token chuẩn tương ứng | Mức nghiêm trọng | Rủi ro hồi quy |
|---|---|---|---|---|---|---|
| ERR-01 | `src/index.css` (L27,44,85-88) | **Radius scale mismatch** | `@theme`: `--radius-sm: 0.25rem`, `--radius-md: 0.375rem`, `--radius-lg: 0.5rem` | `theme/tokens.css` `--r-sm:6px`, `--r-md:8px`, `--r-lg:12px`; `soc.tokens.css` `--r-sm:6px`, `--r-md:8px`, `--r-lg:12px` | **Critical (P0)** | High — mọi component dùng Tailwind `rounded-sm/md/lg` nhận giá trị WRONG so với CSS var |
| ERR-02 | `src/index.css` (L357-381) | **Hardcoded font-size in @layer** | `.panel-title { font-size: 16px }`, `.panel-label { font-size: 12px }`, `.panel-body-text { font-size: 14px }` | `--fs-lg:1rem`, `--fs-xs:0.75rem`, `--fs-md:0.875rem` + `text-lg/text-sm/text-base` | **Critical (P0)** | Low — chỉ ảnh hưởng panel CSS, có thể thay thế an toàn |
| ERR-03 | `src/index.css` (L569) | **Hardcoded color in heatmap legend** | `.heatmap-legend { color: #64748b }` | `var(--color-text-muted)` = `#64748b` (value-match, nhưng hardcode) | **High (P1)** | Low — value đúng nhưng không semantic |
| ERR-04 | `src/index.css` (L262,268,340-353,549) | **Hardcoded rgba/hex in @layer** | `.glass { background: rgba(15,23,42,0.8) }`, `.pill[data-sign] { background-color: rgb(16 185 129/0.2); color: #34d399 }`, `#2a3550` scrollbar, `#7f1d1d` gradient | `var(--bg-panel)`, `var(--color-success-400)`, `var(--color-border-secondary)`, `--heat-up-strong` | **High (P1)** | Medium — dark mode sẽ vỡ nếu theme switch |
| ERR-05 | `src/index.css` (L568-585) | **Hardcoded gradient + px values** | `.heatmap-legend-bar { background: linear-gradient(to right, #7f1d1d, #5b2228, #2f3747, #14532d, #166534) }`, `.heatmap-legend { font-size: 10px }`, `gap: 0.5rem` | `--heat-up-strong` etc, `--fs-2xs` (11px), `var(--sp-2)` | **High (P1)** | Low |
| ERR-06 | `src/index.css` (L379) | **Non-8pt-grid spacing** | `.seg { gap: 4px }`, `.panel-head { gap: 0.75rem }`, `text-[10px]` in heatmap legend | `--sp-1` (0.25rem=4px) hợp lệ nếu dùng `gap-1`, nhưng nên dùng token | **Medium (P2)** | Low |
| ERR-07 | `src/components/alert-center/AlertCard.tsx` (L210-307) | **Arbitrary Tailwind text-size** | `text-[19px]`, `text-[15px]`, etc. tại nhiều dòng | `--fs-2xl` (22px), `--fs-lg` (16px) hoặc `text-xl/text-lg` | **High (P1)** | Low — visual size gần đúng nhưng không scale |
| ERR-08 | `src/components/dashboard/CoreDashboardPositionDeck.tsx` (L238-400) | **Arbitrary Tailwind text-size** | `text-[22px]`, `text-[17px]`, `text-[14px]`, v.v. | `--fs-2xl`, `--fs-lg`, `--fs-md` | **High (P1)** | Medium |
| ERR-09 | `src/layouts/full/vertical/header/Header.tsx` | **Arbitrary Tailwind text-size** | `text-[20px]`, `text-[16px]`, v.v. | `--fs-xl` (18px), `--fs-lg` (16px) | **High (P1)** | Low |
| ERR-10 | `src/components/detail/DetailDrawer.tsx` (L80-123) | **Inline fontSize** | `fontSize: '15px'`, `fontSize: '13px'`, etc. inline styles | `--fs-lg` (16px), `--fs-md` (14px) | **High (P1)** | Low |
| ERR-11 | `src/components/soc/soc.components.css` (L41) | **Non-8pt-grid + hardcoded px in CSS** | `.tabButton { font-size: 0.8rem; gap: 0.4rem; }`, `.tabBar { gap: 0.35rem }` | `--fs-md` (0.875rem), `--sp-2`/`--sp-3`, `gap-1`/`gap-2` | **Medium (P2)** | Low — SOC chỉ |
| ERR-12 | `src/components/dashboard/index.css` (L380-456) | **Hardcoded colors + arbitrary px in @layer utilities** | `scrollbar-color: #2a3550`, `font-size: 0.75rem`, `gap: 4px`, `color: #8a94a6` | `var(--color-text-muted)`, `text-xs`, `--sp-1` | **Medium (P2)** | Low |
| ERR-13 | `src/index.css` (L279-304) | **Hardcoded border/background in glass classes** | `.dashboard-triad-lane { border-color: var(--border-default, rgba(51,65,85,0.6)) }`, `background: var(--bg-panel-soft, rgba(30,41,59,0.4))` | `var(--border-default)`, `var(--bg-panel-soft)` — fallback có giá trị hardcode inline | **Medium (P2)** | Low — fallback only |
| ERR-14 | `src/components/soc/soc.components.css` (L1-3916) | **Font-size px values trong CSS file** | `font-size: 0.8rem`, `font-size: 0.85rem`, v.v. khắp file | `--fs-md`, `--fs-sm` tokens | **Medium (P2)** | Medium — file lớn 3916 dòng, nhiều px |
| ERR-15 | `src/components/aiSettings.module.css`, `DNSEConnectionPanel.css`, `ShellPageTemplate.module.css`, `VninvestInput.module.css` | **Hardcoded hex trong CSS modules** | 15 file CSS chứa `#[0-9a-fA-F]{3,6}` | Theme tokens tương ứng | **Medium (P2)** | Low-Medium |
| ERR-16 | `src/components/dashboard/CoreDashboardPositionDeck.tsx` | **Font-weight inconsistency** | `fontWeight: 700` kết hợp Tailwind `font-bold` | `--fw-semibold:600` / `font-semibold` | **Medium (P2)** | Low |
| ERR-17 | 71 TSX/TS files + 15 CSS files | **71 files chứa hardcoded hex colors** | `#[0-9a-fA-F]{3,6}` pattern match trong code TSX/TS | `var(--color-*)` hoặc Tailwind `text-cyan-400` semantic | **High (P1)** | High — dark mode, theme switch |
| ERR-18 | `src/pages/admin/AdminCore*` (8 pages) | **Header title structure drift** | Header dùng `<h1>` với Tailwind `text-xl`, một số page dùng `<h2>`, một số dùng `text-[20px]` | `<LayoutHeader>` component + `text-xl` + `--fs-xl` | **Medium (P2)** | Low |
| ERR-19 | `src/components/dashboard/PortfolioHeatmap.js` | **Legacy JS file hardcode colors** | `#7f1d1d`, `#5b2228`, `#2f3747` gradient + `#0b1528` | `--heat-*` CSS variables | **Medium (P2)** | Low |
| ERR-20 | `src/components/alert-center/StatsTable.tsx`, `FilterBar.tsx` | **Hardcoded semantic colors in JSX** | `#10b981`, `#ef4444` inline, `text-[#2D3748]` tailwind arbitrary | `var(--color-success-500)`, `var(--color-danger-500)` | **High (P1)** | Medium |

---

## PHẦN II: CHI TIẾT TICKET BÀN GIAO CHO DEV

### [ERR-01] Chuẩn hóa Radius Scale — `src/index.css` + toàn bộ project

- **Scope File(s):**
  - Path: `packages/web/src/index.css` (L85-88)
  - Associated: `packages/web/src/theme/tokens.css`, `packages/web/src/components/soc/soc.tokens.css`
- **Danh sách điểm lệch chuẩn (Defects):**
  1. *Defect 1:* Tailwind `@theme` define `--radius-sm: 0.25rem`, `--radius-md: 0.375rem`, `--radius-lg: 0.5rem` — tương ứng 4px, 6px, 8px
  2. *Defect 2:* `theme/tokens.css` define `--r-sm: 6px`, `--r-md: 8px`, `--r-lg: 12px`
  3. *Defect 3:* `soc.tokens.css` define `--r-sm: 6px`, `--r-md: 8px`, `--r-lg: 12px` (matching `theme/tokens.css`)
  4. *Impact:* Component dùng `rounded-sm/md/lg` nhận 4/6/8px, nhưng CSS var `--r-*` trả về 6/8/12px → widget SOC glassmorphism bị lệch radius so với rest of UI

- **Kế hoạch Refactor (Refactoring Blueprint):**
  - **Mã vi phạm hiện tại (Current Code):**
    ```css
    /* index.css @theme block L85-88 */
    --radius-sm: 0.25rem;  /* = 4px */
    --radius-md: 0.375rem; /* = 6px */
    --radius-lg: 0.5rem;   /* = 8px */
    ```
  - **Mã chuẩn hóa bàn giao (Target Code Diff):**
    ```diff
    - --radius-sm: 0.25rem;  /* = 4px */
    - --radius-md: 0.375rem; /* = 6px */
    - --radius-lg: 0.5rem;   /* = 8px */
    + --radius-sm: 0.375rem; /* = 6px — match --r-sm */
    + --radius-md: 0.5rem;   /* = 8px — match --r-md */
    + --radius-lg: 0.75rem;  /* = 12px — match --r-lg */
    ```
    > Architectural Rationale: SOC design system dùng 6/8/12px radius scale (4pt grid). Tailwind scale cần sync để `rounded-lg` = 12px. `--radius-xl: 0.75rem` có thể giữ nguyên hoặc bump thành `--radius-2xl` tương ứng.

- **Tiêu chuẩn nghiệm thu kỹ thuật (Acceptance Criteria):**
  - [ ] **AC-1:** `rounded-sm` computed = 6px, `rounded-md` = 8px, `rounded-lg` = 12px (measure via DevTools)
  - [ ] **AC-2:** 0 regression — không file nào bị đổi radius ngoài ý muốn
  - [ ] **AC-3:** SOC glass panels (`--r-lg: 12px`) match Tailwind `rounded-lg`
  - [ ] **AC-4:** `border-radius` toàn bộ project đồng nhất 6/8/12px scale

- **Minh chứng xác thực nghiệm thu:**
  ```bash
  # Verify no hardcoded radius values in TSX
  grep -E "rounded-(sm|md|lg)" packages/web/src --include="*.tsx" --include="*.ts" -r
  # Verify computed styles via DevTools
  ```

---

### [ERR-02] Chuẩn hóa font-size trong @layer utilities — `src/index.css`

- **Scope File(s):**
  - Path: `packages/web/src/index.css` (L356-381)
  - Associated: `packages/web/src/theme/tokens.css` (L18-24)
- **Danh sách điểm lệch chuẩn (Defects):**
  1. *Defect 1:* `.panel-title { font-size: 16px }` — hardcoded thay vì `var(--fs-lg)` hoặc `text-lg`
  2. *Defect 2:* `.panel-label { font-size: 12px }` — hardcoded thay vì `--fs-xs` hoặc `text-xs`
  3. *Defect 3:* `.panel-body-text { font-size: 14px }` — hardcoded thay vì `--fs-md` hoặc `text-base`
  4. *Defect 4:* Không dùng `line-height` token (`--lh-*`)

- **Kế hoạch Refactor:**
  - **Mã vi phạm hiện tại:**
    ```css
    .panel-title, .panel-head h2 {
      font-weight: 600;
      font-size: 16px;
      line-height: 1.3;
    }
    .panel-label { font-size: 12px; font-weight: 500; }
    .panel-body-text { font-size: 14px; line-height: 1.5; }
    ```
  - **Target Code Diff:**
    ```diff
    - .panel-title, .panel-head h2 { font-size: 16px; }
    + .panel-title, .panel-head h2 { font-size: var(--fs-lg); font-size: 1rem; line-height: var(--lh-snug); }
    - .panel-label { font-size: 12px; }
    + .panel-label { font-size: var(--fs-xs); font-size: 0.75rem; }
    - .panel-body-text { font-size: 14px; }
    + .panel-body-text { font-size: var(--fs-md); font-size: 0.875rem; }
    ```
    > Architectural Rationale: `var(--fs-lg)` = 16px (matches `text-lg`), `var(--fs-xs)` = 12px (matches `text-xs`), `var(--fs-md)` = 14px (matches `text-base`). Value-preserving — chỉ thay đổi source, không thay đổi visual.

- **AC:**
  - [ ] `.panel-title` computed = 16px, `.panel-label` = 12px, `.panel-body-text` = 14px
  - [ ] CSS variables `--fs-*` được sử dụng
  - [ ] Không có hardcoded `px` trong font-size cho panel classes

---

### [ERR-03..ERR-05] Chuẩn hóa màu hardcode trong @layer — `src/index.css`

- **Scope File(s):** `packages/web/src/index.css` (L262-586)
- **Danh sách điểm lệch chuẩn:**
  1. *Defect 1 (L262):* `.glass { background: rgba(15, 23, 42, 0.8) }` → `var(--bg-panel)` + opacity token
  2. *Defect 2 (L340-353):* `.pill[data-sign]` dùng `rgb(16 185 129 / 0.2)`, `#34d399`, `#fb7185`, `#8a94a6` → semantic tokens
  3. *Defect 3 (L569):* `.heatmap-legend { color: #64748b }` → `var(--color-text-muted)`
  4. *Defect 4 (L568-585):* `.heatmap-legend-bar` gradient hardcode 5 stop → `--heat-up-strong`, `--heat-down-strong` CSS vars
  5. *Defect 5 (L435-456):* `#2a3550` scrollbar color → `var(--color-border-secondary)`

- **Kế hoạch Refactor:**
  - **Current:** `color: #64748b; background: rgb(16 185 129 / 0.2);`
  - **Target:**
    ```diff
    - color: #64748b;
    + color: var(--color-text-muted);
    - background-color: rgb(16 185 129 / 0.2);
    + background-color: color-mix(in srgb, var(--color-success-500) 20%, transparent);
    ```
    > Architectural Rationale: `color-mix()` không support rộng → dùng `rgba(var(--soc-rgb-10b981) / 0.2)` pattern matching soc.tokens.css. Hoặc đơn giản dùng `var(--color-success-500)` với opacity class.

---

### [ERR-07] AlertCard arbitrary text sizes — `src/components/alert-center/AlertCard.tsx`

- **Scope File(s):** `packages/web/src/components/alert-center/AlertCard.tsx` (L210-307)
- **Defects:** `text-[19px]`, `text-[15px]`, `text-[13px]` tại các dòng header/stat/label
- **Kế hoạch Refactor:**
  - **Current:** `<h2 className="text-[19px] font-bold">`, `<span className="text-[15px]">`
  - **Target Diff:**
    ```diff
    - text-[19px]
    + text-xl  /* = 20px, nearest 8pt scale */
    - text-[15px]
    + text-base /* = 14px */
    - text-[13px]
    + text-sm   /* = 12px — nearest valid */
    ```
    > Architectural Rationale: Nearest Valid Token Heuristic. `text-[19px]` → `text-xl` (20px, Δ1px acceptable). `text-[15px]` → `text-base` (14px, Δ1px) OR `text-lg` (16px, Δ1px). Ưu tiên giữ visual gần nhất.

- **AC:**
  - [ ] `grep -E "text-\[[0-9]+px\]" AlertCard.tsx` = 0 hit
  - [ ] Computed font-size thay đổi ≤2px so với hiện tại

---

### [ERR-08] CoreDashboardPositionDeck arbitrary text sizes

- **Scope File(s):** `packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx` (L238-400)
- **Defects:** `text-[22px]`, `text-[17px]`, `text-[14px]` — 10+ occurrences across title/stat/label
- **Kế hoạch Refactor:**
  - **Current:** `text-[22px]` → `text-2xl` (22px exact match!)
  - **Current:** `text-[17px]` → `text-xl` (18px) or `text-lg` (16px) — nearest heuristic
  - **Current:** `text-[14px]` → `text-base` (14px exact match)
  ```diff
  - text-[22px]
  + text-2xl
  - text-[17px]
  + text-xl
  - text-[14px]
  + text-base
  ```

---

### [ERR-10] DetailDrawer inline fontSize

- **Scope File(s):** `packages/web/src/components/detail/DetailDrawer.tsx` (L80-123)
- **Defects:** `fontSize: '15px'`, `fontSize: '13px'` inline style objects
- **Kế hoạch Refactor:**
  - **Current:** `style={{ fontSize: '15px' }}`
  - **Target:** `className="text-base"` (14px) or `className="text-lg"` (16px) per nearest heuristic
  ```diff
  - style={{ fontSize: '15px' }}
  + className="text-base"
  ```
  > Architectural Rationale: Inline style không thể dùng CSS variable cho font-size một cách clean. Chuyển sang Tailwind class để thống nhất với theme scale.

---

### [ERR-17] 71 files hardcoded hex colors

- **Scope:** toàn bộ `packages/web/src`
- **Phương án:** Wave 2 — ưu tiên files SOC, Dashboard, Alert-Center trước
- **Danh sách 20 file hàng đầu (theo first scan):**
  1. `AIUsageDashboard.tsx` — thay `#hex` bằng `text-cyan-400`/`bg-slate-800` etc
  2. `alert-center/AlertCard.tsx`, `FilterBar.tsx`, `StatsTable.tsx`
  3. `dashboard/CoreDashboardPositionDeck.tsx`, `PortfolioHeatmap.js`
  4. `soc/SocAnomalyGuardPanel.tsx`, `SocDataInventorySection.tsx`, `SocBackfillProgressPanel.tsx`
  5. `screener/*.tsx` (7 files)
  6. `pages/admin/AdminCore*.tsx` (8 files)
  7. `layouts/header/Header.tsx`
  8. `components/ui/*.tsx` (button, card, input, etc)

- **Kế hoạch Refactor (per file pattern):**
  ```diff
  - color="#ef4444"
  + color="var(--color-danger-500)" or className="text-red-500"
  - bgColor="#1e293b"
  + className="bg-slate-800"
  - style={{ backgroundColor: '#0f172a' }}
  + className="bg-slate-900"
  ```

---

### [ERR-18] Header title structure drift — 8 admin pages

- **Scope:** `src/pages/admin/AdminCoreOverviewPage.tsx`, `*BillingPage.tsx`, `*JobsPage.tsx`, `*AuditTracePage.tsx`, `*TenantsPage.tsx`, `*UsagePage.tsx`, `*PATsPage.tsx`, `*ServiceAccountsPage.tsx`
- **Defects:** Một số page dùng `<h1 className="text-xl">`, một số `<h2>`, một số `text-[20px]`
- **Target:** `<LayoutHeader title="..." />` hoặc `<h1 className="text-xl font-bold text-text-primary">` thống nhất
- **Kế hoạch:** Tạo/shared `<LayoutHeader>` wrapper nếu chưa có; migrate tất cả 8 pages

---

## PHẦN III: KẾ HOẠCH TRIỂN KHAI PHÂN TẦNG

### Wave 0 — Foundation Fix (NGAY — Critical Radius Mismatch)
**Why first:** ERR-01 radius mismatch là P0 bug, ảnh hưởng toàn bộ project, fix đơn giản (chỉ 3 lines).

| Ticket | Files | Effort |
|---|---|---|
| ERR-01 Fix | `src/index.css` @theme block | 15 phút |
| Verify token sync | `src/theme/tokens.css`, `src/components/soc/soc.tokens.css` | 30 phút |

### Wave 1 — Foundation & Shared Primitives (1 sprint)
| Ticket | Files | Effort |
|---|---|---|
| ERR-02 Fix | `src/index.css` @layer panel classes | 2h |
| ERR-03..ERR-05 Fix | `src/index.css` @layer glass/pill/heatmap/scrollbar | 3h |
| Create/shared `LayoutHeader` component | `src/components/ui/LayoutHeader.tsx` | 4h |
| Migrate admin page headers (ERR-18) | 8 `AdminCore*.tsx` files | 6h |
| Fix scrollbar hardcode in @layer | `src/index.css` L435-456 | 1h |

### Wave 2 — High-Traffic / Core Pages (2-3 sprints)
| Ticket | Files | Effort |
|---|---|---|
| ERR-07 Fix | `alert-center/AlertCard.tsx`, `FilterBar.tsx`, `StatsTable.tsx` | 4h |
| ERR-08 Fix | `dashboard/CoreDashboardPositionDeck.tsx` | 3h |
| ERR-09 Fix | `layouts/full/vertical/header/Header.tsx` + 2 admin pages | 2h |
| ERR-10 Fix | `detail/DetailDrawer.tsx` | 2h |
| ERR-17 — SOC panel group | `soc/*.tsx` (5 files) | 8h |
| ERR-17 — Dashboard group | `dashboard/*.js/tsx`, `alert-center/*.tsx` | 6h |
| ERR-17 — Screener group | `screener/*.tsx` (7 files) | 10h |

### Wave 3 — Sub-pages & Edge Cases (2 sprints)
| Ticket | Files | Effort |
|---|---|---|
| ERR-17 — Admin pages | `pages/admin/AdminCore*.tsx` (8 files) | 12h |
| ERR-17 — Market/Signals/Workspace pages | Remaining files | 8h |
| ERR-17 — Auth/Commercial/VIP/Tenant | Remaining files | 6h |
| ERR-15 — CSS module hardcode | 15 `.css` files | 4h |
| ERR-11 Fix | `soc/soc.components.css` font-size/gap | 2h |
| ERR-12 Fix | `index.css` dashboard @layer remaining | 2h |
| ERR-19 Fix | `PortfolioHeatmap.js` legacy | 1h |

### Quality Gate mỗi Wave
```bash
# Pre-commit check per wave
npm run lint -- --max-warnings=0
npx tsc --noEmit
npm run build
npx vitest run <wave files>
grep -E "#[0-9a-fA-F]{3,6}" packages/web/src/<wave dir> --include="*.tsx" --include="*.ts" || echo "Color audit passed"
```

---

## Architectural Rationale Summary

| Issue | Quy tắc áp dụng | Decision |
|---|---|---|
| Radius mismatch | **Nearest Valid Token Heuristic** + 8pt grid | Bump Tailwind `--radius-*` lên 6/8/12px matching SOC scale — không đổi visual CSS var |
| Font-size hardcode | **Value-Preserving Token Migration** | Thay px bằng `var(--fs-*)` — value không đổi |
| Color hardcode | **Semantic Color Palette** | `#[hex]` → `var(--color-*)` hoặc Tailwind semantic class |
| Arbitrary Tailwind sizes | **Nearest Valid Token Heuristic** | `text-[19px]` → `text-xl` (Δ1px), `text-[17px]` → `text-xl` (Δ1px), `text-[14px]` → `text-base` (Δ0px) |
| Non-8pt-grid spacing | **8pt Grid System** | `gap-4px` → `gap-1` (4px hợp lệ), `p-[13px]` → `p-3` (8px) hoặc `p-4` (16px) |
| Inline style fontSize | **Component Compliance** | Chuyển `style={{fontSize}}` → `className="text-*"` |
| Dark mode safety | **Theme Switch Integrity** | Mọi hardcode màu phải là CSS var để auto-adapt |

---

## Appendix: Scan Statistics

| Metric | Value |
|---|---|
| Total TSX/TS files scanned | ~350 |
| Files with hardcoded hex (`#[0-9a-fA-F]{3,6}`) | **71** |
| CSS files with hardcoded hex | **15** |
| Files with arbitrary Tailwind text sizes (`text-[X]`) | **17** |
| Files with inline `fontSize:` | Multiple (DetailDrawer, AlertCard, CoreDashboardPositionDeck) |
| Radius scale mismatches | **3** (sm, md, lg) |
| Hardcoded font-size in @layer | **3** classes |
| Hardcoded colors in @layer | **5+** locations |
| Admin pages with header drift | **8** |
| Total estimated ticket count | **20 ERR-IDs** |
| Total estimated dev effort | **~18-22 sprints** (full) / **~5 sprints** (Wave 0-2 critical) |
