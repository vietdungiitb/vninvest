# FRONTEND DESIGN - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15  
**Purpose**: detailed frontend handoff for the canonical SaaS-native surfaces and runtime config/admin control.

---

## 1. Frontend design principles

1. All API calls go through the frontend adapter layer.
2. No direct fetch bypass on in-scope flows.
3. Selected-session truth drives chart, tape, advisory, and whale overlays.
4. Runtime config/admin must be visible in the UI and permission-aware.
5. UI text added in this bundle must use Vietnamese with full diacritics in product surfaces.

---

## 2. Surfaces in scope

| Surface | Responsibility |
|---|---|
| `AdminOps` | operator hub for runtime config, queue tiers, and control actions |
| `DataOpsPanel` | manual planner and data operations surface |
| `WhaleAlertsDashboard` | whale/session charting and advisory entry point |
| `StockDetail` | symbol detail, chart, tape, and related signals |
| `KLineChartPanel` | primary chart surface |
| Runtime config/admin panel | preview, update, audit, and disable/readonly states |

---

## 3. Adapter layer contract

The adapter layer must expose functions for:

1. market-data intraday prices,
2. market-data intraday tape,
3. session facts and chart-ready buckets,
4. operator matrix and runtime state,
5. runtime config read/preview/update/history.

The adapter must normalize error envelopes, loading states, and permission failures so views do not each implement their own backend shape logic.

---

## 4. Runtime config/admin UI design

### Must-have interactions

1. View current runtime config by section.
2. Preview a proposed change before saving.
3. Save the change with an audit trail reference.
4. View config history and effective state.
5. Show disabled or read-only states when the user lacks permission.
6. Surface provider readiness, schedule cadence, retention windows, and cutover flags.

### UX rules

- Keep controls grouped by ownership domain.
- Use explicit save/preview states, never silent autosave.
- Show last updated time and actor when available.
- Prevent accidental changes with a confirm step on risky controls.
- Keep audit/history visible from the same panel.

---

## 5. Chart and signal UX

1. KLineChart remains the center surface.
2. Bubble, advisory, CVD, strength, and tape must follow selected-session truth.
3. Do not let charting fall back to a different session just because the latest raw data exists.
4. Keep empty-state and stale-state semantics visible instead of silently fabricating values.

---

## 6. State model

The frontend should treat each runtime control panel as a simple state machine:

- `idle`
- `loading`
- `previewing`
- `dirty`
- `saving`
- `saved`
- `error`
- `readonly`
- `permission_denied`

This state must be reflected in button states, banners, and audit messages.

---

## 7. File anchors for implementation

- `frontend/src/api/client.js`
- `frontend/src/pages/AdminOps.jsx`
- `frontend/src/components/soc/DataOpsPanel.jsx`
- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/components/KLineChartPanel.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/vi.json`

---

## 8. Frontend test ideas

1. Adapter functions call canonical endpoints only.
2. Runtime config/admin panel renders current state, preview, and audit history.
3. Permission-denied paths show readonly/disabled UI.
4. Selected-session truth stays stable across chart and advisory updates.
5. Error envelopes render consistent user messages.
6. Vietnamese UI strings are present for new controls.

---

## 9. Frontend DoD

1. New adapter methods exist and are used by the in-scope surfaces.
2. Runtime config/admin panel is visible to operators with permissions.
3. Charts and tape remain session-consistent.
4. No new direct fetch bypass is introduced.
5. Frontend tests or smoke checks cover the new runtime-config flow.
