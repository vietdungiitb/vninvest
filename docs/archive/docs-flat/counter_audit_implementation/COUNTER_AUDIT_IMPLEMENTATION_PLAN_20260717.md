# Counter-Audit — Implementation Plan (2026-07-17)

**Source:** `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_AUDIT_20260717.md` (610 lines)
**Auditor scope:** Internal consistency, reference code accuracy, dependency correctness, effort realism

---

## CRITICAL FINDINGS (must fix before handoff)

### C1. S1 Reference Code is WRONG — fake `loadBlocking` implementation

**Plan:** `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_AUDIT_20260717.md:106-120`
**Actual:** `useStockDetailPageModel.js:116-153`

The reference code shows:

```js
const loadBlocking = useCallback(async () => {
  try {
    setState(s => ({ ...s, loadingProfile: true, error: null }));
    const [profile, quote] = await Promise.all([
      coreAdapter.getCompanyProfile(symbol),
      coreAdapter.getRealtimeQuote(symbol),
    ]);
    setState(s => ({ ...s, profile, quote, loadingProfile: false }));
  } catch (err) {
    setState(s => ({ ...s, loadingProfile: false, error: err }));
  }
}, [symbol]);
```

**Problems (5):**

| # | Plan reference | Actual code | Impact |
|---|----------------|-------------|--------|
| 1 | `setState` | `setModelState` | Wrong state setter — won't compile |
| 2 | `getCompanyProfile` + `getRealtimeQuote` | `getStockOverview` + `getStockOrderFlow` + `getSessionFactsCvd` + `getWhaleAnalyticsSnapshot` | Wrong APIs — 4 calls, not 2. OrderFlow/CVD/Whale data lost |
| 3 | No `mountedRef` guard | `if (!mountedRef.current) return;` on lines 129, 144 | State update after unmount → React warning |
| 4 | No `buildEffectiveOrderFlowData` | Line 135-141 — transforms 3 payloads into orderFlowData | orderFlowData never populated → tape panel empty |
| 5 | `adapter` created inline in useEffect | `adapter` at line 114 via `createCoreApiAdapter({ env, getToken: env.getToken })` | Extraction requires `adapter` to be hoisted or recreated — non-trivial refactor |

**A code team following this reference will produce broken code.** The actual extraction requires restructuring `useStockDetailPageModel.js` significantly — not a simple `useCallback` wrap.

**Severity:** BLOCKER — plan cannot be used for S1 without correcting this reference code.

---

### C2. S1 Acceptance Criteria #3 is WRONG — ErrorBoundary cannot catch lazy-load failures

**Plan:** line 66: "Error boundary also catches lazy-load chunk failures (`pageRegistry.js:231` imports `StockDetailPage.tsx`)"

**Actual:** ErrorBoundary wraps content INSIDE `StockDetailPage` component. Lazy-load failure occurs at `pageRegistry.js:231` BEFORE the component renders.

```
pageRegistry.js:231 → import("./StockDetailPage.tsx") → FAILS
  → React shows chunk error boundary (if one exists at router level)
  → StockDetailPage NEVER mounts
  → ErrorBoundary inside StockDetailPage NEVER sees the error
```

**Impact:** The plan claims the fix covers chunk failures — it does NOT. A separate error boundary is needed at `pageRegistry.js` level or router level to catch lazy-load failures.

**Severity:** HIGH — acceptance criteria is incorrect; plan scope may be incomplete.

---

### C3. S3 Reference Code uses wrong variable name

**Plan:** line 223: `locale: language, // from useI18n()`

**Actual:** Global `useI18n()` from `LangContext.js:73-87` returns `{ locale, localeTag, setLanguage, t, ... }` — the property is `locale`, NOT `language`.

The local `useI18n` in `VNStockChartPanel.js:21` returns `{ language: 'vi' }` — which is being replaced.

**Fix:** Reference code should be `locale: locale` (destructured from global `useI18n()`).

**Severity:** MEDIUM — will cause compile error or wrong value if followed literally.

---

### C4. S6 Reference code has undeclared `defaultWatchlistId`

**Plan:** line 322: `await addWatchlistItem(defaultWatchlistId, symbol);`

**Actual:** `defaultWatchlistId` is never defined, sourced from context, or fetched. The reference code will fail with `ReferenceError`.

**Need:** Either:
- Fetch watchlist list from API → find default → use its ID, OR
- Hardcode a default watchlist ID constant, OR
- Add to watchlist context/provider

**Severity:** HIGH — code won't compile.

---

## MEDIUM FINDINGS

### C5. S8 import path `vninvestcharts-widget/adapters` unverified

**Plan:** line 413: `createLocalStorageAdapter` imported from `vninvestcharts-widget/adapters`

**Actual:** Grep for `createLocalStorageAdapter` across entire repo returns 0 matches. The audit report (section 3) lists it as an export from the adapters subpath, but this is desk research from the widget's package — NOT verified in the host app.

**Risk:** If the export doesn't exist or has a different name, S8 will fail at import time.

**Severity:** MEDIUM — needs runtime verification before committing S8.

---

### C6. S11 string count estimate potentially low

**Plan:** Line 503-508 lists approximate strings per component:
- StockDetailHeader: ~30
- StockDetailTabs: ~50
- StockSessionWitness: ~10
- StockContextDeck: ~40
- StockDetailPage: ~15
- Total: ~145

**Actual:** StockDetailHeader is 172 lines with extensive price display logic. Quick scan shows strings like "MãCP", "Giá", "Thay đổi", "%Thay đổi", "Trần", "Sàn", "TC", "Mở cửa", "Cao nhất", "Thấp nhất", "KL TB", "Khối lượng", "Theo dõi", "Đặt lệnh", "Thông báo" — that's ~15 strings in the header alone, but each appears in multiple contexts (labels, tooltips, empty states). ~30 is plausible but tight.

StockDetailTabs at 579 lines with 8 tabs × ~5 labels each = ~40 minimum, plus error states, loading states, empty states. ~50 is plausible.

**Assessment:** Estimates are in the right ballpark but should be verified with `grep -r "\"[A-ZÀ-Ỹ]" src/features/stock-detail/` before committing to 3-4d.

**Severity:** LOW — estimates are reasonable but unverified.

---

## LOW FINDINGS

### C7. S10 dependency graph omits S4

**Plan:** line 25: S10 depends on S2, S3, W-03. Line 464: "onSymbolChange uses SPA navigate (S4 must be done first)"

**Actual:** The dependency graph at line 33-44 does NOT show S4 → S10 dependency. S4 is listed as independent but S10 acceptance criteria #3 explicitly requires S4.

**Fix:** Add S4 to S10's dependency list in priority map (line 25).

**Severity:** LOW — inconsistency between priority map and acceptance criteria.

---

### C8. S9 missing data source for `subscribeToTrades`/`subscribeToOrderbook`

**Plan:** line 429-430: "Implement `subscribeToTrades`, `subscribeToOrderbook`"

**Actual:** No specification of WHERE the trade/orderbook data comes from. Options:
- WebSocket via `useRealtimeFeedFromManager` (already used in `VNStockChartPanel.js:66-69`)
- Polling via API adapter
- Separate endpoint

The plan doesn't specify the data source, which means the code team will have to figure this out during implementation.

**Severity:** LOW — underspecified but not blocking.

---

## SUMMARY

| # | Finding | Severity | Action Required |
|---|---------|----------|-----------------|
| C1 | S1 reference code is fake/wrong (5 errors) | BLOCKER | Rewrite reference code with actual API calls, state setter, mountedRef, buildEffectiveOrderFlowData |
| C2 | S1 AC#3 wrong — ErrorBoundary can't catch lazy-load | HIGH | Either: (a) remove claim, or (b) add scope for pageRegistry-level boundary |
| C3 | S3 reference uses `language` instead of `locale` | MEDIUM | Fix variable name to `locale` |
| C4 | S6 `defaultWatchlistId` undeclared | HIGH | Specify source (API fetch, constant, or context) |
| C5 | S8 `createLocalStorageAdapter` import unverified | MEDIUM | Verify export exists in widget package before committing |
| C6 | S11 string count unverified | LOW | Run string scan before finalizing effort |
| C7 | S10 deps missing S4 | LOW | Add S4 to priority map deps |
| C8 | S9 data source unspecified | LOW | Add data source specification |

**Plan readiness:** 6/10 → **blocked on C1 + C4** (reference code errors will cause wrong implementation). After fixing C1-C4: 8.5/10.
