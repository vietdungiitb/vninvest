# Refactor giao diện Alert Center — Kế hoạch toàn diện

**Ngày:** 2026-07-27
**Phiên bản:** v2 (chi tiết)
**Tác giả:** AI Audit

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Feature inventory — danh sách tính năng hiện tại](#2-feature-inventory)
3. [SOC Design System mapping](#3-soc-design-system-mapping)
4. [Component tree & Props interface](#4-component-tree)
5. [Data flow](#5-data-flow)
6. [State matrix](#6-state-matrix)
7. [CSS Audit — từng class trong AlertCenterPage.module.css](#7-css-audit)
8. [Kế hoạch thực hiện chi tiết từng Phase](#8-ke-hoach-thuc-hien)
    - [Phase 1 — Page Shell](#phase-1)
    - [Phase 2 — Controls Bar & Filters](#phase-2)
    - [Phase 3 — Alert Feed (Signal Row Pattern)](#phase-3)
    - [Phase 4 — Stats Table (Coverage Table Pattern)](#phase-4)
    - [Phase 5 — Detail Drawer (SOC Drawer Pattern)](#phase-5)
    - [Phase 6 — Animations & Micro-interactions](#phase-6)
    - [Phase 7 — Component Refactor (Tách file)](#phase-7)
9. [Accessibility requirements](#9-accessibility)
10. [Feature preservation checklist](#10-feature-preservation)
11. [Quality gates](#11-quality-gates)

---

## 1. Tổng quan

### Mục tiêu
- Chuyển toàn bộ giao diện Alert Center từ custom CSS + `createElement` → SOC design system (JSX, SOC classes, Shell components)
- Tăng maintainability, visual consistency, accessibility
- Zero mất tính năng

### Phạm vi
| File cũ | Thay bằng | Loại thay đổi |
|---------|-----------|---------------|
| `AlertCenterPage.tsx` | `AlertCenterPage.tsx` | Sửa — tách logic + SOC |
| `AlertCard.js` | `AlertCard.tsx` | Rewrite — JSX + SOC |
| `SymbolStatsTable.js` | `StatsTable.tsx` | Rewrite — JSX + SOC |
| `DetailDrawer.js` | `DetailDrawer.tsx` | Rewrite — JSX + SOC drawer |
| — | `FilterBar.tsx` | **Mới** — tách từ AlertCenterPage |
| — | `AlertFeedPanel.tsx` | **Mới** — tách từ AlertCenterPage |
| — | `StatsPanel.tsx` | **Mới** — wrapper cho StatsTable |
| — | `useAlertCenterFilters.ts` | **Mới** — filter state hook |
| — | `useAlertCenterActions.ts` | **Mới** — action handlers hook |
| `useAlertCenterData.js` | Giữ nguyên | Không đổi |
| `useAlertCenterRealtime.js` | Giữ nguyên | Không đổi |
| `AlertCenterPage.module.css` | `AlertCenterPage.module.css` | Xoá ~90% CSS |

---

## 2. Feature Inventory

Feature checklist của Alert Center hiện tại — **phải giữ nguyên sau refactor**:

### 2.1 Page Shell
- [x] Eyebrow + Title + Subtitle
- [x] Online indicator (live badge — pause/resume click)
- [x] Metrics bar: 4 metrics (total, high+critical, ai suggest, unseen)
- [x] Auto-refresh toggle (click badge pause/resume)
- [x] Real-time status label (WebSocket / Polling / Paused)

### 2.2 Controls Bar
- [x] Lane selector: "main" | "ai" (segmented buttons)
- [x] Timeframe selector: 5m | 15m | 1h | session | 5d (segmented buttons)
- [x] Refresh button (with spinning animation)
- [x] Symbol search input (form submit → apply symbol filter)

### 2.3 Filter Strip
- [x] Severity filter chips: critical | high | medium | low (multi-select)
- [x] Family filter chips: whale | dark_flow | price_shock | signal | system | ai_suggest (multi-select)
- [x] "Clear filter" button (appears when any filter active)

### 2.4 Alert Feed (virtual scroll)
- [x] react-window `FixedSizeList`, itemSize 280
- [x] Sort: latest | largestValue
- [x] Feed merges REST payload + realtime alerts
- [x] Optimistic updates (acknowledge / mute)
- [x] Loading state: ShellSkeleton (5 cards)
- [x] Empty state: empty message
- [x] Error state: error banner + retry button
- [x] `PageErrorBoundary` wrapper

### 2.5 Alert Card
- [x] Symbol badge
- [x] Alert family + lane label
- [x] Severity badge (color-coded)
- [x] Title
- [x] Summary / body
- [x] Optimistic pending badge (acknowledged / muted)
- [x] Metrics grid: value, direction, confidence, freshness, session, time/executed_at
- [x] Direction text (buy/sell — color-coded)
- [x] Expandable evidence section (toggle)
- [x] Actions: Xem chi tiết, Xác nhận (main lane only), Tắt tiếng
- [x] Busy state (disabled during action, loading text)

### 2.6 Stats Table
- [x] Symbol search (filter in stats)
- [x] Table columns: Symbol, Count, Buy/Sell bar, Frequency, Value
- [x] Buy/sell strength bar (percentage bars)
- [x] Frequency badge (Bùng nổ | Cao | Trung bình | Thấp)
- [x] Symbol link → /stocks/{symbol}
- [x] Pagination (first/prev/next/last)
- [x] Empty state

### 2.7 Detail Drawer
- [x] Alert ID in title
- [x] Detail content (title, summary/body)
- [x] Symbol context panel (total, unseen, avg severity, threshold)
- [x] Close button

### 2.8 Error Handling
- [x] API load error banner
- [x] Action error banner (ack/mute/detail failure)
- [x] Retry button
- [x] Error boundary fallback

---

## 3. SOC Design System Mapping

### 3.1 Layout classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Page wrapper | inline `div` | `.shellPage` (global) | Đã có sẵn từ ShellPageChrome |
| 2-cột container | `soc.opsLayoutContainer` | Giữ nguyên | Đã dùng đúng |
| Cột phải | `soc.opsRightCol` | Giữ nguyên | Sticky |
| Panel container | ShellPanel | Giữ nguyên | Từ ShellPageTemplate |
| Toolbar | `soc.toolbar` + `.toolbarRow` | Giữ nguyên | Chỉ thay inline divider |

### 3.2 Tab & Button classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Lane/timeframe tabs | `soc.subTabBar` + `.subTabBtn` | Giữ nguyên | Đã dùng đúng |
| Filter chips | `soc.filterBtn` | Giữ nguyên | Đã dùng đúng |
| Filter active | `soc.filterBtnActive` | Giữ nguyên | Cyan bg |
| Filter inactive | `soc.filterBtnInactive` | Giữ nguyên | Muted hover |
| Refresh button | `shell.button + shell.buttonSecondary` | `soc.filterBtn` | Đổi cho nhất quán |
| Detail button | `shell.buttonPrimary` | `soc.filterBtn.soc.filterBtnActive` | SOC primary variant |
| Ack/Mute button | `shell.buttonSecondary` | `soc.filterBtn.soc.filterBtnInactive` | SOC secondary variant |
| Pagination btn | custom `acPageBtn` | `soc.pageBtn` | Đã có sẵn |
| Clear filter | inline style amber | `soc.filterBtn.soc.filterBtnInactive` | Thêm class |

### 3.3 Card & Signal Feed classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Card container | custom `acCard` | `soc.feedCard` + `soc.signalRow` | 12px radius, padding |
| Card enter animation | custom `acCardEnter` | `fadeIn` keyframe | SOC có sẵn |
| Severity left border | custom `acCardCritical/High/Medium/Low` | **Giữ lại** (SOC không có) | ~20 dòng CSS |
| Symbol badge | custom `acSymbolBadge` | `soc.signalSymbol` | 0.8rem 700 weight |
| Direction text | inline style `direction-buy/sell` | `soc.signalLabelBuy/Sell` | Chip badge |
| Severity badge | custom `acSevCritical/High/Medium/Low` | `soc.statusBadge` + variant | Pill badge |
| Freshness badge | — | `soc.statusBadge.soc.statusBadgeInfo` | Info pill |
| Metrics grid | custom `acCardMetrics` | `soc.signalMeta` | Flex detail row |
| Evidence toggle | custom `acEvidenceHeader` | `soc.accordionHeader` | Accordion pattern |
| Evidence list | custom `acEvidenceList` | — | Giữ hoặc dùng `signalMeta` |
| Pending badge | custom `acPendingBadge` | `soc.statusBadge.soc.statusBadgeWarning` | Warning pill |

### 3.4 Table classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Table container | — | `soc.coverageTableWrap` | Thêm mới |
| Table | `soc.coverageTable` | Giữ nguyên | Đã dùng đúng |
| Table header | inline `th` | `soc.coverageTable th` | Giữ nguyên |
| Table cell | inline `td` | `soc.coverageTable td` | Giữ nguyên |
| Frequency badge | custom `acFreqBadge` + `acFreqExplosive/High/etc` | `soc.statusBadge` + variant | Dùng SOC pill |
| Strength bar | custom `acStrengthContainer/Bar/Buy/Sell/Neutral` | **Giữ lại** (SOC không có) | ~30 dòng CSS |

### 3.5 Badge & Indicator classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Live dot | custom `acLiveDot` + keyframe | `soc.overviewHeroBadgePulse` + `pulse-ring` | Đã có sẵn |
| Live dot paused | custom `acLiveDotPaused` | `soc.pulsingDot` + `.dotYellow` | paused = yellow |
| Refresh spinner | custom `acSpin` keyframe | — | Giữ (SOC không có) |
| Severity critical badge | custom `acSevCritical` | `soc.statusBadge.soc.statusBadgeDanger` | Dùng SOC |
| Severity high badge | custom `acSevHigh` | `soc.statusBadge.soc.statusBadgeWarning` | Dùng SOC |
| Severity medium badge | custom `acSevMedium` | `soc.statusBadge.soc.statusBadgeInfo` | Dùng SOC |
| Severity low badge | custom `acSevLow` | `soc.statusBadge` | Neutral |
| Freq explosive badge | custom `acFreqExplosive` | `soc.statusBadge.soc.statusBadgeDanger` | Dùng SOC |
| Freq high badge | custom `acFreqHigh` | `soc.statusBadge.soc.statusBadgeWarning` | Dùng SOC |
| Freq medium badge | custom `acFreqMedium` | `soc.statusBadge.soc.statusBadgeInfo` | Dùng SOC |
| Freq low badge | custom `acFreqLow` | `soc.statusBadge` | Neutral |

### 3.6 Drawer classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Drawer backdrop | — | `soc.drawerOverlay` | **Mới** — thêm backdrop |
| Drawer panel | custom `acDrawer` | `soc.drawerContent` | Slide-in right, 480px |
| Drawer header | custom `acDrawerTitleRow` | inline div | Header row |
| Drawer close | custom `acCloseBtn` | `soc.closeBtn` | SOC có sẵn |
| Drawer section | custom `acDrawerSection` | `soc.sectionCard` | 10px radius card |
| Drawer grid | custom `acDrawerGrid` | `soc.opsConfigFields` | 2-col field grid |
| Drawer items | custom `acDrawerItem` | inline | Giữ đơn giản |

### 3.7 Utility classes

| Mục đích | Old class | SOC class | Ghi chú |
|----------|-----------|-----------|---------|
| Error banner | custom `acBannerError` | `soc.bannerError` | Đã có sẵn |
| Loading | custom `acLoading` | `soc.skeleton` | Shimmer |
| Empty state | `soc.emptyState` | Giữ nguyên | Đã dùng đúng |
| Pagination | custom `acPagination` | — | Giữ (SOC không có) |

---

## 4. Component Tree

### 4.1 Tree diagram

```
AlertCenterPage (orchestrator)
├── ShellPageChrome
│   ├── eyebrow     = t("alertCenter.eyebrow")
│   ├── title       = t("alertCenter.title")
│   ├── description = t("alertCenter.subtitle")
│   ├── badge       = <LiveBadge />
│   │               autoRefresh → soc.overviewHeroBadgePulse (green, pulse-ring)
│   │               !autoRefresh → soc.pulsingDot + dotYellow (yellow, static)
│   ├── metrics     = [
│   │   ShellMetric({ label: t("alertCenter.summary.total"),   value: total }),
│   │   ShellMetric({ label: t("alertCenter.summary.highCritical"), value: highCount }),
│   │   ShellMetric({ label: t("alertCenter.summary.aiSuggest"), value: aiCount }),
│   │   ShellMetric({ label: t("alertCenter.summary.unseen"),  value: unseen }),
│   │ ]
│   ├── notice      = !autoRefresh ? t("alertCenter.paused") : null
│   ├── error       = error && !loading ? error + <RetryButton /> : null
│   └── children    = [
│       <FilterBar />,
│       actionError && <BannerError>{actionError}</BannerError>,
│       <div.opsLayoutContainer>
│           <AlertFeedPanel lane={lane} />,      // left col
│           <StatsPanel />,                       // right col
│       </div>,
│       <DetailDrawer />,
│   ]
│
├── FilterBar
│   ├── div.toolbar.toolbarRow
│   │   ├── div.subTabBar
│   │   │   ├── button.subTabBtn[active] × lane (main|ai)
│   │   │   ├── div.separator
│   │   │   └── button.subTabBtn[active] × timeframe (5m|15m|1h|session|5d)
│   │   └── button.filterBtn × refresh
│   └── form.searchWrapper
│       └── span.searchIcon + input.searchInputWithIcon
│
├── AlertFeedPanel
│   ├── ShellPanel({ title, subtitle, actions: sort buttons })
│   ├── loading && !isRefreshing → ShellSkeleton(variant="card", count=5)
│   ├── !loading && alerts.length === 0 → ShellEmptyState
│   ├── error → SocBannerError + retry
│   └── alerts.length > 0 →
│       <FixedSizeList height={460} itemCount={N} itemSize={280}>
│           <AlertCard />
│       </FixedSizeList>
│
├── StatsPanel
│   ├── ShellPanel({ title, subtitle })
│   ├── input.searchWrapper (stats search)
│   ├── div.coverageTableWrap
│   │   └── table.coverageTable
│   │       ├── thead (sortable headers)
│   │       └── tbody × rows
│   └── pagination (soc.pageBtn)
│
└── DetailDrawer
    └── div.drawerOverlay (backdrop, fixed)
        └── aside.drawerContent (slide-in, 480px)
            ├── header: title + closeBtn
            ├── div.sectionCard (detail)
            └── div.sectionCard (context)
```

### 4.2 Component props interfaces (TypeScript)

```typescript
// ── FilterBar.tsx ──
interface FilterBarProps {
  lane: 'main' | 'ai';
  onLaneChange: (lane: 'main' | 'ai') => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  symbolDraft: string;
  onSymbolDraftChange: (val: string) => void;
  onSymbolApply: (e: React.FormEvent) => void;
  severityFilter: string[];
  onToggleSeverity: (val: string) => void;
  familyFilter: string[];
  onToggleFamily: (val: string) => void;
  onClearFilters: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

// ── AlertFeedPanel.tsx ──
interface AlertFeedPanelProps {
  loading: boolean;
  isRefreshing: boolean;
  alerts: AlertItem[];
  error: string;
  sorting: 'latest' | 'largestValue';
  onSortChange: (sort: 'latest' | 'largestValue') => void;
  onRefresh: () => void;
  busyAlertId: string | number;
  expandedEvidence: Record<string, boolean>;
  onToggleEvidence: (id: string) => void;
  onLoadDetail: (alert: AlertItem) => void;
  onAcknowledge: (alert: AlertItem) => void;
  onMute: (alert: AlertItem) => void;
  formatAlertValue: (val: unknown) => string;
  formatAlertTimestamp: (val: unknown) => string;
  liveBadge: ReactNode;
}

// ── AlertCard.tsx ──
interface AlertCardProps {
  alert: AlertItem;
  style?: React.CSSProperties;
  busyAlertId: string | number;
  isEvidenceExpanded: boolean;
  onToggleEvidence: (id: string) => void;
  onLoadDetail: (alert: AlertItem) => void;
  onAcknowledge: (alert: AlertItem) => void;
  onMute: (alert: AlertItem) => void;
  formatAlertValue: (val: unknown) => string;
  formatAlertTimestamp: (val: unknown) => string;
}

interface AlertItem {
  alert_id: string | number;
  symbol?: string;
  title?: string;
  body?: string;
  summary?: string;
  severity?: string;
  direction?: string;
  value?: unknown;
  confidence?: number;
  freshness_state?: string;
  session_date?: string;
  triggered_at?: string;
  executed_at?: string;
  alert_family?: string;
  alert_type?: string;
  evidence?: Record<string, unknown>;
  acknowledged?: boolean;
  muted?: boolean;
  _optimistic?: boolean;
  lane?: string;
}

// ── StatsPanel.tsx ──
interface StatsPanelProps {
  paginatedSymbols: SymbolStatsRow[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  formatAlertValue: (val: unknown) => string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (column: string) => void;
}

interface SymbolStatsRow {
  symbol: string;
  count: number;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  totalValue: number;
  freq: string;
  severities: Record<string, number>;
  latestTime: number;
}

// ── DetailDrawer.tsx ──
interface DetailDrawerProps {
  activeAlertId: string | number;
  activeDetail: Record<string, unknown> | null;
  activeContext: Record<string, unknown> | null;
  appliedSymbol: string;
  onClose: () => void;
}
```

---

## 5. Data Flow

```
[Browser] ←http→ [Django Core API]
    ↑                    ↓
useAlertCenterData       useAlertCenterRealtime
(React Query, 5s poll)   (WebSocket / 30s poll)
    │                    │
    └── merge ──────────┘
         │
         ▼
  AlertCenterPage (orchestrator)
    ├── sortedAlerts (sort: latest|largestValue)
    ├── displayAlerts (optimistic ack/mute merge)
    ├── aggregatedSymbols (stats data transform)
    ├── filters → FilterBar
    ├── feed data → AlertFeedPanel → FixedSizeList → AlertCard[]
    ├── stats data → StatsPanel → StatsTable
    └── selection → DetailDrawer
```

### State ownership

| State | Owner | Lý do |
|-------|-------|-------|
| `lane`, `timeframe`, filters, sorting | `useAlertCenterFilters` | UI-only, local |
| `alerts`, `summary`, `symbolStats` | `useAlertCenterData` (RQ) | Server state |
| `realtimeAlerts` | `useAlertCenterRealtime` | Server state |
| `isRefreshing` | `AlertCenterPage` | UI transient |
| `busyAlertId`, `actionError` | `useAlertCenterActions` | Action state |
| `optimisticAck`, `optimisticMuted` | `useAlertCenterActions` | Optimistic UI |
| `activeAlertId`, `activeDetail`, `activeContext` | `useAlertCenterActions` | Selection state |
| `expandedEvidence` | `AlertCenterPage` | UI toggle |
| `searchTermStats`, `pageStats` | `AlertCenterPage` | Stats pagination |

---

## 6. State Matrix

### 6.1 Alert FeedPanel

| State | Loading | Error | Data | Rendering |
|-------|---------|-------|------|-----------|
| **Initial load** | true | "" | null | ShellSkeleton × 5 |
| **Fresh load** | false | "" | [...] | FixedSizeList + AlertCard[] |
| **Refresh (loading)** | true | "" | [...] | FixedSizeList (giữ data cũ) + spinner |
| **Refresh error** | false | "Error msg" | [...] | AlertCard[] + BannerError |
| **Fatal error** | true | "Error msg" | null | BannerError + retry button |
| **Empty** | false | "" | [] | ShellEmptyState |
| **Empty + filters** | false | "" | [] | `t("alertCenter.empty")` |
| **Filtered** | false | "" | [...] | FixedSizeList (subset) |
| **Optimistic ack** | false | "" | [...] | Card shows pending badge |
| **Realtime merged** | false | "" | [...] | Cards updated + visual feedback |

### 6.2 Stats Table

| State | Data | Rendering |
|-------|------|-----------|
| **Loading** | [] | Skeleton placeholder |
| **Loaded** | [...] | Table rows + pagination |
| **Empty** | [] | `t("alertCenter.statsEmpty")` |
| **Search active** | [...] | Filtered rows (client-side) |
| **Search no match** | [] | `t("alertCenter.statsEmpty")` |
| **Sort by count asc** | [...] | Re-ordered rows |
| **Sort by value desc** | [...] | Re-ordered rows |
| **Page > 1** | [...] | Partial rows + pagination visible |

### 6.3 Detail Drawer

| State | activeDetail | Rendering |
|-------|-------------|-----------|
| **Closed** | null | `return null` |
| **Loading** | "pending" | Spinner inside drawer |
| **Loaded** | {...} | Full detail sections |
| **Context available** | {...} | Detail + Context sections |
| **Context null** | {...} | Detail only |
| **Error** | error obj | Error message in drawer |
| **Closing** | → null | `drawerContent` slide-out animation |

### 6.4 Card Action States

| State | busyAlertId | optimistic | Visual |
|-------|------------|------------|--------|
| **Idle** | "" | false | All buttons enabled |
| **Loading detail** | "alert-123" | false | Button shows "Đang tải..." |
| **Acknowledge** | "alert-123" | { "alert-123": true } | Pending badge, action hidden |
| **Acknowledge error** | "" | { "alert-123": false } | Action error banner |
| **Mute symbol** | "ABC" | { "ABC": true } | Card shows muted, buttons hide |

---

## 7. CSS Audit

### 7.1 Classes cần GIỮ LẠI (SOC không có pattern tương đương)

| Class | Dòng | Lý do giữ | Ghi chú |
|-------|------|-----------|---------|
| `@keyframes acPulseLive` | 8-21 | Thay = `pulse-ring` | Có thể xoá khi dùng SOC |
| `@keyframes acSpin` | 23-29 | SOC không có spin | **Giữ** nếu cần, nhưng dùng `pulsingDot` thay |
| `.acCardCritical/High/Medium/Low` | 72-83 | SOC feedCard không có border-left variant | **Giữ** — ~12 dòng |
| `.acCardTop` | 106-112 | Thay = `signalRow` layout | Có thể xoá |
| `.acCardTitle` | 114-120 | Thay = inline `strong` | Có thể xoá |
| `.acCardMeta` | 122-130 | Thay = `signalMeta` | Có thể xoá |
| `.acSymbolBadge` | 132-139 | Thay = `signalSymbol` | Có thể xoá |
| `.acCardSummary` | 142-155 | Giữ — summary text | **Giữ** hoặc dùng `signalVolume` |
| `.acCardMetrics` | 156-166 | Thay = `signalMeta` | Có thể xoá |
| `.acDirectionBuy/Sell` | 168-175 | Thay = `signalLabelBuy/Sell` | Có thể xoá |
| `.acBtn` | 177-180 | Thay = `filterBtn` | Có thể xoá |
| `.acEvidenceHeader` | 183-202 | Thay = `accordionHeader` | Có thể xoá |
| `.acEvidenceList` | 204-220 | Giữ — evidence list style | **Giữ** ~17 dòng |
| `.acCardActions` | 222-227 | Thay = `soc.filterBtn` | Có thể xoá |
| `.acStrengthContainer/Bar/Buy/Sell/Neutral` | 230-263 | **Giữ** — SOC không có | ~34 dòng |
| `.acFreqBadge/Explosive/High/Medium/Low` | 267-293 | Thay = `statusBadge` + variant | Có thể xoá |
| `.acDrawer` | 297-321 | Thay = `drawerContent` | Có thể xoá |
| `.acDrawerTitleRow/CloseBtn/Section/Grid/Item/DetailFlex/Muted` | 322-402 | Thay = SOC drawer | Có thể xoá |
| `.acStatsHeader` | 405-407 | Thay = `ShellPanel` header | Có thể xoá |
| `.acStatsRow td` | 408-410 | Thay = `coverageTable td` | Có thể xoá |
| `.acCountCell` | 414-416 | Thay = `coverageTable th/td` | Có thể xoá |
| `.acValueCell` | 417-421 | Thay = `coverageTable td` | Có thể xoá |
| `.acLoading` | 424-442 | Thay = `skeleton` | Có thể xoá |
| `.acError` | 443-452 | Thay = `soc.bannerError` | Có thể xoá |
| `.acBannerError` | 453-466 | **Giữ** — SOC `bannerError` có thể thay | **Giữ** nếu SOC không khớp |
| `.acBtnInline` | 467-471 | Thay = inline style | Có thể xoá |
| `.acScrollable` | 472-482 | **Giữ** — scrollbar style | ~11 dòng |
| `.acPagination` | 485-493 | **Giữ** — SOC không có | ~9 dòng |
| `.acPageBtn` | 494-515 | Thay = `soc.pageBtn` | Có thể xoá |
| `.acPageInfo` | 516-521 | **Giữ** — SOC không có | ~6 dòng |
| `.acPendingBadge` | 523-534 | Thay = `statusBadge.statusBadgeWarning` | Có thể xoá |
| `@media (max-width: 640px)` | 536-543 | Thay = SOC responsive | Có thể xoá |
| `[data-theme="light"]` | 546-556 | **Giữ** — light theme support | ~11 dòng |

### 7.2 CSS sẽ giữ lại sau refactor (~80 dòng)

```css
/* Alert Center module.css — only what SOC does not provide */

/* 1. Severity left-border variants */
.acCardCritical  { border-left: 3px solid var(--soc-c-ef4444); }
.acCardHigh      { border-left: 3px solid var(--accent-amber); }
.acCardMedium    { border-left: 3px solid var(--accent-cyan); }
.acCardLow       { border-left: 3px solid var(--text-muted); }

/* 2. Buy/Sell strength bar (SOC không có) */
.acStrengthContainer { display: flex; flex-direction: column; gap: 4px; width: 100%; max-width: 150px; }
.acStrengthText { font-size: 0.7rem; color: var(--text-muted); display: flex; justify-content: space-between; }
.acStrengthBar { display: flex; height: 6px; border-radius: 999px; overflow: hidden; background: rgba(100,116,139,0.18); width: 100%; }
.acStrengthBuy { background: var(--soc-c-34d399); height: 100%; transition: width .3s; }
.acStrengthSell { background: var(--soc-c-f87171); height: 100%; transition: width .3s; }
.acStrengthNeutral { background: var(--text-muted); height: 100%; }

/* 3. Evidence list */
.acEvidenceList { margin: 0 0 12px; padding: 10px 12px; font-size: .78rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 5px; background: rgba(2,11,35,.3); border-radius: 8px; border: 1px solid rgba(80,120,168,.08); list-style: none; }
.acEvidenceList li { font-family: var(--font-mono); word-break: break-all; }

/* 4. Scrollbar */
.acScrollable { flex: 1; overflow-y: auto; padding-right: 6px; }
.acScrollable::-webkit-scrollbar { width: 6px; }
.acScrollable::-webkit-scrollbar-thumb { background: rgba(0,180,216,.3); border-radius: 3px; }

/* 5. Pagination info text (SOC không có) */
.acPagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(80,120,168,.12); }
.acPageInfo { font-size: .82rem; font-weight: 600; color: var(--text-muted); padding: 0 8px; }

/* 6. Refresh spinner (nếu giữ) */
@keyframes acSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.acSpin { animation: acSpin .8s linear infinite; }

/* 7. Light theme variants (giữ nguyên) */
[data-theme="light"] .acStrengthBar { background: rgba(0,0,0,0.08); }
[data-theme="light"] .acEvidenceList { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
```

### 7.3 CSS sẽ XOÁ (~476 dòng)

Toàn bộ class có thể thay bằng SOC pattern:
- `.acLiveDot`, `.acLiveDotPaused` → SOC badge
- `.acCard`, `.acCardTop`, `.acCardTitle`, `.acCardMeta`, `.acSymbolBadge`, `.acCardSummary`, `.acCardMetrics`, `.acDirectionBuy/Sell`, `.acBtn`, `.acCardActions` → SOC signalRow
- `.acEvidenceHeader` → SOC accordion
- `.acFreqBadge` + variants → SOC statusBadge
- `.acDrawer*` → SOC drawer
- `.acStatsHeader`, `.acStatsRow td`, `.acCountCell`, `.acValueCell` → SOC coverageTable
- `.acSevCritical/High/Medium/Low` → SOC statusBadge variants
- `.acLoading`, `.acError`, `.acBannerError`, `.acBtnInline` → SOC banner/skeleton
- `.acPageBtn` → SOC pageBtn
- `.acPendingBadge` → SOC statusBadge
- `.acSpin` → SOC pulsingDot (nếu dùng)

---

## 8. Kế hoạch thực hiện chi tiết

### Phase 1: Page Shell & Hero 🏠

**Mục tiêu:** Dùng `ShellPageChrome` đúng pattern, xoá custom hero code.

**File:** `AlertCenterPage.tsx`

**Trước:**
```tsx
const liveBadge = e("div", { className: `${soc.heroBadge}`, ... }, [
  e("span", { className: `${autoRefresh ? soc.statusDot : styles.acLiveDotPaused} ${styles.acLiveDot}` }),
  !autoRefresh ? t("alertCenter.paused") : realtimeStatus === "live" ? t("alertCenter.liveWs") : t("alertCenter.livePolling"),
]);

const metrics = [
  e(ShellMetric, { key: "m-total", label: t("alertCenter.summary.total"), value: String(summaryData?.total ?? alerts.length) }),
  e(ShellMetric, { key: "m-high", label: t("alertCenter.summary.highCritical"), value: String(highSeverityCount) }),
  e(ShellMetric, { key: "m-ai", label: t("alertCenter.summary.aiSuggest"), value: String(aiSuggestCount) }),
  e(ShellMetric, { key: "m-unseen", label: t("alertCenter.summary.unseen"), value: String(summaryData?.unseen ?? 0) }),
];

return e(ShellPageChrome, { eyebrow, title, description, badge: liveBadge, metrics, className }, [...]);
```

**Sau:**
```tsx
const liveBadge = (
  <div
    className={`${soc.overviewHeroBadge}`}
    onClick={() => setAutoRefresh(!autoRefresh)}
    title={autoRefresh ? t("alertCenter.pauseHint") : t("alertCenter.resumeHint")}
  >
    <span className={`${autoRefresh ? soc.overviewHeroBadgePulse : `${soc.pulsingDot} ${soc.dotYellow}`}`} />
    {!autoRefresh
      ? t("alertCenter.paused")
      : realtimeStatus === "live"
        ? t("alertCenter.liveWs")
        : t("alertCenter.livePolling")
    }
  </div>
);

const metrics = [
  <ShellMetric key="total" label={t("alertCenter.summary.total")} value={String(summaryData?.total ?? alerts.length)} />,
  <ShellMetric key="high" label={t("alertCenter.summary.highCritical")} value={String(highSeverityCount)} />,
  <ShellMetric key="ai" label={t("alertCenter.summary.aiSuggest")} value={String(aiSuggestCount)} />,
  <ShellMetric key="unseen" label={t("alertCenter.summary.unseen")} value={String(summaryData?.unseen ?? 0)} />,
];

return (
  <ShellPageChrome
    eyebrow={t("alertCenter.eyebrow")}
    title={t("alertCenter.title")}
    description={t("alertCenter.subtitle")}
    badge={liveBadge}
    metrics={metrics}
    notice={!autoRefresh ? t("alertCenter.paused") : undefined}
    error={error && !loading ? error : undefined}
    className={className}
  >
    {children}
  </ShellPageChrome>
);
```

**Xoá CSS:** `.acLiveDot`, `@keyframes acPulseLive`, `.acLiveDotPaused`, `.acBannerError`, `.acLoading`
**Thêm CSS:** 0 dòng

---

### Phase 2: Controls Bar & Filters 🔧

**Mục tiêu:** Dùng SOC toolbar + filter patterns, replace inline divider và refresh button.

**File mới:** `FilterBar.tsx`

```tsx
interface FilterBarProps {
  lane: string;
  onLaneChange: (lane: string) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  symbolDraft: string;
  onSymbolDraftChange: (val: string) => void;
  onSymbolApply: (e: React.FormEvent) => void;
  severityFilter: string[];
  onToggleSeverity: (val: string) => void;
  familyFilter: string[];
  onToggleFamily: (val: string) => void;
  onClearFilters: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function FilterBar(props: FilterBarProps) {
  const { t } = useI18n();
  const hasActiveFilters = props.severityFilter.length > 0 || props.familyFilter.length > 0;

  return (
    <>
      <div className={`${soc.toolbar}`}>
        {/* Row 1: Lane + Timeframe + Refresh */}
        <div className={`${soc.toolbarRow}`}>
          <div className={`${soc.subTabBar}`}>
            {LANE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`${soc.subTabBtn} ${props.lane === o.value ? soc.subTabBtnActive : ""}`}
                onClick={() => props.onLaneChange(o.value)}
              >
                {t(o.label)}
              </button>
            ))}
            <div className={`${soc.separator}`} style={{ width: 1, alignSelf: "stretch" }} />
            {WINDOW_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`${soc.subTabBtn} ${props.timeframe === o.value ? soc.subTabBtnActive : ""}`}
                onClick={() => props.onTimeframeChange(o.value)}
              >
                {t(o.label)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            onClick={props.onRefresh}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <span className={props.isRefreshing ? `${soc.pulsingDot} ${soc.dotGreen}` : ""} />
            {t("alertCenter.refresh")}
          </button>
        </div>

        {/* Row 2: Symbol search */}
        <form className={`${soc.searchWrapper}`} onSubmit={props.onSymbolApply}>
          <span className={soc.searchIcon}>⌕</span>
          <input
            type="text"
            className={soc.searchInputWithIcon}
            value={props.symbolDraft}
            maxLength={10}
            placeholder={t("alertCenter.filterSymbol")}
            onChange={e => props.onSymbolDraftChange(e.target.value.toUpperCase())}
          />
        </form>
      </div>

      {/* Filter chips strip */}
      <div className={`${soc.toolbarRow}`} style={{ marginBottom: 12 }}>
        <span className={`${soc.opsLabel}`}>{t("alertCenter.severity")}</span>
        {SEVERITY_OPTIONS.map(s => (
          <button
            key={s.value}
            type="button"
            className={`${soc.filterBtn} ${props.severityFilter.includes(s.value) ? soc.filterBtnActive : soc.filterBtnInactive}`}
            onClick={() => props.onToggleSeverity(s.value)}
          >
            {t(s.labelKey)}
          </button>
        ))}
        <div className={`${soc.separator}`} style={{ width: 1, alignSelf: "stretch", margin: "0 4px" }} />
        <span className={`${soc.opsLabel}`}>{t("alertCenter.family")}</span>
        {FAMILY_OPTIONS.map(f => (
          <button
            key={f.value}
            type="button"
            className={`${soc.filterBtn} ${props.familyFilter.includes(f.value) ? soc.filterBtnActive : soc.filterBtnInactive}`}
            onClick={() => props.onToggleFamily(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            style={{ color: "var(--accent-amber)", borderColor: "rgba(245,158,11,0.4)" }}
            onClick={props.onClearFilters}
          >
            {t("alertCenter.clearFilter")}
          </button>
        )}
      </div>
    </>
  );
}
```

**SOC classes dùng mới:** `.opsLabel`, `.separator`, `.overviewHeroBadge`, `.overviewHeroBadgePulse`, `.pulsingDot`, `.dotGreen`, `.dotYellow`
**Xoá CSS:** (không xoá — đây là component mới)
**Thêm CSS:** 0 dòng

---

### Phase 3: Alert Feed Cards (Signal Row Pattern) 🃏

**Mục tiêu:** Chuyển `AlertCard.js` → `AlertCard.tsx` dùng SOC signal feed pattern + JSX.

**Trước (AlertCard.js):**
```js
// createElement style, custom CSS classes
return e("article", { className: `${styles.acCard} ${styles[`acCard${severity}`]}` }, [
  e("div", { className: styles.acCardTop }, [
    e("div", {}, [
      e("h3", { className: styles.acCardTitle }, alert.title),
      e("p", { className: styles.acCardMeta }, [
        e("span", { className: `${soc.statusBadge} ${styles.acSymbolBadge}` }, alert.symbol),
        e("span", {}, `· ${alert.alert_family} · Lane: ${lane}`),
      ]),
    ]),
    e("span", { className: `${soc.statusBadge} ${styles[`acSev${severity}`]}` }, severity),
  ]),
  e("p", { className: styles.acCardSummary }, alert.summary || alert.body),
  // ... metrics grid with acCardMetrics
  // ... actions with shell.buttonPrimary/Secondary
]);
```

**Sau (AlertCard.tsx):**
```tsx
import { memo } from "react";
import { useI18n } from "../../context/LangContext.js";
import { FeedCard, SignalRow, SignalIcon, SignalSymbol, SignalLabel, SignalLabelBuy, SignalLabelSell, SignalLabelNeutral, SignalVolume, SignalTime, SignalMeta, StatusBadge, Accordion, AccordionHeader, AccordionContent, FilterBtn, FilterBtnActive, FilterBtnInactive } from "../soc/soc.module.css";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../soc/soc.module.css";

// ── Mapping helper ──
const SEVERITY_TO_SOC = {
  critical: soc.statusBadgeDanger,
  high: soc.statusBadgeWarning,
  medium: soc.statusBadgeInfo,
  low: "",
} as const;

const DIRECTION_TO_SOC = {
  buy: soc.signalLabelBuy,
  sell: soc.signalLabelSell,
  neutral: soc.signalLabelNeutral,
} as const;

function getDirectionClass(dir: string): string {
  const d = String(dir || "").toLowerCase();
  if (d.includes("buy") || d === "mua") return soc.signalLabelBuy;
  if (d.includes("sell") || d === "bán") return soc.signalLabelSell;
  return soc.signalLabelNeutral;
}

export const AlertCard = memo(function AlertCard(props: AlertCardProps) {
  const { t } = useI18n();
  const { alert, busyAlertId, isEvidenceExpanded, toggleEvidence, handleLoadDetail, handleAcknowledge, handleMuteSymbol, formatAlertValue, formatAlertTimestamp, style } = props;

  const severity = alert.severity || "medium";
  const severityCap = severity.charAt(0).toUpperCase() + severity.slice(1);
  const borderClass = styles[`acCard${severityCap}`] || styles.acCardMedium;
  const severityBadgeClass = SEVERITY_TO_SOC[severity as keyof typeof SEVERITY_TO_SOC] || "";
  const directionClass = getDirectionClass(alert.direction);

  return (
    <article className={`${soc.feedCard} ${soc.signalRow} ${borderClass}`.trim()} style={style}>
      {/* ── Row 1: Symbol + Title + Value + Direction ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
          <div className={`${soc.signalIcon} ${severityBadgeClass || soc.statusBadgeInfo}`}>
            {/* Icon: severity symbol */}
            {severity === "critical" ? "⚠" : severity === "high" ? "⚡" : "ℹ"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span className={`${soc.signalSymbol}`}>{alert.symbol || "—"}</span>
              <span className={`${soc.statusBadge} ${severityBadgeClass || ""}`.trim()}>
                {t(`alertCenter.sev${severityCap}` as any)}
              </span>
              <span className={`${soc.statusBadge} ${soc.statusBadgeInfo}`}>
                {alert.freshness_state || "—"}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
              {alert.title || t("alertCenter.cardTitle")}
            </h3>
            <div className={`${soc.signalMeta}`}>
              {alert.alert_family || alert.alert_type || "—"} · Lane: {alert.lane || lane}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className={`${soc.signalVolume}`}>
            {formatAlertValue(alert.value)} VND
          </div>
          <div className={`${soc.signalLabel} ${directionClass}`.trim()}>
            {alert.direction || "—"}
          </div>
        </div>
      </div>

      {/* ── Row 2: Summary ── */}
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", margin: "8px 0" }}>
        {alert.summary || alert.body || t("alertCenter.cardNoSummary")}
      </p>

      {/* ── Optimistic badge ── */}
      {alert._optimistic && (
        <span className={`${soc.statusBadge} ${soc.statusBadgeWarning}`} style={{ marginBottom: 8 }}>
          {alert.acknowledged ? t("alertCenter.pendingAck") : t("alertCenter.pendingMute")}
        </span>
      )}

      {/* ── Row 3: Metrics in signalMeta ── */}
      <div className={`${soc.signalMeta}`} style={{ marginBottom: 10 }}>
        <span><strong>{t("alertCenter.labelConfidence")}:</strong> {alert.confidence != null ? alert.confidence : "—"}</span>
        <span><strong>{t("alertCenter.labelSession")}:</strong> {alert.session_date || "—"}</span>
        <span><strong>{t("alertCenter.labelTime")}:</strong> {formatAlertTimestamp(alert.triggered_at)}</span>
        {alert.executed_at && (
          <span><strong>{t("alertCenter.labelExecuted")}:</strong> {formatAlertTimestamp(alert.executed_at)}</span>
        )}
      </div>

      {/* ── Row 4: Evidence Accordion ── */}
      {alert.evidence && Object.keys(alert.evidence).length > 0 && (
        <div className={`${soc.accordion}`} style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`${soc.accordionHeader}`}
            onClick={() => toggleEvidence(alert.alert_id)}
          >
            <span>{t("alertCenter.evidenceView")}</span>
            <span>{isEvidenceExpanded ? "▼" : "▶"}</span>
          </button>
          {isEvidenceExpanded && (
            <div className={`${soc.accordionContent}`}>
              {renderEvidenceList(alert.evidence, t)}
            </div>
          )}
        </div>
      )}

      {/* ── Row 5: Actions ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnActive}`}
          disabled={busyAlertId === alert.alert_id}
          onClick={() => handleLoadDetail(alert)}
        >
          {busyAlertId === alert.alert_id ? t("alertCenter.btnDetailLoading") : t("alertCenter.btnDetail")}
        </button>
        {lane === "main" && (
          <button
            type="button"
            className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
            disabled={busyAlertId === alert.alert_id}
            onClick={() => handleAcknowledge(alert)}
          >
            {t("alertCenter.btnAck")}
          </button>
        )}
        <button
          type="button"
          className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
          disabled={busyAlertId === (alert.alert_id || alert.symbol)}
          onClick={() => handleMuteSymbol(alert)}
        >
          {t("alertCenter.btnMute")}
        </button>
      </div>
    </article>
  );
});
```

**Xoá CSS:** `.acCard`, `.acCardTop`, `.acCardTitle`, `.acCardMeta`, `.acSymbolBadge`, `.acCardSummary`, `.acCardMetrics`, `.acDirectionBuy/Sell`, `.acBtn`, `.acCardActions`, `.acEvidenceHeader`, `.acSevCritical/High/Medium/Low`, `.acPendingBadge`
**Giữ CSS:** `.acCardCritical/High/Medium/Low` (border-left)
**Thêm CSS:** 0 dòng

---

### Phase 4: Stats Table (Coverage Table Pattern) 📊

**Mục tiêu:** Chuyển `SymbolStatsTable.js` → `StatsTable.tsx` dùng SOC coverageTable pattern + sortable columns.

**File mới:** `StatsTable.tsx`

```tsx
interface StatsTableProps {
  rows: SymbolStatsRow[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  formatAlertValue: (val: unknown) => string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}

const FREQ_SOC_MAP: Record<string, string> = {
  "Bùng nổ": soc.statusBadgeDanger,
  "Cao": soc.statusBadgeWarning,
  "Trung bình": soc.statusBadgeInfo,
  "Thấp": "",
};

const SORTABLE_COLUMNS = ["symbol", "count", "value", "freq"];

export function StatsTable(props: StatsTableProps) {
  const { t } = useI18n();

  function renderSortIcon(col: string): string {
    if (props.sortColumn !== col) return "⇅";
    return props.sortDirection === "asc" ? "↑" : "↓";
  }

  return (
    <div className={`${soc.panel}`}>
      {/* Header */}
      <div className={`${soc.panelHeader}`}>
        <h2 className={soc.panelTitle}>{t("alertCenter.statsTitle")}</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {props.rows.length} {t("alertCenter.colSymbol")}
        </span>
      </div>

      {/* Search */}
      <div className={`${soc.searchWrapper}`} style={{ marginBottom: 12 }}>
        <span className={soc.searchIcon}>⌕</span>
        <input
          type="text"
          className={soc.searchInputWithIcon}
          value={props.searchTerm}
          maxLength={10}
          placeholder={t("alertCenter.statsSearch")}
          onChange={e => props.onSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      {props.rows.length === 0 ? (
        <p className={`${soc.emptyState}`}>{t("alertCenter.statsEmpty")}</p>
      ) : (
        <div className={`${soc.coverageTableWrap}`}>
          <table className={`${soc.coverageTable}`}>
            <thead>
              <tr>
                {["symbol", "count", "buySell", "freq", "value"].map(col => (
                  <th
                    key={col}
                    onClick={SORTABLE_COLUMNS.includes(col) ? () => props.onSort(col) : undefined}
                    style={SORTABLE_COLUMNS.includes(col) ? { cursor: "pointer", userSelect: "none" } : undefined}
                  >
                    {t(`alertCenter.col${col.charAt(0).toUpperCase() + col.slice(1)}` as any)}
                    {SORTABLE_COLUMNS.includes(col) && ` ${renderSortIcon(col)}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map(item => {
                const total = item.count || 0;
                const buyPct = total > 0 ? (item.buyCount / total) * 100 : 0;
                const sellPct = total > 0 ? (item.sellCount / total) * 100 : 0;
                const neutralPct = total > 0 ? (item.neutralCount / total) * 100 : 0;
                const freqClass = FREQ_SOC_MAP[item.freq] || "";

                return (
                  <tr key={item.symbol}>
                    <td>
                      <a
                        href={`/stocks/${item.symbol}`}
                        className={`${soc.statusBadge}`}
                        style={{ fontWeight: 800 }}
                      >
                        {item.symbol}
                      </a>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {t("alertCenter.times", { count: item.count })}
                    </td>
                    <td>
                      <div className={`${styles.acStrengthContainer}`}>
                        <div className={`${styles.acStrengthBar}`}>
                          {buyPct > 0 && (
                            <div className={`${styles.acStrengthBuy}`} style={{ width: `${buyPct}%` }}
                              title={`${t("alertCenter.labelBuy")}: ${item.buyCount}`}
                            />
                          )}
                          {sellPct > 0 && (
                            <div className={`${styles.acStrengthSell}`} style={{ width: `${sellPct}%` }}
                              title={`${t("alertCenter.labelSell")}: ${item.sellCount}`}
                            />
                          )}
                          {neutralPct > 0 && (
                            <div className={`${styles.acStrengthNeutral}`} style={{ width: `${neutralPct}%` }}
                              title={`${t("alertCenter.labelOther")}: ${item.neutralCount}`}
                            />
                          )}
                        </div>
                        <div className={`${styles.acStrengthText}`}>
                          <span>{t("alertCenter.buyShort")}:{item.buyCount}</span>
                          <span>{t("alertCenter.sellShort")}:{item.sellCount}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${soc.statusBadge} ${freqClass}`.trim()}>
                        {t(`alertCenter.freq${item.freq === "Bùng nổ" ? "Explosive" : item.freq === "Cao" ? "High" : item.freq === "Trung bình" ? "Medium" : "Low"}` as any)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatAlertValue(item.totalValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**SOC class mới dùng:** `.coverageTableWrap`
**Giữ CSS:** `.acStrengthContainer`, `.acStrengthBar`, `.acStrengthBuy`, `.acStrengthSell`, `.acStrengthNeutral`, `.acStrengthText` (SOC không có)
**Xoá CSS:** `.acFreqBadge`, `.acFreqExplosive/High/Medium/Low`, `.acStatsHeader`, `.acStatsRow td`, `.acCountCell`, `.acValueCell`, `.acStatsSymbolBadge`

---

### Phase 5: Detail Drawer (SOC Drawer Pattern) 📦

**Mục tiêu:** Chuyển `DetailDrawer.js` → `DetailDrawer.tsx` dùng SOC drawer + backdrop overlay.

**Trước:** inline section, không overlay
**Sau:**

```tsx
import { useEffect, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import soc from "../soc/soc.module.css";

interface DetailDrawerProps {
  activeAlertId: string | number;
  activeDetail: Record<string, unknown> | null;
  activeContext: Record<string, unknown> | null;
  appliedSymbol: string;
  onClose: () => void;
}

export function DetailDrawer(props: DetailDrawerProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (props.activeDetail) {
      closeRef.current?.focus();
    }
  }, [props.activeDetail]);

  // Escape key
  useEffect(() => {
    if (!props.activeDetail) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [props.activeDetail, props.onClose]);

  if (!props.activeDetail) return null;

  return (
    <div className={`${soc.drawerOverlay}`} onClick={props.onClose}>
      <aside
        ref={drawerRef}
        className={`${soc.drawerContent}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("alertCenter.detailTitle", { id: props.activeAlertId })}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {t("alertCenter.detailTitle", { id: props.activeAlertId })}
          </h3>
          <button
            ref={closeRef}
            type="button"
            className={`${soc.closeBtn}`}
            onClick={props.onClose}
            aria-label={t("alertCenter.close")}
          >
            ✕
          </button>
        </div>

        {/* Detail section */}
        <div className={`${soc.sectionCard}`} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
            {t("alertCenter.detailContent")}
          </h4>
          <div className={`${soc.opsConfigFields}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t("alertCenter.detailTitle", { id: "" })}
              </span>
              <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                {props.activeDetail?.title || t("alertCenter.detailNoTitle")}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                {t("alertCenter.detailSummary")}
              </span>
              <strong style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {props.activeDetail?.summary || props.activeDetail?.body || t("alertCenter.cardNoSummary")}
              </strong>
            </div>
          </div>
        </div>

        {/* Context section */}
        {props.activeContext && (
          <div className={`${soc.sectionCard}`}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              {t("alertCenter.detailContext", { symbol: props.activeContext.symbol || props.appliedSymbol })}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>{t("alertCenter.detailTotal")}: <strong>{String(props.activeContext.total || 0)}</strong></div>
              <div>{t("alertCenter.detailUnseen")}: <strong style={{ color: "var(--accent-amber)" }}>{String(props.activeContext.unseen || 0)}</strong></div>
              <div>{t("alertCenter.detailAvgSeverity")}: <strong>{props.activeContext.average_severity || "medium"}</strong></div>
              <div>{t("alertCenter.detailThreshold")}: <strong>{props.activeContext.threshold_strategy || "default"}</strong></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
```

**SOC classes dùng mới:** `.drawerOverlay`, `.drawerContent`, `.closeBtn`, `.sectionCard`, `.opsConfigFields`
**Xoá CSS:** `.acDrawer`, `.acDrawerTitleRow`, `.acCloseBtn`, `.acDrawerSection`, `.acDrawerGrid`, `.acDrawerItem`, `.acDetailFlex`, `.acDetailMuted`, `acDrawerTitleRow::after`
**Thêm CSS:** 0 dòng

---

### Phase 6: Animations & Micro-interactions ✨

**Mục tiêu:** Dùng SOC animations có sẵn, thêm stagger delay cho card list.

**File:** `AlertCenterPage.tsx` + `AlertCenterPage.module.css`

**Stagger delay cho card list:**

```tsx
// Trong AlertFeedPanel, khi render FixedSizeList item
const ITEM_STAGGER = 50; // ms delay per item

// Mỗi card style:
style={{ ...style, overflow: "hidden", animationDelay: `${(index % 20) * ITEM_STAGGER}ms` }}
```

**Refresh spinner animation:**
```tsx
// SOC pulsingDot + dotGreen
<button type="button" className={`${soc.filterBtn} ${soc.filterBtnInactive}`} onClick={onRefresh}>
  {isRefreshing ? (
    <>
      <span className={`${soc.pulsingDot} ${soc.dotGreen}`} />
      {t("alertCenter.refresh")}
    </>
  ) : (
    t("alertCenter.refresh")
  )}
</button>
```

**Live badge pulse:**
```tsx
// SOC overviewHeroBadgePulse với pulse-ring keyframe
<span className={`${autoRefresh ? soc.overviewHeroBadgePulse : `${soc.pulsingDot} ${soc.dotYellow}`}`} />
```

**Animation mapping chi tiết:**

| Element | SOC keyframe | Gắn vào |
|---------|-------------|---------|
| Alert card enter | `fadeIn` | `article.feedCard` |
| Alert card hover | (built-in) | `soc.feedCard:hover` |
| Filter active | (transition) | `soc.filterBtnActive` |
| Tab active | `tabActiveSlide` | `soc.subTabBtnActive` |
| Drawer open | `slideInRight` | `soc.drawerContent` |
| Accordion toggle | `accordionSlide` | `soc.accordionContent` |
| Live dot | `pulse-ring` | `soc.overviewHeroBadgePulse` |
| Refresh spinner | (none) | dùng `soc.pulsingDot` |
| Skeleton | `shimmer` | `soc.skeleton` |
| Card stagger | — | inline `animationDelay` |

**CSS thêm vào module.css:**
```css
/* Card stagger — delay via CSS variable set inline */
.feedCard {
  animation: fadeIn 300ms ease-out both;
}
```

---

### Phase 7: Component Refactor 🔧

**Mục tiêu:** Tách `AlertCenterPage.tsx` (649 dòng) → hooks + sub-components.

**File mới: `hooks/useAlertCenterFilters.ts`**

```typescript
import { useState, useCallback } from "react";

export function useAlertCenterFilters() {
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState("latest");
  const [searchTermStats, setSearchTermStats] = useState("");
  const [pageStats, setPageStats] = useState(1);

  const toggleSeverity = useCallback((val: string) => {
    setSeverityFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }, []);
  const toggleFamily = useCallback((val: string) => {
    setFamilyFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }, []);
  const clearFilters = useCallback(() => {
    setSeverityFilter([]);
    setFamilyFilter([]);
  }, []);
  const applySymbol = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSymbol(symbolDraft.trim().toUpperCase());
  }, [symbolDraft]);

  return {
    lane, setLane, symbolDraft, setSymbolDraft, appliedSymbol,
    sessionDate, timeframe, setTimeframe,
    severityFilter, familyFilter, sorting, setSorting,
    searchTermStats, setSearchTermStats,
    pageStats, setPageStats,
    toggleSeverity, toggleFamily, clearFilters, applySymbol,
  };
}
```

**File mới: `hooks/useAlertCenterActions.ts`**

```typescript
import { useState, useCallback } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

interface AlertActionItem {
  alert_id: string | number;
  symbol?: string;
  alert_family?: string;
  alert_type?: string;
  [key: string]: unknown;
}

export function useAlertCenterActions(refetch: () => void) {
  const [activeAlertId, setActiveAlertId] = useState<string | number>("");
  const [activeDetail, setActiveDetail] = useState<unknown>(null);
  const [activeContext, setActiveContext] = useState<unknown>(null);
  const [actionError, setActionError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState<string | number>("");
  const [optimisticAck, setOptimisticAck] = useState<Record<string, boolean>>({});
  const [optimisticMuted, setOptimisticMuted] = useState<Record<string, boolean>>({});

  const handleLoadDetail = useCallback(async (alert: AlertActionItem) => {
    if (!alert?.alert_id || !alert?.symbol) return;
    setActionError("");
    setBusyAlertId(alert.alert_id);
    try {
      const [detail, context] = await Promise.all([
        coreApiAdapter.getAlertCenterEventDetail(alert.alert_id),
        coreApiAdapter.getAlertCenterSymbolContext(alert.symbol),
      ]);
      setActiveAlertId(alert.alert_id);
      setActiveDetail(detail || null);
      setActiveContext(context || null);
    } catch (err: unknown) {
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể tải chi tiết alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, []);

  const handleAcknowledge = useCallback(async (alert: AlertActionItem) => {
    if (!alert?.alert_id) return;
    const id = String(alert.alert_id);
    setActionError("");
    setBusyAlertId(alert.alert_id);
    setOptimisticAck(prev => ({ ...prev, [id]: true }));
    try {
      await coreApiAdapter.acknowledgeAlertCenterEvent(alert.alert_id);
      refetch();
    } catch (err: unknown) {
      setOptimisticAck(prev => { const n = { ...prev }; delete n[id]; return n; });
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể xác nhận alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, [refetch]);

  const handleMute = useCallback(async (alert: AlertActionItem) => {
    if (!alert?.symbol) return;
    const sym = String(alert.symbol).trim().toUpperCase();
    setActionError("");
    setBusyAlertId(alert.alert_id || alert.symbol);
    setOptimisticMuted(prev => ({ ...prev, [sym]: true }));
    try {
      await coreApiAdapter.muteAlertCenterPreference({
        symbol: alert.symbol,
        alert_family: alert.alert_family || alert.alert_type || "",
        mute_minutes: 30,
      });
      refetch();
    } catch (err: unknown) {
      setOptimisticMuted(prev => { const n = { ...prev }; delete n[sym]; return n; });
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể tắt tiếng cảnh báo mã.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, [refetch]);

  const closeDetail = useCallback(() => {
    setActiveDetail(null);
  }, []);

  return {
    activeAlertId, activeDetail, activeContext,
    actionError, busyAlertId, optimisticAck, optimisticMuted,
    handleLoadDetail, handleAcknowledge, handleMute, closeDetail,
  };
}
```

**AlertCenterPage.tsx sau refactor (~250 dòng):**

```tsx
export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }: AlertCenterPageProps) {
  const { t } = useI18n();
  const filters = useAlertCenterFilters();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const { loading, error, payload, summary, symbolStats, refetch } = useAlertCenterData({
    env, lane: filters.lane, symbol: filters.appliedSymbol,
    sessionDate: filters.sessionDate, timeframe: filters.timeframe,
    severity: filters.severityFilter, alertFamily: filters.familyFilter,
    autoRefresh,
  });

  const { realtimeAlerts, realtimeStatus } = useAlertCenterRealtime({ enabled: autoRefresh });
  const actions = useAlertCenterActions(refetch);

  // ── Data transformations (moved from main component body) ──
  const alerts = useMemo(() => mergeAlerts(payload, realtimeAlerts), [payload, realtimeAlerts]);
  const sortedAlerts = useMemo(() => sortAlerts(alerts, filters.sorting), [alerts, filters.sorting]);
  const displayAlerts = useMemo(() => applyOptimistic(sortedAlerts, actions.optimisticAck, actions.optimisticMuted), [sortedAlerts, actions.optimisticAck, actions.optimisticMuted]);
  const aggregatedSymbols = useMemo(() => aggregateStats(symbolStats, filters.searchTermStats, t), [symbolStats, filters.searchTermStats, t]);

  // ── Effects ──
  useEffect(() => { filters.setPageStats(1); }, [filters.searchTermStats, filters.lane, filters.appliedSymbol, filters.timeframe]);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  }, [refetch]);

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Derived state ──
  const highSeverityCount = (summary?.by_severity?.high || 0) + (summary?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter(a => a?.alert_family === "ai_suggest" || a?.alert_type === "ai_suggest").length;
  const ITEMS_PER_PAGE = 8;
  const totalPages = Math.ceil(aggregatedSymbols.length / ITEMS_PER_PAGE) || 1;
  const paginatedSymbols = aggregatedSymbols.slice(
    (filters.pageStats - 1) * ITEMS_PER_PAGE,
    filters.pageStats * ITEMS_PER_PAGE,
  );

  return (
    <ShellPageChrome
      eyebrow={t("alertCenter.eyebrow")}
      title={t("alertCenter.title")}
      description={t("alertCenter.subtitle")}
      badge={renderLiveBadge(autoRefresh, realtimeStatus, t, () => setAutoRefresh(!autoRefresh))}
      metrics={[
        <ShellMetric key="total" label={t("alertCenter.summary.total")} value={String(summary?.total ?? alerts.length)} />,
        <ShellMetric key="high" label={t("alertCenter.summary.highCritical")} value={String(highSeverityCount)} />,
        <ShellMetric key="ai" label={t("alertCenter.summary.aiSuggest")} value={String(aiSuggestCount)} />,
        <ShellMetric key="unseen" label={t("alertCenter.summary.unseen")} value={String(summary?.unseen ?? 0)} />,
      ]}
      notice={!autoRefresh ? t("alertCenter.paused") : undefined}
      error={error && !loading ? error : undefined}
      className={className}
    >
      <FilterBar
        lane={filters.lane}
        onLaneChange={filters.setLane}
        timeframe={filters.timeframe}
        onTimeframeChange={filters.setTimeframe}
        symbolDraft={filters.symbolDraft}
        onSymbolDraftChange={filters.setSymbolDraft}
        onSymbolApply={filters.applySymbol}
        severityFilter={filters.severityFilter}
        onToggleSeverity={filters.toggleSeverity}
        familyFilter={filters.familyFilter}
        onToggleFamily={filters.toggleFamily}
        onClearFilters={filters.clearFilters}
        isRefreshing={isRefreshing}
        onRefresh={triggerRefresh}
      />

      {actions.actionError && <BannerError message={actions.actionError} />}

      <div className={`${soc.opsLayoutContainer}`}>
        <AlertFeedPanel
          loading={loading}
          isRefreshing={isRefreshing}
          alerts={displayAlerts}
          error={error}
          sorting={filters.sorting}
          onSortChange={filters.setSorting}
          onRefresh={triggerRefresh}
          busyAlertId={actions.busyAlertId}
          expandedEvidence={expandedEvidence}
          onToggleEvidence={toggleEvidence}
          onLoadDetail={actions.handleLoadDetail}
          onAcknowledge={actions.handleAcknowledge}
          onMute={actions.handleMute}
          formatAlertValue={formatAlertValue}
          formatAlertTimestamp={formatAlertTimestamp}
        />

        <StatsPanel
          rows={paginatedSymbols}
          searchTerm={filters.searchTermStats}
          onSearchChange={filters.setSearchTermStats}
          formatAlertValue={formatAlertValue}
          page={filters.pageStats}
          totalPages={totalPages}
          onPageChange={filters.setPageStats}
        />
      </div>

      <DetailDrawer
        activeAlertId={actions.activeAlertId}
        activeDetail={actions.activeDetail}
        activeContext={actions.activeContext}
        appliedSymbol={filters.appliedSymbol}
        onClose={actions.closeDetail}
      />
    </ShellPageChrome>
  );
}
```

---

## 9. Accessibility Requirements

| Requirement | Implementation | File |
|-------------|---------------|------|
| **Keyboard nav** | Tab order: FilterBar → Feed → Stats → Drawer | AlertCenterPage.tsx |
| **Focus visible** | SOC `.filterBtn:focus-visible` (có sẵn) | soc.module.css |
| **Focus trap drawer** | Tab cycle inside drawer, focus close btn on open | DetailDrawer.tsx |
| **Escape close** | `e.key === "Escape"` → closeDrawer | DetailDrawer.tsx |
| **aria-label** | Drawer `aria-label={detailTitle}`, `aria-modal="true"` | DetailDrawer.tsx |
| **aria-live** | Feed area `aria-live="polite"` announce new alerts | AlertFeedPanel.tsx |
| **aria-busy** | Card buttons `aria-busy` khi loading | AlertCard.tsx |
| **Color + icon** | direction: color (green/red) + icon (↑↓) | AlertCard.tsx |
| **Color + pattern** | severity: color + icon + text label | AlertCard.tsx |
| **Min touch target** | All buttons ≥ 32px | SOC filterBtn (có sẵn) |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` | AlertCenterPage.module.css |

---

## 10. Feature Preservation Checklist

Tick khi hoàn thành mỗi item — **phải giữ nguyên sau refactor**:

- [ ] **Page hero**: eyebrow, title, subtitle, live badge, 4 metrics
- [ ] **Live badge**: click pause/resume, pulsing dot, realtime status text
- [ ] **Lane tabs**: main | ai (segmented, filter state)
- [ ] **Timeframe tabs**: 5m | 15m | 1h | session | 5d
- [ ] **Refresh button**: spinning animation, trigger refetch
- [ ] **Symbol search**: input + form submit → filter feed
- [ ] **Severity filter**: multi-select chips, clear button
- [ ] **Family filter**: multi-select chips, clear button
- [ ] **Feed sort**: latest | largestValue buttons
- [ ] **Virtual scroll**: react-window FixedSizeList, itemSize 280
- [ ] **Alert card**: symbol, family, severity, title, summary
- [ ] **Card metrics**: value, direction, confidence, freshness, session, time
- [ ] **Direction display**: buy = green, sell = red
- [ ] **Evidence toggle**: expand/collapse, list view
- [ ] **Card actions**: detail, ack (main only), mute
- [ ] **Busy state**: buttons disabled during action
- [ ] **Optimistic ack**: pending badge, no re-fetch flash
- [ ] **Optimistic mute**: pending badge, no re-fetch flash
- [ ] **Realtime merge**: WebSocket alerts merged into feed
- [ ] **Stats search**: filter symbol list
- [ ] **Stats table**: Symbol, Count, Buy/Sell bar, Freq, Value
- [ ] **Stats sort**: sortable columns (add social)
- [ ] **Stats pagination**: first/prev/next/last
- [ ] **Symbol link**: → /stocks/{symbol}
- [ ] **Detail drawer**: title, content, context, close
- [ ] **Loading skeleton**: ShellSkeleton × 5
- [ ] **Empty state**: feed empty, stats empty
- [ ] **Error banner**: API error + retry
- [ ] **Action error**: inline error on ack/mute/detail failure
- [ ] **Error boundary**: PageErrorBoundary wrapper

---

## 11. Quality Gates

### Mỗi Phase

```bash
npx tsc --noEmit         # Zero type errors
```

### Sau Phase 3 (AlertCard rewrite)

```bash
npm run build            # Vite build (tsc + vite build)
```

### Sau Phase 7 (hoàn tất refactor)

```bash
npx tsc --noEmit && npm run lint && npm run build
```

### Kiểm tra browser

```
http://localhost/operations-center  # Load trang, verify:
1. Live badge pulse
2. Lane/timeframe switch
3. Filter chips toggle
4. Feed virtual scroll
5. Card actions (detail drawer opens)
6. Stats table pagination
7. Responsive <768px (single column)
```

### Final verification

- [ ] `npx tsc --noEmit` — PASS
- [ ] `npm run lint` — PASS (chỉ warnings pre-existing)
- [ ] `npm run build` — PASS
- [ ] Tất cả 35 feature items trong checklist đều hoạt động
- [ ] SOC classes ~40 classes dùng đúng semantic
- [ ] CSS module giảm từ 556 → ~80 dòng (-86%)
- [ ] JSX thay createElement ở 4 components
- [ ] Zero new i18n keys (chỉ dùng keys có sẵn)

---

> **Hết tài liệu.**
