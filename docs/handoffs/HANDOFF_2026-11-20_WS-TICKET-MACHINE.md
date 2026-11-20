# HANDOFF 2026-11-20 — WS ticket machine scope

- **Repo/branch**: `vninvest` · `dev` (slice branch `feat/ws-ticket-machine-iso`, commit `b34e3cded`)
- **Status**: **done** — deploy staging xanh, E2E demo có giá thật.
- **Scope**: machine PAT có scope `ws:realtime` được mint ticket WS/SSE 30s, single-use; staff/superuser bị strip tại 5 redeem site; AlertCenter từ chối machine ticket 403.

## Evidence
- Plan: `docs/PLAN_WS_TICKET_MACHINE_SCOPE_20261120.md`
- Evidence: `docs/evidence/ws-ticket-machine/EVIDENCE_20261120.md` — RED `FAILED (errors=5)` → GREEN `Ran 24 tests — OK` → deploy `core-api healthy` → `POST ws-ticket 200 {"expiresIn":30}`.
- Ledger Entry 564 (renumber từ 563 do agent khác chiếm 563).
- Widget phía consuming: `vninvestcharts-widget/docs/evidence/D1-WATCHLIST-LIVE/{report,staging}.md` — E2E `rows=30`, 6/6 giá thật, 0 console error, health `d3b9d356`.

## Next / owner
- PAT demo id 1067 hết hạn 2027-11-20; rotate định kỳ (lưu ý pepper từ `compose.staging.env`, DSN pgbouncer).
- Main-branch merge của handoff này: **chưa làm** (repo dùng `dev` daily; coordinator quyết khi chốt release).
- Owner: coordinator.
