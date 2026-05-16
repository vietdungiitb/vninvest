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
| B01 | Alert taxonomy + canonical fact models | ✅ DONE | Copilot | Fact-first materialization đã ghi `MarketAnomalyEvent` (`price_shock`/`stale_quote`) và `AdvisorySignalEvent` trước khi liên kết sang UnifiedAlert; taxonomy feed/filter giữ đúng lane semantics |
| B02 | Producer plane completion | ✅ DONE | Copilot | Producer/materializer pipeline đã wiring đầy đủ cho market anomaly + AI signal với linkage Fact → UnifiedAlert và regression coverage tương ứng |
| B03 | OpenAPI alert-center contracts | ✅ DONE | Copilot | Native endpoint family `/core/v1/signals/alert-center/*` + `/core/v1/signals/ai-alerts/*` đã active end-to-end với adapter/UI/backend regression suites pass |
| C01 | Per-user delivery projection | ✅ DONE | Copilot | Delivery service/state transitions + user-scope ack/mute đã có API coverage, bao gồm cross-user scope block và mute filtering behavior |
| C02 | packages/web alert hub | ✅ DONE | Copilot | Alert hub đã có full workflow feed/summary/detail/context/ack/mute trên packages/web và có regression test cho adapter contracts |
| D01 | frontend bridge sunset | ✅ DONE | Copilot | Runtime path chính đã chuẩn hóa sang naming `AlertCenterFeed` cho frontend bridge và mobile service layer; giữ alias tương thích tạm thời để migration an toàn |
| D02 | Parity/shadow gates + legacy sunset docs | 🔄 IN PROGRESS | Copilot | Đã có parity/shadow package; đã thêm template production shadow/soak + parity dashboard checklist, còn pending điền dữ liệu thực tế >= 3 ngày trade để close gate |
| D03 | Frontend wrapper removal wave | 🟠 REOPENED | Copilot | Wrapper removal done, nhưng acceptance phụ thuộc canonical contract closure từ B03/C01 nên chưa thể close độc lập |
| D04 | Dashboard intermediary removal wave | 🟠 REOPENED | Copilot | Route simplification done, nhưng downstream alert contract parity chưa đạt gate nên chưa close end-to-end |
| D05 | Unified-alert frontend bridge hardening | ✅ DONE | Copilot | Frontend bridge đã dùng native feed, browser-side synthesis đã bỏ, runtime path chính đã đổi sang naming `AlertCenterFeed` và giữ alias tương thích để migration an toàn |
| D06 | Cutover doc-pack sync wave | 🟠 REOPENED | Copilot | Doc pack đầy đủ nhưng một số claim DONE không phản ánh runtime reality sau audit đối chiếu |
| D07 | packages/web alert-center route + adapter wave | ✅ DONE | Copilot | Adapter + page interaction coverage cho detail/context/ack/mute workflow đã hoàn tất và pass test |
| D08 | signal_intelligence canonical alert model wave | ✅ DONE | Copilot | Integration đã hoàn tất ở materializers/tests contract-level: facts được persist và liên kết vào read model; focused signal_intelligence suites pass |
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
