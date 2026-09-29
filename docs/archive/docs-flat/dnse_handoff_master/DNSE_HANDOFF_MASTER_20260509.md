# DNSE Integration Handoff Master (SaaS Edition)

## 1. Project Overview
This bundle is the implementation handoff for DNSE broker integration through `vnbroker` in VNInvest's Core SaaS stack.

Current workspace reality:
- Core backend code lives under `packages/core/backend/src/`.
- Web shell and shared client adapters live under `packages/web/src/`.
- Legacy `backend/portfolio` is reference material only; any DNSE-specific broker flow must be routed through `vnbroker`, not implemented as a direct project-side DNSE client.

Project policy lock:
- `vnbroker` is the single library source for all project data access.
- Core account management remains available even before DNSE is linked; DNSE adds a broker-sync overlay, not a replacement for local account ownership.
- DNSE is broker-only inside `vnbroker`: account, balance, positions, orders, OTP, trading token, and reconciliation.
- Public market data (price, intraday, company, listing, news, market snapshot) MUST remain multi-provider inside `vnbroker`; do not pin those flows to DNSE.
- No direct DNSE HTTP calls or parallel provider modules outside `vnbroker`.

## 2. Read Order
All developers and AI sessions SHOULD read these documents in order before starting work:

1. [DNSE_CONFIG_OWNERSHIP_MATRIX_20260509.md](../dnse_config_ownership/DNSE_CONFIG_OWNERSHIP_MATRIX_20260509.md)
2. [DNSE_INTEGRATION_ANALYSIS_20260509.md](../dnse_integration_analysis/DNSE_INTEGRATION_ANALYSIS_20260509.md)
3. [DNSE_IMPLEMENTATION_PLAN_20260509.md](../dnse_implementation_plan/DNSE_IMPLEMENTATION_PLAN_20260509.md)
4. [DNSE_TASKBOARD_AND_SLICES_20260509.md](../dnse_taskboard_and/DNSE_TASKBOARD_AND_SLICES_20260509.md)
5. [DNSE_TRACEABILITY_MATRIX_20260509.md](../dnse_traceability_matrix/DNSE_TRACEABILITY_MATRIX_20260509.md)
6. [DNSE_SELF_AUDIT_AND_TEST_PROTOCOL_20260509.md](../dnse_self_audit/DNSE_SELF_AUDIT_AND_TEST_PROTOCOL_20260509.md)

## 3. Current Code Anchors
- Core identity and tenant context: `packages/core/backend/src/identity_access/`
- Core auth and PAT flow: `packages/core/backend/src/identity_access/views_auth.py`
- Workspace domain models: `packages/core/backend/src/user_workspace/models.py`
- Workspace REST API: `packages/core/backend/src/user_workspace/views.py`
- Workspace URLConf: `packages/core/backend/src/user_workspace/urls.py`
- Web adapter contract: `packages/web/src/adapters/coreApiAdapter.js`
- Web entry pages: `packages/web/src/pages/PortfoliosPage.js`, `packages/web/src/pages/StockDetailPage.js`, `packages/web/src/pages/TransactionsPage.js`
- Legacy reference only: `backend/portfolio/models.py`, `backend/portfolio/encryption_utils.py`

## 4. Handoff Scope
- Add DNSE broker-only integration glue that delegates to `vnbroker`, plus sync tasks and snapshot/materialization in core.
- Keep public market-data flows on the shared multi-provider `vnbroker` layer.
- Extend the web shell through `coreApiAdapter.js` only.
- Keep `identity_access` as the user/tenant SSOT.
- Use Vietnamese UI text with full diacritics for any new user-facing surfaces.

## 5. Hard Constraints
1. No legacy DB writes from the DNSE path.
2. No direct `fetch` calls from `packages/web`.
3. DNSE secrets and passwords must be encrypted at rest.
4. Access and trading tokens must stay short-lived in Redis or the session cache.
5. Every slice must include tests and audit evidence.
6. Do not introduce a parallel writer outside the core workspace domain.
7. DNSE-linked account and order flows must match DNSE contract semantics exactly; do not invent alternate statuses, field names, or state transitions.
8. Public market-data routing must stay multi-provider and must not be fixed to DNSE.
9. Do not add a direct DNSE transport/client outside `vnbroker`.

## 6. Ready State
The bundle is aligned with the actual workspace anchors and is ready for the implementation team.

- Status: Ready for code-team execution.
- Owner: AI Architecture / VNInvest Core Team.
- Date: 2026-05-09
