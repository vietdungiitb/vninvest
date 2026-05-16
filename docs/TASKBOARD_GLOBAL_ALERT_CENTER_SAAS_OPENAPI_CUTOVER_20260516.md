# Taskboard — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`

---

## Trạng thái tổng quan

| Task | Tên | Status | Assignee | Note |
|---|---|---|---|---|
| D00 | Doc pack bàn giao | ✅ DONE | Copilot | Bộ tài liệu chuẩn đã được tạo |
| F01 | Lock global matrix contract | ✅ DONE | Copilot | Hard validation cho source contract (`source_type` + `source_ref`) đã enforce tại registry service boundary, có regression test |
| F02 | Complete demand ledger wiring | ✅ DONE | Copilot | Demand sources `watchlist/tracked/holding/alert/admin/system_default` đã có regression coverage đầy đủ trong market-data registry suite |
| F03 | Operator read path + reconciliation | ✅ DONE | Copilot | DataOps registry summary/detail/reconcile-preview đã ship ở core operator/SOC surfaces |
| A01 | Coverage/freshness hardening | ✅ DONE | Copilot | Hoàn tất freshness/next-action cho `daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts` (bao gồm warm-window semantics cho snapshot/session_facts) |
| A02 | Missing-only planner completion | ✅ DONE | Copilot | Planner execution path nâng `session_facts` thành executable first-class dataset; giữ `missing_only` default + `force_refresh` explicit trên preview/run contract |
| A03 | Queue tier/runtime policy cutover | ✅ DONE | Copilot | Warm tier now carries `session_facts`; scheduler/runtime snapshot bám theo priority tier và runtime config với ownership audit hiện có |
| B01 | Alert taxonomy + canonical fact models | ✅ DONE | Copilot | UnifiedAlert now exposes confidence/freshness/evidence and lane-separated main vs AI read paths; materializers backfill the new contract |
| B02 | Producer plane completion | ✅ DONE | Copilot | Core now has native producer tasks for whale, stale quote, market anomaly, AI signal, and unified-alert materialization with explicit evidence fields |
| B03 | OpenAPI alert-center contracts | ✅ DONE | Copilot | `/api/signals/*` alert endpoints now carry OpenAPI annotations, lane query param, and cursor response schemas aligned to the new read model |
| C01 | Per-user delivery projection | ✅ DONE | Copilot | Added canonical per-user delivery endpoint filtered by watchlists, tracked symbols, holdings, and whale threshold while keeping detection global |
| C02 | packages/web alert hub | ✅ DONE | Copilot | Added packages/web `alert-center` hub page, lane-aware delivery adapter, live route coverage, and signal navigation wiring on the canonical core API path |
| D01 | frontend bridge sunset | ✅ DONE | Copilot | Removed browser-side alert synthesis, bridged unified alerts to core delivery, and wrapped legacy whale/dashboard surfaces onto canonical pages |
| D02 | Parity/shadow gates + legacy sunset docs | ✅ DONE | Copilot | Added shadow/parity evidence pack, converted self-audit to pass-state, and kept the anti-bypass gate explicit |
| D03 | Frontend wrapper removal wave | ✅ DONE | Copilot | Removed `WhaleAlertsHub` and `LegacyDashboard` wrapper pages; router now mounts canonical pages directly while preserving `/admin-ops` compatibility alias |
| D04 | Dashboard intermediary removal wave | ✅ DONE | Copilot | Removed `frontend/src/pages/Dashboard.jsx` and routed `/dashboard` directly to `ModernDashboard` while preserving existing shell/debug route behavior |
| D05 | Unified-alert frontend bridge hardening | ✅ DONE | Copilot | Bridged legacy `getUnifiedAlerts` to canonical `coreApiAdapter` delivery path and removed browser-side snapshot synthesis fallback while preserving dashboard compatibility fields |
| D06 | Cutover doc-pack sync wave | ✅ DONE | Copilot | Added full Global Alert Center SaaS OpenAPI cutover handoff/spec/plan/runbook document pack to repository |
| D07 | packages/web alert-center route + adapter wave | ✅ DONE | Copilot | Added `alert-center` route/navigation/page registry wiring in packages/web and completed adapter delivery endpoint + env-factory behavior with focused tests |
| D08 | signal_intelligence canonical alert model wave | ✅ DONE | Copilot | Added unified-alert read model fields, evidence-aware materializers, delivery route registration, and focused signal_intelligence regression coverage |
| D09 | market_data matrix SSOT parity wave | ✅ DONE | Copilot | Completed registry/coverage/planner parity updates for global symbol matrix workflows with focused market_data test suites |
| D10 | service_ops operator matrix wave | ✅ DONE | Copilot | Added operator-facing registry summary/detail/reconcile-preview coverage and queue-tier runtime dataset parity updates with focused SOC test suites |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## Gate notes

1. Không task nào sau `B03` được coi là DONE nếu chưa pass OpenAPI gate.
2. Không task nào liên quan cutover compat/legacy được coi là DONE nếu chưa có shadow/parity evidence.
3. `D02` là hard-stop gate cho mọi ý tưởng cutover bỏ soak/shadow.
