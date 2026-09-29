# HANDOFF MASTER - Scraping System SaaS-Native + OpenAPI Addendum

**Date**: 2026-05-15  
**Status**: READY FOR EXECUTION  
**Scope**: extend the existing SaaS-native scraping workstream with a complete backend/frontend handoff package, OpenAPI contract closure, and a frontend runtime config/admin surface.

---

## 1. Muc tieu

This addendum extends the existing bundle in `docs/SCRAPING_SYSTEM_SAAS_NATIVE_HANDOFF_MASTER_20260514.md` and the core API rules in `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`.

The workstream must give the code team everything they need to execute without asking back:

1. canonical SaaS-native backend routes and request/response contracts,
2. runtime config and admin control surfaces in the frontend,
3. test/audit/checklist artifacts,
4. clear task breakdown and ownership boundaries,
5. retention, materialization, and cutover rules for market data and signal data.

---

## 2. Locked decisions

1. `market_data.vnbroker_adapter` remains the only broker access SSOT.
2. `service_ops` remains the operator control plane for scraping/runtime coordination.
3. `OpenAPI` is contract-first; every new or changed API must carry schema, examples, status codes, and error envelope semantics.
4. Raw tick is short-lived. Default retention target in this program is 7 days in Postgres hot storage.
5. Intraday bars are also hot and short-lived in the primary plan. Daily and derived facts are long-lived.
6. Whale canonical events and SessionFacts are long-lived materialized facts.
7. 10m candle is out of scope for this bundle.
8. Frontend must expose a runtime config/admin layer so operators can view, preview, and control runtime settings without leaving the UI.
9. No direct provider import or direct fetch bypass is allowed on steady-state paths.
10. Portfolio-serving joins, if needed, must be projection-based and not ad hoc per request.

---

## 3. Documents in this bundle

1. `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
2. `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
3. `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
4. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_BACKEND_DESIGN_20260515.md`
5. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_FRONTEND_DESIGN_20260515.md`
6. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_SELF_AUDIT_AND_TEST_PROTOCOL_20260515.md`
7. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_TRACEABILITY_MATRIX_20260515.md`
8. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_EXECUTION_EVIDENCE_TEMPLATE_20260515.md`
9. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_CODE_QUALITY_CONSTITUTION_20260515.md`

---

## 4. Canonical architecture target

```text
Demand sources
  system defaults
  holdings
  watchlists
  tracked symbols
  alerts
  admin runtime policy
        |
        v
Global registry / queue planner
        |
        v
service_ops control plane
        |
        +--> ingestion / backfill / warmup
        +--> retention / purge / forensic window
        +--> runtime config / operator audit
        |
        v
Native data plane
  DailyPrice / IntradayBar / IntradayTick
  WhaleAlertCanonical / OrderFlowEvent
  SessionFacts / SessionFactsBucket
        |
        v
Frontend consumers
  charts / tape / advisory / admin ops / data ops
```

---

## 5. Success criteria

1. Backend and frontend share one SSOT model for contracts, runtime config, and read paths.
2. Operators can manage runtime config and control actions from the UI with permission-aware controls and audit trail.
3. OpenAPI metadata is complete for the routes in scope.
4. Materialized facts are available for charts and advisory without full raw tick scans on the primary path.
5. Audit, traceability, and evidence docs are enough for another engineer to reproduce the slice.

---

## 6. Non-goals

1. Building a new provider integration beyond the current broker roster.
2. Reintroducing legacy bridge paths as steady-state dependencies.
3. Making 10m candle a new canonical timeframe in this workstream.
4. Replacing the existing SaaS-native bundles already in the repo.

---

## 7. Reference order when there is a conflict

1. `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
2. `docs/IMPLEMENTATION_PLAN_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
3. `docs/TASKBOARD_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md`
4. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_BACKEND_DESIGN_20260515.md`
5. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_FRONTEND_DESIGN_20260515.md`
6. `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_SELF_AUDIT_AND_TEST_PROTOCOL_20260515.md`
7. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
8. `AGENTS.md`
9. `quality/QUALITY.md`
