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

### Slice 2: Account Discovery and Mapping
- **Goal**: Populate `SubAccount` from DNSE and keep the mapping idempotent.
- **Tasks**:
    - Extend `SubAccount` with `external_id`, `broker_source`, and `sync_status`.
    - Implement `sync_dnse_accounts_task` in `packages/core/backend/src/user_workspace/tasks.py`.
    - Add a workspace API endpoint for account sync.
- **Evidence**: API response snapshot showing DNSE account IDs mapped to core sub-account IDs.

### Slice 3: Balance and NAV Synchronization
- **Goal**: Materialize account balance snapshots in core.
- **Tasks**:
    - Add `AccountSnapshot` to `user_workspace` if missing.
    - Implement `sync_dnse_balances_task`.
    - Schedule nightly snapshot generation.
- **Evidence**: Table or payload snapshot showing `AccountSnapshot` NAV matching DNSE `account_balance()`.

### Slice 4: Transaction Reconciliation
- **Goal**: Reconcile historical orders without duplicates.
- **Tasks**:
    - Implement `reconcile_transactions_task`.
    - Derive idempotency from DNSE `orderId` or `dealId`.
    - Map broker fee and tax fields into `Transaction`.
- **Evidence**: Running the sync twice adds zero new `Transaction` rows.

### Slice 5: Secure Execution and Web Panel
- **Goal**: Add the DNSE connection panel and secure order flow.
- **Tasks**:
    - Add `DNSEConnectionPanel` under `packages/web/src/components/`.
    - Integrate it into `packages/web/src/pages/PortfoliosPage.js`.
    - Wire order execution and token status through `coreApiAdapter.js` and the broker-only `vnbroker` DNSE path.
- **Evidence**: Screenshot or screen recording of account link, status update, and a FILLED-only local transaction write.

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
