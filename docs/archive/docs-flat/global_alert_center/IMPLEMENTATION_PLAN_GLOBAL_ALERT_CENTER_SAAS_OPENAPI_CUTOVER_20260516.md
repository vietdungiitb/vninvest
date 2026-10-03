# Implementation Plan — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16  
**Status**: Approved — Ready for execution  
**Parent**: `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`

---

## 1. Tổng quan

Kế hoạch này coi `global symbol matrix` là foundation, sau đó triển khai 4 workstreams phụ thuộc:

1. Planner + freshness policy
2. Canonical alert facts + unified alert model
3. Per-user delivery + AI lane
4. OpenAPI contracts + packages/web cutover + compat sunset

---

## 2. Dependency graph

```text
F01 Global matrix contract lock
  -> F02 Demand ledger wiring
    -> F03 Operator read path + reconciliation
      -> A01 Coverage/freshness hardening
        -> A02 Missing-only planner completion
          -> A03 Queue tier/runtime policy cutover
            -> B01 Alert taxonomy + canonical fact models
              -> B02 Producer plane completion
                -> B03 OpenAPI alert-center contracts
                  -> C01 Per-user delivery projection
                    -> C02 packages/web alert hub
                      -> D01 frontend bridge sunset
                        -> D02 parity/shadow gates + legacy sunset docs
```

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| F01 | Lock global matrix contract | `market_data/models.py`, `market_data/global_symbol_registry.py` | Registry, demand source, coverage semantics được khóa làm foundation chính thức |
| F02 | Complete demand ledger wiring | `user_workspace/signals.py`, registry services | System defaults, admin groups, holdings, watchlists, tracked symbols, alerts cùng promote qua một boundary |
| F03 | Operator read path + reconciliation | `service_ops/views/dataops.py`, admin/operator contracts | Operator xem được registry summary, source ledger, decay state, reconcile preview |
| A01 | Coverage/freshness hardening | `market_data/global_symbol_coverage.py` | Dataset freshness và next-action đủ cho alert-center và planner |
| A02 | Missing-only planner completion | `market_data/global_symbol_planner.py`, `data_ingest` tasks | Planner chỉ chạy coverage-gap/freshness-gap driven, support session-facts-first |
| A03 | Queue tier/runtime policy cutover | `service_ops` runtime config + scheduler policy | Hot/warm/cold/recovery bám matrix priority và demand intensity |
| B01 | Alert taxonomy + canonical fact models | `signal_intelligence/models.py` + serializers | `whale`, `dark_flow`, `price_shock`, `stale_quote`, `system`, `ai_signal` có canonical representation |
| B02 | Producer plane completion | `signal_intelligence/materializers.py`, `tasks.py`, market/advisory producers | Không còn browser-side truth; core tạo đầy đủ alert facts từ raw/canonical inputs |
| B03 | OpenAPI alert-center contracts | `signal_intelligence/views.py`, `urls.py`, schema metadata | `/core/v1/signals/alert-center/*` và `/core/v1/signals/ai-alerts/*` pass contract gates |
| C01 | Per-user delivery projection | delivery services + preference persistence | User chỉ thấy alert relevant; có mute/snooze/ack/cooldown |
| C02 | packages/web alert hub | `packages/web/src/adapters/coreApiAdapter.js` + pages/components | packages/web đọc thuần native contracts, main feed và AI lane tách riêng |
| D01 | frontend bridge sunset | `frontend/src/hooks/useUnifiedAlerts.js`, `frontend/src/api/client.js` | frontend cũ chỉ bridge sang server truth, bỏ client synthesis |
| D02 | Parity/shadow gates + legacy sunset docs | rollout docs, evidence, taskboard | Compat alert paths chỉ được sunset sau parity/shadow gates; không có no-soak bypass |

---

## 4. Chi tiết từng task

### F01 — Lock global matrix contract

**Mục tiêu:** Chốt `global symbol matrix` thành câu trả lời duy nhất cho câu hỏi “hệ thống đang giám sát mã nào và vì sao”.

**Files chính:**
- `packages/core/backend/src/market_data/models.py`
- `packages/core/backend/src/market_data/global_symbol_registry.py`

**DoD:**
- Một symbol chỉ có một registry row canonical.
- Demand source, priority tier và coverage/freshness không bị trộn vào run-state.
- `decay_after_at` và demotion semantics được khóa rõ.

### F02 — Complete demand ledger wiring

**Mục tiêu:** Mọi nguồn demand hợp lệ đều promote vào cùng một ledger.

**Files chính:**
- `packages/core/backend/src/user_workspace/signals.py`
- `packages/core/backend/src/market_data/global_symbol_registry.py`

**DoD:**
- Watchlist, tracked, holding, price alert, system default, admin group đều đi qua cùng service.
- Không còn universe truth rải rác ở nhiều module.

### F03 — Operator read path + reconciliation

**Mục tiêu:** Cho operator nhìn được matrix hiện hành và rebuild được truth từ dữ liệu hiện hữu.

**Files chính:**
- `packages/core/backend/src/service_ops/views/dataops.py`
- `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`

**DoD:**
- Có registry summary, symbol detail, source ledger, decay candidates.
- Có reconcile preview hoặc audited rebuild path.

### A01 — Coverage/freshness hardening

**DoD:**
- `daily_prices`, `price_board_snapshot`, `intraday_bars`, `intraday_ticks`, `session_facts` đều có freshness state và next action.
- Coverage summary đủ để planner và alert-center không suy diễn ad hoc.

### A02 — Missing-only planner completion

**DoD:**
- Default là `missing_only`.
- `force_refresh` phải explicit, audited.
- `session_facts` trở thành dataset planner-first-class.

### A03 — Queue tier/runtime policy cutover

**DoD:**
- Queue tiers bám theo priority tier của matrix.
- Scheduler không tự build universe riêng.
- Runtime config operator preview/apply có ownership audit.

### B01 — Alert taxonomy + canonical fact models

**DoD:**
- Main alert center family được khóa rõ.
- AI lane là family riêng, không trộn vào main feed mặc định.
- Unified alert read model đủ fields cho severity, confidence, freshness, evidence.

### B02 — Producer plane completion

**DoD:**
- Order-flow, market anomaly, stale quote và AI signal đều có producer path trong core.
- Không còn client-side business logic làm source of truth.

### B03 — OpenAPI alert-center contracts

**DoD:**
- Contracts được annotate đầy đủ bằng OpenAPI.
- Pagination, error envelope, tenant isolation và rate-limit semantics có test.

### C01 — Per-user delivery projection

**DoD:**
- Detection toàn cục, delivery theo user.
- User preferences không xóa canonical global event.

### C02 — packages/web alert hub

**DoD:**
- `coreApiAdapter` là adapter duy nhất của alert-center ở packages/web.
- packages/web hiển thị được main feed và AI lane riêng.

### D01 — frontend bridge sunset

**DoD:**
- `frontend/src` không còn synthesize alert nghiệp vụ.
- Compat endpoints chỉ còn temporary bridge và bị giảm dần traffic.

### D02 — Parity/shadow gates + legacy sunset docs

**DoD:**
- Có evidence parity/shadow rõ ràng.
- Không có tài liệu hoặc execution plan nào hợp thức hóa việc bỏ shadow/soak gates.

---

## 5. Validation gates toàn workstream

1. `market_data.tests.test_global_symbol_registry`
2. `market_data.tests.test_global_symbol_coverage`
3. `market_data.tests.test_global_symbol_planner`
4. `service_ops.tests.test_soc_api_domain`
5. `service_ops.tests.test_soc_tasks`
6. `signal_intelligence.tests.test_materializers`
7. Suite API contract mới cho alert-center và per-user delivery
8. packages/web adapter/UI tests cho alert hub
9. `./start_dev.ps1` smoke cho mọi slice runtime/UI
10. Shadow/parity evidence trước mọi cutover có ảnh hưởng legacy

---

## 6. Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Universe drift giữa matrix và alert detection | Medium | Detection chỉ đọc từ matrix service boundary |
| Alert spam khi mở rộng price_shock/stale_quote | High | Cooldown, dedupe, merge-window và delivery suppression |
| Contract drift giữa core và packages/web | Medium | OpenAPI-first + adapter tests + examples |
| Bỏ qua shadow/parity gate | High | Hard block ở taskboard, self-audit và rollout protocol |
