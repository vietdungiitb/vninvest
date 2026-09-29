# TASKBOARD — Screener SaaS Native Upgrade (2026-07-10)

**Related Plan**: `SCREENER_SAAS_NATIVE_AUDIT_AND_UPGRADE_PLAN_20260710.md`
**Related Tech Spec**: `TECH_SPEC_SCREENER_SAAS_NATIVE_UPGRADE_20260710.md`
**Tong estimated**: 21-30 ngay

---

## Phase 0 — Backend Fix + Type Cleanup (1-2 ngay)

### P0-1: Fix Backend URL Routing
- **File**: `packages/core/backend/src/user_workspace/urls.py`
- **Action**: Import `ScreenerRuleListCreateAPIView`, `ScreenerRuleDetailView`, `ScreenerRuleRunView` tu `portfolio_analytics_views.py`. Them 3 URL patterns: `screener/rules/`, `screener/rules/<int:pk>/`, `screener/rules/<int:pk>/run/`.
- **Verify**: `python manage.py show_urls | grep screener` shows 3 endpoints. `python manage.py test portfolio.tests.test_screener_api --keepdb` pass.
- **Status**: PENDING
- **Estimate**: 0.5 ngay

### P0-2: Fix Type Declarations
- **Files**: `packages/web/src/adapters/coreApiAdapter.d.ts`, `packages/web/src/pages/ScreenerPage.tsx`
- **Action**: (a) Replace `getScreenerPresets` → `getScreenerRules` (5 methods) trong `coreApiAdapter.d.ts`. (b) Remove `(coreApiAdapter as any)` casts — cast as proper type. (c) Add SOC screener methods (8 methods) to `coreApiAdapter.d.ts`.
- **Verify**: `npx tsc --noEmit` — no errors in screener files.
- **Status**: PENDING
- **Estimate**: 0.5 ngay

### P0-3: Fix i18n Typo
- **Files**: `packages/web/src/components/soc/SocScreenerPanel.tsx`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`
- **Action**: (a) Fix `soc.screenter.scan_started` → `soc.screener.scan_started` trong `SocScreenerPanel.tsx:121`. (b) Add key `soc.screener.scan_started` to both i18n files.
- **Verify**: No missing i18n keys when loading SOC screener tab.
- **Status**: PENDING
- **Estimate**: 0.1 ngay

### P0-4: Add Route Catalog Entries
- **Files**: `packages/web/src/pages/routeCatalog.js`, `packages/web/src/navigationCatalog.js`
- **Action**: Add screener entry voi `path: '/screener'`, `labelKey: 'layout.nav.screener'`, `icon: 'Search'`, `buildTargets: ['all']`.
- **Verify**: Screener appears trong route catalog listing.
- **Status**: PENDING
- **Estimate**: 0.2 ngay

### P0-5: Verification Pass
- **Action**: Run full verification: `npx tsc --noEmit && npm run build && npm run test`.
- **Verify**: All pass, no regressions.
- **Status**: PENDING
- **Estimate**: 0.2 ngay

---

## Phase 1 — Legacy Parity (5-7 ngay)

### P1-1: SOC Rule CRUD Modal
- **New File**: `packages/web/src/components/soc/SocScreenerRuleModal.tsx`
- **Action**: Tao modal component voi: (a) Rule name input, (b) Rule type dropdown (9 types), (c) JSON value textarea, (d) Enabled toggle, (e) Create/Edit modes, (f) Confirm/Cancel buttons. Use `createElement` pattern, `soc.module.css` tokens.
- **Depends**: P0-1
- **Status**: PENDING
- **Estimate**: 1.5 ngay

### P1-2: SOC Panel Integration — Add/Edit Buttons + Pagination
- **File**: `packages/web/src/components/soc/SocScreenerPanel.tsx`
- **Action**: (a) Add "Thêm Rule" button header, (b) Add "Sửa" button per row, (c) Open modal on click, (d) Refetch rules after modal confirm, (e) Add pagination (10/page) voi prev/next buttons.
- **Depends**: P1-1
- **Status**: PENDING
- **Estimate**: 1 ngay

### P1-3: SOC Config Structured Form
- **New File**: `packages/web/src/components/soc/SocScreenerConfigForm.tsx`
- **Action**: Replace JSON textarea voi 5-number-input form voi labels, validation, min/max constraints. Keep JSON editor as "Nâng cao" collapsible section. Use `createElement` pattern.
- **Depends**: P0-1
- **Status**: PENDING
- **Estimate**: 1 ngay

### P1-4: Replace alert()/window.confirm()
- **Files**: `SocScreenerPanel.tsx`, `ScreenerPage.tsx`
- **Action**: (a) Replace `alert(t("soc.screener.*"))` voi toast notification component (find existing or create `Toast.tsx`). (b) Replace `window.confirm()` voi `ConfirmModal` component (find existing or create). (c) Add error boundary wrapper.
- **Depends**: None
- **Status**: PENDING
- **Estimate**: 1.5 ngay

### P1-5: Remove `as unknown as` Casts
- **File**: `SocScreenerPanel.tsx`
- **Action**: Replace `defaultCoreApiAdapter as unknown as { ... }` voi proper typed adapter reference. Import typed interface from `coreApiAdapter.d.ts`.
- **Depends**: P0-2
- **Status**: PENDING
- **Estimate**: 0.5 ngay

### P1-6: Phase 1 Verification
- **Action**: `npx tsc --noEmit && npm run build && npm run test`. Manual QA: SOC rule CRUD modal hoat dong, config form shows 5 fields, no alert()/confirm().
- **Status**: PENDING
- **Estimate**: 0.5 ngay

---

## Phase 2 — Commercial-Grade Features (10-14 ngay)

### P2-1: Expanded Filter System — Backend
- **File**: `packages/core/backend/src/user_workspace/screener_helpers.py`
- **Action**: (a) Add 13 new fields to `ALLOWED_FIELDS`. (b) Implement computation functions: `_compute_pe_ratio`, `_compute_market_cap`, `_compute_stochastic_k`, `_compute_atr`, `_compute_adx`, `_compute_vwap`, `_compute_mfi`. (c) Add OR/NOT operators support (backend validation).
- **Depends**: P0-1
- **Status**: PENDING
- **Estimate**: 2 ngay

### P2-2: Expanded Filter System — Frontend
- **New File**: `packages/web/src/components/screener/ScreenerFilterBuilder.tsx`
- **New File**: `packages/web/src/types/screener.d.ts`
- **Action**: (a) Create unified type definitions. (b) Build advanced filter builder voi: grouped field dropdown (price/technical/volume/fundamental/whale), OR/NOT/AND operators, field-specific value hints. (c) Replace existing `FIELD_OPTIONS` voi `SCREENER_FIELDS` constants.
- **Depends**: P2-1, P0-2
- **Status**: PENDING
- **Estimate**: 2 ngay

### P2-3: Results Table Upgrade
- **New File**: `packages/web/src/components/screener/ScreenerResultsTable.tsx`
- **Action**: (a) Sortable columns (click header toggle asc/desc). (b) Column picker dropdown (show/hide columns). (c) Pagination (25/50/100 per page). (d) Inline sparkline mini-chart (20-day price, SVG path). (e) Row hover expand chi tiet.
- **Depends**: P0-1
- **Status**: PENDING
- **Estimate**: 2 ngay

### P2-4: Export CSV/Excel
- **New File**: `packages/web/src/components/screener/ScreenerExport.tsx`
- **Action**: (a) CSV export using browser Blob. (b) Excel export using `xlsx` library (install). (c) Export buttons trong results table header. (d) Export filtered + sorted data.
- **Depends**: P2-3
- **Status**: PENDING
- **Estimate**: 1 ngay

### P2-5: Pre-built Templates
- **New File**: `packages/web/src/components/screener/ScreenerTemplates.tsx`
- **Action**: (a) Define 10 template objects voi id, name, description, icon, conditions, category. (b) Render grid of template cards. (c) Click template → populate filter builder voi conditions. (d) Category filter tabs (All/Technical/Fundamental/Whale/Hybrid).
- **Depends**: P2-2
- **Status**: PENDING
- **Estimate**: 1.5 ngay

### P2-6: Scheduled Scanning — Backend
- **File**: `packages/core/backend/src/user_workspace/` (views + tasks)
- **Action**: (a) Add `schedule_enabled`, `schedule_frequency`, `schedule_next_run` fields to `ScreenerRule` model. (b) Create Celery beat task `run_scheduled_screens`. (c) Add schedule CRUD endpoints. (d) Integration voi `UnifiedAlert` for notifications.
- **Depends**: P0-1
- **Status**: PENDING
- **Estimate**: 2 ngay

### P2-7: Scheduled Scanning — Frontend
- **New File**: `packages/web/src/components/screener/ScreenerSchedule.tsx`
- **Action**: (a) Schedule config UI voi frequency dropdown + time window picker. (b) Next run display. (c) Enable/disable toggle. (d) Alert history view voi ack/dismiss.
- **Depends**: P2-6
- **Status**: PENDING
- **Estimate**: 1 ngay

### P2-8: Phase 2 Verification
- **Action**: Full test suite + manual QA. Verify: 20+ filters work, results sort/paginate/export, templates load, scheduled scan triggers.
- **Status**: PENDING
- **Estimate**: 1 ngay

---

## Phase 3 — AI Features (5-7 ngay)

### P3-1: AI Advisory Score — Backend
- **File**: `packages/core/backend/src/user_workspace/ai_advisory_helpers.py`
- **Action**: (a) Implement `_build_screener_advisory(snapshot)` adapter. (b) Tinh `ai_score_0_100` from signal confluence. (c) Add `ai_advisory` field to `ScreenerRuleRunView` response. (d) Fallback: if AI fails, return `ai_advisory: null`.
- **Depends**: P2-1
- **Status**: PENDING
- **Estimate**: 2 ngay

### P3-2: AI Score UI
- **New File**: `packages/web/src/components/screener/ScreenerScoreCard.tsx`
- **Action**: (a) AI score badge (0-100 colored circle). (b) Strategy action badge (BUY=green, SELL=red, HOLD=yellow). (c) Confidence indicator. (d) Tooltip voi synthesis text. (e) Column trong results table.
- **Depends**: P3-1
- **Status**: PENDING
- **Estimate**: 1.5 ngay

### P3-3: Performance Analytics
- **New File**: `packages/web/src/components/screener/ScreenerHistory.tsx`
- **Action**: (a) Run history table (last 20 runs voi timestamp, rule name, matched count). (b) Win rate calculator (tinh % symbol thang/giam sau 30 ngay). (c) Simple backtesting UI: select date range → run screen → show historical matches.
- **Depends**: P3-1
- **Status**: PENDING
- **Estimate**: 2 ngay

### P3-4: Phase 3 Verification
- **Action**: Full test suite + manual QA. AI score displays correctly, history loads, backtesting returns results.
- **Status**: PENDING
- **Estimate**: 1 ngay

---

## Dependency Graph

```
Phase 0 (1-2 days)
├── P0-1: Backend URL Fix ─────────┐
├── P0-2: Type Declarations ───────┤
├── P0-3: i18n Typo               │
├── P0-4: Route Catalog           │
└── P0-5: Verification            │
                                    │
Phase 1 (5-7 days)                 │
├── P1-1: Rule Modal ←─────────────┤
├── P1-2: Panel Integration ← P1-1 │
├── P1-3: Config Form ←────────────┤
├── P1-4: Replace alert/confirm    │
├── P1-5: Remove casts ← P0-2 ────┤
└── P1-6: Phase 1 Verify           │
                                    │
Phase 2 (10-14 days)               │
├── P2-1: Expanded Filters BE ←────┘
├── P2-2: Filter Builder FE ← P2-1 + P0-2
├── P2-3: Results Table ←──────────
├── P2-4: Export ← P2-3
├── P2-5: Templates ← P2-2
├── P2-6: Scheduling BE ← P0-1
├── P2-7: Scheduling FE ← P2-6
└── P2-8: Phase 2 Verify
        │
Phase 3 (5-7 days)
├── P3-1: AI Advisory BE ← P2-1
├── P3-2: AI Score UI ← P3-1
├── P3-3: Analytics ← P3-1
└── P3-4: Phase 3 Verify
```

---

## Quick Wins (Co the lam ngay)

| Task | Time | Impact |
|------|------|--------|
| P0-3: Fix i18n typo | 15 min | SOC panel translations work |
| P0-4: Add route catalog | 30 min | Screener in capability filtering |
| P0-2: Fix type declarations | 2 hours | Type safety restored |
| P1-4: Replace alert()/confirm() | 1.5 days | Professional UX |

---

## Milestone Checkpoints

| Milestone | Target Date | Criteria |
|-----------|------------|----------|
| M0: Screener works | End of Phase 0 | CRUD + Run functional, build pass |
| M1: Legacy parity | End of Phase 1 | SOC modal, config form, no alert() |
| M2: Commercial grade | End of Phase 2 | 20+ filters, templates, export, scheduling |
| M3: AI powered | End of Phase 3 | AI scores, analytics, backtesting |

---

**Trang thai**: READY FOR APPROVAL
