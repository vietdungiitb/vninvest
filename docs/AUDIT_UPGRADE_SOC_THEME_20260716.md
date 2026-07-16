# Audit & Chuẩn hóa UI/UX SOC — Áp dụng System Theme chung

**Ngày:** 2026-07-16 (rev 2 — mở rộng toàn bộ SOC, dựa trên system theme thực tế)
**Phạm vi:** Toàn bộ `packages/web/src/components/soc/*` (30 components) + container DataOps
**Mục tiêu:** Đưa SOC lên chuẩn theme thống nhất của hệ thống (đã được shell Header/Sidebar áp dụng), đạt chất lượng commercial-grade.

---

## 1. PHÁT HIỆN QUAN TRỌNG NHẤT

### 1.1 Hệ thống theme chuẩn của hệ thống (đã tồn tại & được áp dụng ở shell)
Qua nghiên cứu codebase, hệ thống **đÃ có** design system thống nhất, được shell chrome (`Header.tsx`, `Sidebar.tsx`) sử dụng:

| Lớp | Vị trí | Trạng thái |
|-----|--------|-----------|
| **Primitive components** | `src/components/ui/*` (button, card, badge, tabs, table, dialog, drawer, select, input, skeleton, switch, checkbox, tooltip, lucide-icon...) | ✅ Được shell dùng (`Header`/`Sidebar` import `Button`, `LucideIcon`) |
| **Vector icons** | `src/components/ui/lucide-icon.tsx` (`LucideIcon`) | ✅ Shell dùng thay emoji |
| **Token layer** | `src/theme/tokens.css` (alias `--accent-cyan`, `--text-muted`, `--bg-panel`, `--border-default`...) | ⚠️ Ít referenced |
| **CSS-module design system** | `src/theme/theme.module.css` (`.btn`, `.card`, `.panelGlass`, `.badge*`, `.tabs`, `.table*`, `.alert*`, `.skeleton`, `.emptyState`, `.metric`, `.toolbar`) | ⚠️ **Orphaned — 0 component import** |

**Kết luận:** Có 2 design system song song:
- (A) **Chuẩn hệ thống** = `components/ui/*` (shadcn-style, adopted bởi shell) + `lucide-icon`.
- (B) **Legacy SOC** = `soc.module.css` (5038 dòng, hardcoded hex + class tự động `s5_N_SocXxx` + emoji).

**Toàn bộ 30 component SOC dùng (B) và không import (A) hay `theme.module.css`.** Đây là root cause của mọi gap UI/UX.

### 1.2 Bằng chứng định lượng
- `grep "theme.module.css"` trong 146 file `.tsx` → **0 kết quả**.
- `grep "soc.module.css"` trong 30 file SOC → **30/30 file** (100% dùng legacy).
- `grep "components/ui/(button|card|badge|tabs|table|dialog|lucide-icon)"` → chỉ `Header` + `Sidebar` (shell).
- `SocTabNavigation.tsx` + `SocDataOpsPanel.tsx` dùng emoji (`📊 🚀 📡 ⏰ ⚙️`) thay vì `LucideIcon`.

---

## 2. AUDIT TOÀN BỘ SOC — GAP THEO TIÊU CHÍ

### 2.1 Bố cục & Cấu trúc (Layout)
| # | File | Vấn đề |
|---|------|--------|
| L1 | `SocDataOpsPanel.tsx:80` | `className: "styles.tabBar s5_0_SocDataOpsPanel"` — `"styles.tabBar"` là string literal **không resolve** → class không tồn tại, tab bar mất styling. **BUG High** |
| L2 | Tất cả 30 SOC | Dùng `.tabBar/.tabButton` (legacy) thay vì `components/ui/tabs` hoặc `theme.module.css .tabs/.tabActive` |
| L3 | `SocDataOpsOperationsSection.tsx:773` `opsLayoutContainer` | 2 cột `1.6fr 1.1fr` ổn, nhưng cột phải `sticky top:1rem` dễ bị cắt khi nội dung dài; không dùng `.panelGlass` |
| L4 | `SocOverviewPanel`, `SocSignalsPanel`, `SocScreenerPanel` | Mỗi panel tự define layout class `s5_*`, không có grid system chung |

### 2.2 Màu sắc & Tokens (Color)
| # | File | Vấn đề |
|---|------|--------|
| C1 | `soc.module.css` (toàn bộ) | Hardcode hex: `#34d399`, `#f87171`, `#fbbf24`, `rgb(6,95,70)`, `rgba(0,180,216,...)` thay vì token `--accent-emerald/--accent-rose/--accent-amber/--accent-cyan` |
| C2 | `SocDataInventorySection.tsx:90` | `background: "rgba(6,95,70,0.08)"` + `borderColor:"rgb(6,95,70)"` hardcode |
| C3 | `SocDataOpsOperationsSection.tsx:307` | `borderColor:"rgba(34,211,238,0.4)"` hardcode (phải là `var(--accent-cyan)`) |
| C4 | `SocDataOpsOperationsSection.tsx:258` `getStatusBadgeStyle` | Inline hardcode status colors thay vì `.badgeSuccess/.badgeWarning/.badgeDanger` |

### 2.3 Typography & Font (điểm yếu nhất)
| # | File | Vấn đề |
|---|------|--------|
| T1 | `soc.module.css:334,405,555` | Font code hardcode `"Menlo","Consolas",monospace` (phải `--font-mono` token) |
| T2 | `ShellPageTemplate.module.css:42` | `"Segoe UI","Arial",sans-serif` — khác với `StockDetailPage` dùng `"Inter"` |
| T3 | Toàn SOC | **Không có font-scale chuẩn**: chữ rải rác `0.55rem`(quá nhỏ) → `1.2rem` tự phát, không theo thang đo; line-height `1.4`/`1.5`/không set không nhất quán |
| T4 | `theme/tokens.css` | Đã có token màu nhưng **chưa có token font-family / font-scale** → cần bổ sung |

### 2.4 Icon & Trực quan (Iconography)
| # | File | Vấn đề |
|---|------|--------|
| I1 | `SocDataOpsPanel.tsx:13-17`, `SocTabNavigation.tsx` | Dùng emoji (`📊🚀📡⏰⚙️`) — render không nhất quán cross-platform, trông "rẻ", không commercial |
| I2 | Toàn SOC | Không dùng `LucideIcon` (vector, đã có sẵn trong hệ thống) |

### 2.3 i18n & Ngôn ngữ
| # | File | Vấn đề |
|---|------|--------|
| N1 | `SocDataInventorySection.tsx:128,132-138` | Header bảng hardcode EN (`Group/Symbols/Covered/Ngày lịch/Total Rows/Date Range`) + `"Coverage by Group"` không qua i18n |
| N2 | `SocDataOpsOperationsSection.tsx:354` | Nút "⚙ config" dùng `soc.dataops.subtab.config` (nhãn sai ngữ cảnh — mở drawer custom group) |
| N3 | Nhiều panel | Một số label hardcode, chưa map i18n key |

### 2.6 Components & Tech Debt
| # | File | Vấn đề |
|---|------|--------|
| D1 | `SocBackfillCenter.tsx` vs `SocDataOpsOperationsSection.tsx` | **2 component làm cùng việc backfill** → lệch style, duplicate logic |
| D2 | `soc.module.css` 5038 dòng | ~2800 dòng là class tự động `s5_N_SocXxx` (tên vô nghĩa, khó bảo trì) — tech debt lớn |
| D3 | `SocDataOpsConfigSection.tsx`, `SocSchedulerBoard.tsx` | Table dùng `font-mono: 1` (sai thuộc tính CSS, phải `font-family`) |

### 2.7 Accessibility & Motion
| # | Vấn đề |
|---|--------|
| A1 | Tab bar thiếu `aria-orientation`; focus-visible ring không đồng nhất |
| A2 | Không có `@media (prefers-reduced-motion: reduce)` |
| A3 | Bảng dài thiếu sticky header; numeric column chưa right-align + tabular-nums đồng nhất |

---

## 3. CHIẾN LƯỢC ÁP DỤNG SYSTEM THEME

**Nguyên tắc:** Không viết design system mới. Áp dụng hệ thống **đã có** theo thứ tự ưu tiên:

1. **Ưu tiên 1 — `components/ui/*`** (shadcn primitives): Button, Card, Badge, Tabs, Table, Dialog, Drawer, Input, Skeleton, Switch, Tooltip, `LucideIcon`. Đây là chuẩn shell đang dùng.
2. **Ưu tiên 2 — `theme/theme.module.css`**: khi cần CSS-module specific (glass panel, metric, toolbar) dùng class token-driven có sẵn (`.panelGlass`, `.card`, `.badge*`, `.alert*`, `.table*`, `.metric`, `.skeleton`, `.emptyState`, `.toolbar`).
3. **Ưu tiên 3 — `theme/tokens.css`**: bổ sung token **font-family + font-scale** (hiện thiếu), giữ nguyên alias màu đã có.
4. **Loại bỏ — `soc.module.css` legacy**: dần migrate, xóa `s5_*` rác.

### 3.1 Bổ sung token (file `theme/tokens.css`)
```css
:root {
  /* Font families (chuẩn hệ thống) */
  --font-sans: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Menlo", "Consolas", monospace;

  /* Font scale */
  --fs-2xs: 0.6875rem;  /* 11px micro-label */
  --fs-xs:  0.75rem;    /* 12px caption */
  --fs-sm:  0.8125rem;  /* 13px body-sm */
  --fs-md:  0.875rem;   /* 14px body */
  --fs-lg:  1rem;       /* 16px subhead */
  --fs-xl:  1.125rem;   /* 18px h3 */
  --fs-2xl: 1.375rem;   /* 22px h2 */

  /* Line heights */
  --lh-tight: 1.25; --lh-snug: 1.4; --lh-normal: 1.55;

  /* Spacing (4px base) */
  --sp-1:0.25rem; --sp-2:0.5rem; --sp-3:0.75rem; --sp-4:1rem; --sp-5:1.25rem; --sp-6:1.5rem;

  /* Radius */
  --r-sm:6px; --r-md:8px; --r-lg:12px; --r-pill:999px;
}
```
> Gắn `--font-sans` làm default body trong `index.css` để toàn SOC kế thừa.

---

## 4. KẾ HOẠCH NÂNG CẤP (mở rộng toàn SOC, 9 bước)

| Step | Nội dung | File / Component | Verify |
|------|----------|-----------------|--------|
| 0 | Bổ sung token font/scale/spacing vào `tokens.css`; set `--font-sans` default body | `theme/tokens.css`, `index.css` | visual font đồng nhất |
| 1 | **Sửa bug tab bar** (L1): `styles.tabBar` → import `theme.module.css .tabs` hoặc giữ `soc.module.css .tabBar` đúng cách | `SocDataOpsPanel.tsx` | tab bar có border/active |
| 2 | **Emoji → LucideIcon** ở mọi tab SOC (`dataops`, overview, signals, screener, scheduler...) | `SocTabNavigation.tsx`, `SocDataOpsPanel.tsx`, các panel | icon vector nhất quán |
| 3 | **i18n header bảng** (N1/N2/N3): move EN hardcode → `vi.js/en.js` | `SocDataInventorySection.tsx`, `SocDataOpsOperationsSection.tsx` | 0 hardcode EN |
| 4 | **Token màu** (C1–C4): thay hex hardcode bằng `--accent-*`; status badge dùng `.badge*` | `soc.module.css`, các section | grep hex = 0 |
| 5 | **Primitive adoption**: Button/Card/Badge/Table/Dialog/Drawer thay inline style | `SocDataOpsOperationsSection`, `SocDataInventorySection`, `SocDataOpsConfigSection`, `SocSchedulerBoard` | dùng `components/ui` |
| 6 | **Gom `s5_*` rác** (D2): map sang class semantic/theme, xóa dần `soc.module.css` → <3000 dòng | `soc.module.css` + 30 components | CSS thu gọn |
| 7 | **Hợp nhất Backfill** (D1): chọn 1 canonical (`SocDataOpsOperationsSection`), xóa `SocBackfillCenter` | 2 files | 1 path |
| 8 | **Bảng & Empty state** (A3): sticky header, numeric right-align + tabular-nums, `.emptyState` icon | inventory/monitor/config | visual |
| 9 | **A11y & Motion** (A1/A2): focus-visible, `aria-orientation`, `prefers-reduced-motion`, responsive 1024/768/480 | `soc.module.css` | devtools |

---

## 5. TIÊU CHÍ "COMMERCIAL-GRADE" (hệ thống chung)
- [ ] 100% SOC component import `components/ui/*` hoặc `theme.module.css` (0 file dùng `soc.module.css` legacy thuần túy)
- [ ] Icon vector (`LucideIcon`) thay emoji 100%
- [ ] Type scale đồng nhất (Inter 11–22px) qua token
- [ ] 100% màu qua token `--accent-*` (0 hex hardcode trong component)
- [ ] 100% label qua i18n (0 EN hardcode trong VN UI)
- [ ] Tab/Card/Button/Badge/Table/Dialog/Drawer dùng primitive chuẩn
- [ ] `prefers-reduced-motion` respected; responsive 3 breakpoint
- [ ] `tsc --noEmit` + `npm run build` pass

---

## 6. RISK & LƯU Ý
- `theme.module.css` đang orphaned → an toàn để adopt (không breaking existing).
- `components/ui/*` đã được shell dùng → proven stable.
- `SocBackfillCenter` có thể được route khác reference → kiểm tra trước khi xóa (Step 7).
- Giữ nguyên API/data shape, chỉ đổi presentation.
- Pure createElement (AGENTS.md): `LucideIcon` dùng `createElement(LucideIcon, { name: "..." })`; primitive `createElement(Button, {...})`.
- Migrate dần từng panel (không big-bang) để giữ `tsc` xanh sau mỗi step.
