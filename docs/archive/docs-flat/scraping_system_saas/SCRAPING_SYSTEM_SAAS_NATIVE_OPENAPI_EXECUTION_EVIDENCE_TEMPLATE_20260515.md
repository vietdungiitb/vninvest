# EXECUTION EVIDENCE TEMPLATE - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15

Use this template for each slice in the workstream.

---

## 1. Slice summary

- Slice ID:
- Owner:
- Date:
- Scope:
- Goal:

---

## COMPLETED BATCH — SOA-T09 / SOA-T10 / SOA-T11 Evidence (2026-05-15)

### 1. Slice summary

- **Slice IDs**: SOA-T09, SOA-T10, SOA-T11
- **Owner**: Copilot agent
- **Date**: 2026-05-15
- **Scope**: Frontend adapter canonical routes, runtime config/admin panel, selected-session truth across chart/advisory/tape
- **Goal**: Operators can view, preview, update, and audit DataOps runtime settings from the admin panel; chart, advisory, and tape stay pinned to the same selected session

### 2. Files changed

- `frontend/src/api/socApi.js` — modified: preview handler preserves 400 validation payload; all DataOps routes route through SOC adapter
- `frontend/src/__tests__/socApi.dataops.test.js` — created: locked canonical route, preview, and audit adapter behavior (9 tests)
- `frontend/src/components/soc/DataOpsPanel.jsx` — modified: backend preview + audit history table with pagination and validation error propagation to modal
- `frontend/src/components/soc/SOCComponents.test.jsx` — modified: added mocks and assertions for audit table and preview API call (9 tests)
- `frontend/src/components/WhaleFeedPanel.jsx` — modified: `getSessionFacts` accepts `selectedTradeDate`; supports `ordersOverride` from parent
- `frontend/src/components/WhaleFeedPanel.test.jsx` — created: regression for selected-session tape truth (1 test)
- `frontend/src/pages/WhaleAlertsDashboard.jsx` — modified: passes `selectedTradeDate` and `ordersOverride` into `WhaleFeedPanel`
- `frontend/src/i18n/vi.js` — modified: added `preview_loading`, `audit_title`, `audit_description`, `audit_total`, `audit_empty`, `audit_timestamp`, `audit_actor`, `audit_service_key`, `audit_change_summary`, `audit_page`, `audit_previous`, `audit_next`
- `frontend/src/i18n/en.js` — modified: same keys in English

### 3. Validation evidence

#### Frontend

- **Command**: `CI=true npm test -- --runInBand --watch=false src/__tests__/socApi.dataops.test.js src/components/soc/SOCComponents.test.jsx src/components/WhaleFeedPanel.test.jsx`
- **Result**: **19 tests passing, 0 failures**
- **Notes**: adapter routes, preview/audit panel, selected-session tape truth all covered

#### Runtime smoke

- **Command**: `.\start_dev.ps1`
- **Result**: All 14 containers started; `Core API health: OK`; `Frontend health: OK`; frontend bundle compiled `843.92 kB (gzip)`
- **Runtime panel verified**: `http://localhost/operations-center?tab=dataops` shows runtime config JSON editor (current config with `decay_days: 7` and all four tiers), audit panel (`Tổng thay đổi: 0`, empty state as expected in clean dev env), run history table (`Tổng run: 154`, latest `md-run-454 Thành công`)

### 4. Payload / screenshot proof

- **DataOps runtime config editor**: live config JSON shown in textarea; "Xem trước" button active; values confirmed as `decay_days: 7, hot_user_demand.poll_interval_seconds: 30, warm_liquid_market.poll_interval_seconds: 120`
- **Audit panel**: heading "Kiểm toán cấu hình", `Tổng thay đổi: 0`, empty-state message shown correctly
- **Run history**: table with `md-run-454`, `md-run-451`, ..., all status `Thành công`, mode `missing_only`, reason `queue_tier_scheduler:warm_liquid_market`
- Screenshots captured from live runtime via browser tool on 2026-05-15T16:30Z (Dev)

### 5. Audit updates

- `CODE_CHANGE_AUDIT_LEDGER.md` — SOA-T09 and SOA-T10/T11 entries added ✅
- `PROGRESS_DASHBOARD.md` — SOA-T09 and SOA-T10/T11 entries added ✅
- `module_tree_full.md` — regenerated (1201 modules) ✅

### 6. Residual risk

- **Risk**: Audit panel shows `Tổng thay đổi: 0` in dev because no config writes have been made yet. The endpoint is live and tested.
  - **Mitigation**: Flow is test-proven via `SOCComponents.test.jsx`; backend endpoint covered in `test_soc_api_domain.py`. No code change needed.
- **Risk**: Tape `ordersOverride` depends on backend returning non-empty bubble orders for the selected session. Empty historical payload → override is empty.
  - **Mitigation**: Panel gracefully falls back to realtime feed orders. Empty-state is visible. Backend payload completeness out of scope for this slice.

### 7. Sign-off line

**Ready for next slice (T12/T13/T14/T15 closure)**

---

## 2. Files changed

- `path/to/file` - created/modified
- `path/to/file` - created/modified

---

## 3. Validation evidence

### Backend

- Command:
- Result:
- Notes:

### Frontend

- Command:
- Result:
- Notes:

### OpenAPI / schema

- Command:
- Result:
- Notes:

### Runtime smoke

- Command:
- Result:
- Notes:

---

## 4. Payload / screenshot proof

- Endpoint or screen:
- Snapshot summary:
- Screenshot path if applicable:

---

## 5. Audit updates

- `CODE_CHANGE_AUDIT_LEDGER.md` entry added/updated:
- `PROGRESS_DASHBOARD.md` entry added/updated:
- `module_tree_full.md` regenerated if source changed:

---

## 6. Residual risk

Write any open risk clearly and concretely.

- Risk:
- Why it remains:
- Mitigation plan:

---

## 7. Sign-off line

- Ready for next slice / ready for review / blocked (pick one)
