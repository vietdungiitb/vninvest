# Implementation Plan — Stock Detail Page Audit Fixes

**Date:** 2026-07-17
**Source:** `docs/STOCK_DETAIL_PAGE_AUDIT_20260717.md` (24 findings, 3 counter-audit rounds)
**Effort:** ~13-14 days (Widget 1.75d + Host 11-12d)
**Scope:** Bugs, feature gaps, widget compatibility, commercial-grade UX

---

## Overview

### Priority Map

| Slice | Code | Effort | Findings Fixed | Depends On |
|-------|------|--------|----------------|------------|
| S1 | ErrorBoundary + Retry | 1.5d | F-05, F-23 | — |
| S2 | searchSymbols adapter | 0.5d | F-22 | — |
| S3 | Widget locale/theme wiring | 0.5d | F-08, F-20, F-21 | — |
| S4 | SPA navigate | 0.25d | F-11 | — |
| S5 | Safe props B-04(a) | 0.25d | (B-04a) | — |
| S6 | Watchlist API wiring | 1.0d | F-06, F-09 | — |
| S7 | promptConfig validate | 0.25d | F-24 | — |
| S8 | Workspace persistence | 0.5d | (C-04) | S1 |
| S9 | Data-dependent props B-04(b) | 1.5d | (B-04b), F-17 | S2 |
| S10 | MultiChart switch (B-01) | 1.5d | (B-01) | S2, S3, S4, W-03 |
| S11 | i18n 6 components (C-07) | 3-4d | F-07 | S3 |
| S12 | Mobile responsive (C-08) | 4-5d | F-12 | — |

**Total:** ~13-14d (sequential) / ~9d critical path (parallelizable)

### Dependency Graph

```
S1 (ErrorBoundary)  ─┐
S2 (searchSymbols)   ─┼── S10 (MultiChart)
S3 (widget locale)   ─┤       │
S4 (SPA navigate)    ─┼───────┤
S5 (safe props)      ─┤       ▼
S6 (watchlist)        ─┘    [shipable]
S7 (promptConfig)     ─ (independent)
S8 (workspace)         ─ after S1
S9 (data props)        ─ after S2
S11 (i18n components)  ─ after S3, parallelizable
S12 (mobile)           ─ independent, parallelizable
```

---

## Slice S1: ErrorBoundary + Retry (C-05)

**Findings:** F-05 (white-screen risk), F-23 (no retry)
**Effort:** 1.5d | **Priority:** P0 — do first

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `pages/StockDetailPage.tsx` | 307 | Wrap return in ErrorBoundary; add `loadBlocking` retry |
| `features/stock-detail/hooks/useStockDetailPageModel.js` | 49 | Expose `loadBlocking` from hook return |
| `components/AISettingsErrorBoundary.tsx` | — | Reuse as-is or create generic `PageErrorBoundary` |

### Acceptance Criteria

1. Widget/chart/render crash → error card shown, NOT white screen
2. Error card has "Thử lại" button that calls `loadBlocking()` (full re-fetch, not `setSelectedSession(null)`)
3. **Scope clarification:** Lazy-load chunk failures (`pageRegistry.js:231`) are already caught by `createDeferredPageComponent` (`pageRegistry.js:3-44`) which renders "Không thể tải trang" fallback. S1 ErrorBoundary covers **render-time crashes only** (widget throw, model hook error, component render error).
4. `componentDidCatch` logs to console with `[StockDetailPage]` prefix
5. Fallback UI uses `sdp-error-state` + `sdp-retry-btn` CSS classes (already exist, `StockDetailPage.tsx:177-191`)

### Audit Checklist

- [ ] `pageRegistry.js:231` — lazy chunk crash caught (test: throw in StockDetailPage render)
- [ ] `useStockDetailPageModel.js:143-150` — blocking lane error caught
- [ ] `StockDetailPage.tsx:187` — retry button calls `loadBlocking()` not `setSelectedSession(null)`
- [ ] `VNStockChartPanel.js` — widget internal crash caught by outer boundary
- [ ] No regression: error boundary does NOT catch non-render errors (e.g. event handlers)
- [ ] `npm run build` passes (tsc + vite)

### Reference Code

```tsx
// StockDetailPage.tsx — wrap entire return
return e(
  "div",
  { className: `sdp-page ${className}` },
  // ... existing content
);

// After fix:
return e(
  PageErrorBoundary,  // NEW — or reuse AISettingsErrorBoundary with generic props
  {
    fallbackTitle: "Lỗi hiển thị Stock Detail",
    errorMessage: error?.message,
    onRetry: () => { loadBlocking(); },  // expose from hook
  },
  e(
    "div",
    { className: `sdp-page ${className}` },
    // ... existing content
  )
);
```

```js
// useStockDetailPageModel.js — extract loadBlocking into useCallback
// CURRENT: loadBlocking is async function defined INSIDE useEffect (line 116-153),
//          depends on adapter (line 114) and mountedRef (line 70).
//
// REFACTOR STEPS:
// 1. Hoist adapter creation to top of hook (or recreate in useCallback)
// 2. Extract loadBlocking as useCallback with [env, symbol] deps
// 3. Keep original useEffect to call loadBlocking() on mount/symbol change
// 4. Expose loadBlocking in hook return

// AFTER (correct implementation matching actual code):
const loadBlocking = useCallback(async () => {
  if (!symbol) return;
  setModelState(s => ({ ...s, loadingBlocking: true, error: null }));

  const adapter = createCoreApiAdapter({ env, getToken: env?.getToken });
  try {
    const [overviewRes, orderFlowRes, sessionFactsCvdRes, whaleSnapshotRes] = await Promise.allSettled([
      adapter.getStockOverview(symbol),
      adapter.getStockOrderFlow(symbol, { window: DEFAULT_ORDER_FLOW_WINDOW }),
      adapter.getSessionFactsCvd(symbol, { window: DEFAULT_ORDER_FLOW_WINDOW }),
      adapter.getWhaleAnalyticsSnapshot(symbol, {
        timeframe: DEFAULT_ORDER_FLOW_WINDOW,
        compact: 0,
        includeBaseline: false,
      }),
    ]);

    if (!mountedRef.current) return;

    setModelState(s => ({
      ...s,
      loadingBlocking: false,
      snapshot: overviewRes.status === "fulfilled" ? overviewRes.value : null,
      orderFlowData: buildEffectiveOrderFlowData({
        orderFlowPayload: orderFlowRes.status === "fulfilled" ? orderFlowRes.value : null,
        sessionFactsCvdPayload: sessionFactsCvdRes.status === "fulfilled" ? sessionFactsCvdRes.value : null,
        whaleSnapshotPayload: whaleSnapshotRes.status === "fulfilled" ? whaleSnapshotRes.value : null,
        symbol,
        fallbackWindow: DEFAULT_ORDER_FLOW_WINDOW,
      }),
    }));
  } catch (err) {
    if (!mountedRef.current) return;
    setModelState(s => ({
      ...s,
      loadingBlocking: false,
      error: err?.message || "Không thể tải thông tin cốt lõi của cổ phiếu.",
    }));
  }
}, [env, symbol]);

// Original useEffect (line 105-154) simplified to:
useEffect(() => {
  loadBlocking();
}, [loadBlocking]);

// Add to hook return object (currently ends ~441):
return {
  // ... existing fields
  loadBlocking,  // NEW — used by S1 retry button
};
```

---

## Slice S2: searchSymbols Adapter (C-01)

**Findings:** F-22 (stub blocks B-01 search)
**Effort:** 0.5d | **Priority:** P1

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `adapters/chartAdapter.js` | 130-132 | Replace stub with real API call |
| `adapters/core/market.js` | 197 | Already has `getSymbolList` — use it |

### Acceptance Criteria

1. `searchSymbols("VNM")` returns real results from `GET /market-data/symbols/?q=VNM`
2. Response mapped to `[{ symbol, name, exchange }]` format expected by widget
3. Fallback: if API fails, return `[{ symbol: query, name: "Không tìm thấy", exchange: "" }]`
4. Debounce: caller (widget search) handles debounce, adapter just wraps API

### Audit Checklist

- [ ] `chartAdapter.js:130` — calls `coreAdapter.getSymbolList({ q: query })` or `coreGet('/market-data/symbols/')`
- [ ] `market.js:197` — `getSymbolList` endpoint confirmed working (test: `curl /market-data/symbols/?q=VNM`)
- [ ] Response shape: `[{ symbol: "VNM", name: "Vinamilk", exchange: "HOSE" }]`
- [ ] `npm run build` passes

### Reference Code

```js
// chartAdapter.js:130 — BEFORE
async searchSymbols(query) {
  return [{ symbol: query, name: query, exchange: 'VNINVEST' }];
}

// AFTER
async searchSymbols(query) {
  try {
    const payload = await coreAdapter.getSymbolList({ q: query, limit: 20 });
    const results = payload.results ?? payload ?? [];
    return results.map(s => ({
      symbol: s.symbol ?? s.code ?? '',
      name: s.name ?? s.company_name ?? '',
      exchange: s.exchange ?? s.market ?? '',
    }));
  } catch {
    return [{ symbol: query, name: 'Không tìm thấy', exchange: '' }];
  }
}
```

---

## Slice S3: Wire locale/theme from LangContext (C-02)

**Findings:** F-08 (local useI18n hardcoded), F-20 (widget locale), F-21 (widget theme)
**Effort:** 0.5d | **Priority:** P1

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `components/VNStockChartPanel.js` | 10-23 | Remove local `useI18n`, import from LangContext |
| `components/VNStockChartPanel.js` | 236 | `locale: language` (dynamic) |
| `components/VNStockChartPanel.js` | 238 | `theme: resolvedTheme` (dynamic) |

### Acceptance Criteria

1. `VNStockChartPanel` uses global `useI18n()` from `LangContext.js` (not local)
2. `locale` prop on widget reacts to language switch (vi ↔ en)
3. `theme` prop reads from CSS custom property or context (dark/light)
4. Widget text (toolbar labels, timeframes) renders in correct language

### Audit Checklist

- [ ] `VNStockChartPanel.js:10-23` — local `useI18n` removed
- [ ] `LangContext.js:92-114` — global `useI18n()` imported and used
- [ ] `VNStockChartPanel.js:236` — `locale` is `language` variable (not `'vi'`)
- [ ] `VNStockChartPanel.js:238` — `theme` is dynamic (not `'dark'`)
- [ ] `npm run build` passes

### Reference Code

```js
// VNStockChartPanel.js — BEFORE (lines 10-23)
function useI18n() {
  return { locale: 'vi', t: (k) => k };
}

// AFTER
import { useI18n } from '../context/LangContext.js';
// Inside component:
const { locale, t } = useI18n();

// line ~236 — widget props
locale: locale,      // from global useI18n() — NOT 'language' (local used 'language', global uses 'locale')
theme: resolvedTheme, // from context or CSS custom property
```

---

## Slice S4: SPA navigate (C-03)

**Findings:** F-11 (window.location.href)
**Effort:** 0.25d | **Priority:** P2

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `components/VNStockChartPanel.js` | 253 | Replace `window.location.href` with `navigate()` |

### Acceptance Criteria

1. `onSymbolChange` triggers React Router navigation, NOT full page reload
2. No state loss (except URL param) when switching symbols via chart toolbar
3. Browser back/forward works correctly

### Audit Checklist

- [ ] `VNStockChartPanel.js:253` — uses `useNavigate()` from `react-router-dom`
- [ ] No `window.location.href` or `window.location.assign` in stock-detail components
- [ ] Manual test: click symbol in chart → navigates without full reload
- [ ] `npm run build` passes

---

## Slice S5: Safe props B-04(a)

**Findings:** B-04(a) — non-trading-days, symbol-badges
**Effort:** 0.25d | **Priority:** P2

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `components/VNStockChartPanel.js` | ~236-248 | Add `showNonTradingDays={true}`, `showSymbolBadges={true}` |

### Acceptance Criteria

1. Gray zones appear on chart for weekends/holidays
2. Symbol badge shows on chart cell (when in multichart mode)

### Audit Checklist

- [ ] Props added to widget
- [ ] No crash when props added (verify widget accepts them)
- [ ] `npm run build` passes

---

## Slice S6: Watchlist API wiring (C-06)

**Findings:** F-06 (dummy button), F-09 (no persist)
**Effort:** 1.0d | **Priority:** P1

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `pages/StockDetailPage.tsx` | 43 | Replace `useState(false)` with watchlist context check |
| `pages/StockDetailPage.tsx` | 113-115 | Call `addWatchlistItem`/`removeWatchlistItem` |

### Acceptance Criteria

1. `handleWatch` calls `addWatchlistItem(watchlistId, symbol)` or `removeWatchlistItem(watchlistId, symbol)`
2. `isWatched` initial value checks watchlist context (not hardcoded `false`)
3. Navigate away and back → button reflects actual watchlist state
4. Optimistic UI: button toggles immediately, API call in background

### Audit Checklist

- [ ] `workspace.js:100-112` — `addWatchlistItem`/`removeWatchlistItem` called
- [ ] `StockDetailPage.tsx:43` — reads from watchlist context/store
- [ ] `StockDetailPage.tsx:113-115` — calls API, not just `setIsWatched`
- [ ] Error handling: API failure → revert button state + show toast
- [ ] `npm run build` passes

### Reference Code

```js
// StockDetailPage.tsx — BEFORE (line 113-115)
const handleWatch = useCallback(() => {
  setIsWatched((w) => !w);
}, []);

// AFTER
import { createCoreApiAdapter } from '../adapters/coreApiAdapter.js';

// 1. On mount / symbol change, check if symbol is in any watchlist
useEffect(() => {
  if (!symbol) return;
  const adapter = createCoreApiAdapter({ env });
  adapter.getWatchlists().then((res) => {
    const watchlists = res?.results ?? res ?? [];
    const found = watchlists.some(wl =>
      (wl.items ?? wl.symbols ?? []).some(item => (item.symbol ?? item) === symbol)
    );
    setIsWatched(found);
  }).catch(() => {});
}, [symbol, env]);

// 2. handleWatch — call API, not just toggle state
const handleWatch = useCallback(async () => {
  const adapter = createCoreApiAdapter({ env });
  const next = !isWatched;
  setIsWatched(next); // optimistic UI
  try {
    // Get first watchlist (default) — or find one containing the symbol
    const res = await adapter.getWatchlists();
    const watchlists = res?.results ?? res ?? [];
    const targetWatchlist = watchlists[0]; // default: first watchlist
    if (!targetWatchlist) {
      throw new Error('Không tìm thấy watchlist nào.');
    }
    if (next) {
      await adapter.addWatchlistItem(targetWatchlist.id, symbol);
    } else {
      await adapter.removeWatchlistItem(targetWatchlist.id, symbol);
    }
  } catch {
    setIsWatched(!next); // revert on failure
    showToast('Cập nhật watchlist thất bại.');
  }
}, [isWatched, symbol, env, showToast]);
```

---

## Slice S7: promptConfig schema validate (C-24)

**Findings:** F-24 (no schema validation)
**Effort:** 0.25d | **Priority:** P2

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `pages/StockDetailPage.tsx` | 46-66 | Add schema validation before `setPromptConfig` |

### Acceptance Criteria

1. `JSON.parse(stored)` result validated against `PromptConfig` shape
2. Missing `sources` field → fallback to default
3. Invalid field types → fallback to default (not crash)

### Audit Checklist

- [ ] `StockDetailPage.tsx:46-66` — validation logic added
- [ ] Test: localStorage with `{ version: 2 }` (no sources) → falls back to default
- [ ] Test: localStorage with `{ sources: "invalid" }` → falls back to default
- [ ] `npm run build` passes

### Reference Code

```ts
// StockDetailPage.tsx — BEFORE (lines 46-66)
const [promptConfig, setPromptConfig] = useState<PromptConfig>(() => {
  try {
    const stored = localStorage.getItem(`ai_advisory_prompt_config:${symbol}`);
    if (stored) return JSON.parse(stored);
  } catch { }
  return { version: 2, sources: { ... } };
});

// AFTER
function isValidPromptConfig(obj: unknown): obj is PromptConfig {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.version !== 'number') return false;
  if (!o.sources || typeof o.sources !== 'object') return false;
  return true;
}

const [promptConfig, setPromptConfig] = useState<PromptConfig>(() => {
  try {
    const stored = localStorage.getItem(`ai_advisory_prompt_config:${symbol}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidPromptConfig(parsed)) return parsed;
    }
  } catch { }
  return { version: 2, sources: { ... } };
});
```

---

## Slice S8: Workspace persistence (C-04)

**Findings:** C-04 (no workspace save/load)
**Effort:** 0.5d | **Priority:** P2 — after S1

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `components/VNStockChartPanel.js` | ~236 | Add `workspaceId`, `storageAdapter` props |

### Acceptance Criteria

1. `workspaceId={`stock-${symbol}`}` — unique per symbol
2. `storageAdapter={createLocalStorageAdapter()}` — persist drawings/layout to localStorage
3. User drawings survive page reload

### Audit Checklist

- [ ] **VERIFY FIRST:** `createLocalStorageAdapter` exists in `vninvestcharts-widget/adapters` subpath — run `import('vninvestcharts-widget/adapters')` in dev console or check widget `package.json` exports. If not found, skip S8 or use plain localStorage wrapper.
- [ ] `workspaceId` set per symbol
- [ ] Drawings persist across reload (manual test)
- [ ] `npm run build` passes

---

## Slice S9: Data-dependent props B-04(b)

**Findings:** B-04(b) — tape, advisory, corporate events
**Effort:** 1.5d | **Priority:** P2 — after S2

### Data Source Specification

- **Trades (tape panel):** Use existing `useRealtimeFeedFromManager` (`RealtimeContext.js`) — already imported in `VNStockChartPanel.js:6,66-69`. Feed `realtimeFeed.quotesBySymbol[symbol]` trades to widget via adapter's `subscribeToTrades`.
- **Orderbook (advisory panel):** Use `useOrderBook` hook from `components/workstation/hooks/index.js` — already used in `StockDetailPage.tsx:12,148`. Wire orderbook data to adapter's `subscribeToOrderbook`.
- **Corporate events:** Check if backend `getStockOverview` (used in blocking lane) returns corporate event data. If not, check `getStockProfile` for events/earnings data. May need new endpoint.

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `adapters/chartAdapter.js` | 122-128 | Implement `subscribeToTrades` (wire to realtime feed), `subscribeToOrderbook` (wire to orderbook hook) |
| `components/VNStockChartPanel.js` | ~236 | Add `showTapePanel={true}`, `showAdvisoryPanel={true}`, `showCorporateEvents={true}` |

### Acceptance Criteria

1. `subscribeToTrades` returns real trade data from WebSocket or polling
2. `subscribeToOrderbook` returns real order book data
3. Tape panel shows live trades
4. Advisory panel shows AI advisory overlay
5. Corporate events overlay shows earnings/dividend dates

### Audit Checklist

- [ ] `chartAdapter.js:122` — `subscribeToTrades` implements real subscription
- [ ] `chartAdapter.js:126` — `subscribeToOrderbook` implements real subscription
- [ ] Widget receives data and renders panels (not empty/error)
- [ ] `npm run build` passes

---

## Slice S10: MultiChart switch (B-01)

**Findings:** B-01 (switch to VNInvestMultiCharts)
**Effort:** 1.5d | **Priority:** P1 — after S2, S3

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `components/VNStockChartPanel.js` | 191-264 | Replace `VNInvestCharts` with `VNInvestMultiCharts` |

### Acceptance Criteria

1. Default layout: 1×1 (single chart, same UX as current)
2. `showWorkspaceToolbar={true}` — user can split to 2×2, L-shape, etc.
3. `onSymbolChange` uses SPA navigate (S4 must be done first)
4. `locale`/`theme` dynamic (S3 must be done first)
5. `searchSymbols` returns real results (S2 must be done first)

### Audit Checklist

- [ ] `VNInvestMultiCharts` imported from `vninvestcharts-widget`
- [ ] Layout default `{ rows: 1, cols: 1 }`
- [ ] `charts` array has 1 entry with current symbol/timeframe
- [ ] `showWorkspaceToolbar={true}` enables search + layout controls
- [ ] Manual test: click search → real results → click result → navigates to `/stocks/:symbol`
- [ ] Manual test: split to 2×2 → both charts render
- [ ] `npm run build` passes

### Risk Gate & Rollback Plan

**Risk** (from audit B-01): `VNInvestMultiCharts` may be unstable on React 18 after lazy-load (widget built for React 19 peer-dep, see AGENTS.md TDZ fix).

**Dev-verify gate** (BLOCKING before commit):
1. Create isolated branch `feature/stock-detail-multichart`
2. Implement S10 on branch, run dev server, navigate `/stocks/VNM`
3. Verify: no white-screen, no console TDZ error, search works, split works
4. If unstable → **DO NOT MERGE**. Revert to `VNInvestCharts` + keep S5 (safe props) as the only chart upgrade.

**Rollback**: If merged then found unstable in staging:
- `git revert <S10 commit>` → falls back to `VNInvestCharts` (S2/S3/S4 still valid, no regression)
- S5 (safe props) remains active regardless

---

## Slice S11: i18n 6 components (C-07)

**Findings:** F-07 (100% Vietnamese hardcoded)
**Effort:** 3-4d | **Priority:** P1 — after S3

### Files to Modify

| File | Approx Strings | Change |
|------|----------------|--------|
| `features/stock-detail/components/StockDetailHeader.js` | ~30 | Extract + `t()` |
| `features/stock-detail/components/StockDetailTabs.js` | ~50 | Extract + `t()` |
| `features/stock-detail/components/StockSessionWitness.js` | ~10 | Extract + `t()` |
| `features/stock-detail/components/StockContextDeck.js` | ~40 | Extract + `t()` |
| `pages/StockDetailPage.tsx` | ~15 | Extract + `t()` |
| `components/VNStockChartPanel.js` | ~5 (after S3) | Already done in S3 |

### Acceptance Criteria

1. All 6 components import `useI18n` from `LangContext.js`
2. All hardcoded Vietnamese strings replaced with `t('stockDetail.xxx')`
3. i18n keys added to `i18n/vi.js` and `i18n/en.js`
4. Switch language → all text updates correctly
5. No raw Vietnamese strings remain (scan: `grep -r "Vui lòng\|Đang tải\|Không có\|Xem chi tiết" src/features/stock-detail/`)

### Audit Checklist

- [ ] **Pre-work string scan:** `rg "\"[A-ZÀ-Ỹ][a-zà-ỹ]" src/features/stock-detail/ src/pages/StockDetailPage.tsx --count` — verify actual string count before committing to 3-4d estimate
- [ ] `i18n/vi.js` — all `stockDetail.*` keys present
- [ ] `i18n/en.js` — all `stockDetail.*` keys present
- [ ] `grep -r "Vui lòng\|Đang tải\|Không có" src/features/stock-detail/` — returns empty
- [ ] `grep -r "Vui lòng\|Đang tải\|Không có" src/pages/StockDetailPage.tsx` — returns empty
- [ ] Language switch test: vi → en → vi all text correct
- [ ] `npm run build` passes

---

## Slice S12: Mobile responsive (C-08)

**Findings:** F-12 (no mobile layout)
**Effort:** 4-5d | **Priority:** P2 — parallelizable

### Files to Modify

| File | Change |
|------|--------|
| `pages/StockDetailPage.css` | Add mobile breakpoints for `sdp-page`, `sdp-premium-header`, `sdp-chart-wrapper`, tabs, context deck |

### Acceptance Criteria

1. `@media (max-width: 768px)` — single column layout
2. Header 3-row → stacked vertically
3. Chart wrapper → full width, fixed aspect ratio
4. Tabs → horizontal scroll
5. Context deck → single column stack
6. Workstation layout disabled on mobile (already gated by `isFeatureEnabled`)

### Audit Checklist

- [ ] `StockDetailPage.css` — media queries at 768px and 480px
- [ ] Manual test: Chrome DevTools mobile emulation
- [ ] Header readable at 375px width
- [ ] Chart visible and interactive at 375px
- [ ] Tabs scrollable
- [ ] No horizontal overflow

---

## Widget-Side Tasks (Separate Team)

| ID | Task | Effort | Status |
|----|------|--------|--------|
| W-01 | Publish `dist/index.d.ts` with package | 0.5d | TODO |
| W-02 | Sync `version = "1.0.0"` → `"1.2.5"` | 0.25d | TODO |
| W-03 | peerDeps: `"^18.0.0 \|\| ^19.0.0"` | 0.5d | TODO |
| W-04 | Expose `openSearch()` ref method | 0.5d | TODO |
| W-05 | Stable named export for lazy-load | 0.25d | TODO |

---

## Verification Protocol

After each slice:
1. `npm run build` (tsc + vite) — MUST pass
2. Manual smoke test: navigate to `/stocks/VNM`
3. Check console for errors
4. Run `npm run test` if tests exist

After all slices:
1. Full regression: `/stocks/VNM`, `/stocks/VSH`, `/stocks/FPT`
2. Language switch: vi → en → vi
3. Mobile emulation: 375px, 768px, 1024px
4. Widget crash test: invalid symbol → error boundary catches
5. Watchlist: add → navigate away → back → still watched
6. Workspace: draw line → reload → line persists
7. **Widget lazy-load verification**:
   - `npm run build` → check `dist/static/js/` contains async chunk for widget (`index-*.js` ~2.1MB, hash changes when widget version bumps)
   - DevTools Network tab: navigate `/stocks/VNM` → confirm widget chunk loaded (not bundled into main `StockDetailPage` chunk)
   - If widget package upgraded (`package.json` `vninvestcharts-widget` → newer): re-run build, confirm chunk hash changes and no import break

---

## Files Changed Summary

| File | Slices |
|------|--------|
| `pages/StockDetailPage.tsx` | S1, S6, S7, S11 |
| `features/stock-detail/hooks/useStockDetailPageModel.js` | S1 |
| `adapters/chartAdapter.js` | S2, S9 |
| `components/VNStockChartPanel.js` | S3, S4, S5, S8, S9, S10 |
| `features/stock-detail/components/StockDetailHeader.js` | S11 |
| `features/stock-detail/components/StockDetailTabs.js` | S11 |
| `features/stock-detail/components/StockSessionWitness.js` | S11 |
| `features/stock-detail/components/StockContextDeck.js` | S11 |
| `i18n/vi.js` | S11 |
| `i18n/en.js` | S11 |
| `pages/StockDetailPage.css` | S12 |

**Total files:** 11 (plus widget-side if applicable)
