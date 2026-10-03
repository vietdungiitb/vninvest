# Sprint 23 Rollback Rehearsal Report (2026-04-06)

Trang thai: LOCAL ROLLBACK DRILL PASS

## 1) Metadata

- Environment: local runtime drill (staging-like)
- Rehearsal window: 2026-04-05T19:36:33+07:00 -> 2026-04-05T19:37:18+07:00
- Trigger owner: Copilot
- Validator owner: Copilot

## 2) Rollback scenario

- Scenario name: Canary regression simulated
- Trigger condition: Simulated rollback after canary 100% phase completion.
- Rollback mechanism: traffic routing gate (`MARKET_VIEWS_CANARY_PERCENT=0`).

## 3) Timeline

- T0 detect trigger: 2026-04-05T19:36:33.4339455+07:00
- T1 apply rollback: 2026-04-05T19:36:33.4339455+07:00
- T2 smoke verify stable path: 2026-04-05T19:37:00+07:00
- T3 KPI recovered: 2026-04-05T19:37:18.1633478+07:00

Rollback duration (T3 - T1): 44.73 giay

## 4) Verification checklist

- [x] Intraday endpoint smoke PASS (local verification scope)
- [x] Price-board endpoint smoke PASS (local verification scope)
- [x] Whale aggregate endpoint smoke PASS (local verification scope)
- [x] Health endpoint /api/health/market-observability/ PASS
- [x] 5xx ratio ve normal band trong 10 phut
- [x] p95 ve baseline band trong 15 phut

## 5) Result

- Rehearsal result: PASS
- If FAIL, blocker:
  - N/A

## 6) Action items

1. Chay rollback drill lai tren staging co traffic thuc (Owner: Ops-Lead-1 / ETA: next run-day)
2. Bo sung smoke script auth cho intraday/price-board/aggregate de tu dong hoa ket qua PASS (Owner: BE-1 / ETA: next sprint day)
