# Global Alert Center SaaS OpenAPI Cutover — Legacy Decommission-Ready Inventory
**Date**: 2026-05-16
**Status**: Step 1 complete (inventory + rollback map)

---

## 1. Scope

This inventory is limited to alert-center related legacy/compat surfaces and naming shims that are candidates for future decommission after D02 gate closure.

Out of scope:

1. Non-alert-center legacy domains (portfolio, advisory broad compat, stock-management full compat matrix).
2. Any destructive legacy deletion before production shadow/soak gate is fully passed.

---

## 2. Candidate inventory

| ID | Surface | File | Current role | Decommission readiness | Blocker |
|---|---|---|---|---|---|
| LC-01 | Frontend API alias `getUnifiedAlerts` | `frontend/src/api/client.js` | Compatibility alias to `getAlertCenterFeed` | READY_AFTER_D02 | External call-sites outside audited scope may still import alias |
| LC-02 | Hook bridge shim `useAlertCenterFeed -> useUnifiedAlerts` | `frontend/src/hooks/useAlertCenterFeed.js` | Migration bridge to legacy hook module path | READY_AFTER_D02 | Internal consumers still depend on legacy implementation file |
| LC-03 | Legacy-named hook module `useUnifiedAlerts.js` | `frontend/src/hooks/useUnifiedAlerts.js` | Runtime implementation carrying legacy name | PARTIAL | Requires rename rollout across app + test snapshots |
| LC-04 | Legacy-named UI component `UnifiedAlertCenter` | `frontend/src/components/UnifiedAlertCenter.jsx` | Main dashboard alert panel component | PARTIAL | Naming-only debt; functional contract already native |
| LC-05 | Legacy-named task key `signal_unified_alert_materializer` | `packages/core/backend/src/service_ops/tasks.py` and registry/ownership files | Ops observability key, not API contract | BLOCKED | Renaming impacts SOC dashboards and historical run logs |

---

## 3. Decommission sequence (proposed)

1. Confirm production shadow/soak evidence >= 3 real trading days and parity dashboard PASS.
2. Remove or deprecate `LC-01` alias (`getUnifiedAlerts`) after usage inventory returns zero non-test callers.
3. Rename `LC-03` implementation module from `useUnifiedAlerts` to `useAlertCenterFeed` and keep temporary re-export shim for one release window.
4. Rename `LC-04` component symbol to `AlertCenterPanel` (or equivalent) with codemod-style replacement.
5. Evaluate `LC-05` separately as SOC/ops migration task (do not bundle with frontend naming removals).

---

## 4. Rollback map

Rollback strategy is commit-based and non-destructive.

| Purpose | Commit | Rollback action |
|---|---|---|
| D01 naming alignment baseline | `413f3921` | `git revert 413f3921` |
| B01/B02/D08 fact-first materializer | `7140910f` | `git revert 7140910f` |
| D02 parity/shadow governance normalization | `d050ba1e` | `git revert d050ba1e` |
| D02 readiness kit templates | `60620895` | `git revert 60620895` |

Note: rollback must preserve hard rule that no new legacy business route is introduced.

---

## 5. Gate conditions before any deletion

1. Production shadow/soak evidence file filled: `GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PRODUCTION_SHADOW_SOAK_EVIDENCE_20260516.md`.
2. Parity dashboard checklist filled with PASS thresholds: `GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_DASHBOARD_CHECKLIST_20260516.md`.
3. D02 moved from IN PROGRESS to DONE with sign-off.
4. Legacy decommission PR includes explicit rollback plan and owner.

If any condition is missing, legacy decommission is blocked.
