# Global Alert Center SaaS OpenAPI Cutover — Parity Dashboard Checklist
**Date**: 2026-05-16
**Status**: Operational checklist (pre-legacy-sunset)

---

## 1. Dashboard minimum fields

1. Trading date
2. Native event count
3. Legacy event count
4. Comparable sample size
5. Parity score (daily)
6. Parity score (rolling window)
7. Critical mismatch count
8. High mismatch count
9. Top mismatch categories
10. Status flag (`PASS`, `WARN`, `FAIL`)

---

## 2. Category breakdown (required)

1. Taxonomy mismatch (`alert_family` / `alert_type` / lane)
2. Delivery-scope mismatch (user symbol scope, threshold, mute/ack)
3. Contract mismatch (fields, pagination, envelope)
4. Timing mismatch (triggered_at/session_date drift)
5. Freshness-state mismatch

---

## 3. PASS criteria

1. Daily parity score >= 0.99 for at least 3 real trading days.
2. Rolling parity score >= 0.99.
3. No unresolved critical mismatches.
4. No active blocker in OpenAPI schema/contract checks.

If any criterion fails, status must be `FAIL` and D02 remains open.

---

## 4. Evidence export checklist

- [ ] Daily CSV/JSON export attached
- [ ] Mismatch sample payloads attached
- [ ] Root-cause notes attached
- [ ] Remediation actions linked to commits/tickets
- [ ] Sign-off metadata included

---

## 5. Governance linkage

This checklist must be referenced by:

1. `GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PRODUCTION_SHADOW_SOAK_EVIDENCE_20260516.md`
2. `GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_SHADOW_EVIDENCE_20260516.md`
3. `TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` (D02)

Without these links and filled outputs, legacy sunset gate cannot be closed.
