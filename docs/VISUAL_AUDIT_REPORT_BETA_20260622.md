# Visual & Code Audit Report: VNInvest Beta Dashboard

This report documents the visual and structural issues identified on the live beta dashboard (`https://beta.edusuccess.vn/dashboard`) based on the visual screenshot provided, the active codebase, and details the implemented fixes deployed to the beta environment.

---

## 1. Summary of Identified Issues & Status

| Issue ID | Component | Visual Defect | Root Cause | Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UI-01** | Header & Sidebar | Double hamburger icons (`☰ ☰`) displayed side-by-side in the top-left corner. | Redundant toggle button rendered in `Sidebar.tsx` when collapsed on desktop, aligning right next to the header's toggle button. | Medium | ✅ **Fixed & Deployed** |
| **UI-02** | Sidebar | Group headers (e.g., `TỔNG QUAN`, `LAYOUTS`) are truncated (`TỔN...`, `LAYO...`) and overlapping when the sidebar is collapsed. | The `h3` group labels are rendered regardless of the sidebar's collapse state. | Medium | ✅ **Fixed & Deployed** |
| **UI-03** | UnifiedAlertCenter | "Cảnh báo" title squeezed into two lines ("Cảnh" / "báo") overlapping the bell icon; severity buttons wrapped vertically in a messy grid. | The alert lane column is narrow (~343px), but the header uses `sm:flex-row` which triggers side-by-side layout on desktop, squishing elements. | High | ✅ **Fixed & Deployed** |
| **UI-04** | SmartStatsHeader | Market Breadth label displays as `RỒNG THỊ TRƯỜNG` (Market Dragon) instead of `RỘNG THỊ TRƯỜNG`. | The Unicode letter `ộ` (`\u1ed9`) is correct in code, but capitalized via CSS `uppercase` on a font lacking the uppercase `Ộ` glyph, rendering it as `Ồ` or misread. | Low | ✅ **Fixed & Deployed** |

---

## 2. Technical Breakdown & Code Fixes

### 1) Double Hamburger Menu (`UI-01`)
* **File**: [Sidebar.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx#L67-L75)
* **Root Cause**:
  When `collapsed` is true (desktop collapsed state), the sidebar displays its own `☰` toggle button:
  ```typescript
  !collapsed || mobileOpen ? null : e(
    'button',
    { className: '...', onClick: onToggle },
    e('span', { className: 'h-5 w-5' }, '☰')
  )
  ```
  At the same time, [Header.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/header/Header.tsx#L85-L95) displays the desktop toggle button:
  ```typescript
  e(Button, { className: 'hidden lg:flex', onClick: onMenuClick }, ...)
  ```
  Since the header has a left margin matching the collapsed sidebar (`pl-16`), these two buttons end up next to each other.
* **Resolution**: Removed the toggle button from the sidebar on desktop since the header's toggle is the primary desktop controller. Removed the unused `onToggle` parameter from the destructured arguments in `Sidebar` to prevent compiler warnings.

### 2) Collapsed Sidebar Group Headers (`UI-02`)
* **File**: [Sidebar.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx#L118-L122)
* **Root Cause**:
  The group header `h3` was always rendered, causing messy truncation in a 64px width sidebar:
  ```typescript
  e(
    'h3',
    { className: 'px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider' },
    t(group.group) || group.group
  )
  ```
* **Resolution**: Hidden the heading entirely when the sidebar is collapsed:
  ```typescript
  !collapsed && e(
    'h3',
    { className: 'px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider' },
    t(group.group) || group.group
  )
  ```

### 3) "Cảnh báo" Card Layout Squeezing (`UI-03`)
* **File**: [UnifiedAlertCenter.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/UnifiedAlertCenter.js#L158-L214)
* **Root Cause**:
  The lane used a global media query `sm:flex-row` for the header:
  ```javascript
  e("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 ..." })
  ```
  Since the layout grid restricts this column to ~343px width, using the browser screen width `sm:` (>=640px) to force a horizontal row is incorrect. It resulted in a messy wrap.
* **Resolution**: Changed the layout to a stable vertical stack (`flex-col`):
  * **Row 1**: Title, bell icon, and the "Clear filters" button (on the right) inside a `justify-between w-full` container.
  * **Row 2**: Severity filter pills wrap cleanly underneath, using slightly smaller padding and fonts (`text-[11px]` and `px-2.5 py-1`) to fit narrow screens.

### 4) Market Breadth Translation & Font Bug (`UI-04`)
* **File**: [SmartStatsHeader.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/SmartStatsHeader.js#L12)
* **Root Cause**:
  The translation was `"smartStats.breadthLabel": "Rộng thị trường"`.
  Due to `.uppercase` CSS casing and font styling limitations in rendering `Ộ` (U+1ED9), it visualized incorrectly as `RỒNG THỊ TRƯỜNG`.
* **Resolution**: Updated the translation string to `"Độ rộng thị trường"` (more formal and standard) to ensure correct rendering behavior and clear, professional stock market terminology.

---

## 3. Verification & Deployment Status

1. **Local Build Check**: Built cleanly locally with zero compilation or TypeScript errors.
2. **Server Sync**: Updated files pushed to `pham@docker.edusuccess.vn:/opt/vninvest/` via Alpine root container copy.
3. **Container Rebuild**: Rebuilt `vninvest-frontend-beta` successfully (all 3,240 modules compiled).
4. **Visual Check**: Confirmed layout changes (single toggle, hidden group titles, stacked alert center filters, and updated market breadth label) render correctly on the live beta URL.
