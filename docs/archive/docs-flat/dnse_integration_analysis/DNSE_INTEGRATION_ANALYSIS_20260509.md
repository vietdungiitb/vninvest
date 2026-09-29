# DNSE Native Synchronization Technical Analysis

## 1. Executive Summary
DNSE broker integration should be implemented through `vnbroker`, which is the only library surface the project should use. `identity_access` handles user/tenant auth, `user_workspace` owns broker-side project state, and DNSE stays limited to account/trading flows.

Core account management must remain available for non-DNSE users. Linking DNSE should only add a sync overlay and must not change the local account-management baseline or require DNSE for basic account operations.

Public market data must remain multi-provider inside `vnbroker` so price, intraday, company, listing, news, and snapshot paths do not become DNSE-only bottlenecks.

The current workspace does not yet contain DNSE-specific core models or adapter code, so the code team must create only thin project glue that delegates to `vnbroker` rather than wiring new behavior into legacy `backend/portfolio` write paths or direct DNSE transport code.

## 2. Architecture and Boundaries

### 2.1 Identity and access
- `identity_access` is the source of truth for tenant, user, service account, and PAT authentication.
- DNSE login or OTP data must not be stored in `identity_access` unless it is part of auth bootstrap metadata.
- Core API calls from the web layer must go through `packages/web/src/adapters/coreApiAdapter.js`.

### 2.2 Workspace ownership
- `user_workspace` owns DNSE credentials, broker linkage, account mapping, transactions, and snapshots.
- `SubAccount` should be extended with broker linkage fields such as `external_id`, `broker_source`, and `sync_status`.
- `AccountSnapshot` should be introduced in `user_workspace` if parity reporting is required.

### 2.3 Legacy reference only
- `backend/portfolio/models.py` remains a reference for migration patterns, not the target write path.
- `backend/portfolio/encryption_utils.py` shows the existing reversible-secret pattern that can be mirrored in core if a shared helper is not already available.

### 2.4 Project policy lock
- `vnbroker` is the single library source for all project data access.
- Local account management stays available even when DNSE is not linked.
- DNSE may only be used for broker/account/trading flows.
- Public market data must remain multi-provider and must not be hard-coded to DNSE.
- If project glue is needed, it should wrap `vnbroker.connector.dnse` instead of reimplementing network, signature, or retry logic.

### 2.5 DNSE contract parity
- When DNSE is linked, the project must mirror DNSE contract semantics exactly for broker/account/trading flows.
- Do not rename or reinterpret DNSE states, order statuses, token behavior, or field names in a way that diverges from the provider contract.
- Auto-sync is allowed, but the synced representation must remain faithful to DNSE payloads and lifecycle rules.

## 3. Data Mapping and API Surface

Public market-data capabilities are intentionally outside this DNSE-specific handoff; they belong to the shared `vnbroker` provider router and failover layer.

| Capability | DNSE Source | Core Target |
|---|---|---|
| Credential bootstrap | API key, API secret, username, password | `user_workspace.DNSECredential` |
| Sub-account discovery | `sub_accounts()` | `SubAccount` upsert |
| Balance sync | `account_balance()` | `AccountSnapshot` and portfolio NAV summary |
| Positions / executed trades | `deals_list()` | `Transaction` history and holdings read model |
| Order history | `order_list()` | `Transaction` records with idempotency key |
| Order execution | `place_order()` | secure execution endpoint guarded by trading token |

## 4. Security and Session Flow
- Store persistent API credentials encrypted at rest.
- Keep access and trading tokens short-lived in Redis or an equivalent session cache.
- Use idempotency keys derived from broker order or deal identifiers.
- Never write raw DNSE secrets into logs, task payloads, or audit notes.

## 5. Risk Assessment
- OTP friction can block account bootstrap if the UX does not handle retries cleanly.
- Data drift can happen if balance sync succeeds but transaction reconciliation lags.
- The snapshot model does not exist yet in `user_workspace`, so parity work is blocked until that slice is added.
- If DNSE-linked account semantics drift from the provider contract, the sync overlay becomes unreliable and must be treated as a blocker.
- Hard-fixing public price/intraday/company flows to DNSE would create single-source overload risk for multi-user access, so those routes must stay multi-provider.
- UI handoff must use existing web entry points because `PortfolioDashboard.jsx` is not present in the current workspace.
