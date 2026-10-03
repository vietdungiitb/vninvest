# Sprint 26 - Day 2 Execution Log (2026-04-07)

## Status
- Sprint: 26 (OpenCore License & Billing)
- Day: 2
- Overall: IN PROGRESS
- Objective: Hook feature gating vao endpoint business uu tien (P0)

## Done Today
- [x] Hook OpenCore feature gating vao 3 endpoint P0 trong stock workspace:
  - `/api/stock-management/stocks/<symbol>/order-flow/` -> `dark_pool_flow`
  - `/api/stock-management/stocks/<symbol>/ai-advisory-session/` -> `whale_momentum`
  - `/api/stock-management/stocks/<symbol>/ai-advisory-components/generate/` -> `sentiment_score`
- [x] Bo sung mapping table feature-key cho endpoint P0 ngay trong backend views.
- [x] Bo sung 4 test smoke cho behavior feature-locked/allow theo DPI license tier.

## Notes
- Co co che transitional compatibility cho user legacy chua co DPI license de tranh hard-break truoc backfill.
- Response contract khi bi khoa feature: HTTP 403 + `code=feature_locked` + `feature_key`.

## In Progress
- [ ] Mo rong quota enforcement cho endpoint premium vua gate (neu can theo policy).
- [ ] Chot feature-key mapping cho endpoint P1 (component refresh/regenerate).

## Risks
- Risk: Legacy user khong co DPI license co the tao hanh vi khac voi user da backfill.
- Mitigation: rollout theo batch + bo sung checklist backfill license.

## Plan Next (Day 3)
1. Mo rong quota gate cho endpoint premium P0/P1.
2. Bo sung test matrix trial/grace + free/pro/premium/admin.
3. Bat dau chot source-of-truth trial/grace de tranh xung dot logic.
