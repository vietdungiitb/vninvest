# DNSE Native Synchronization Implementation Plan (SaaS Architecture)

## 1. Goal
Deliver DNSE broker integration through `vnbroker` inside the Core SaaS stack, with `identity_access` as the auth SSOT and `user_workspace` as the broker data owner for project-owned state.

Core account management must remain usable without DNSE; DNSE link-up only adds broker sync and secure execution on top of the local account model.

Public market data must stay on the shared multi-provider `vnbroker` layer so the project does not hard-lock price, intraday, company, listing, news, or snapshot flows to DNSE.

## 2. Implementation Sequence

### Phase 0: Contract lock
- Confirm that all project data access goes through `vnbroker`.
- Confirm that DNSE is broker-only and that public market data remains multi-provider.
- Confirm that local account management is available before DNSE is linked, and that DNSE sync never replaces the local account baseline.
- Confirm the final storage model for broker credentials and tokens.
- Confirm whether `AccountSnapshot` is required for this release.
- Confirm the web entry point: `PortfoliosPage.js` as the main host, with a new `DNSEConnectionPanel` component if needed.

### Phase 1: Core storage and adapter scaffold
- Add `DNSECredential` to `packages/core/backend/src/user_workspace/models.py`.
- Add encryption helpers and admin/serializer support for DNSE secrets.
- Create `packages/core/backend/src/user_workspace/dnse_adapter.py` as thin project glue only if needed; the actual DNSE network, signature, and retry behavior must come from `vnbroker.connector.dnse`.
- Add unit tests for credential persistence and adapter bootstrap.

### Phase 2: Account discovery and mapping
- Extend `SubAccount` with DNSE linkage fields.
- Add a sync task in `packages/core/backend/src/user_workspace/tasks.py`.
- Add a workspace endpoint for DNSE account sync and a regression test for idempotent upsert.

### Phase 3: Balance and NAV snapshots
- Add `AccountSnapshot` to `user_workspace` if it is not already present.
- Add a balance sync task and a nightly snapshot job.
- Validate parity against DNSE balance payloads and ensure the selected account is stable.

### Phase 4: Transaction reconciliation
- Add an idempotent reconciliation task using broker order or deal IDs.
- Map broker fee and tax fields into the core transaction model.
- Ensure a second sync run adds zero duplicate `Transaction` rows.

### Phase 5: Web integration
- Add `DNSEConnectionPanel` under `packages/web/src/components/`.
- Integrate the panel into `packages/web/src/pages/PortfoliosPage.js`.
- Keep all calls routed through `coreApiAdapter.js`; do not add direct fetch calls.
- Do not move public market-data traffic to DNSE; keep it on the shared multi-provider `vnbroker` routes.

## 3. File Targets
- `packages/core/backend/src/user_workspace/models.py`
- `packages/core/backend/src/user_workspace/serializers.py`
- `packages/core/backend/src/user_workspace/views.py`
- `packages/core/backend/src/user_workspace/urls.py`
- `packages/core/backend/src/user_workspace/tasks.py`
- `packages/core/backend/src/user_workspace/dnse_adapter.py`
- `packages/web/src/pages/PortfoliosPage.js`
- `packages/web/src/components/DNSEConnectionPanel.js`
- `packages/web/src/adapters/coreApiAdapter.js`

## 4. Rollout Strategy
1. Land the core models and adapter scaffold.
2. Land account mapping and sync tasks.
3. Add snapshot parity and transaction reconciliation.
4. Execute a mandatory shadow run of minimum 3 real trading days for all Celery sync tasks.
5. Wire the web panel and finish with contract tests.
6. Promote only after the audit ledger and progress dashboard are updated.

## 5. Rules
- No legacy DB writes.
- No plaintext DNSE secrets.
- No new UI text without Vietnamese diacritics.
- No parallel writer outside the core workspace domain.
- No direct DNSE transport client outside `vnbroker`.
- No DNSE-only lock-in for public market data.
- No custom DNSE semantics; account/order states must mirror the provider contract.
