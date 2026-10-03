# DNSE Integration Self-Audit & Test Protocol

## 1. Quality Objectives
- All project data access must go through `vnbroker`.
- Core account management must remain available for users without DNSE; DNSE link is additive, not a prerequisite.
- DNSE is broker-only inside `vnbroker`; public market data must remain multi-provider.
- No plaintext DNSE credentials.
- No duplicate transactions after repeated syncs.
- Snapshot parity must be reproducible from broker payloads.
- The web layer must only call core through `coreApiAdapter.js`.
- Every sync must be auditable with a payload snapshot or test fixture.

## 2. Mandatory Test Scenarios

### T0: Library Routing Guard
- **Action**: Inspect the implemented routes and call sites for public market data versus broker-only flows.
- **Pass Criteria**: All broker/account/trading paths resolve through `vnbroker`, and public market data routes resolve through multi-provider `vnbroker` routing rather than DNSE-only logic.
- **Fail Criteria**: Any direct DNSE transport call exists outside `vnbroker`, or any public price/intraday/company/listing/news path is pinned to DNSE.

### T0.5: Local Account Management Baseline
- **Action**: Use account-management features without linking DNSE.
- **Pass Criteria**: Local account/portfolio management works without DNSE, and DNSE-linked enhancements only appear after an explicit link.
- **Fail Criteria**: The project blocks basic account management until DNSE is linked, or the UI/API forces DNSE-only semantics on local accounts.

### T1: Credential Bootstrap and Account Linkage
- **Action**: User enters DNSE credentials, authenticates, and links a broker account.
- **Pass Criteria**: Credential payload is stored encrypted, a sub-account mapping is created or updated, and the linked representation matches DNSE contract semantics without custom status/field divergence.
- **Fail Criteria**: Invalid credentials allow a write, or raw secret material appears in logs, DB, or API snapshots.

### T2: Idempotent Transaction Sync
- **Action**: Run the transaction sync job twice for the same broker account.
- **Pass Criteria**: The second run adds 0 new `Transaction` rows.
- **Fail Criteria**: Duplicate rows appear, or fee/tax mapping changes between runs.

### T3: Market Value Revaluation
- **Action**: DNSE balance or position value changes.
- **Pass Criteria**: Core `AccountSnapshot` or equivalent summary reflects the new NAV on the next sync.
- **Fail Criteria**: The snapshot lags indefinitely or is computed from stale data.

### T4: Secure Order Execution
- **Action**: Place an order from the VNInvest UI with a valid trading token.
- **Pass Criteria**: The order is accepted by DNSE through the `vnbroker` DNSE connector, and the local `Transaction` is created only after the broker status reaches `FILLED`.
- **Fail Criteria**: A local transaction is created before broker finality, or order placement bypasses the token flow.

## 3. Evidence Collection Template
Developers must include the following in every slice handoff:

```markdown
### Slice [N] Evidence
- **Files Modified**: [list]
- **Validation Command**: [test or smoke command]
- **Result**: PASS
- **Payload Snapshot**:
  ```json
  { "sync": "success", "linked_accounts": 3 }
  ```
- **Residual Risks**: [e.g. rate limiting, broker OTP friction]
```

## 4. Decommission Criteria for Manual Path
Manual transaction entry can only be disabled if:
1. The portfolio is linked to DNSE.
2. `reconcile_transactions_task` has run at least once and matched the full history.
3. `AccountSnapshot` parity has held at or above 0.99 for 3 consecutive days.
4. The code owner has signed off on the cutover.
5. Public market data remains multi-provider in `vnbroker` and is not hard-coded to DNSE.
6. Local account management remains usable when DNSE is absent.
