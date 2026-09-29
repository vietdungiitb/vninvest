# Independent Review: Implementation Plan for Operations Center Fixes

**Reviewer:** AI Agent  
**Date:** July 1, 2026  
**Base Documents:**  
- Audit report: `docs/AUDIT_OPERATIONS_CENTER_UI_UX_AND_TECHNICAL_GAPS_20260701.md`
- Independent review: `docs/AUDIT_REVIEW_INDEPENDENT_20260701.md`
- Proposed plan: user-submitted implementation plan (6 components)

**Methodology:** Each proposed change is evaluated against the actual codebase for correctness, completeness, risk, and edge cases.

---

## Component 1 — DataOps Context: Error Masking

### Proposed Change
Modify `triggerBackfill` to return `{ success: true, runId: string }` or throw/propagate the original API error.

### Review

#### ❌ Ambiguity in Proposed Approach
The plan describes two distinct strategies separated by "or":

1. **Return a result object** (`{ success: true, runId } | { error: string }`)
2. **Throw the error** (let it propagate to the existing outer catch)

These have **different caller implications** and should not be presented as interchangeable options.

#### Recommended Strategy: Throw (Minimal Change)
The caller at `SocDataOpsOperationsSection.tsx:239-253` already has an outer `try-catch`:
```
try {
  const runId = await actions.triggerBackfill(buildPayload());
  if (runId) { ... }
  else { setError(t("soc.dataops.backfill_failed")); }
} catch (err) {
  setError(err instanceof Error ? err.message : t("soc.dataops.backfill_failed"));
}
```

The minimal correct fix is to **remove the `catch {}` in `triggerBackfill`** (DataOpsContext.tsx:L119-121). The error will propagate naturally to the existing catch block, which already calls `setError(err instanceof Error ? err.message : ...)`.

**Changes required:**
- DataOpsContext.tsx: Remove lines 119-121 (empty catch block)
- DataOpsContext.tsx: Update type signature at line 55 — change return type from `Promise<string | null>` to `Promise<string>` (remove `null`). But this breaks the `else` branch in the caller...

Actually, if we remove the catch, the return becomes:
```
const result = await adapter.runSocDataOpsPlanner(payload);
await refreshRuns();
return result.run_id || "";
```

Or better, we can keep the null return but let errors propagate:

```
const triggerBackfill = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    const result = await adapter.runSocDataOpsPlanner(payload);
    await refreshRuns();
    return result.run_id || null;
}, [refreshRuns]);
```

Wait, but if we remove the catch, the function will throw on error. The caller's try-catch will catch it. But then `runId` will never be assigned, so the `if (runId)` check won't execute — execution jumps to the catch block. This is correct behavior.

**But there's a subtlety**: the caller has an `else` branch that was designed to handle the "null return" case. If we let errors throw, the `else { setError(generic) }` branch becomes **dead code** because:
- On success: runId is a string → enters `if` branch
- On error: exception is thrown → enters `catch` branch
- Neither `null` nor empty string is ever returned

This is actually fine — it's cleaner. But we should remove the `else` branch to prevent dead code.

#### Alternative: Discriminated Union (More Explicit)
```
type BackfillResult = { ok: true; runId: string } | { ok: false; error: string };
```

Changes required:
- Update `DataOpsActions.triggerBackfill` return type
- Update `triggerBackfill` implementation
- Update caller: `const result = await actions.triggerBackfill(...); if (result.ok) { ... } else { setError(result.error); }`

This is more type-safe but requires changes in two files. The "throw" approach requires changes in one file (just remove catch).

#### Missing Consideration
The plan does not discuss whether `refreshRuns()` should still be called on error. Currently:
```
try {
  const result = await adapter.runSocDataOpsPlanner(payload);
  await refreshRuns();  // ← called on success
  return result.run_id || null;
} catch {
  return null;  // ← refreshRuns NOT called on error
}
```

With the throw approach, `refreshRuns()` is not called on error, which is correct (no new run to refresh).

### Verdict
✅ **Approved with clarification needed**: Recommend the **throw approach** (minimal change: remove `catch {}` in DataOpsContext.tsx). Remove the dead `else` branch in the caller. Update the `null` part of the return type to `never` or keep as-is if preferred.

---

## Component 2 — Config Textarea Editors: Clear/Reset Block

### Proposed Change
1. Initialize `editConfig` inside `fetchData` via `setEditConfig(JSON.stringify(config || {}, null, 2))`
2. Bind value as `value: editConfig` (remove the `||` fallback)

### Review

#### ✅ Correct Diagnosis
The `value: editConfig || JSON.stringify(config || {}, null, 2)` pattern is the confirmed root cause across all 4 files.

#### ⚠️ Incomplete Assessment — Partial Fix Exists
`SocDataOpsConfigSection.tsx:111` **already** initializes `editConfig` inside the fetch:
```
setEditConfig(JSON.stringify(envelopeData.config || {}, null, 2));
```
The remaining bug in this file is only the fallback at line 215 (`value: editConfig || JSON.stringify(envelope?.config || {}, null, 2)`). The other 3 files have neither initialization nor correct binding.

#### Complete Fix Per File
| File | Step 1: Init in fetchData | Step 2: Remove `||` fallback |
|---|---|---|
| `SocScreenerPanel.tsx` | Add after line 78 `setConfig(cfg)` | Change line 180 |
| `SocPrefetchPanel.tsx` | Add after line 53 `setConfig(cfg)` | Change line 186 |
| `SocVnbrokerPanel.tsx` | Add after line 83 `setConfig(cfg)` | Change line 181 |
| `SocDataOpsConfigSection.tsx` | Already done at line 111 | Change line 215 |

#### Edge Cases
1. **Initial render before fetchData completes**: With `value: editConfig` (where `editConfig = ""`), the textarea will be empty. After fetch, it populates. This is acceptable behavior — better than showing a misleading default.
2. **User clears textarea → saves `{}`**: Will work correctly now — `editConfig = ""` is preserved, and `JSON.parse("")` will throw, which is caught by existing error handling.
3. **Reset/Clear buttons**: These call `setEditConfig(JSON.stringify(config || {}, null, 2))` — they pass a non-empty string, so they will continue to work.

### Verdict
✅ **Approved with specific instructions**: Each file needs different treatment. Add explicit `setEditConfig(JSON.stringify(...))` call inside each fetchData's success handler. Remove the `||` fallback from value binding.

---

## Component 3 — Overlays: Clipping & Z-Index

### Proposed Change
Wrap `JobHistoryDrawer` and CustomGroupManager drawer in `createPortal(..., document.body)`.

### Review

#### ✅ Import Already Present in One File
`SocSchedulerBoard.tsx:2`: `import { createPortal } from "react-dom";` — already imported, but only used for `ActionConfirmModal` (L922). The `JobHistoryDrawer` at L934 does not use it.

#### ⚠️ CustomGroupManager Portal Shape
The CustomGroupManager drawer in `SocDataOpsOperationsSection.tsx:849-874` is structured as:
```
createElement("div", null,      // ← wrapper
  createElement("div", {className: styles.drawerOverlay}, ...),
  createElement("div", {className: styles.drawerContent}, ...)
)
```

When portaling, the `drawerOverlay` + `drawerContent` pair should be portaled together as a single unit:
```
createPortal(
  createElement("div", { style: { position: "fixed", inset: 0, zIndex: 9999 } },
    createElement("div", { className: styles.drawerOverlay, onClick: ... }),
    createElement("div", { className: styles.drawerContent, ... }, ...)
  ),
  document.body
)
```

The **wrapper div** can be removed since portaling to body eliminates the need for a local container.

#### Missing: SocSchedulerBoard.tsx Inconsistency
The review document noted that `ActionConfirmModal` already uses portal but `JobHistoryDrawer` does not — in the same file. This should be highlighted in the plan as it proves the portal pattern is known but inconsistently applied.

#### Risk: SSR/SSG
`document.body` is not available during server-side rendering. If this code is ever rendered on the server, `typeof document !== "undefined"` guards are needed. The current codebase is CSR (client-side rendering based on the existing patterns), but the plan should mention this guard for future-proofing.

### Verdict
✅ **Approved** — Low-risk change. `SocSchedulerBoard.tsx` already has the import. `SocDataOpsOperationsSection.tsx` needs the new import. Consider SSR guard for future-proofing.

---

## Component 4 — Screener i18n Typos & Missing Keys

### Proposed Change
- Fix `soc.screenter` → `soc.screener`
- Replace `symbols_required` → `scan_symbols_required`
- Replace `scan_started` → `scan_queued` or add new key

### Review

#### ✅ Both Correct Keys Already Exist
Verified in `vi.js` and `en.js`:
| Key | vi.js | en.js |
|---|---|---|
| `soc.screener.scan_symbols_required` | Line 761 | Line 766 |
| `soc.screener.scan_queued` | Line 760 | Line 765 |

No new translation keys need to be added. The plan's suggestion "or add a new translation key" for `scan_started` is unnecessary — `scan_queued` already exists and is semantically correct.

#### Exact Code Changes
`SocScreenerPanel.tsx`:
- Line 121: `t("soc.screenter.symbols_required")` → `t("soc.screener.scan_symbols_required")`
- Line 129: `t("soc.screener.scan_started")` → `t("soc.screener.scan_queued")`

#### Residual i18n Risk
The `t()` function returns `string` type regardless of key validity. TypeScript will not catch these errors. The project should consider adding an i18n key validation step (either runtime check during development or a lint plugin) to prevent similar regressions.

### Verdict
✅ **Approved** — Mechanical, low-risk. Exact key replacements determined. Remove "or add new key" option from the plan since keys already exist.

---

## Component 5 — Queue Tiers: Silent Failure

### Proposed Change
- Add `queueTiersError` state
- Populate error in `.catch()`
- Render `styles.inlineError`

### Review

#### ✅ Correct Approach
The component at `SocDataInventorySection.tsx:34-46` needs:
1. New state: `const [queueTiersError, setQueueTiersError] = useState("");`
2. Set error in catch: `.catch((err) => { setQueueTiersError(err instanceof Error ? err.message : "Failed to load queue tiers."); })`
3. Clear error on success: `setQueueTiersError("");`
4. Render banner: add `queueTiersError ? createElement("div", { className: styles.inlineError }, queueTiersError) : null` in JSX

#### ⚠️ Error Lifetime Consideration Not Addressed
The current `useEffect` at lines 34-46 has dependency `[]` (runs once on mount). This means:
- If the API fails, the error banner shows permanently
- There is no retry mechanism
- The error will not be dismissed unless the component unmounts and remounts

The plan should either:
a) Accept this as acceptable (error persists until page refresh), or
b) Add a dismiss/retry button alongside the error banner

#### Guard Logic Issue
Line 35: `if (!queueTiersLoading && queueTiers.length === 0)` — this guard prevents re-fetching if we already have data. But it also means: if the first fetch fails and `queueTiers` stays `[]`, the error will not auto-retry even if conditions change. The guard should be updated to allow retry when an error exists:
```
if (!queueTiersLoading && queueTiers.length === 0 && !queueTiersError) {
```

Or more robustly:
```
useEffect(() => {
  if (!queueTiersLoading) {
    fetchQueueTiers();
  }
}, []);
```

But this is an enhancement, not a bugfix. The minimal fix is acceptable for the Medium/High severity issue.

### Verdict
✅ **Approved** — Low-risk, contained change. Add `queueTiersError` state and render banner. Consider adding retry logic and updating the guard condition.

---

## Component 6 — Code Convention: JSX → createElement

### Proposed Change
Complete mechanical refactoring of `ShellMailConfigPage.tsx` from JSX to pure `React.createElement`.

### Review

#### ⚠️ High-Risk, Low-Reward Change
This is the most risky change in the plan for the least user-facing benefit:

| Factor | Assessment |
|---|---|
| **Lines affected** | 603 lines (entire file) |
| **Runtime behavior change** | Zero — purely syntactic |
| **User impact** | None |
| **Bug risk during conversion** | High (missing `key` props, incorrect children, wrong prop spreading) |
| **Testing coverage** | Unknown — no unit tests evident for this page |

#### Specific Risks
1. **`key` props on array children**: JSX automatically handles keys — createElement does not. All `.map(...)` calls in JSX produce array children that must have explicit `key` props when converted.
2. **`Fragment` usage**: Line 1 imports `Fragment`. In createElement, fragments are expressed as `createElement(Fragment, null, ...children)`. The conversion must not drop the import.
3. **Boolean attribute handling**: JSX attributes like `disabled={formLoading}` convert to `createElement("button", { disabled: formLoading, ... })` — React handles boolean coercion automatically for `disabled`, `checked`, etc. Correct in createElement.
4. **Event handlers**: JSX `onClick={handleCloseModal}` converts to `createElement("button", { onClick: handleCloseModal, ... })` — straightforward.

#### Alternative Strategy
Consider a **two-phase approach**:
- Phase 1 (now): Only fix the literal strings that trigger `react/jsx-no-literals`. Wrap string literals in JSX with a helper or use template strings.
- Phase 2 (later): Full createElement migration when there's a stronger reason.

However, since the project AGENTS.md explicitly requires "Pure createElement pattern (không JSX)", the full migration is necessary.

#### Recommended Safeguards
1. Perform the migration as a **separate commit** with zero logic changes
2. Review every `.map()` callback for missing `key` props
3. Verify that `Fragment` is properly handled (both named import and `createElement(Fragment, ...)` calls)
4. Pay special attention to ternary expressions inside JSX children — in createElement, conditional children must use ternary or `&&` at the value position, not as child siblings

### Verdict
⚠️ **Approved with conditions**: High-risk change. Must be done as a separate, reviewable commit. Verify with `npx tsc --noEmit` AND `npm run build` AND visual smoke test. Consider two-phase approach if risk tolerance is low.

---

## Verification Plan Review

### Proposed Checks
| Check | Command | Coverage |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Type errors, import errors |
| Unit tests | `npm run test` | Regression in test suite |
| Build | `npm run build` | Bundle integrity |

### Gaps

#### Missing: Lint Check
The plan should include `npx eslint packages/web/src/components/soc/` (or the project's lint command) to verify:
- `react/jsx-no-literals` is clean (Component 6)
- No new lint violations introduced

#### Missing: i18n Key Validation
Component 4 (i18n) and any other `t()` calls are not validated by TypeScript or lint. Consider running a grep-based check:
```
rg "t\(\"soc\.\w+" packages/web/src/ | grep -v -f known-keys.txt
```
Or manually spot-check the affected translation keys after changes.

#### Missing: Component-Specific Smoke Test Guidance
For a complex UI like the Operations Center, the plan should recommend a basic visual smoke test:
1. Open each tab (Inventory, Backfill, Scheduler, Screener, Prefetch, VnBroker)
2. Test config editor: clear textarea, save empty `{}`, reload
3. Test backfill form: submit without reason, with invalid date, with missing symbols
4. Test scheduler: open history drawer, confirm modal positioning

### Verdict
⚠️ **Strengthen verification**: Add lint check and i18n key validation. Add manual smoke test checklist for Components 1-5 (Component 6 is syntactic only).

---

## Cross-Cutting Concerns

### 1. Test Coverage
None of the affected files have obvious unit tests. The verification plan relies on `npm run test` but it's unclear which tests actually cover these components. Consider adding at least:
- A test for `triggerBackfill` error propagation (Component 1)
- A test for config editor empty state behavior (Component 2)

### 2. Regression Risk per Component
| Component | Risk Level | Mitigation |
|---|---|---|
| C1 (Error Masking) | Low — changes are additive (removing a catch) | Ensure backfill still works on happy path |
| C2 (Config Editor) | Low — well-understood change | Verify save empty config, save valid config, reload |
| C3 (Overlays) | Low — familiar React pattern | Verify drawer opens/closes, verify overlay covers full viewport |
| C4 (i18n) | Minimal — key string changes | Verify no `alert(undefined)` |
| C5 (Queue Tiers) | Low — additive error state | Trigger mock failure, verify banner appears |
| C6 (JSX → createElement) | **High** — entire file rewrite | Separate commit, full visual regression check |

### 3. Execution Order
Recommended order by risk (lowest first):
1. C4 (i18n) — 2 line changes, zero risk
2. C5 (Queue Tiers) — contained, new state only
3. C2 (Config Editors) — well-understood, 4 similar changes
4. C3 (Overlays) — familiar portal pattern
5. C1 (Error Masking) — requires decision on throw vs. result object
6. C6 (JSX → createElement) — highest risk, last

---

## Final Recommendation

**Proceed with all 6 components** after resolving the ambiguities noted above:

| Component | Status | Notes |
|---|---|---|
| C1 | ✅ **Proceed** (clarify throw vs. result) | Recommend throw strategy |
| C2 | ✅ **Proceed** | Specify exact per-file changes |
| C3 | ✅ **Proceed** | Add SSR guard consideration |
| C4 | ✅ **Proceed** | Exact key replacements known; no new keys needed |
| C5 | ✅ **Proceed** | Add retry mechanism discussion |
| C6 | ⚠️ **Proceed with caution** | Separate commit; full regression check |

**Strengthen verification** to include lint check and manual smoke test.
