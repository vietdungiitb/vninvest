# Global Alert Center SaaS OpenAPI Cutover — Production Shadow/Soak Evidence
**Date**: 2026-05-16
**Status**: Template for production shadow run

---

## 1. Run metadata

- Window type: production shadow (legacy vs native)
- Required horizon: >= 3 real trading days
- Owner:
- Tech lead reviewer:
- Start timestamp:
- End timestamp:

---

## 2. Scope and guardrails

1. No legacy code decommission while this report is incomplete.
2. No bypass of soak/shadow gates.
3. Native `/core/v1/signals/alert-center/*` and `/core/v1/signals/ai-alerts/*` are source of truth for cutover readiness.
4. Any exception must include ticket + owner + expiry.

---

## 3. Daily evidence blocks (minimum 3 days)

### Day 1

- Trading date:
- Native request volume:
- Legacy request volume:
- Comparable sample size:
- Parity score:
- Critical mismatches:
- Root causes:
- Action items:

### Day 2

- Trading date:
- Native request volume:
- Legacy request volume:
- Comparable sample size:
- Parity score:
- Critical mismatches:
- Root causes:
- Action items:

### Day 3

- Trading date:
- Native request volume:
- Legacy request volume:
- Comparable sample size:
- Parity score:
- Critical mismatches:
- Root causes:
- Action items:

---

## 4. Required parity dimensions

1. Alert family correctness (`whale`, `dark_flow`, `price_shock`, `stale_quote`, `system`, AI lane).
2. Lane isolation (main lane does not leak AI-only events).
3. Delivery projection correctness (symbol scope, threshold, mute/ack state).
4. OpenAPI contract correctness (schema, pagination, error envelope behavior).
5. End-user rendering parity in packages/web and temporary frontend bridge.

---

## 5. KPI thresholds

- Minimum acceptable daily parity score: `>= 0.99`
- Minimum acceptable overall parity score: `>= 0.99`
- Zero unresolved critical mismatches by end of window.

If any threshold fails:

1. Cutover is blocked.
2. Legacy sunset is blocked.
3. Remediation wave must be executed and evidence rerun.

---

## 6. Supporting artifacts

Attach or link:

1. API payload snapshots (legacy vs native) for mismatched samples.
2. Endpoint-level error and latency summaries.
3. Screenshots or captures for UI parity checks.
4. Change list of remediation commits during shadow window.

---

## 7. Rollback readiness

- Rollback trigger conditions:
- Rollback owner:
- Rollback steps verified date:
- Last dry-run result:

---

## 8. Sign-off

- Engineering owner sign-off: `PENDING`
- Tech lead sign-off: `PENDING`
- Governance gate result (`D02`): `PENDING`

Only after both sign-offs can legacy decommission planning proceed.
