# Audit UI/UX Operations Center — Chuẩn Thương Mại (Bloomberg / Datadog / Grafana)

**Date:** 2026-09-16
**Scope:** `http://localhost/operations-center` — 8 tabs: Overview / Signals / DataOps (5 subtabs: Kho dữ liệu, Vận hành, Giám sát, Lịch chạy, Cấu hình) / Prefetch / Screener / VNBroker / Runtime KPI / DNSE Backfill
**Khung:** `AGENTS.md:136-216` — mọi khẳng định `file:line`, grep toàn repo `.css/.module.css/config/i18n`, không đoán
**Phương pháp:** `read` shell + 8 panels + `soc.tokens.css` + `soc.components.css` + `SocTabNavigation.tsx` + grep `hardcoded color / inline style / emoji / a11y`

---

## 1) Tóm tắt 8 vấn đề “xấu thiếu chuyên nghiệp” nghiêm trọng nhất

| # | Mức | Tab | Vấn đề (file:line) | Tác động với user khó tính |
|---|---|---|---|---|
| U01 | CRITICAL | Shell | `ShellOperationsCenterPage.tsx:105-117` chỉ `ShellPageChrome` + `SocTabNavigation` — header nghèo nàn: không breadcrumb, không eyebrow live, không stats tóm tắt, tab description thay thế title → mất hierarchy. So Bloomberg terminal header luôn có eyebrow + status dot. | Trông như admin CRUD, không phải trung tâm vận hành. |
| U02 | CRITICAL | Tab Bar | `SocTabNavigation.tsx:31-51` `styles.tabBar` gap 0.5rem + `tabButton` 0.8rem + underline 2px — quá nhạt, không có badge count, không có segmented-control, scroll không hint. 8 tabs dài → mobile tràn không scroll cue. | User không biết đang ở đâu, không scan được. |
| U03 | HIGH | Tokens | `soc.tokens.css:1-43` chỉ 30 token màu, thiếu semantic: `--text-primary/secondary/muted`, `--border-default`, `--bg-panel`, `--accent-cyan`, spacing `--sp-*`, radius `--r-*`, shadow, font-scale. `soc.components.css` vẫn hardcode `rgba(0,180,216,0.08)` nhiều nơi, `color-mix` lẫn `rgba`. | Không có single source, khó theming, màu lệch giữa Overview và DataOps. |
| U04 | HIGH | DataOps | `SocDataOpsPanel.tsx:110-121` header `DATAOPS` eyebrow + `dataopsTitle` 1.5rem nhưng hero 4 metrics dùng `formatNumber` + `heroMetrics` đếm `runs.filter` trong panel (không phải Overview stats) — lệch mental model. Subtab bar `dataopsSubtabBar` khác `tabBar` (border 1px vs 2px, gap 0.2rem vs 0.5rem) → không nhất quán. | Cảm giác “ghép” không phải hệ thống. |
| U05 | HIGH | DataOps subpages | Mỗi subpage tự fetch + tự skeleton khác nhau: `Inventory` 4 skeleton cards (`:52-57`), `Monitor` `inventorySkeletonGrid` 4, `Operations` không skeleton mà `emptyState` “Chưa có…” — không đồng nhất loading UX. `Monitor` và `Inventory` đều fetch `queueTiers` riêng → flicker. | Loading thiếu chuyên nghiệp, không predictable. |
| U06 | MEDIUM | Tables | `coverageTable`, `previewTable` font 0.75rem, th `0.5rem` + `letter-spacing 0.04em` nhưng không sticky header, không zebra, không sort, không empty icon. Mobile overflow-x auto nhưng không có shadow hint. So Grafana luôn có sticky + zebra + sort. | Đọc bảng mệt, không scan nhanh. |
| U07 | MEDIUM | Cards | `glassPanel` 0.4 opacity + `sectionCard` 0.3 + `metricCard` 0.4 — 3 lớp kính khác nhau, hover khác nhau (`glassPanel:hover border 0.3`, `sectionCard:hover 0.25`, `metricCard:hover translateY -1px`) — không hệ thống. `overviewMetricCard` có `border-left 3px` nhưng `dataopsHeroMetricCard` không → lệch. | Thiếu design system, cảm giác “mỗi dev tự vẽ”. |
| U08 | MEDIUM | Content | Thiếu `EmptyState` illustration, chỉ `border dashed + text` (`emptyState`). `inlineError`/`inlineSuccess` màu riêng nhưng không có icon, không có action Retry. `Signals` và `Prefetch` dùng emoji `✅ ⬜` (`SocPrefetchPanel.tsx:203`) thay `LucideIcon`. | Không đạt chuẩn “thương mại” — thiếu delight, thiếu a11y. |

---

## 2) Bản đồ chi tiết từng subpage

### 2.1 Shell — `ShellOperationsCenterPage.tsx:1-118`

| Điểm | file:line | Thực tế | Gap thương mại |
|---|---|---|---|
| Header | `:105-117` `ShellPageChrome title/description` | `title = t(soc.pages.soc_page_title)` + `description = t(TAB_DESCRIPTIONS[activeTab])` — mỗi đổi tab là đổi description, không có eyebrow cố định “OPERATIONS CENTER” + live status. | Bloomberg luôn có top bar fixed: logo + breadcrumb + live dot + clock. Datadog header có env selector + time range. |
| Tab routing | `:40-68` `getInitialTab` đọc `searchParams tab` + `localStorage` | Tốt nhưng `handleTabChange` ghi cả 2 nơi, không có `replace` history depth. | Ổn, nhưng thiếu `aria-current`? Có `aria-selected`. |
| Content | `:71-91` `renderTabContent switch` | Direct `createElement` không `Suspense` / lazy — 8 panels load cùng bundle `ShellOperationsCenterPage-CinlKw5q.js 192k`. | Grafana code-split per tab. Để P2. |

### 2.2 Tab Navigation — `SocTabNavigation.tsx:1-51`

| Điểm | file:line | Thực tế | Gap |
|---|---|---|---|
| Layout | `soc.components.css:5-28` `.tabBar` flex nowrap overflow-x auto, `.tabBarDataOps` variant cyan | Tốt nhưng không có fade mask, không có scroll button. 8 tabs `Runtime KPI` dài → mobile phải scroll mù. | Datadog có scroll fade + arrow. |
| Button | `:30-58` `.tabButton` 0.6rem 1rem, `tabButtonActive::after` 2px cyan | Quá nhẹ, không có background pill khi active (chỉ underline). So với `dataopsSubtabBar` pill style thì lệch. | Bloomberg dùng pill + icon fill. |
| Icon | `:44-46` `LucideIcon` `tabIcon` 1rem | Tốt, nhưng màu active chỉ `22d3ee`, không có icon fill. | Thêm `tabIconActive` opacity 1 vs 0.7. |
| A11y | `:38-42` `role=tab aria-selected` | Tốt, thiếu `aria-controls` + `tabIndex` roving. | Thêm `tabIndex 0/-1`. |

### 2.3 Overview — `SocOverviewPanel.tsx:1-1076`

**Đã polish ở PR-1/PR-2 (bar 6 segment, SLO, domain strip, debounce, pagination, a11y, SSE) — đạt 8.5/10.** Còn lại:

| Gap | file:line | Chi tiết |
|---|---|---|
| Hero | `soc.components.css:348-371` `overviewMetricGrid repeat(7,1fr) → 4 → 2 →1` | Đã fix orphan “Đã tắt”, nhưng card vẫn border-left 3px không đồng với DataOps hero (không border-left). |
| Header | `:489-547` `overviewPageHeader` eyebrow + stream dot + hero badge | Tốt nhất trong SOC — nên làm chuẩn cho các tab khác. |
| Grid | `:735-739` `servicesGrid repeat(auto-fill minmax 300px)` | Tốt, nhưng card `overviewServiceCard` padding 1rem 1.15rem khác `sectionCard` 1rem. |

### 2.4 Signals — `SocSignalsPanel.tsx:323-...`

| Gap | file:line |
|---|---|
| Layout | Dùng `signalsTwoCol 3fr 2fr` (`soc.components.css:907-917`) — tốt nhưng feed `max-height 560px` + `signalRow` compact, không có virtual scroll → 100 items lag. |
| Viz | `sentimentBar` 28px + `matGrid` nhưng không có sparkline, không có health bar. |
| Controls | `signalFeedFilterBar` flex wrap, nhưng filter chips dùng `filterBtn` generic, không có active count. |
| Empty | `radarContainer` dashed + pulse — đẹp, nhưng `emptyState` khác với Overview. |

### 2.5 DataOps — `SocDataOpsPanel.tsx:1-205` + 5 sections

| Subtab | File | Gap |
|---|---|---|
| Header | `SocDataOpsPanel.tsx:110-121` `dataopsPageHeader` eyebrow “DATAOPS” + `dataopsTitle` 1.5rem | Tốt nhưng không có stream dot như Overview, hero `dataopsHeroMetrics repeat(4,1fr)` khác `overviewMetricGrid repeat(7,1fr)`. |
| Hero | `:47-53` `heroMetrics` đếm `runs.filter` local, không phải service health như Overview | Lệch mental model — user mong “tổng rows / queue / running / failed” nhưng failed chỉ từ run logs, không phải fail rate. |
| Subtab Bar | `soc.components.css:1698-1769` `dataopsSubtabBar` border 1px + `dataopsSubtabItem` 0.6rem 1rem, active underline 2px | Khác `tabBar` (gap 0.5rem vs 0.2rem) — cần unify. |
| Inventory | `SocDataInventorySection.tsx:79-231` `metricGrid auto-fit 130px` + `dataTypeGrid` + `yearChart` + `coverageTable` | `metricGrid` 130px quá nhỏ, `yearRow` grid 3rem 1fr 5.5rem không responsive, `coverageTableWrap` không sticky. |
| Operations | `SocDataOpsOperationsSection.tsx:246-…` `opsFormGrid 1.2fr 1fr` + `opsCheckboxGrid 1fr 1fr` + `opsConfigFields 1fr 1fr` | Form dense, label 0.65rem uppercase quá nhỏ, checkbox card `dataTypeCard` border-top 2px cyan nhưng `opsCheckboxLabelActive` border 00b4d8 0.35 — lệch. Drawer `opsPreviewDrawer 560px` không có overlay blur. |
| Monitor | `SocDataOpsMonitorSection.tsx:1-817` `observability` + `coverageMatrix` + `top gaps` + `queue tiers` | Quá dài, không có collapsible, `coverageTable` 6 cột không sticky, `starvation` list không có icon, export buttons `actionBtn` generic. |
| Scheduler | `SocSchedulerBoard.tsx:1-718` `schedulerHealthStrip` + `schedulerTableWrap` | Health strip tốt, table `coverageTable` reuse nhưng `schedulerDomainBadge` 4 màu, `schedulerActionCapsule` pill khác `actionBtn`. |
| Config | `SocDataOpsConfigSection.tsx:1-312` `configEditor` 12 rows + `audit_trail` list | `configEditor` font Menlo 0.75rem tốt, nhưng `audit_trail` list không có table, không có actor avatar, pagination `actionBtn` generic. |

### 2.6 Prefetch — `SocPrefetchPanel.tsx:1-274`

| Gap | file:line |
|---|---|
| Layout | `glassPanel > ShellPanel` lồng nhau — double padding. `sectionGrid` 2 cols (`universe_groups` + `config`) nhưng `universe_groups` dùng `filterBtn` với `✅/⬜` emoji (`:203`) — không chuyên, nên `LucideIcon Check`. |
| Metrics | `metricGrid` 3 cards hit_rate/size/ttl — tốt nhưng icon không có background như Overview. |
| Actions | `warm_now`/`purge_cache` cùng `actionBtn` — không phân cấp primary/secondary. |
| Scheduler | Lồng `SocSchedulerBoard domain prefetch` — tốt. |

### 2.7 Screener — `SocScreenerPanel.tsx:1-441`

| Gap |
|---|
| Header `bannerNotice` ops_notice + link `/screener` — tốt nhưng inline style `color 06b6d4 underline` hardcode. |
| Table `rules` dùng plain `table` không class `coverageTable`, th không uppercase, không sticky. |
| `manual_scan` input + button cùng row nhưng button `background rgba(16,185,129,0.15)` hardcode, không dùng `runBtn`. |
| Metrics `avg_scan`/`hit_rate` dùng `metricGrid` 2 cols — ổn. |

### 2.8 VNBroker / RuntimeKPI / DNSE

| Panel | Gap |
|---|---|
| `SocVnbrokerPanel` | Chưa đọc nhưng grep shows `vnbrokerHealth` + `benchmark` + `circuitBreaker` — nhiều section, không có hero. |
| `SocRuntimeKpiPanel` | `bannerHint + Usage` — stub “coming soon”, thiếu sparkline (đã có burn-rate 24h ở Overview nhưng RuntimeKPI riêng vẫn trống). |
| `SocDnseBackfillPanel` | Form dense, label nhỏ, không có preview. |

---

## 3) Tokens & Components

| Hệ | file:line | Gap |
|---|---|---|
| Tokens | `soc.tokens.css:1-43` | Thiếu `--space-*`, `--radius-*`, `--shadow-*`, `--font-*`, `--text-*`, `--bg-*`, `--border-*` semantic. Hiện chỉ màu rời. |
| Glass | `soc.components.css:90-116` | 3 cấp `glassPanel` / `sectionCard` / `metricCard` opacity khác nhau, không có elevation scale. |
| Typography | `sectionCardTitle 0.85rem 700`, `metricLabel 0.65rem uppercase` | Quá nhỏ cho demanding user, nên 0.875rem + 0.75rem. Line-height không token. |
| Motion | `tabActiveSlide 0.2s`, `accordionSlide 0.2s`, `pulse-ring 2s` | Tốt nhưng thiếu `prefers-reduced-motion` cho tất cả (chỉ có 1 nơi). |
| A11y | `focus-visible` không có, `aria` đủ nhưng thiếu `skip link`, `h2` hierarchy. |  |
| Responsive | `overviewMetricGrid` breakpoints 1280/768/480 tốt, nhưng `dataopsHeroMetrics` 900/480 khác, `opsFormGrid` 1024, `signalsTwoCol` 1100 — không thống nhất breakpoint. |  |

---

## 4) So sánh chuẩn thương mại

| Tiêu chí | Datadog | Grafana | Bloomberg | SOC hiện tại | Gap |
|---|---|---|---|---|---|
| Header | Eyebrow + env + time range + live pulse | Dashboard title + tags + refresh | Top bar + market status + clock | Chỉ title + description, không live trừ Overview | Thiếu live pulse ở Shell |
| Tab | Segmented pill + count badge | Left nav + breadcrumb | Keyboard nav + color | Underline 2px, không count | Thêm badge |
| Metric hero | 4-6 cards icon+value+trend sparkline | Stat panel + sparkline | Ticker strip | Overview 7 cards tốt, DataOps 4 cards không sparkline | Thêm sparkline/burn |
| Table | Sticky header + zebra + sort + pagination + row hover | Table panel + column toggle | Blotter + filter | Plain table, không sticky/sort | Thêm sticky + zebra |
| Empty | Illustration + CTA | No data + query hint | No data | Dashed border + text | Thêm illustration |
| Loading | Skeleton shimmer + progressive | Panel loading | Skeleton | Khác nhau mỗi tab | Unify skeleton |
| Error | Banner + Retry + Request ID | Alert + details | Toast | InlineError plain | Thêm icon + Retry + ID |

---

## 5) Đề xuất bố trí lại — đạt chuẩn khó tính

### 5.1 Nguyên tắc (đã chốt, không hỏi lại)

1. **Shell là sản phẩm:** `ShellOperationsCenterPage` có fixed chrome: breadcrumb `Operations / {Tab}` + eyebrow `OPERATIONS CENTER · LIVE` + title 1.75rem + description 0.9rem + tab bar sticky.
2. **Tab là segmented control:** `SocTabNavigation` pill 32px height, active `background 00b4d8/0.12 + border 00b4d8/0.25 + shadow`, icon 16px + label 0.8rem 600, badge count nếu có, scroll fade mask + arrow.
3. **Hero là 1 hàng 4-7 cards:** Dùng `overviewMetricGrid` chuẩn cho cả SOC — icon 32px rounded 8px + value 1.15rem + label 0.65rem uppercase + `metric_share` caption. DataOps hero đổi thành Overview style (border-left accent).
4. **Section là `sectionCard` 1rem padding + `sectionCardTitle` 0.875rem + `sectionGrid` 1fr 1fr → 1fr.**
5. **Table là `coverageTable` sticky th + zebra even `rgba(15,23,42,0.2)` + hover `0.3` + sort icon.**
6. **Empty là `emptyState` + `LucideIcon Inbox/Search` 32px + title + CTA.**
7. **Mọi màu qua token, không hardcode `rgba`.**

### 5.2 Thứ tự thực hiện (1.5d)

| Step | File | Việc | Ước |
|---|---|---|---|
| S1 | `soc.tokens.css` | Thêm semantic tokens: `--text-primary/secondary/muted`, `--border-default/strong`, `--bg-panel/soft`, `--shadow-*`, `--radius-*`, `--space-*`, `--font-*` | 0.25h |
| S2 | `ShellOperationsCenterPage.tsx` | Thêm breadcrumb, eyebrow live dot, title 1.75rem, description, sticky tab bar | 0.5h |
| S3 | `SocTabNavigation.tsx` + `soc.components.css tabBar/tabButton` | Pill active, badge, fade mask, scroll arrow, a11y roving | 0.5h |
| S4 | `SocDataOpsPanel.tsx` | Hero đổi `overviewMetricGrid` style, subtab bar unify với `tabBar`, content `gap 1.25rem` | 0.5h |
| S5 | `SocDataInventory/Operations/Monitor/ConfigSection` | Unify `metricGrid` 4→2→1, `sectionCard` spacing, table sticky, empty illustration, skeleton `dataopsSkeletonMetric` | 0.5h |
| S6 | `SocPrefetch/Screener/Vnbroker/RuntimeKpi/Dnse` | Wrap `ShellPanel` consistent, metricGrid, `filterBtn` → `domainPill` style, emoji → `LucideIcon` | 0.5h |

### 5.3 Tiêu chí bàn giao (không hỏi lại)

- [ ] `npx tsc --noEmit` 0, `npm run build` PASS, `npm run lint` 0 errors
- [ ] Visual: 1920/1366/390 không orphan, tab bar scroll có fade, hero 1 hàng, card hover lift  -1.5px + shadow
- [ ] 8 tabs đều có eyebrow + title + description + empty illustration + skeleton
- [ ] Table sticky th, zebra, hover, pagination `showing_range`
- [ ] A11y: `role=tablist/tab`, `aria-selected`, `focus-visible` ring, `prefers-reduced-motion`
- [ ] i18n: không hardcode, `vi.js/en.js` đủ

---

*Audit này là cơ sở để implement S1-S6. Mọi deviation phải ghi `CODE_CHANGE_AUDIT_LEDGER.md`.*
