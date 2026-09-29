# UI STANDARDIZATION SELF AUDIT & TEST PROTOCOL
**Date:** 2026-04-27

This protocol must be executed before marking any Migration Phase (Slice) as "done".

## 1. Automated Testing (Regression)
Run the standard frontend test suite to ensure refactoring React components didn't break logic:
```powershell
Push-Location ./frontend
npm run test -- --watchAll=false
Pop-Location
```

## 2. Visual Density Audit
Verify the following using the eyes (or browser DevTools):
- [ ] **No excessive whitespace:** Does the page look like an "Admin" panel (bad) or a "Trading Terminal" (good)?
- [ ] **Padding compliance:** Are all primary panels using `p-3` or `p-4` max?
- [ ] **Color compliance:** Is the background `bg-slate-950`? Are panels `bg-slate-900/x`?
- [ ] **Typography:** Are all header titles using `text-sm font-bold uppercase`?

## 3. Responsive Audit
- [ ] **Desktop (1280px+):** Sidebar should be visible on the right if the page has one.
- [ ] **Tablet/Mobile (< 1024px):** Sidebar MUST collapse below the main content OR be hidden. No horizontal scrolling allowed.

## 4. Interaction Audit
- [ ] Realtime socket connections must still update the DOM (check flashing green/red texts).
- [ ] Charts must resize correctly when the window is resized. (ECharts `resize()` hook must not be broken by the new flex/grid layout).

## 5. Artifact Ledger Update
Update `docs/CODE_CHANGE_AUDIT_LEDGER.md` with:
- Target slice completed.
- Screenshots attached to the Walkthrough artifact.
