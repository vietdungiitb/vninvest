# AUDIT UI/UX TOÀN DIỆN — vninvest web (thực trạng · so sánh thương mại · lộ trình nâng cấp)

> **TÓM TẮT 5 FINDINGS QUAN TRỌNG NHẤT (đọc đầu tiên)**
>
> 1. **Nợ SSOT, không phải 2 theme (đính chính)**: repo **có đúng một SSOT trên giấy** (`AGENTS.md`, `index.css:3-5`, `scripts/check-light-theme.mjs:45-48`), nhưng lớp base được **khai báo ở 3 file** (`index.css:19` `@theme`, `theme/tokens.css:1`, `soc.tokens.css:5`) với **13 token conflict đã bị đóng băng trong baseline**. Gate `check-token-conflict.mjs:5-21` tự ghi nhận: *"`--bg-panel` resolves to `#0f172a` on `/dashboard` and to `rgba(8 23 52 / .4)` on `/admin/users` — same theme, different value, depending on which CSS chunk the route loaded."* Đây là nguyên nhân gốc của cảm giác "theme không đồng bộ giữa các trang".
> 2. **Không có một template page-level duy nhất**: 4 kiểu page header, 5 kiểu loading/empty state, 6 mức bo góc (8/12/14/16/20/24/28px), 4 cơ chế styling cùng tồn tại trên 834 file nguồn. `ShellPageChrome` được 40 file dùng, nhưng các nhóm admin/portfolio/AI/dashboard vẫn tự dựng chrome riêng.
> 3. **Có gate đỏ — không chỉ là nợ cũ**: `check-uiux-budget` **FAIL** (`CSS-2: 46→55 (+9)`, `A11Y-9: 5→16 (+11)`; tổng 162→129 nhưng gate chặn vì 2 rule tăng). 4 gate khác baseline-locked — exit 0 chỉ có nghĩa *không có vi phạm mới*. 13 conflict token vẫn đang chạy production.
> 4. **A11y nền tảng tốt nhưng còn nợ tập trung**: contrast PASS cả 2 mode (7 cặp tone + 12 cặp portfolio), skip link/landmark/reduced-motion có sẵn; nhưng ~45 control thiếu accessible name, ~24 trang thiếu `<h1>` thật, 5 modal thiếu focus trap/Escape, chưa probe runtime bằng Chromium.
> 5. **Khoảng cách với thương mại nằm ở "hệ", không phải "thành phần"**: repo đã có density, dark-default, token, widget chart riêng — gần Bloomberg/TradingView/Datadog về ý định. Cái thiếu là **một component library được adopt 100% route** + **one source of truth cơ học** + **chuẩn disclosure dữ liệu stale/delay** (fintech-specific).

- **Ngày audit**: 2026-11-19 · **Base**: `dev@69141ab93` · **Scope**: `packages/web/src` (0 dòng source thay đổi — docs-only).
- **Skill đã nạp**: `soc-uiux` (repo, SSOT + 12 gate) · `impeccable` (audit + critique playbook) · `ponytail` (reuse-first, review mode). `impeccable context` báo `NO_PRODUCT_MD` → đây là scoped audit trên code có sẵn, không phải greenfield; đề xuất chạy `/impeccable init` riêng (xem §I).
- **Tái lập**: mọi số liệu kèm lệnh ở §E và §A. Số không có lệnh tái lập trong phiên này bị đánh dấu `CHƯA XÁC MINH`.

---

## 0. Nguyên tắc đã tuân thủ

1. Mọi khẳng định kèm `file:line` hoặc lệnh tái lập; chưa đọc → `CHƯA XÁC MINH`.
2. grep/quét toàn repo gồm `.css`, `.module.css`, config, i18n, adapter — không chỉ `.tsx`.
3. Plan/doc mâu thuẫn code → mục **CONTRADICTIONS** (§C).
4. Gate cơ học của repo **luôn thắng** khuyến nghị thiết kế từ skill/catalog ngoài (soc-uiux §1).
5. Không viết code, không khai claim, không commit trong phiên audit này.

---

## A. BẢN ĐỒ KIẾN TRÚC (liên quan trực tiếp đến nhất quán giao diện)

| File | Dòng | Trách nhiệm | Ghi chú |
|---|---|---|---|
| `packages/web/src/index.css` | ~900 | Entry CSS toàn cục: `@theme` (Tailwind v4), dark-variant binding, reduced-motion, safe-area, touch-action | `:1-8` import chain; `:19-116` palette; `:812-829` reduced-motion (theo subagent) |
| `packages/web/src/theme/tokens.css` | 82 | Base semantic tokens + light override | `:1-62` `:root`; `:65-82` light. Được gọi là SSOT ở `index.css:5`, `check-light-theme.mjs:45-48` |
| `packages/web/src/theme/light-theme.css` | — | Override theo property cho 230 utility / 638 file | File **sinh bởi** `check-light-theme.mjs --update`, KHÔNG sửa tay (`index.css:3-6`) |
| `packages/web/src/theme/theme.module.css` | 385 | UI kit (btn/card/input/badge/modal/table…) | Chỉ **1** consumer: `WorkstationShell.tsx:3` (subagent) |
| `packages/web/src/components/soc/soc.tokens.css` | 217 | Token SOC + portfolio (`--pf-*`) + light override | `:5-140` `:root` — **khai lại 13 tên dùng chung**; `:143-217` light |
| `packages/web/src/components/soc/soc.components.css` | >2000 | ~395 class SOC (tab, metric, badge, table, radar…) | Import qua `soc.module.css:2-3` (barrel 3 dòng); nhiều `rgba()` cứng |
| `packages/web/src/components/soc/soc.module.css` | 3 | Barrel `@import` | ⚠ Không thêm token/class vào đây (L-F03) |
| `packages/web/src/components/ShellPageTemplate.js` | ~200 | `ShellPageChrome`: hero → eyebrow → titleRow → description → badge → metrics | `:90-152`, `role="region"` + `aria-labelledby` `:102-111`; 40 file adopt |
| `packages/web/src/pages/admin/adminUi.tsx` | 101 | Admin UI kit | `:12-14` **tự loại trừ** SOC glass/tenant-admin; `:48,71` card `bg-white` + `ring-black/5` |
| `packages/web/src/app/routeCatalog.js` | — | 49 route (baseline 2026-10-07), 8 trường schema | Số hiện tại CHƯA đếm lại trong phiên này |
| `packages/web/scripts/check-token-conflict.mjs` | 475 | Gate phát hiện trùng custom property | Pinned 3 file (`:53-57`), baseline-locked (`:23-29`), self-test (`:318-457`) |

**Đếm cơ chế styling** (lệnh của subagent, unique file path, `packages/web/src`, 834 file `*.ts/tsx/js/jsx`):

| Cơ chế | Số file | Lệnh |
|---|---|---|
| CSS module | 92 | `Select-String 'import\s+\w+\s+from\s+["''][^"'']*\.module\.css'` |
| Tailwind-like utility | 101 | `Select-String 'className[=:]\s*["''`][^"''`]*\b(flex|grid|p-\[|text-(xs|sm|slate|amber))'` |
| Plain global `.css` | 23 | `Select-String 'import\s+["''][^"'']*\.css'` |
| Inline `style={{…}}` | 102 | `Select-String 'style=\{\{|style:\s*\{'` |
| `ShellPageChrome` | 40 | `Select-String 'ShellPageChrome'` |

---

## B. LUỒNG ĐÃ TRACE — đổi theme rồi mở 2 trang

```
main.tsx:14  import './index.css'
   └─ index.css:2  @import "./theme/tokens.css"          → :root { --bg-panel: #0f172a }        (theme/tokens.css:1,13)
   └─ index.css:6  @import "./theme/light-theme.css"     → override theo property
   └─ index.css:19 @theme { --color-*, --radius-*, --space-* }

Trang A /dashboard (không import soc.tokens.css)
   → --text-primary = var(--color-text-primary, #f1f5f9)     (theme/tokens.css:2)
   → --bg-panel     = var(--color-bg-panel, #0f172a)          (theme/tokens.css:13)

Trang B /portfolios (PortfoliosPage.tsx:33 import soc.tokens.css)
   → --text-primary = var(--soc-c-f1f5f9)                     (soc.tokens.css:5,81)
   → --bg-panel     = rgba(var(--soc-rgb-081734) / 0.4)       (soc.tokens.css:5,12)

Cùng 1 tên token · cùng 1 theme · 2 giá trị · thứ tự cascade phụ thuộc chunk được load.
```
Đây không phải lỗi suy luận: chính header của gate ghi rõ hệ quả runtime (đã trích ở tóm tắt).

---

## C. CONTRADICTIONS (tài liệu nói gì / code làm gì)

| Plan/doc nói | Thực tế code | Tác động |
|---|---|---|
| "Token mới → `soc.tokens.css`, **KHÔNG tạo file token riêng**" (`soc-uiux/SKILL.md` §1; `soc.tokens.css:33-38`) | `src/theme/tokens.css:1` cũng định nghĩa `:root` chứa `--text-primary`, `--accent-cyan`, `--r-*`, `--sp-*` | 2 nơi cùng nhận vai trò base → 13 conflict |
| "SSOT duy nhất" (`index.css:5`, `check-light-theme.mjs:45-48`) | `soc.tokens.css:5` khai lại 13 tên, có cả light override riêng `:143-217` | Đổi token ở SSOT không lan sang SOC; đổi ở SOC không lan sang shell |
| "Shell cung cấp 1 `<h1>`/route" (`check-heading-contract`, soc-uiux §2) | `adminUi.tsx:24` tự render `<h1>`; `DashboardPage.tsx:113-121` tự `<h1>`; `PortfolioOverviewPage.tsx:116-140` không có `<h1>` | 4 kiểu header; gate chỉ chặn "vi phạm mới", baseline vẫn chứa ngoại lệ |
| "Admin UI kit dùng chung, tránh drift" (`adminUi.tsx:4-14`) | Chính file `:12-14` loại trừ SOC glass / crawl gray / advertising violet / tenant-admin | Kit chỉ phủ 12 trang fleet; phần còn lại 3 hệ khác |
| "Component library SOC đầy đủ" (`soc.components.css` ~395 class) | `theme/theme.module.css:4-385` định nghĩa lại btn/card/input/badge/modal/table/emptyState | 2 bộ component cùng mục đích; 1 bộ chỉ có 1 consumer |
| Audit 2026-10-07 báo "327 → 246, không rule nào tăng" (`UIUX_AUDIT_20261007.md:4,343`) | `check-uiux-budget` hôm nay **FAIL**: baseline 2026-10-09 = 162, hiện tại = 129 (−33) nhưng 2 rule tăng `CSS-2 46→55`, `A11Y-9 5→16` | Tổng giảm nhưng gate vẫn đỏ — đúng hợp đồng "rule nào tăng cũng fail". Cần đối chiếu 2 bộ baseline (162 ngày 09-10 vs 246 ngày 07-10) trước khi báo số tổng |

---

## D. FINDINGS CHI TIẾT

### D1. Nợ SSOT token — **P1** (nguyên nhân gốc)
- **Vị trí**: `theme/tokens.css:1` vs `soc.tokens.css:5`; `@theme` tại `index.css:19`; baseline `check-ui-baseline/check-token-conflict.json`.
- **Bằng chứng**: chạy `node packages/web/scripts/check-token-conflict.mjs` → `13 vi phạm hiện tại | baseline 13`; `--scope root-only` → `11`.
- **Bị trùng**: `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-cyan`, `--bg-panel`, `--bg-panel-soft`, `--border-default`, `--font-sans`, `--fs-xs`, `--fs-sm`, `--fs-md`, `--shadow-sm`, `--shadow-md`.
- **Root cause**: lớp SOC là hệ self-contained được ghép vào app sau khi `theme/` đã thành SSOT; không ai gỡ các tên dùng chung.
- **Tác động**: cùng token → giá trị khác nhau theo route → đúng biểu hiện "thiếu nhất quán giữa các trang". Light theme đặc biệt dễ lệch vì mỗi file có override riêng.
- **Đề xuất**: chọn 1 owner (khuyến nghị `theme/tokens.css`), gỡ 13 tên khỏi `soc.tokens.css` (giữ `--soc-*`, `--pf-*`, `--vnb-*`), hạ baseline về 0, rồi **siết gate từ baseline-locked sang fail-on-any-duplicate**. Cần Owner chốt màu tăng/giảm (`soc.tokens.css:40-53`, L-F08).

### D2. Page chrome phân mảnh — **P1**
- `ShellPageChrome` (`ShellPageTemplate.js:90-152`) — 40 file.
- `AdminPageHeader` (`adminUi.tsx:16-39`) — Tailwind `text-2xl font-bold text-slate-950 dark:text-white` (`:24`), hoặc `rounded-3xl bg-white ring-black/5` (`:48`).
- AI Command Center tự dựng `styles.pageHeader/pageTitle/pageDesc` + Breadcrumb + AiHubNav (`AICommandCenterPage.tsx:210-232`, theo subagent).
- Dashboard tự `<h1 className="core-dashboard-title">` + plain CSS (`DashboardPage.tsx:113-121,331-348`).
- Portfolio Overview **không có header/h1** (`PortfolioOverviewPage.tsx:116-140`).
- **Tác động**: tiêu đề, khoảng cách, breadcrumb, màu chữ khác nhau giữa route; người dùng không nhận ra cùng một sản phẩm. Ảnh hưởng cả a11y (điểm neo đầu trang).

### D3. Chiến lược nền tảng (card/metric/radius) — **P2**
- Shell glass: hero 28px / panel 24px / metric 20px / button 14px (`ShellPageTemplate.module.css:63,198,133,232` theo subagent).
- Portfolio: `pf-metric-card`, 8–12px (`PortfolioWorkspace.css:39,80`).
- AI: `styles.metricCard` riêng, 8–12px (`aiSettings.module.css:142,205`).
- Admin: `rounded-2xl`/`rounded-3xl` + `bg-white` (`adminUi.tsx:48,71`).
- **Tác động**: glassmorphism lẫn card trắng đặc trong cùng app.

### D4. Loading / empty state có 5 biến thể — **P2**
- `<p role="status">Đang tải…</p>` / `<p role="alert">` (`PortfolioOverviewPage.tsx:77-87`)
- `ShellSkeleton variant="card"` (`ShellOperationsCenterPage.tsx:108`)
- `LoadingSkeleton` tự định nghĩa (`DashboardPage.tsx:93-100`)
- `styles.loading` / `styles.empty` (`AICommandCenterPage.tsx:418,432,470`)
- `AdminEmptyState` = 1 thẻ `<p>` (`adminUi.tsx:97-101`); Dashboard `<p className="core-dashboard-empty-hint">` (`:333`)
- **Trùng tên**: `ShellEmptyState` nội bộ (`ShellPageTemplate.js:167-195`) **và** `components/ShellEmptyState.js` (19 file import theo subagent).
- **Tác động**: cùng trạng thái "không có dữ liệu" hiển thị 5 cách; có nơi thiếu CTA/icon; khó chuẩn hoá test.

### D5. Màu/kích thước cứng thay vì token — **P2**
- `TenantAdminBillingPage.tsx:51` `style={{ fontSize:"11px", color:"#94a3b8" }}`; `:92-98` `fill:"#94a3b8"`, `background:"#1e293b"`, `border:"#334155"`, `borderRadius:"8px"`, `fill="#3b82f6"`.
- `TenantAdminHomePage.tsx:63` `#10b981/#f59e0b/#ef4444`; `:519` `rgba(...)/#22c55e/#64748b`.
- `soc.components.css:273-293` `rgba(239,68,68,.08)`, `rgba(0,180,216,.08)` — không đi qua token → **không đổi theo light theme**.
- Gate `check:tokens` vẫn PASS (79 hex allowlisted) ⇒ gate chỉ chặn hex, **không chặn rgba cứng nằm trong allowlist màu**.
- **Tác động**: mismatch dark/light cục bộ; sửa SSOT không lan tới đây.

### D6. 4 cơ chế styling — **P3**
- Số liệu §A. `theme.module.css` chỉ 1 consumer; `soc.components.css` chỉ qua barrel; `soc.tokens.css` import trực tiếp 2 page.
- **Tác động**: chi phí onboarding agent mới + bảo trì; "template dùng chung" là khái niệm, không phải artifact duy nhất.

### D7. A11y — nợ có trọng tâm — **P1/P2**
- Static tốt: `check:contrast` PASS; `check-portfolio-contrast` PASS 12 cặp × 2 theme; landmark PASS; skip link & reduced-motion có (`index.css:812-829`).
- Còn: ~45 control thiếu accessible name (tập trung `features/advertising/components` 15, `components/ui` 5, admin 10, tenant-admin 8 — theo `UIUX_AUDIT_20261007.md:456-474`); ~24 trang thiếu `<h1>` thật (`:476-495`); 5 modal thiếu focus trap/Escape (`:227-229`); ~29 điểm filter/pagination không deep-link (`:409-435`).
- **Cảnh báo số liệu**: `check-uiux-budget` đo `A11Y-9 = 16` (baseline 5) và `CSS-2 = 55` (baseline 46) — **khác định nghĩa/phạm vi** với con số tường thuật ~45 control thiếu label của audit 07-10. Không trộn 2 bộ số; cần chạy lại `scan-ui-guidelines` với timeout lớn hơn để đối chiếu (đang `CHƯA CHẠY xong`).
- **CHƯA XÁC MINH**: `check-a11y-runtime` (cần Chromium) chưa chạy; chưa có synthesized touch/device test.

### D8. Detector `impeccable` — **P2**
- Lệnh: `impeccable detect --json packages/web/src/pages/{portfolio,admin,tenant-admin}` → exit 1, **3 warnings** `side-tab` (`PortfolioWorkspace.css:683,687,691`: `border-left: 3px solid var(--pf-gain|loss|flat …)`).
- Đây là tín hiệu "AI-generated UI tell"; không phải lỗi chức năng. Cân nhắc thay bằng chip nền soft (`--pf-positive-soft`/`--pf-negative-soft` đã có ở `soc.tokens.css:55-58`).

### D9. Fintech-specific disclosure — **P2**
- Không tìm thấy chuẩn hiển thị stale/delayed data thống nhất trong các file đã đọc. Baseline audit có ghi nhận 4 thẻ portfolio hiện `—` + "BE chưa cung cấp" (`UIUX_AUDIT_20261007.md:220-224`).
- Theo thực tiễn tài chính (§F): stale price phải khác empty state; delayed data phải ghi rõ cạnh giá; reconciliation phải hiện 2 giá trị + hiệu số.
- **CHƯA XÁC MINH**: chưa quét toàn app cho "Cập nhật lúc"/"dữ liệu trễ" — cần grep riêng trước khi kết luận đây là gap.

---

## E. QUALITY GATES — chạy thật hôm nay

| Gate | Lệnh | Kết quả |
|---|---|---|
| Token hex | `npm run check:tokens` (cwd `packages/web`) | ✅ PASS — 79 allowlisted hex, 0 violation ngoài allowlist |
| Token conflict | `node packages/web/scripts/check-token-conflict.mjs` | ⚠ exit 0 nhưng **13/13 baselined**; root-only `11` |
| Contrast tone | `node packages/web/scripts/check-contrast.mjs` | ✅ PASS — 7 cặp × 2 mode ≥ 4.5:1 |
| Contrast portfolio | `node scripts/check-portfolio-contrast.mjs` (cwd `packages/web`) | ✅ PASS — 12 cặp × 2 theme ≥ 4.5:1 |
| Contrast theme | `node packages/web/scripts/check-theme-contrast.mjs` | ⚠ exit 0 baseline; baseline còn 1 mục `--pf-negative-text` bị giới hạn parser (`không đọc được giá trị`) — cần review |
| Light theme | `node packages/web/scripts/check-light-theme.mjs` | ✅ PASS — 230 utility / 638 file được phủ theo property |
| Focus ring | `node packages/web/scripts/check-focus-ring.mjs` | ⚠ exit 0 baseline (có hàm hạ baseline) |
| Heading contract | `node packages/web/scripts/check-heading-contract.mjs` | ⚠ exit 0 baseline (vd `WatchlistMainWorkspace.tsx#0`) |
| Landmarks | `node scripts/check-dom-landmarks.mjs` (cwd `packages/web`) | ✅ PASS — 1 `<main>`, region + aria-labelledby |
| UI/UX budget | `node packages/web/scripts/check-uiux-budget.mjs` | ❌ **FAIL** — baseline 2026-10-09 = 162, hiện tại 129 (−33) nhưng `CSS-2 46→55 (+9)`, `A11Y-9 5→16 (+11)` |
| Scanner gốc | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | ⚠ timeout 300s — **CHƯA CHẠY xong** |
| A11y runtime | `node packages/web/scripts/check-a11y-runtime.mjs` | **CHƯA CHẠY** (cần Chromium) |
| Visual regression | `npm run test:visual` | **CHƯA CHẠY** (không chụp ảnh staging trong phiên này) |
| Detector thiết kế | `impeccable detect --json …` | exit 1 — 3 warning `side-tab` (D8) |

> **Bài học gate**: 4 gate baseline-locked (token-conflict, focus-ring, heading-contract, theme-contrast) xanh không có nghĩa hết nợ — exit 0 chỉ là "không có vi phạm **mới**" (`check-token-conflict.mjs:23-29`). Riêng `check-uiux-budget` có hợp đồng khác: so số rule với baseline, **tổng giảm nhưng vẫn FAIL nếu có rule tăng** — đây là tín hiệu hồi quy thật cần xử lý ở Wave 1.

---

## E2. ĐIỂM SỨC KHOẺ (impeccable)

### Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Static gates mạnh (contrast/landmark/skip/reduced-motion); vẫn ~45 control thiếu label, ~24 trang thiếu h1, 5 modal thiếu focus trap, chưa probe runtime |
| 2 | Performance | 2 | Widget lazy-load + echarts đã ra khỏi tải đầu (ghi nhận lịch sử); không đo Lighthouse/bundle trong phiên này → điểm bảo thủ |
| 3 | Theming | 1 | 13 conflict token trên 3 base block; rgba cứng không theo theme; light override nhân bản |
| 4 | Responsive Design | 2 | Breakpoints + mobile sidebar + safe-area/touch-action/overscroll có; chưa test thiết bị/gesture thật |
| 5 | Implementation Integrity | 2 | 4 cơ chế styling, 5 empty-state, 4 header, 3 warning detector — nhiều vấn đề đã verify |
| | **Total** | **10/20** | **Acceptable — significant work needed** |

### Nielsen heuristics (critique, chế độ Operate)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Có loading/empty/error nhưng 5 biến thể; stale-data disclosure chưa chuẩn hoá |
| 2 | Match system / real world | 3 | Tiếng Việt đủ dấu; xanh tăng/đỏ giảm đúng VN (L-F08); domain term phù hợp |
| 3 | User control and freedom | 2 | ~29 điểm filter/page không deep-link; modal thiếu Escape/focus trap |
| 4 | Consistency and standards | **1** | Finding D1–D4 — đây là điểm yếu định đoạt |
| 5 | Error prevention | 2 | Guard/csrf/validation ở BE tốt; guard trên UI chưa đồng nhất |
| 6 | Recognition rather than recall | 2 | Icon-only ở vài nơi; link không giữ state |
| 7 | Flexibility and efficiency | 2 | Có Cmd+K ở tenant-admin; chưa density toggle; shortcut rời rạc |
| 8 | Aesthetic and minimalist | 2 | Glass + white-card lẫn; side-tab warnings; dense nhưng chưa luôn có chủ đích |
| 9 | Error recovery | 2 | Error message đa dạng chất lượng; role=alert có ở shell |
| 10 | Help and documentation | 2 | Docs repo đầy nhưng hỗ trợ contextual trong app mỏng |
| | **Total** | **21/40** | **Acceptable (20–27)** |

### Design specificity verdict
**Có bản sắc SOC rõ** (glass, cyan, radar, tabular-nums, mono ticker ở vài nơi) — không phải category-interchangeable. Nhưng bản sắc đó **chỉ phủ nhóm SOC/admin**, trong khi portfolio/AI/dashboard tạo ra ngôn ngữ riêng. Kết luận: *authored for this product, nhưng chưa authored across the whole product*.

### Positive findings
1. Reduced-motion toàn cục đúng kiểu — `index.css:812-821` khoá ở global thay vì sửa 57 file.
2. SSOT có tài liệu + script sinh — `index.css:3-7`, `check-light-theme.mjs:45-48`.
3. `ShellPageChrome` adopt 40 file với a11y tích hợp (`ShellPageTemplate.js:102-111,129-149`).
4. Layout shell có skip-link/focus management (`FullLayout.tsx:103-114`).
5. Kỷ luật barrel SOC + admin UI kit chủ động loại trừ subsystem khác (`soc.module.css:1-3`, `adminUi.tsx:4-14`).

---

## F. SO SÁNH VỚI GIẢI PHÁP THƯƠNG MẠI

Nguồn tham khảo (đọc trong phiên này): Bloomberg UX story ([link](https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity)), industry patterns ([financial-ui-patterns](https://raw.githubusercontent.com/rgourley/financial-ui-suite/main/skills/financial-ui-patterns/references/industry-patterns.md)), Bloomberg vs TradingView 2026 ([Pineify](https://pineify.app/resources/blog/bloomberg-terminal-vs-tradingview-2025-comparison-for-traders-analysts-and-teams)), fintech dashboard patterns 2026 ([Pavle Lucic](https://pavle-design.com/blog/fintech-dashboard-design-patterns)), data-dense dashboard lessons 2026 ([Pixel Show](https://pixel-show.com/blog/designing-data-dense-dashboards)), financial dashboard trust ([Lazarev](https://www.lazarev.agency/articles/financial-dashboard-design)).

| Tiêu chí | Bloomberg Terminal | TradingView | Datadog / Grafana | Linear / Vercel (dark SaaS) | Stripe / Mercury (fintech) | **vninvest hiện tại** |
|---|---|---|---|---|---|---|
| Mật độ thông tin | Rất cao (20+ điểm/screen), bảng 40+ dòng | Cao, có toggle Comfortable/Normal/Compact | Cao, panel lặp đều | Trung bình, tĩnh lặng | Trung bình, "visual calm" | Cao ở SOC/dashboard; **không có density toggle** |
| Dark mặc định | Có (amber CRT lịch sử) | Có | Có | Có, light là toggle | Thường light | ✅ Dark mặc định chủ đích (`index.css:10-17`) |
| Typography số | Mono ticker + tabular-nums | Mono ticker, sans + tabular giá | Mono log/metric | Sans nhất quán | Tabular figures, precision nhất quán | tabular-nums có ở SOC; **font-sans conflict** (`theme/tokens.css:19` vs `soc.tokens.css:72`) |
| Token SSOT | Hệ thống nội bộ duy nhất, thay đổi increments | Design system nội bộ | Design token tập trung | Token tập trung | Token tập trung | ⚠ 1 SSOT trên giấy / 3 nơi khai báo / 13 conflict |
| Component library | Keyboard(function key)+component thống nhất | Toolbar/chart component thống nhất | Panel component thống nhất | Component thống nhất | Component thống nhất | ⚠ 2 bộ btn/card/input + 4 cơ chế styling |
| Điều hướng | Function key, huấn luyện 1000h | Cmd+K symbol search | Command palette | Cmd+K | – | ⚠ Cmd+K mới ở tenant-admin; chưa universal |
| Biến động dữ liệu | Status dim label, realtime | Replay/backtest mode | Health/status rõ | – | Pending/in-flight state hiện rõ | ⚠ Stale/delay disclosure chưa chuẩn hoá (D9, CHƯA XÁC MINH) |
| Màu tài chính | Amber/orange+green; **grep sát thực tế** | Green up / red down (US) | Status tone | Trung tính | Màu chỉ dành cho state | ✅ Xanh tăng/đỏ giảm đúng VN, Owner chốt (L-F08) |
| Chiến lược thay đổi | "Hiding complexity", incremental, không làm users bất ngờ | Release chu kỳ | – | – | – | Có gate chặn hồi quy, nhưng nợ baseline được giữ nguyên |

**Kết luận so sánh**: vninvest **đạt parity về ý định và một phần thực thi** (dark-default, density, token, chart boundary, màu VN). Khoảng cách nằm ở **(1) SSOT cơ học**, **(2) adoption 100% component library**, **(3) disclosure dữ liệu tài chính**, **(4) density toggle + universal command palette**. Đây là các vấn đề *hệ thống*, không phải thiếu widget hay thiếu màu — nên không nên giải bằng cách thêm catalog thiết kế mới (đánh giá `ui-ux-pro-max` tại `AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md:93-99` cũng kết luận vậy).

---

## G. PERSONA RED FLAGS

Chọn theo loại giao diện **Dashboard / admin + data-heavy** (critique §personas): **Alex** (power user), **Sam** (a11y), **Casey** (mobile), **Jordan** (first-timer).

- **Alex (power user)**: 29 điểm lọc/phân trang không có URL state → gửi link cho đồng nghiệp họ thấy dữ liệu không lọc. Cmd+K chỉ có ở tenant-admin, không phải universal. Không có density toggle dù làm việc với bảng 40+ dòng.
- **Sam (a11y)**: ~45 control thiếu accessible name; ~24 trang thiếu h1 thật; 5 modal không Escape/focus trap; token `--text-primary` khác giá trị giữa 2 route → có nơi tương phản ngoài dự kiến dù gate tĩnh PASS.
- **Casey (mobile)**: đã có safe-area/touch-action/overscroll (`index.css:823-829` theo subagent) nhưng **chưa test gesture thật**; 5 kiểu empty state → khi mất kết nối, mỗi trang báo một kiểu, dễ hiểu nhầm là "hết dữ liệu".
- **Jordan (first-timer)**: 4 kiểu page header + glass lẫn white-card → không nhận ra cùng hệ thống; `PortfolioOverviewPage` không có tiêu đề để định hướng (`:116-140`).

---

## H. HƯỚNG NÂNG CẤP (phases có AC, owner, gate)

### Wave 0 — Hội tụ SSOT (1–2 sprint) · **P1 · chặn mọi wave sau**
1. Owner chốt **1 token owner** (khuyến nghị `theme/tokens.css` — đã được `index.css:5` + `check-light-theme.mjs:45-48` gọi là SSOT).
2. Gỡ 13 tên trùng khỏi `soc.tokens.css:5` (chừa `--soc-*`, `--pf-*`, `--vnb-*`); giữ nguyên giá trị dark/light đã tinh chỉnh.
3. Hạ baseline `check-ui-baseline/check-token-conflict.json` về 0 **sau khi** sửa thật (không dùng `--update-baseline` để "xanh giả" — `check-token-conflict.mjs:263-269`).
4. Nâng gate: fail trên **bất kỳ** khai báo trùng base block (không chỉ cái mới) + thêm rule chặn `rgba(...)` cứng trong component CSS (D5).
- **AC**: `check-token-conflict` = 0 conflict; `check:tokens`, `check:contrast`, `check-portfolio-contrast`, `check-theme-contrast`, `check-light-theme` đều xanh không baseline; chụp ảnh 4 route (dashboard, admin, portfolio, AI) ở dark+light không có token lệch.
- **Owner**: Owner + 1 FE agent (claim riêng). **Không đụng** màu tăng/giảm (L-F08).

### Wave 1 — Một template cho mọi route (2–3 sprint) · **P1** · Owner chốt: **tất cả 4 nhóm**
1. `ShellPageChrome` thành chrome duy nhất; `AdminPageHeader`/AI header/Dashboard header compose vào shell. **Owner chốt 2026-11-19**: convert card admin trắng (`adminUi.tsx:48,71`) sang glass shell, **không** giữ ngoại lệ.
2. Gộp empty/loading/error thành 1 bộ `components/feedback/*`; xoá `ShellEmptyState` trùng (`ShellPageTemplate.js:167-195` vs `components/ShellEmptyState.js`).
3. Sửa ~24 trang thiếu h1 qua shell (không thêm h1 vào 33 trang đã có — bài học `UIUX_AUDIT_20261007.md:476-495`).
4. Focus trap + Escape cho 5 modal; accessible name cho 45 control theo nhóm (`components/ui` → `advertising` → admin → tenant-admin).
5. Hook URL state dùng chung cho ~29 điểm deep-link thật (đã có `useUrlState` — tái dùng, đừng cài `nuqs` khi chưa chốt: `UIUX_AUDIT_20261007.md:432-435`).
- **AC**: `check-heading-contract` + `check-focus-ring` baseline → 0; `check-uiux-budget` **trở lại xanh** (`CSS-2` ≤ 46, `A11Y-9` ≤ 5); `check-a11y-runtime` chạy thật (Chromium); 5/5 modal test Escape/focus; visual snapshot mới có chủ đích (đặc biệt admin glass dark/light).

### Wave 2 — Trải nghiệm fintech chuyên sâu (2–3 sprint) · **P2**
1. **Density toggle** (Comfortable/Compact) lưu vào `UserSettingsPage` — theo TradingView/pipelines dữ liệu.
2. **Cmd+K universal** mở rộng từ tenant-admin sang toàn app.
3. **Data freshness chuẩn**: stale price ≠ empty state; delay label cạnh giá; reconciliation hiện 2 giá trị + hiệu số (theo `pavle-design.com`).
4. Tabular figures + mono ticker thống nhất; thay 3 `border-left:3px` bằng soft chip (D8).
5. Light-theme QA bằng ảnh thật trên staging (`14.225.255.47` / `docker.edusuccess.vn` theo AGENTS.md), không chỉ gate tĩnh.
- **AC**: `test:visual` baseline mới cho 6 route × 2 theme; `check-a11y-runtime` PASS; có evidence ảnh trong `docs/evidence/`.

### Wave 3 — Đo & duy trì · **P3**
- Chạy `/impeccable document` để sinh `DESIGN.md` từ code đã hội tụ (SSOT thứ hai bị cấm — chỉ sinh sau Wave 0).
- Đưa `impeccable detect` + `check-token-conflict` vào `check:shell`; định kỳ chạy lại audit này quarterly.
- Chỉ số giữ lại: số route dùng `ShellPageChrome` (mục tiêu 100%), số conflict token (0), số baseline gate còn nợ (0), số finding scanner (≤ baseline 246).

---

## I. CÂU HỎI CẦN OWNER CHỐT (chặn trước Wave 0/1)

1. **Token owner là ai?** `theme/tokens.css` (đề xuất) hay `soc.tokens.css`? Quyết định này định hướng toàn bộ Wave 0.
2. **Có cho phép gỡ 13 tên dùng chung khỏi `soc.tokens.css` không?** Ảnh hưởng màu SOC đang dùng; cần chốt không đổi giá trị dark/light.
3. **Admin card trắng (`adminUi.tsx:48,71`) có được giữ làm ngoại lệ, hay phải convert sang glass shell?** Đây là lựa chọn giữa "tôn trọng subsystem" và "một sản phẩm một ngôn ngữ".
4. **Scope Wave 1**: làm toàn bộ (header + empty state + a11y + URL state) hay chỉ top 3? Theo `ponytail`, ưu tiên cái sửa 1 chỗ ra nhiều màn hình (`components/ui`, `advertising`, `PaginationBar`) trước.
5. **Có chạy `/impeccable init` để có PRODUCT.md/DESIGN.md không?** `impeccable context` báo thiếu; không bắt buộc cho audit nhưng cần cho greenfield sau này.

### I.1 — Owner ĐÃ CHỐT 2026-11-19 (cập nhật sau khi trình báo cáo)

| Câu hỏi | Quyết định | Hệ quả cho kế hoạch |
|---|---|---|
| Token owner | **`theme/tokens.css`** | Wave 0 gỡ 13 tên khỏi `soc.tokens.css:5`; giữ giá trị dark/light hiện tại; hạ baseline về 0 sau khi sửa thật |
| Admin card trắng (`adminUi.tsx:48,71`) | **Convert sang glass shell** — không giữ ngoại lệ | Wave 1 mở rộng: sửa `AdminPanel`/`AdminMetricCard` (và 12 trang fleet) sang token glass; rủi ro cao hơn phương án giữ ngoại lệ → cần ảnh QA dark/light trước khi nhân rộng |
| Scope Wave 1 | **Tất cả 4 nhóm** (header + empty state + a11y + URL state) | Bỏ phương án dời URL state sang Wave 2; tái dùng `useUrlState` có sẵn cho 29 điểm; AC phải đưa `check-uiux-budget` về xanh |
| DESIGN.md | **Có, sau Wave 0** | Không sinh DESIGN.md lúc token còn lộn (tránh SSOT thiết kế thứ hai) — giữ nguyên Wave 3 |

> **Ponytail risk callout**: hai lựa chọn "convert glass" + "all 4 groups" tăng đáng kể bề mặt thay đổi so với khuyến nghị tối thiểu. Điều khoản giữ nguyên: không đụng màu tăng/giảm (L-F08), không cài dependency mới (`nuqs`…), không thêm token/class vào `soc.module.css` (L-F03), và mọi sửa CSS phải đọc **CSS đã build** trước khi kết luận (L-F11).

---

## J. ĐÁNH GIÁ TỔNG THỂ + NEXT STEPS

- **Implementable?** Có — không blocker kỹ thuật và Owner **đã chốt xong 4 quyết định** (§I.1). Còn lại 2 điều kiện: **kỷ luật hạ baseline** (không xanh giả) và **đưa `check-uiux-budget` về xanh** (2 rule tăng).
- **Ưu tiên sửa**: D1 (SSOT) → D2 (chrome) → D7 (a11y) → D4/D5 → D8/D9. Đây là thứ tự giảm "cảm giác không đồng bộ" nhanh nhất với chi phí thấp nhất.
- **Không nên làm**: thêm catalog thiết kế ngoài, sinh palette mới, hay redesign toàn bộ — repo đã có tài sản và gate đủ; vấn đề là adoption + SSOT (xem `AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md:93-99`).
- **Tests/validation đã chạy**: xem §E (13 gate + detector); `check-uiux-budget` **FAIL 2 rule** — phải đưa về xanh ở Wave 1. **Chưa chạy**: `test:visual`, `check-a11y-runtime` (cần Chromium), `scan-ui-guidelines` (timeout 300s), BE test, E2E, ảnh staging. Không suy ra kết quả cho các hạng mục này.
- **Next steps / Owner**: Owner **đã chốt §I.1 ngày 2026-11-19** → mở claim riêng cho Wave 0 theo `workflow-dev-loop` (nạp `project-lessons` trước, không commit thẳng `dev`) → thực hiện AC Wave 0 → chạy lại toàn bộ §E → mới mở Wave 1 (đã mở rộng theo quyết định).
- **Hạn chế trung thực**: báo cáo này dựa trên **mã nguồn + gate tĩnh + 1 subagent đọc code**; **không có ảnh chụp staging, không có browser runtime, không có device test** trong phiên này. Mức độ lệch thị giác thực tế **CHƯA định lượng được**.

---

*File này là evidence cho phát hiện audit ngày 2026-11-19. Không thay đổi source code; mọi con số có lệnh tái lập ở §A/§E/§D1.*
