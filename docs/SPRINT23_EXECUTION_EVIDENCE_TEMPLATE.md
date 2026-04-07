# Sprint 23 execution evidence template

Trang thai: TEMPLATE - READY TO FILL

Su dung tai lieu nay de thu thap bang chung cho S23-08:
- Canary 10% -> 50% -> 100%
- Rollback rehearsal
- Final Go/No-Go

## A) Metadata

- Date: ____
- Environment: staging / production
- Release window: ____
- Incident channel: ____
- Evidence directory: docs/ops-evidence/sprint23

Owner:
- Tech Lead: ____
- DevOps Lead: ____
- QA Lead: ____
- Backend owner: ____
- PM owner: ____

## B) Baseline KPI snapshot

- Intraday p95: ____ ms
- PriceBoard p95: ____ ms
- Whale aggregate p95: ____ ms
- HTTP 5xx ratio: ____ %
- Fallback ratio: ____ %
- External timeout ratio: ____ %

## C) Canary 10% evidence

- Start: ____
- End: ____
- p95 delta vs baseline: ____
- 5xx peak: ____
- fallback ratio delta: ____
- external timeout delta: ____
- Decision: GO / NO-GO
- Notes: ____

## D) Canary 50% evidence

- Start: ____
- End: ____
- p95 delta vs baseline: ____
- 5xx peak: ____
- fallback ratio delta: ____
- external timeout delta: ____
- Decision: GO / NO-GO
- Notes: ____

## E) Canary 100% evidence

- Start: ____
- End: ____
- p95 delta vs baseline: ____
- 5xx peak: ____
- fallback ratio delta: ____
- external timeout delta: ____
- Decision: GO / NO-GO
- Notes: ____

## F) Rollback rehearsal

- Trigger time (T0): ____
- Recovery time (T1): ____
- Duration: ____
- Smoke endpoints: PASS / FAIL
- KPI post-rollback: PASS / FAIL
- Result: PASS / FAIL

## G) Final decision

- Final decision: GO / NO-GO
- Rationale:
  - ____

## H) Risks and follow-up

1. Risk: ____
   - Owner: ____
   - ETA: ____
2. Risk: ____
   - Owner: ____
   - ETA: ____

## I) Signatures

- Tech Lead: ____  Date/Time: ____
- DevOps Lead: ____  Date/Time: ____
- QA Lead: ____  Date/Time: ____
- Backend owner: ____  Date/Time: ____
- PM owner: ____  Date/Time: ____

## J) Artifact checklist

- [ ] preflight + flag snapshot
- [ ] baseline KPI snapshot
- [ ] canary 10 log
- [ ] canary 50 log
- [ ] canary 100 log
- [ ] rollback rehearsal report
- [ ] go/no-go sign-off
