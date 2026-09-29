# Audit & Nâng cấp UI/UX — Trang SOC DataOps (`/operations-center?tab=dataops`)

**Ngày:** 2026-07-16
**Phạm vi:** 5 sub-tab (inventory, operations, monitor, scheduler, config) + container `SocDataOpsPanel`
**Mục tiêu:** Đưa trang đạt chất lượng phần mềm thương mại (commercial-grade) theo theme glassmorphism SOC hiện có.

---

## 1. HIỆN TRẠNG & ĐIỂM NGHẼN

### 1.1 Cấu trúc code
- `SocDataOpsPanel.tsx` — container, tab bar dùng emoji (`📊 🚀 📡 ⏰ ⚙️`), `className: "styles.tabBar s5_0_SocDataOpsPanel"` (sai cú pháp: `"styles.tabBar"` là string literal chứ không phải CSS module reference → class không tồn tại, chỉ `s5_0_...` áp dụng). **BUG**: class `styles.tabBar` không được áp dụng → tab bar mất styling.
- 5 sub-tab render qua `ShellPanel` (title/subtitle).
- File CSS `soc.module.css` **5038 dòng**, trong đó ~2800 dòng là các class tự động `s5_0_SocXxx ... s5_N_SocXxx` (tên vô nghĩa, khó bảo trì). Đây là technical debt lớn.

### 1.2 Các bug / gap cụ thể

| # | Vị trí | Vấn đề | Mức độ |
|---|--------|--------|--------|
| B1 | `SocDataOpsPanel.tsx:80` | `"styles.tabBar s5_0_SocDataOpsPanel"` — `styles.tabBar` không resolve → tab bar không có border/active indicator | 🔴 High |
| B2 | `SocDataInventorySection.tsx:128-139` | Header bảng hardcode tiếng Anh (`Group/Symbols/Covered/Ngày lịch/Total Rows/Date Range`) trong khi UI là tiếng Việt | 🔴 High |
| B3 | `SocDataInventorySection.tsx:127` | `createElement("div", { className: styles.sectionCardTitle }, "Coverage by Group")` hardcode EN, không qua i18n | 🟠 Med |
| B4 | `SocDataOpsOperationsSection.tsx:355` | Nút "⚙ config" dùng `t("soc.dataops.subtab.config")` (nhãn sai ngữ cảnh — mở drawer custom group, không phải config) | 🟠 Med |
| B5 | Duplicate UI | `SocDataOpsOperationsSection` (mới) và `SocBackfillCenter` làm cùng việc backfill → 2 code path, dễ lệch style | 🟠 Med |
| B6 | `SocDataOpsOperationsSection.tsx:288-333` | Hardcode color `rgba(34,211,238,0.4)` thay vì token CSS var → lệch theme khi đổi accent | 🟡 Low |
| B7 | `SocDataInventorySection.tsx:90` | `rgb(6,95,70)` hardcode (không dùng token) | 🟡 Low |
| B8 | Tab bar | Không có aria-orientation, indicator active dùng `::after` nhưng class cha bị hỏng (B1) nên indicator mất | 🟠 Med |
| B9 | Monitor/Config tables | `font-size: 0.7rem` + `font-mono: 1` (sai thuộc tính CSS, phải là `font-family`) → mono không áp dụng | 🟡 Low |
| B10 | Responsive | Tab bar `flex-wrap: nowrap` + overflow-x auto nhưng không có shadow/scroll hint; bảng coverage không cuộn ngang trên mobile | 🟡 Low |

### 1.3 Typography & Font (điểm yếu nhất theo yêu cầu)
- **Không có design token typography toàn cục.** Mỗi component tự chọn:
  - `soc.module.css`: `"Menlo","Consolas",monospace` (code/JSON)
  - `ShellPageTemplate.module.css:42`: `"Segoe UI","Arial",sans-serif`
  - `StockDetailPage.css:54`: `"Inter","Segoe UI",system-ui`
  - `WatchlistPage.css`: `"JetBrains Mono"`
  - `index.css:108`: `system-ui`
- **Không có font-scale chuẩn** (base 14/16px, heading hierarchy). Các section dùng `0.65–0.95rem` tự phát, line-height không đồng nhất (`1.4` vs `1.5` vs không set).
- Kích thước chữ rải rác: `0.55rem` (quá nhỏ, khó đọc), `0.7rem`, `0.75rem`, `0.8rem`, `0.85rem`, `0.95rem`, `1.1rem`, `1.2rem` — không theo thang đo.

### 1.4 Bố cục & Spacing
- `opsLayoutContainer` 2 cột `1.6fr 1.1fr` ổn, nhưng cột phải `position: sticky; top: 1rem` có thể bị cắt khi nội dung dài.
- `sectionCard` padding `1rem`, `glassPanel` padding `1.25rem` — không nhất quán với `metricCard` (`0.75rem 1rem`).
- Khoảng cách `gap` dao động `0.35rem`–`1.25rem` tùy chỗ.

### 1.5 Màu sắc & Theme
- Đã có token `:root` đầy đủ (cyan/emerald/amber/red/rgb variants) — **tốt**.
- Nhưng nhiều chỗ hardcode hex (`#34d399`, `#fbbf24`, `rgb(6,95,70)`) → vi phạm value-preserving token system.
- Status badge dùng inline `getStatusBadgeStyle` (hardcode) thay vì class `.statusBadge` + biến thể.

---

## 2. KẾ HOẠCH NÂNG CẤP CHI TIẾT

### Giai đoạn 0 — Nền tảng Typography & Spacing tokens (ưu tiên cao nhất)
**File mới:** `soc.module.css` bổ sung block `:root` typography + `_tokens`:
```css
:root {
  /* Font families */
  --font-sans: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Menlo", "Consolas", monospace;

  /* Font scale (commercial-grade hierarchy) */
  --fs-2xs: 0.6875rem;  /* 11px — micro label */
  --fs-xs:  0.75rem;    /* 12px — caption */
  --fs-sm:  0.8125rem;  /* 13px — body small */
  --fs-md:  0.875rem;   /* 14px — body */
  --fs-lg:  1rem;       /* 16px — subhead */
  --fs-xl:  1.125rem;   /* 18px — h3 */
  --fs-2xl: 1.375rem;   /* 22px — h2 */

  /* Line heights */
  --lh-tight: 1.25;
  --lh-snug:  1.4;
  --lh-normal:1.55;

  /* Spacing scale (4px base) */
  --sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem;
  --sp-4: 1rem; --sp-5: 1.25rem; --sp-6: 1.5rem;

  /* Radii */
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-pill: 999px;

  /* Elevation */
  --shadow-card: 0 2px 8px rgba(2,11,35,0.35);
  --shadow-pop: 0 8px 24px rgba(2,11,35,0.5);
}
```
- Set `font-family: var(--font-sans)` trên `.glassPanel`, `.sectionCard`, body SOC.
- Áp dụng font-scale vào `.sectionCardTitle` (`--fs-lg`, weight 700, `--lh-tight`), `.metricLabel` (`--fs-2xs`, uppercase, letter-spacing), `.metricValue` (`--fs-xl`, tabular-nums).

### Giai đoạn 1 — Sửa bug cấu trúc (B1–B4, B8, B9)
1. **B1/B8:** Sửa `SocDataOpsPanel.tsx:80` → `className: styles.tabBar` (bỏ `"styles.tabBar"` literal). Đảm bảo `styles.tabButton`/`.tabButtonActive::after` hoạt động.
2. **B2/B3:** Đưa toàn bộ header bảng inventory + "Coverage by Group" vào i18n key (`soc.dataops.coverage_by_group`, `soc.dataops.col_group`, `soc.dataops.col_symbols`, `soc.dataops.col_covered`, `soc.dataops.col_calendar_days`, `soc.dataops.col_total_rows`, `soc.dataops.col_date_range`).
3. **B4:** Nút drawer đổi nhãn thành `soc.dataops.manage_custom_groups` (⚙ quản lý nhóm).
4. **B9:** Sửa `font-mono: 1` → `font-family: var(--font-mono)` trong monitor/config tables.

### Giai đoạn 2 — Tab bar thương mại
- Thay emoji bằng **icon vector** (SVG inline hoặc `ui/Icon`) thay vì emoji (emoji render không nhất quán cross-platform, nhìn "rẻ").
- Thêm `aria-orientation="horizontal"`, focus-visible ring, hover lift.
- Active indicator: giữ `::after` slide, thêm `box-shadow` glow nhẹ.
- Trên mobile: biến thành scroll-snap ngang có gradient fade ở 2 mép.

### Giai đoạn 3 — Chuẩn hóa component (xóa tech debt `s5_*`)
- Gom các class `s5_N_SocXxx` vào semantic tokens (`.dataTypeCard`, `.coverageCell`, `.previewTable` đã có sẵn). Dần dần xóa ~2800 dòng CSS rác.
- Đồng nhất status badge: tạo `.statusBadge--success/running/failed/partial/queued` dùng token, thay `getStatusBadgeStyle` inline.

### Giai đoạn 4 — Bảng & Dữ liệu (inventory/monitor)
- Thêm sticky header cho bảng dài (`position: sticky; top: 0`).
- Hover row highlight đồng nhất (đã có `.coverageTable tbody tr:hover` nhưng monitor table thiếu).
- Numeric column right-align + `tabular-nums` (monitor table chưa chuẩn).
- Empty state có icon + hint thay vì text trần.

### Giai đoạn 5 — Operations form (backfill)
- Hợp nhất `SocDataOpsOperationsSection` + `SocBackfillCenter` (chọn 1 làm canonical, xóa 1).
- Dataset checkboxes: dùng `.dataTypeCard` có state selected (border + bg token), bỏ hardcode `rgba(34,211,238,0.4)`.
- Preview/Run console: 2 cột, sticky right col, progress bar dùng token gradient.
- Thêm keyboard: Enter trên reason input → preview.

### Giai đoạn 6 — Polish & Motion
- Micro-interaction: button press `transform: scale(0.98)`, card hover lift `translateY(-2px)` + shadow.
- Skeleton loading đồng nhất (đã có `.skeleton`).
- Reduce-motion: `@media (prefers-reduced-motion: reduce)` tắt animation.
- Dark theme chỉ: đảm bảo contrast AA (chữ `#94a3b8` trên nền tối đạt ≥4.5:1).

### Giai đoạn 7 — Responsive audit
- `<=1024px`: ops layout 1 cột, right col bỏ sticky.
- `<=768px`: tab bar scroll, bảng wrap/horizontal scroll, metric grid 2 cột.
- `<=480px`: font-scale xuống 1 cấp, padding giảm.

---

## 3. TIẾN TRÌNH ĐỀ XUẤT (theo thứ tự)

| Step | Nội dung | File | Verify |
|------|----------|------|--------|
| 0 | Thêm typography/spacing tokens + font-sans base | `soc.module.css`, `index.css` | `tsc`, visual |
| 1 | Sửa B1 tab bar class bug | `SocDataOpsPanel.tsx` | tab bar có border/active |
| 2 | i18n header bảng inventory (B2/B3) | `SocDataInventorySection.tsx`, `vi.js/en.js` | không còn EN hardcode |
| 3 | Sửa B4 nhãn drawer, B9 font-mono | `SocDataOpsOperationsSection.tsx` | label đúng |
| 4 | Tab bar icon vector + a11y | `SocDataOpsPanel.tsx` + `ui/Icon` | visual |
| 5 | Chuẩn hóa status badge tokens | `soc.module.css` | badge đồng nhất |
| 6 | Gom/thay `s5_*` classes | `soc.module.css` các section | CSS giảm <3000 dòng |
| 7 | Hợp nhất BackfillCenter | 2 file | 1 path |
| 8 | Bảng sticky/right-align/empty state | inventory/monitor | visual |
| 9 | Motion + reduced-motion + responsive | `soc.module.css` | devtools |

---

## 4. TIÊU CHÍ "COMMERCIAL-GRADE" CẦN ĐẠT
- [ ] Type scale nhất quán (Inter 11–22px), line-height chuẩn.
- [ ] Mọi label qua i18n (không hardcode EN trong VN UI).
- [ ] Mọi màu qua token CSS var (không hex hardcode).
- [ ] Tab bar có icon vector, active state rõ, a11y.
- [ ] Không còn class `s5_*_SocXxx` rác.
- [ ] Bảng có sticky header, numeric right-align, empty state.
- [ ] Responsive 3 breakpoint (1024/768/480).
- [ ] `prefers-reduced-motion` respected.
- [ ] `tsc --noEmit` + `npm run build` pass.

---

## 5. RISK & LƯU Ý
- CSS `s5_*` đang được tham chiếu ở nhiều component → xóa phải song song với refactor component (tránh gãy layout).
- `SocBackfillCenter` có thể đang được route khác dùng → kiểm tra trước khi xóa.
- Giữ nguyên API/data shape, chỉ đổi presentation.
- Pure createElement (không JSX) theo AGENTS.md; icon vector dùng `createElement("svg", ...)`.
