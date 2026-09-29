# Independent Audit Review: Operations Center Findings

**Reviewer:** AI Agent  
**Date:** July 1, 2026  
**Methodology:** Verbatim codebase inspection of all referenced files, i18n registry (vi.js + en.js), and cross-file call chain tracing.  
**Status:** Each finding rated on two axes: **Accuracy** (does the evidence support the claim?) and **Severity** (is the business impact correctly assessed?).

---

## Finding 1 — Error Masking in Backfill Action

**Rating:** ✅ **CONFIRMED — Accuracy: Correct, Severity: Accurate (Critical)**

### Evidence
`DataOpsContext.tsx:114-122`:
```
catch { return null; }
```
- No error parameter, no logging, always returns `null`.
- Caller at `SocDataOpsOperationsSection.tsx:239-253` wraps the call in a `try-catch`, but this outer `catch` is **unreachable** because `triggerBackfill` never throws — it always returns `null` on any failure.

### Nuance Noted
The `backfill_queued_with_run` i18n key **does exist** (vi.js:502, en.js:502). The success path will work correctly when the API succeeds. The problem is exclusively on the error path: the caller can only ever display `t("soc.dataops.backfill_failed")` → `"Backfill thất bại."` regardless of what actually went wrong.

### Additional Risk
The same swallowing pattern appears in `refreshInventory` (L86), `refreshRuns` (L97), and `refreshCoverage` (L108) — but those are less critical since their consumers have independent error handling. `triggerBackfill` is unique: the consumer **cannot** retroactively recover the error.

---

## Finding 2 — Config Editor Clear/Reset Block

**Rating:** ✅ **CONFIRMED — Accuracy: Correct, Severity: Accurate (High)**

### Evidence
Four files use the identical pattern:
- `SocScreenerPanel.tsx:180`
- `SocPrefetchPanel.tsx:186`
- `SocVnbrokerPanel.tsx:181`
- `SocDataOpsConfigSection.tsx:215`

```
value: editConfig || JSON.stringify(config || {}, null, 2)
```

### Nuance Noted
The root cause is a `useState("")` initialization in all four files. When `fetchData` completes, `editConfig` remains `""`. The `||` operator coerces `""` (falsy) to the fallback. The fix requires initializing `editConfig` inside the `fetchData`/`useEffect` resolver, e.g.:
```
setEditConfig(JSON.stringify(cfg || {}, null, 2));
```
`SocDataOpsConfigSection.tsx:111` already does this correctly — it sets `editConfig` inside the fetch. This means the bug only manifests in the **initial render** before data loads, AND when a user clears the input and the component re-renders before the next fetch.

### Additional Observation
The `handleEditConfig()` / reset-to-default buttons in all four panels explicitly call `setEditConfig(JSON.stringify(config || {}, null, 2))`. This works because it passes a **non-empty string**. The bug only triggers when the user manually deletes all text, making `editConfig = ""`.

---

## Finding 3 — Overlay Clipping & Z-Index Containment Risks

**Rating:** ⚠️ **PARTIALLY CONFIRMED — Accuracy: Partially correct, Severity: Slightly overstated**

### Evidence
- `SocSchedulerBoard.tsx:934` — `createElement(JobHistoryDrawer, ...)` WITHOUT `createPortal`.
- `SocDataOpsOperationsSection.tsx:849-874` — CustomGroupManager drawer WITHOUT `createPortal`.

### Counter-Nuance
The **same file** (`SocSchedulerBoard.tsx:922`) correctly uses `createPortal` for `ActionConfirmModal`:
```
createPortal(createElement(ActionConfirmModal, ...), document.body)
```

This inconsistency is actually **more concerning** than the original report states — it proves the developer knew about the portal pattern for overlays but did not apply it consistently.

### Severity Assessment
The severity should remain **High** because:
- If either drawer is ever rendered inside a parent with `position: relative; overflow: hidden`, the drawer **will** break.
- The `JobHistoryDrawer` contains its own overlay (`drawerOverlay`) and content panel, making it a full-screen modal — exactly the use case that demands a portal.
- The CustomGroupManager drawer in `SocDataOpsOperationsSection.tsx` is rendered inside a flex column layout — a future parent style change could silently break it.

---

## Finding 4 — Screener Panel Typo & Missing Keys

**Rating:** ✅ **CONFIRMED — Accuracy: Correct, Severity: Accurate (Medium)**

### Verbatim Verification
| Code | i18n key used | Actual key in vi.js | Actual key in en.js |
|---|---|---|---|
| L121 | `soc.screenter.symbols_required` | **Does not exist** (typo: `screenter`) | **Does not exist** |
| L129 | `soc.screener.scan_started` | **Does not exist** | **Does not exist** |

### Correct Keys
| Expected meaning | Actual key in both files |
|---|---|
| "Enter at least one symbol" | `soc.screener.scan_symbols_required` (vi.js:761, en.js:766) |
| "Scan queued" | `soc.screener.scan_queued` (vi.js:760, en.js:765) |

### Impact
- L121: `alert(undefined)` → user sees "undefined" in the alert dialog.
- L129: `alert(undefined)` → user sees "undefined" in the alert dialog after a successful scan.

Both cases produce silent user-facing regressions that degrade to "undefined" rather than showing a meaningful message.

---

## Finding 5 — Silent Failure in Queue Tiers Loading

**Rating:** ✅ **CONFIRMED — Accuracy: Correct, Severity: Slightly understated**

### Evidence
`SocDataInventorySection.tsx:42-44`:
```
.catch(() => {
    // Silently fail
})
```

### Additional Observation
This pattern is **worse** than the original report states because:
1. There is no `queueTiersError` state variable at all (line 22-28 confirms only `queueTiers`, `queueTiersExpanded`, `queueTiersLoading`).
2. The `queueTiersLoading` state is never exposed to the template — the render only checks `queueTiers.length > 0` to decide whether to show the accordion section.
3. An API failure and a genuine "no tiers configured" response produce **identical output**: an empty section with no explanatory text.

### Recommended Severity: Medium → **High**
The queue tiers accordion is a key UI element that administrators depend on to understand data pipeline health. Silent failure here means ops engineers cannot distinguish between "no tiers configured" (normal in staging) and "API unavailable" (critical in production).

---

## Finding 6 — Code Convention Violation in Mailing Config

**Rating:** ✅ **CONFIRMED — Accuracy: Correct, Severity: Accurate (Low)**

### Evidence
`ShellMailConfigPage.tsx` is the **only** admin page under `packages/web/src/pages/admin/` that uses raw JSX syntax. Every other page (`ShellOperationsCenterPage.tsx`, `AdminCoreUsagePage.tsx`, etc.) uses pure `React.createElement`.

### Verification
- `ShellOperationsCenterPage.tsx`: `import { createElement, useState, useCallback } from "react";` — consistent createElement usage throughout.
- `ShellMailConfigPage.tsx`: JSX `<ShellPageChrome>`, `<div>`, `{configs.map(...)}`, `{modalOverlay}` — full JSX throughout.

### Severity Assessment
This is a **housekeeping issue** but not a runtime bug. The `react/jsx-no-literals` lint rule will fail on literal strings in JSX attributes, but the code compiles and runs correctly. The fix is mechanical (JSX → createElement) with low risk.

---

## Summary Table

| # | Finding | Rating | Original Severity | Suggested |
|---|---|---|---|---|
| 1 | Error Masking in Backfill | ✅ CONFIRMED | 🚨 Critical | Critical |
| 2 | Config Editor Clear/Reset | ✅ CONFIRMED | 🔴 High | High |
| 3 | Overlay Clipping | ⚠️ PARTIALLY CONFIRMED | 🔴 High | High (with nuance) |
| 4 | Screener i18n Typo | ✅ CONFIRMED | 🟡 Medium | Medium |
| 5 | Queue Tiers Silent Failure | ✅ CONFIRMED | 🟡 Medium | **🟠 High** (see note) |
| 6 | Mail Config Convention | ✅ CONFIRMED | 🟢 Low | Low |

### Cross-File Issues Discovered During Review

1. **Inconsistent portal usage in `SocSchedulerBoard.tsx`:** `ActionConfirmModal` (L922) uses `createPortal`, `JobHistoryDrawer` (L934) does not — in the same component tree. This indicates an oversight rather than a deliberate choice.

2. **`SocDataOpsConfigSection.tsx` already has partial fix for Finding 2:** Line 111 runs `setEditConfig(JSON.stringify(envelopeData.config || {}, null, 2))` inside the fetch, which is the correct approach. The bug only manifests on initial mount or if the user clears the textarea. The other three panels (Screener, Prefetch, VnBroker) do **not** have this initialization and are fully affected.

3. **`shellPage__` CSS class dependency in `ShellMailConfigPage.tsx`:** The JSX uses ShellPageTemplate component classes (`shellPage__list`, `shellPage__button`, etc.) rather than CSS modules (`soc.module.css`). This may cause style regressions if the ShellPageTemplate styles are refactored.
