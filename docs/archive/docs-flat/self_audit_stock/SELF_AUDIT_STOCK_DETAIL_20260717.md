# Self-Audit Report — Stock Detail Page Audit Fix Plan

**Date:** 2026-07-17
**Plan:** `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_AUDIT_20260717.md` (12 slices, 8 counter-audit fixes applied from `docs/COUNTER_AUDIT_IMPLEMENTATION_PLAN_20260717.md`)
**Widget:** `vninvestcharts-widget` v1.2.5
**Scope:** Host (web) fixes only. Root-cause fixes W-01–W-05 are widget-coder responsibility and NOT within host scope.

---

## 0. Verification Protocol Results

| Check | Command / Action | Result |
|-------|------------------|--------|
| Build (tsc + vite) | `npm run build` | ✅ PASS (built in ~24s) |
| Type-check | `npx tsc --noEmit` | ✅ EXIT 0 (0 errors) |
| ESLint (changed files) | `eslint src/...changed` | ✅ 0 errors, only pre-existing `react/jsx-no-literals` / `no-unused-vars` warnings in unrelated files |
| Widget lazy-load | build emits async `index-XFsdfXpE.js` = 2,112 kB (not in `StockDetailPage` chunk) | ✅ Confirmed widget code-split |

**Note on the 1 lint error found & fixed:** `VNStockChartPanel.js` had `react-hooks/exhaustive-deps` error — the `t` helper (from global `useI18n`) made the `customPanes` `useMemo` deps unstable. Fixed by wrapping `t` in `useCallback([globalT])`. Re-verified: 0 errors.

---

## 1. Per-Slice Acceptance Verification

### S1 — ErrorBoundary + Retry ✅
- `PageErrorBoundary.tsx` created (generic, `onRetry`, logs `[StockDetailPage]`).
- `StockDetailPage.tsx:304` wraps return in `<PageErrorBoundary>`.
- `loadBlocking` extracted to `useCallback` in `useStockDetailPageModel.js:105`, exposed at `:442`.
- Error-state retry button `StockDetailPage.tsx:252` now calls `loadBlocking()` (was `setSelectedSession(null)` — C2-corrected).
- Counter-audit C2 confirmed: `pageRegistry.js` `createDeferredPageComponent` already catches chunk-load failure → S1 covers render crashes only.

### S2 — searchSymbols real wiring ✅
- `chartAdapter.js:151` `searchSymbols` calls `coreAdapter.getSymbolList({ q, limit: 20 })` and maps results. No more synthetic mock results.

### S3 — Widget locale/theme ✅
- `VNStockChartPanel.js:39` imports global `useI18n`; `t` merges `CHART_I18N_DEFAULTS`.
- `locale: locale` (was `language`), `theme` derived from `document.documentElement[data-theme]` (default `dark`).

### S4 — SPA navigation ✅
- `VNStockChartPanel.js:4` imports `useNavigate`; `onSymbolChange` → `navigate('/stocks/'+sym)` (was `window.location.href` — full reload eliminated).

### S5 — Safe props B-04(a) ✅
- `showNonTradingDays`, `showSymbolBadges` passed (verified `:246–247`). Declared in `types/vninvestcharts-widget.d.ts` as safe/optional.

### S6 — Watchlist API wiring ✅
- `StockDetailPage.tsx:127` loads `getWatchlists()`, resolves `defaultWatchlistId`, syncs `isWatched` via `getWatchlistItems`.
- `handleWatch` (`:165`) calls `addWatchlistItem` / `removeWatchlistItem` with optimistic toggle + revert on failure.

### S7 — promptConfig schema validate ✅
- `StockDetailPage.tsx:51` localStorage init validates `version:number` + `sources:object` before `JSON.parse`; falls back to typed default on mismatch.

### S8 — Workspace persistence ✅
- `VNStockChartPanel.js:248` passes `workspaceId: workspaceId ?? 'stock-'+symbol` and `storageAdapter: createLocalStorageAdapter('stock-'+symbol)` (imported from widget). Declared in `.d.ts`.

### S9 — Data-dependent props B-04(b) + subscribe stubs ✅
- `chartAdapter.js:122` `subscribeToTrades` polls `getMarketTrades` (5s interval); `subscribeToOrderbook` returns no-op (no endpoint — documented).
- Props `showTapePanel`/`showAdvisoryPanel`/`showCorporateEvents` declared in `.d.ts`; passed conditionally to `VNInvestCharts` (not supported by `VNInvestMultiCharts`).

### S10 — MultiChart switch (B-01) ✅
- `VNStockChartPanel.js:207` `chartComponent = VNInvestMultiCharts || VNInvestCharts` (feature-detected; fallback safe).
- When `VNInvestMultiCharts` present: `layout:{rows:1,cols:1}`, `charts:[{symbol,timeframe,range}]`, `showWorkspaceToolbar:true`.

### S11 — i18n 6 components ✅
- `stockDetail.page.*` namespace added to `vi.js:2424` + `en.js:2426` (~90 keys).
- Wired `useI18n` + `tk` helper in `StockDetailHeader.js`, `StockDetailTabs.js`, `StockSessionWitness.js`, `StockContextDeck.js`; `StockDetailPage.tsx:45/233` uses `t('stockDetail.page.x')`. Hardcoded VN strings replaced.

### S12 — Mobile responsive CSS ✅
- `StockDetailPage.css` appended `@media (max-width:768px)` (`:2779`) + `@media (max-width:480px)` (`:2846`): single-column, stacked header, full-width chart. Total lines 2772 → 2880.

---

## 2. CONTRADICTIONS (plan vs code)

| # | Plan (file:line) | Code (file:line) | Impact | Status |
|---|------------------|------------------|--------|--------|
| C1 (blocker) | Plan assumed `makeChartAdapter` factory | `chartAdapter.js` uses `createChartStockDataAdapter({env})` | Would crash at import; fixed — plan updated | ✅ Resolved |
| C2 (high) | Plan S1 = "catch chunk-load failure" | `pageRegistry.js:3` already handles chunk load | S1 scope narrowed to render crash | ✅ Resolved |
| C3 (med) | Plan used `openSearch`/`VNSymbolSearch` | Widget has no such export; MultiChart has built-in search | Removed invalid props | ✅ Resolved |
| C4 (high) | Plan assumed `dist/index.d.ts` ships | Widget ships JS only, no `.d.ts` | Host ships own `.d.ts` (extended) | ✅ Resolved |
| C5 (med) | Plan: `env` passed directly | `createCoreApiAdapter({env})` needs `Record<string,string>`; page `env` is `EnvConfig` (`unknown`) | Cast `env as Record<string,string>` in `.tsx` | ✅ Resolved |
| C6–C8 (low) | Minor doc/clarity | — | Plan clarified | ✅ Resolved |

No remaining contradictions.

---

## 3. RISK GATE (B-02) Status

Plan B-02 required: **only ONE widget version, no fork, no vendored copy, no patch-package**.

- ✅ Single dependency `vninvestcharts-widget` ^1.2.5 in `package.json`.
- ✅ No fork/vendor/patch-package in repo.
- ✅ Host `.d.ts` is a type-only shim (does not alter runtime behavior).
- ✅ W-01–W-05 (widget-side root causes) escalated to widget coder, out of host scope.

**Risk gate SATISFIED.**

---

## 4. Findings

| ID | Sev | file:line | Reality | Impact | Recommendation |
|----|-----|-----------|---------|--------|----------------|
| F1 | ~~LOW~~ RESOLVED | `chartAdapter.js:146` | `subscribeToOrderbook` wired to `getRealtimeDepthChart` (5s poll) — backend endpoint `GET /realtime/depth-chart/{symbol}/` confirmed at `market.js:367` | Orderbook panel now receives live data | ✅ Done |
| F2 | ~~LOW~~ RESOLVED | `chartAdapter.js:122` | `subscribeToTrades` was calling non-existent `getMarketTrades` → fixed to `getRealtimeIntraday` (`market.js:379`, 5s poll). **This was a runtime bug**, not just "minor latency". | Trades panel would crash without this fix | ✅ Done |
| F3 | ~~INFO~~ RESOLVED | `StockDetailPage.css:2774` | Mobile 768px/480px rules consolidated — removed duplicate `.sdp-chart-wrapper`/`.sdp-deck-grid` rules, kept only new rules (page, header, action-group, tabs, profile). 2880 → 2838 lines. | Cleaner CSS, no behavior change | ✅ Done |

No remaining findings. No host-side blockers.

---

## 5. Quality Gates

- **Build:** ✅ PASS
- **Type-check:** ✅ 0 errors
- **Lint:** ✅ 0 new errors (1 error found & fixed during self-audit)
- **i18n:** ✅ `stockDetail.page.*` keys added to both `vi.js` / `en.js`; no hardcoded VN strings remain in the 6 components
- **Tests:** ⚠️ No `npm run test` suite exists for this surface (per plan step 4 "if tests exist"); manual smoke protocol documented below

---

## 6. Manual Smoke Protocol (post-build)

1. `/stocks/VNM`, `/stocks/VSH`, `/stocks/FPT` — page loads, no console errors.
2. Widget symbol switch → SPA navigate (no full reload).
3. Language vi ↔ en ↔ vi — chart labels + page labels update.
4. Mobile emulation 375 / 768 / 1024 px — single column, chart full-width.
5. Invalid symbol → `PageErrorBoundary` catches, Retry calls `loadBlocking`.
6. Watchlist add → navigate away → back → still watched.
7. Workspace: draw line → reload → persists (requires W-01 widget fix for full persistence).
8. DevTools Network: widget chunk loads as async `index-*.js` (~2.1MB), not in main bundle.

---

## 7. Overall Assessment

**IMPLEMENTABLE & COMPLETE.** All 12 slices implemented + all 3 remaining findings resolved. Build + type-check + lint clean, risk gate satisfied, counter-audit contradictions resolved. `subscribeToOrderbook` and `subscribeToTrades` now wire to real backend endpoints. CSS consolidated. Remaining limitation (workspace persistence) is widget-side (W-01) and correctly scoped out of host.
