# TASKBOARD — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## Slice `DIR-00` — Acceptance Freeze

- [x] `DIR-00.1` Create doc pack baseline  
  Owner: Tech Lead / Planner  
  Estimate: 2h  
  DoD:
  - Handoff master, implementation plan, tech spec, frontend/backend design created
  - Scope/out-of-scope frozen
  - Requirement IDs assigned
  Files: `docs/*DASHBOARD_INFORMATION_ARCHITECTURE_REDESIGN*_20260519.md`

- [x] `DIR-00.2` Lock IA wireframe and route strategy  
  Owner: Product + Frontend Lead  
  Estimate: 30m  
  DoD:
  - Desktop triad approved
  - Mobile/tablet order approved
  - Decision recorded: live route first, package-host parity mandatory before close

---

## Slice `DIR-01` — Shared Layout Contract

- [x] `DIR-01.1` Add reusable triad/full-width layout classes  
  Owner: Frontend Dev  
  Estimate: 45m  
  DoD:
  - `index.css` or equivalent has layout primitives for triad + full-width deck
  - Desktop/tablet/mobile breakpoints defined
  Req: `DIR-REQ-01`, `DIR-REQ-14`, `DIR-REQ-15`

- [x] `DIR-01.2` Update `DashboardPage.js` slot contract for AI lane  
  Owner: Frontend Platform  
  Estimate: 1h  
  DoD:
  - `renderAiPanel` exists or equivalent dedicated AI lane contract
  - `renderBubble` not required for default dashboard layout
  Req: `DIR-REQ-11`, `DIR-REQ-12`

- [x] `DIR-01.3` Align `PackageDashboardHost.jsx` with new slot names  
  Owner: Frontend Platform  
  Estimate: 45m  
  DoD:
  - Host injects stats, alert, heatmap, AI, deck slots
  - No direct import violation from `packages/web/src`
  Req: `DIR-REQ-11`, `DIR-REQ-13`

---

## Slice `DIR-02` — Live Top Triad

- [x] `DIR-02.1` Replace current main+side composition with triad  
  Owner: Frontend Dev  
  Estimate: 1h  
  DoD:
  - `ModernDashboard.jsx` top fold is one triad container
  - No separate side rail for AI panel
  Req: `DIR-REQ-01`

- [x] `DIR-02.2` Move `PortfolioHeatmap` to center lane  
  Owner: Frontend Dev  
  Estimate: 30m  
  DoD:
  - Heatmap rendered in center lane on desktop
  - Width >= each side lane width
  Req: `DIR-REQ-02`, `DIR-REQ-06`

- [x] `DIR-02.3` Place `UnifiedAlertCenter` in left lane  
  Owner: Frontend Dev  
  Estimate: 20m  
  DoD:
  - Alert center renders in left lane only
  - Internal scroll retained
  Req: `DIR-REQ-06`, `DIR-REQ-17`

- [x] `DIR-02.4` Place `AIAdvisorAlertPanel` in right lane  
  Owner: Frontend Dev  
  Estimate: 20m  
  DoD:
  - AI lane renders right of heatmap
  - Internal tabs still work
  Req: `DIR-REQ-07`, `DIR-REQ-18`

- [~] `DIR-02.5` Fix top-row heights and overflow behavior  
  Owner: Frontend Dev  
  Estimate: 30m  
  DoD:
  - Top triad heights visually aligned
  - No horizontal overflow at 1280px+
  - Heatmap tooltip not clipped
  Audit note:
  - Authenticated shared-browser smoke at `~791px` confirms `Workstation` stays on one equal-width row while `Classic` keeps `Heatmap` on row 1 and `Alert + AI` on row 2.
  - `1280px+` overflow and tooltip-clipping proof remain blocked by integrated-browser viewport constraints, so this item stays in progress.
  Req: `DIR-REQ-23`, `DIR-REQ-24`

---

## Slice `DIR-03` — Full-width Deck

- [x] `DIR-03.1` Move deck to dedicated second row  
  Owner: Frontend Dev  
  Estimate: 30m  
  DoD:
  - Deck wrapper is outside triad row
  - Deck sits below all three top panels
  Req: `DIR-REQ-03`

- [x] `DIR-03.2` Span deck full-width 3 columns  
  Owner: Frontend Dev  
  Estimate: 20m  
  DoD:
  - Desktop deck spans full page-body width
  - Table width visibly improved
  Req: `DIR-REQ-03`

- [x] `DIR-03.3` Preserve deck empty state and CTA  
  Owner: Frontend Dev  
  Estimate: 20m  
  DoD:
  - Empty title/help/CTA remain visible and centered
  - CTA `Mở Transactions` still works
  Req: `DIR-REQ-16`

---

## Slice `DIR-04` — Remove Low-value Blocks

- [x] `DIR-04.1` Remove `StickyAlertBar` from default dashboard route  
  Owner: Frontend Dev  
  Estimate: 15m  
  DoD:
  - No render path from `/dashboard` to `StickyAlertBar`
  Req: `DIR-REQ-04`

- [x] `DIR-04.2` Remove `ModernSidebar` from default dashboard route  
  Owner: Frontend Dev  
  Estimate: 15m  
  DoD:
  - No render path from `/dashboard` to `ModernSidebar`
  Req: `DIR-REQ-05`

- [x] `DIR-04.3` Move valuable risk metrics to compact header strip  
  Owner: Frontend Dev  
  Estimate: 45m  
  DoD:
  - Max 4 compact metrics retained in header
  - Header height stays controlled
  Req: `DIR-REQ-08`

- [x] `DIR-04.4` Verify alert duplication eliminated  
  Owner: Frontend Dev  
  Estimate: 20m  
  DoD:
  - No live alert stream remains outside `UnifiedAlertCenter`
  Req: `DIR-REQ-17`, `DIR-REQ-18`

---

## Slice `DIR-05` — Package-host Parity

- [x] `DIR-05.1` Recompose `DashboardPage.js` into stats + triad + deck  
  Owner: Frontend Platform  
  Estimate: 1.5h  
  DoD:
  - Host page matches live-route hierarchy
  - No JSX if file remains under `packages/web`
  Req: `DIR-REQ-11`, `DIR-REQ-13`

- [x] `DIR-05.2` Inject AI lane via `PackageDashboardHost.jsx`  
  Owner: Frontend Platform  
  Estimate: 45m  
  DoD:
  - AI lane injected with real legacy component
  - No placeholder `null` lane on host
  Req: `DIR-REQ-11`, `DIR-REQ-13`

- [x] `DIR-05.3` Deprecate `renderBubble` from default dashboard layout  
  Owner: Frontend Platform  
  Estimate: 20m  
  DoD:
  - Bubble slot no longer occupies top-fold layout responsibility
  Req: `DIR-REQ-12`

- [x] `DIR-05.4` Mark legacy dashboard path as transitional only  
  Owner: Frontend Platform + Tech Lead  
  Estimate: 30m  
  DoD:
  - Code/docs/evidence state that `ModernDashboard` is not canonical end-state
  - Package-host path is recorded as SaaS native target architecture
  - Any temporary legacy bridge has owner + expiry
  Req: `DIR-REQ-25`, `DIR-REQ-26`, `DIR-REQ-30`

- [x] `DIR-05.5` Prevent legacy-only feature drift  
  Owner: Frontend Platform  
  Estimate: 30m  
  DoD:
  - No redesign logic exists only on legacy page path
  - Package-host receives corresponding slot/layout update
  Req: `DIR-REQ-27`, `DIR-REQ-30`

---

## Slice `DIR-06` — Responsive + Accessibility Hardening

- [x] `DIR-06.1` Tablet layout  
  Owner: Frontend Dev  
  Estimate: 30m  
  DoD:
  - Workstation non-mobile keeps alert, heatmap, AI in one compact equal-width row
  - Classic non-mobile keeps heatmap full-width hàng 1, alert + AI ở hàng 2
  Req: `DIR-REQ-14`

- [x] `DIR-06.2` Mobile stack order  
  Owner: Frontend Dev  
  Estimate: 30m  
  DoD:
  - Heatmap → Alert → AI → Deck order
  Req: `DIR-REQ-15`

- [~] `DIR-06.3` Keyboard/focus/scroll audit  
  Owner: Frontend Dev + QA  
  Estimate: 45m  
  DoD:
  - Focus order sane
  - Scrollbars and internal scroll usable
  - Contrast acceptable
  Audit note:
  - Shared-browser `Tab` smoke on authenticated `/dashboard` reached nav, refresh, alert filters, alert actions, and alert-card controls without an immediate focus trap.
  - Scroll feel and true mobile/desktop viewport verification still require a resizable browser outside the integrated shared tab.
  Req: `DIR-REQ-23`, `DIR-REQ-24`

- [x] `DIR-06.4` Verify no extra fetch fan-out  
  Owner: Frontend Platform  
  Estimate: 20m  
  DoD:
  - Network calls count not increased vs baseline
  Req: `DIR-REQ-09`, `DIR-REQ-10`

---

## Slice `DIR-07` — Validation + Evidence

- [x] `DIR-07.1` Frontend build validation  
  Owner: Frontend Dev  
  Estimate: 10m  
  DoD:
  - `npm run build` PASS
  Req: `DIR-REQ-19`

- [x] `DIR-07.2` Runtime refresh via `./start_dev.ps1`  
  Owner: Frontend Dev  
  Estimate: 15m  
  DoD:
  - Dev stack healthy after refresh
  Req: `DIR-REQ-20`

- [~] `DIR-07.3` Desktop/tablet/mobile screenshot evidence  
  Owner: QA  
  Estimate: 30m  
  DoD:
  - 3 screenshots attached to evidence pack
  Audit note:
  - One authenticated shared-viewport screenshot was captured for live `/dashboard`.
  - Explicit `1440px`, `1024px`, and `390px` captures remain blocked because the integrated browser stays fixed near `791px` wide and the screenshot tool ignores Playwright viewport changes.
  Req: `DIR-REQ-01` to `DIR-REQ-18`

- [~] `DIR-07.4` Run code review + spec audit checklists  
  Owner: Reviewer  
  Estimate: 45m  
  DoD:
  - Review docs executed and signed off
  Audit note:
  - Code-level checks completed for `StickyAlertBar`/`ModernSidebar` removal, `renderAiPanel` presence, redesign-scoped diff boundaries, and shared-session parity smoke.
  - Final sign-off still depends on real multi-viewport screenshot evidence.
  Req: `DIR-REQ-21`

- [x] `DIR-07.5` Update governance artifacts  
  Owner: Developer  
  Estimate: 15m  
  DoD:
  - `CODE_CHANGE_AUDIT_LEDGER.md` updated
  - `PROGRESS_DASHBOARD.md` updated
  - `module_tree_full.md` regenerated if source changes
  Req: `DIR-REQ-22`

- [x] `DIR-07.6` Architecture compliance audit  
  Owner: Reviewer + Tech Lead  
  Estimate: 30m  
  DoD:
  - No dashboard completion claim leaves legacy monolith as accepted target architecture
  - No unauthorized backend/legacy compat path introduced
  - If backend touched: `/core/v1/*` + OpenAPI metadata + PR gates verified
  Audit note:
  - Route comments and docs continue to declare `PackageDashboardHost -> DashboardPage -> coreApiAdapter` as the canonical SaaS-native target.
  - The redesign-scoped diff remains confined to frontend/docs/module-tree/package-host files; no dashboard backend/API contract change was introduced in this slice.
  Req: `DIR-REQ-25`, `DIR-REQ-26`, `DIR-REQ-28`, `DIR-REQ-29`, `DIR-REQ-30`
