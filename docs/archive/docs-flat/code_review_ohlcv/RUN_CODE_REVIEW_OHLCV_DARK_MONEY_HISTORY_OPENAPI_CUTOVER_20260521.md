# Run Code Review - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21

---

## Review objective

Identify defects/risks/regressions in:
- OpenAPI contract mismatches
- timeframe normalization and clamp behavior
- error/status semantics
- frontend adapter route correctness
- legacy replacement safety

---

## Reviewer checklist

- [ ] Constitution hard rules reviewed
- [ ] PR gate checklist verified
- [ ] Endpoint route and schema diffs reviewed
- [ ] Timeframe alias policy reviewed
- [ ] Integration/parity evidence reviewed

---

## Mandatory focus points

1. Backend
- Contract shape drift between implementation and OpenAPI metadata
- Missing validation branches for interval/period/timeframe
- Any exception-swallow pattern

2. Frontend
- Any direct fetch bypassing adapter for covered endpoints
- Incorrect query mapping in adapter methods
- Improper error envelope handling

3. Migration
- Legacy replacement readiness based on dev parity evidence

---

## Severity policy

- Critical/High unresolved: NO-GO
- Medium: fix or attach approved mitigation with owner/due date
- Low: can defer with ticket

---

## Required outputs

- Findings list with severity
- Impacted files/endpoints
- Required fixes before merge
- Final go/no-go recommendation
