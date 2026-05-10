# DNSE Integration Taskboard & Slices

## 0. Project Policy Lock
- All project data access must route through `vnbroker`.
- Core account management stays available without DNSE; DNSE is an optional broker-sync overlay on top of the local account model.
- DNSE slices are broker-only: account, balance, positions, orders, OTP, trading token, and reconciliation.
- Public market data (price, intraday, company, listing, news) must remain multi-provider inside `vnbroker` and must never be hard-coded to DNSE.
- DNSE-linked account and order views must preserve provider contract semantics exactly.

## 1. Work Slice Definition

### Slice 1: Credential Storage and Adapter Scaffold
- **Goal**: Create encrypted DNSE credential storage and a broker-only integration point that delegates to `vnbroker`.
- **Tasks**:
    - Add `DNSECredential` to `packages/core/backend/src/user_workspace/models.py`.
    - Add serializer/admin support for credential management.
    - Create `packages/core/backend/src/user_workspace/dnse_adapter.py` as thin glue only if needed; do not reimplement DNSE HTTP/signature logic outside `vnbroker`.
    - Add a focused credential bootstrap test.
- **Evidence**: Unit test showing encrypted persistence and mocked adapter login/bootstrap.

### Slice 2: Account Discovery and Mapping [DONE]
- **Goal**: Populate `SubAccount` from DNSE and keep the mapping idempotent.
- **Tasks**:
- [x] Extend `SubAccount` with `external_id`, `broker_source`, and `sync_status`.
- [x] Implement `sync_dnse_accounts_task` in `backend/portfolio/tasks_dnse.py`.
- [x] Add a workspace API endpoint for account sync.
- **Evidence**: Unit tests `test_dnse_slice2_sync` passed.

### Slice 3: Balance and NAV Synchronization [DONE]
- **Goal**: Materialize account balance snapshots in core.
- **Tasks**:
- [x] Ensure `AccountSnapshot` model exists with required fields and defaults.
- [x] Implement `sync_dnse_balances_task` and deploy in shadow run mode.
- [x] Schedule nightly snapshot generation (Celery beat).
- **Evidence**: Unit tests `test_dnse_slice3_balances` passed.

### Slice 4: Transaction Reconciliation [DONE]
- **Goal**: Reconcile historical orders without duplicates.
- **Tasks**:
- [x] Implement `reconcile_dnse_transactions_task`.
- [x] Derive idempotency from DNSE `orderId` or `dealId` via `external_id`.
- [x] Map broker fee and tax fields into `Transaction`.
- **Evidence**: Unit tests `test_dnse_slice4_reconcile` passed.

### Slice 5: Secure Execution and Web Panel [IN PROGRESS]
- **Goal**: Add the DNSE connection panel and secure order flow.
- **Tasks**:
- [x] Add `DNSEConnectionPanel` under `frontend/src/components/`.
- [x] Integrate it into `frontend/src/pages/PortfolioManagement.jsx`.
- [x] Wire token status and place-order placeholders through `api/client.js`.
- [ ] Implement secure order signing/OTP flow in `vnbroker`.
- **Evidence**: UI panel visible in Portfolio Management, able to trigger account sync.

## 2. Audit Evidence Obligations
Each slice MUST include an entry in `docs/CODE_CHANGE_AUDIT_LEDGER.md` with:
1. List of modified files.
2. Validation command and result.
3. Payload snapshot for API changes.
4. Residual risk note.

## 3. Implementation Guardrails
- If DNSE sync fails, show an "Out of Sync" warning and do not allow manual editing of synced fields.
- Never store DNSE password or trading token in plain text.
- Respect broker rate limits through Celery throttling or equivalent queue controls.
- Keep the web layer on `coreApiAdapter.js` only.
- Keep public market data on multi-provider `vnbroker` routes; do not create DNSE-only public price/intraday/company flows.
- Do not invent custom DNSE states or labels; synced views must match the provider contract.
