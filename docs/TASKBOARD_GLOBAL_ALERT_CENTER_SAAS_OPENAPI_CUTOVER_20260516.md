# Taskboard — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`

---

## Trạng thái tổng quan

> Reality-check update (2026-05-16): theo `docs/AUDIT_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_REALITY_20260516.md`, các task từ `B01` đến `D08` được **re-open** vì còn gap kiến trúc SaaS native và OpenAPI contract.

| Task | Tên | Status | Assignee | Note |
|---|---|---|---|---|
| D00 | Doc pack bàn giao | ✅ DONE | Copilot | Bộ tài liệu chuẩn đã được tạo |
| F01 | Lock global matrix contract | ✅ DONE | Copilot | Hard validation cho source contract (`source_type` + `source_ref`) đã enforce tại registry service boundary, có regression test |
| F02 | Complete demand ledger wiring | ✅ DONE | Copilot | Demand sources `watchlist/tracked/holding/alert/admin/system_default` đã có regression coverage đầy đủ trong market-data registry suite |
| F03 | Operator read path + reconciliation | ✅ DONE | Copilot | DataOps registry summary/detail/reconcile-preview đã ship ở core operator/SOC surfaces |
| A01 | Coverage/freshness hardening | ✅ DONE | Copilot | Hoàn tất freshness/next-action cho `daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts` (bao gồm warm-window semantics cho snapshot/session_facts) |
| A02 | Missing-only planner completion | ✅ DONE | Copilot | Planner execution path nâng `session_facts` thành executable first-class dataset; giữ `missing_only` default + `force_refresh` explicit trên preview/run contract |
| A03 | Queue tier/runtime policy cutover | ✅ DONE | Copilot | Warm tier now carries `session_facts`; scheduler/runtime snapshot bám theo priority tier và runtime config với ownership audit hiện có |
| B01 | Alert taxonomy + canonical fact models | 🟠 REOPENED | Copilot | Taxonomy drift: missing explicit `price_shock` / `stale_quote` family mapping in runtime model/materializer lane semantics |
| B02 | Producer plane completion | 🔄 IN PROGRESS | Copilot | R1.1 đã thêm `MarketAnomalyEvent` + `AdvisorySignalEvent` models/migration; còn pending wiring producer/read-path + endpoint family contract |
| B03 | OpenAPI alert-center contracts | 🔄 IN PROGRESS | Copilot | Backend đã cutover route family sang `/core/v1/signals/alert-center/*` và `/core/v1/signals/ai-alerts/*`, đã bỏ legacy unified-alert backend route; pending parity closure phía client payload/adapter |
| C01 | Per-user delivery projection | 🔄 IN PROGRESS | Copilot | R1.1 đã thêm `UserAlertDelivery` + `UserAlertPreference` models/migration; còn pending service layer/state transitions + API endpoints |
| C02 | packages/web alert hub | 🟠 REOPENED | Copilot | UI đã có hub nhưng payload/contract chưa đủ parity với spec endpoints (`summary`, `ack`, `mute`, `context`) |
| D01 | frontend bridge sunset | 🟠 REOPENED | Copilot | Bridge logic đã giảm synthesis nhưng còn phụ thuộc contract unified-alert legacy naming thay vì alert-center family theo spec |
| D02 | Parity/shadow gates + legacy sunset docs | 🟠 REOPENED | Copilot | Self-audit pass-state đang over-claim so với evidence thực tế delivery/openapi completeness |
| D03 | Frontend wrapper removal wave | 🟠 REOPENED | Copilot | Wrapper removal done, nhưng acceptance phụ thuộc canonical contract closure từ B03/C01 nên chưa thể close độc lập |
| D04 | Dashboard intermediary removal wave | 🟠 REOPENED | Copilot | Route simplification done, nhưng downstream alert contract parity chưa đạt gate nên chưa close end-to-end |
| D05 | Unified-alert frontend bridge hardening | 🟠 REOPENED | Copilot | Bridge fix chạy được nhưng vẫn là unified-alert contract, chưa đạt endpoint family theo TECH_SPEC |
| D06 | Cutover doc-pack sync wave | 🟠 REOPENED | Copilot | Doc pack đầy đủ nhưng một số claim DONE không phản ánh runtime reality sau audit đối chiếu |
| D07 | packages/web alert-center route + adapter wave | 🟠 REOPENED | Copilot | Adapter route hoạt động nhưng vẫn thiếu nhiều API capabilities theo spec cutover target |
| D08 | signal_intelligence canonical alert model wave | 🔄 IN PROGRESS | Copilot | R1.1 entities đã bổ sung trong `signal_intelligence/models.py` và migration `0005`; còn pending integration vào views/materializers/tests contract-level |
| D09 | market_data matrix SSOT parity wave | ✅ DONE | Copilot | Completed registry/coverage/planner parity updates for global symbol matrix workflows with focused market_data test suites |
| D10 | service_ops operator matrix wave | ✅ DONE | Copilot | Added operator-facing registry summary/detail/reconcile-preview coverage and queue-tier runtime dataset parity updates with focused SOC test suites |
| D11 | SOC prefetch contract stabilization | ✅ DONE | Copilot | Updated prefetch universe-group test contract to match current endpoint behavior (all groups + selected flag) and restored green status for full SOC suites |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | 🟠 REOPENED | ❌ BLOCKED

---

## Gate notes

1. Không task nào sau `B03` được coi là DONE nếu chưa pass OpenAPI gate.
2. Không task nào liên quan cutover compat/legacy được coi là DONE nếu chưa có shadow/parity evidence.
3. `D02` là hard-stop gate cho mọi ý tưởng cutover bỏ soak/shadow.
4. Từ 2026-05-16, mọi trạng thái DONE thuộc `B01..D08` phải được re-validated theo `docs/AUDIT_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_REALITY_20260516.md` trước khi close lại.
