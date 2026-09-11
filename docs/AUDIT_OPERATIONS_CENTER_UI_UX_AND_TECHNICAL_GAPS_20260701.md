# Audit Report: Operations Center UI/UX & Technical Gaps

**Auditor:** Antigravity AI
**Date:** July 1, 2026
**Target Component:** Operations Center (`operations-center` shell interface and sub-tab panels)
**Status:** COMPLETE (No speculation, verified directly against actual codebase surface)

---

## Executive Summary
This audit inspects the React-based Operations Center interface under `packages/web/src/components/soc` and `packages/web/src/pages/admin`. Key findings reveal critical error-masking behaviors in asynchronous actions, configuration clear/reset bugs in user input components, i18n translation key typos, clipping risks in overlay elements, and a violation of the pure `React.createElement` convention in the mailing module.

---

## Summary of Findings

| Severity | Category | Target File / Component | Short Description |
|---|---|---|---|
| 🚨 **Critical** | Functional / API | [DataOpsContext.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/DataOpsContext.tsx#L114-L122) | Error masking during backfill trigger; generic error replaces specific API failures. |
| 🔴 **High** | UI / UX | Configuration textareas: [Screener](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocScreenerPanel.tsx#L180), [Prefetch](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocPrefetchPanel.tsx#L186), [VnBroker](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L181), [DataOps](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataOpsConfigSection.tsx#L215) | Logical OR fallback prevents users from clearing the editor or setting an empty configuration. |
| 🔴 **High** | UI / UX / Layout | [SocDataOpsOperationsSection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataOpsOperationsSection.tsx#L849), [SocSchedulerBoard.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocSchedulerBoard.tsx#L934) | Overlay drawer/dialog rendered inline, causing clipping and z-index issues under containment layout contexts. |
| 🟡 **Medium** | Functional / UX | [SocScreenerPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocScreenerPanel.tsx#L121) | Typos and missing translation keys (`soc.screenter` and `scan_started` do not exist). |
| 🟡 **Medium** | Functional / UX | [SocDataInventorySection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataInventorySection.tsx#L34-L46) | Silent failure of queue tiers loading without alert banner or error state feedback. |
| 🟢 **Low** | Code Convention | [ShellMailConfigPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/admin/ShellMailConfigPage.tsx) | Raw JSX usage violating the codebase-wide "pure createElement pattern" constraint. |

---

## Detailed Audit Results & Code Proofs

### 1. [Critical] Error Masking in Backfill Action
* **File:** [DataOpsContext.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/DataOpsContext.tsx#L114-L122)
* **Code Proof:**
  ```typescript
  const triggerBackfill = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    try {
      const result = await adapter.runSocDataOpsPlanner(payload);
      await refreshRuns();
      return result.run_id || null;
    } catch {
      return null;
    }
  }, [refreshRuns]);
  ```
* **Implication:** The `catch` block catches all API failures (e.g. `403 Forbidden`, validation errors, rate limits) and returns `null`. In [SocDataOpsOperationsSection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataOpsOperationsSection.tsx#L238-L253), this masks the error completely, returning a generic message:
  ```typescript
  const runId = await actions.triggerBackfill(buildPayload());
  if (runId) {
    setSuccess(t("soc.dataops.backfill_queued_with_run", { run_id: runId }));
  } else {
    setError(t("soc.dataops.backfill_failed")); // Generic fallback always shown on failure
  }
  ```
* **Resolution Plan:** Modify `triggerBackfill` to propagate exceptions or return a union type `{ runId: string } | { error: string }` so the operation panel can display the actual server response.

---

### 2. [High] Config Editor Clear/Reset Block
* **Files:**
  * [SocScreenerPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocScreenerPanel.tsx#L180)
  * [SocPrefetchPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocPrefetchPanel.tsx#L186)
  * [SocVnbrokerPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocVnbrokerPanel.tsx#L181)
  * [SocDataOpsConfigSection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataOpsConfigSection.tsx#L215)
* **Code Proof:**
  ```typescript
  createElement(
    "textarea",
    {
      value: editConfig || JSON.stringify(config || {}, null, 2),
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
      ...
    }
  )
  ```
* **Implication:** If a user clears the editor textarea (making `editConfig` an empty string `""`), the logical OR `||` evaluates to falsy and falls back to showing the original stringified `config`. The user is completely blocked from clearing the config editor or entering `{}`.
* **Resolution Plan:**
  1. Initialize `editConfig` with the stringified config value in a `useEffect` or inside the `fetchData` resolver.
  2. Bind the textarea value directly: `value: editConfig`.

---

### 3. [High] Overlay Clipping and Z-Index Risks
* **Files:**
  * [SocDataOpsOperationsSection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataOpsOperationsSection.tsx#L849) (Custom Group Manager Drawer)
  * [SocSchedulerBoard.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocSchedulerBoard.tsx#L934) (History Drawer)
* **Code Proof:**
  ```typescript
  historyJob && createElement(JobHistoryDrawer, {
    jobKey: historyJob,
    onClose: () => setHistoryJob(null),
    t
  })
  ```
* **Implication:** The drawers are rendered inline inside local flex/grid wrappers. If the parent layout uses `position: relative`, `overflow: hidden`, or custom layout boundaries, the overlays will clip or fail to stretch across the full viewport.
* **Resolution Plan:** Wrap drawer components in React `createPortal(..., document.body)` with appropriate `typeof document !== "undefined"` safety guards.

---

### 4. [Medium] Typo and Missing i18n Keys in Screener Panel
* **File:** [SocScreenerPanel.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocScreenerPanel.tsx#L121)
* **Code Proof:**
  ```typescript
  if (!manualSymbols.trim()) {
    alert(t("soc.screenter.symbols_required")); // Typo: 'screenter'
    return;
  }
  ...
  alert(t("soc.screener.scan_started")); // Missing key: 'scan_started'
  ```
* **Implication:**
  1. `"soc.screenter"` is a typo (`screenter` with an extra `t`).
  2. `"symbols_required"` is not in `vi.js` or `en.js`. The correct path is `soc.screener.scan_symbols_required`.
  3. `"scan_started"` key does not exist. It should use `soc.screener.scan_queued` or be added to localization.
* **Resolution Plan:** Correct i18n queries to use `soc.screener.scan_symbols_required` and add `scan_started`/`scan_queued` support.

---

### 5. [Medium] Silent Failures in Queue Tiers Loading
* **File:** [SocDataInventorySection.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/soc/SocDataInventorySection.tsx#L34-L46)
* **Code Proof:**
  ```typescript
  adapter.getSocDataOpsQueueTiers().then((res) => {
    setQueueTiers(res.tiers || []);
  }).catch(() => {
    // Silently fail
  })
  ```
* **Implication:** When the queue tiers backend endpoint experiences problems (e.g. DB connection issues), the section silently suppresses the failure. The user sees an empty section with no feedback.
* **Resolution Plan:** Implement local state `queueTiersError` and render an inline warning banner when the fetch catches an error.

---

### 6. [Low] Code Convention Violation in Mailing Config
* **File:** [ShellMailConfigPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/admin/ShellMailConfigPage.tsx)
* **Code Proof:** Contains standard JSX nodes throughout the file, e.g.:
  ```tsx
  return (
    <ShellPageChrome
      eyebrow="Hệ thống · SOC"
      title="Quản trị Mail Vận Hành"
      ...
  ```
* **Implication:** Violates the vertical project constraints (`Pure createElement pattern (không JSX)`) resulting in raw-string warnings from `react/jsx-no-literals` and architectural inconsistency.
* **Resolution Plan:** Refactor to pure `React.createElement` pattern.
