# Sprint 34 KPI Progress (2026-04-10)

Status: PROVISIONAL (local regression evidence)
Scope: A1 + A2 + B1

## 1) Evidence sources

1. Core suite:
- Command: python backend/manage.py test portfolio.tests.test_order_flow
- Result: 42/42 PASS

2. Focused hardening suite:
- Command:
  - python backend/manage.py test portfolio.tests.test_order_flow.TestOrderFlowApi portfolio.tests.test_order_flow.TestOrderFlowSignalTask
- Result: 9/9 PASS

3. Commit and publish:
- Commit: 3f2c4907
- Branch: deploy
- Push: origin/deploy success

## 2) KPI snapshot (provisional)

| KPI | Current (local) | Target | Status | Notes |
|---|---:|---:|---|---|
| Duplicate event rate | 0.0% (0/23 in traversal test) | < 1% | PASS (provisional) | Derived from automated 5-page traversal test |
| Pagination consistency | 100% in local cursor tests | > 99.9% | PASS (provisional) | Includes 5-page traversal + cursor replay tests |
| Dark-flow severity info-collapsed risk | Pending formal sample review | Reduce vs baseline | PENDING | Need manual sample >= 30 events and PM/QA sign-off |

## 3) Remaining for final KPI sign-off

1. Source parity measurement across redis_stream, intraday_tick_db, vnstock fallback.
2. Manual severity sample validation (>=30 events) and review notes.
3. Before/after KPI summary approved by PM + QA + DevOps.

## 4) Risks / caveats

1. Local test logs still contain OpenCore DPIPlan warnings.
2. Local test logs still contain Redis WS connection warnings.
3. Neither warning blocks current Sprint 34 regression test outcomes.
