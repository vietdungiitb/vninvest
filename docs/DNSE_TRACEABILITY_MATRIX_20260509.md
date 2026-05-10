# DNSE Integration Traceability Matrix

## 1. Overview
This matrix maps DNSE business requirements to core implementation slices and validation protocols.

Project policy lock:
- `vnbroker` is the only library entrypoint for VNInvest data access.
- DNSE stays broker-only inside `vnbroker`; public market data remains multi-provider.
- No direct DNSE transport/client should be implemented outside `vnbroker`.

## 2. Requirement Mapping

| ID | Requirement | Implementation Slice | Validation Protocol |
|---|---|---|---|
| P0 | All VNInvest data access must route through `vnbroker` | Project policy lock | T0 |
| P1 | DNSE is broker-only; public market data remains multi-provider | Routing policy lock | T0 / T1 |
| R1 | Automated account discovery | Slice 2: Account Discovery and Mapping | T1: Account bootstrap and mapping |
| R2 | Real-time balance / NAV sync | Slice 3: Balance and NAV Synchronization | T3: Market value revaluation |
| R3 | Idempotent transaction sync | Slice 4: Transaction Reconciliation | T2: Idempotent sync |
| R4 | Secure order execution | Slice 5: Secure Execution and Web Panel | T4: Secure order execution |
| R5 | Credential security and token hygiene | Slice 1 and Slice 5 | T1 and T4 |
| R6 | Web/core contract parity | Slice 1, Slice 2, and Slice 5 | Adapter contract tests and route smoke tests |
| R7 | Shadow Run and Parity Gates | Slice 3 and Slice 4 | 3-day shadow run and parity >= 0.99 |

## 3. Component Dependencies

| Component | Depends On | Responsible For |
|---|---|---|
| `vnbroker.connector.dnse.client.DNSEClient` / `vnbroker.connector.dnse.trade.Trade` | broker client, encryption helper, `identity_access` tenant context | Low-level DNSE broker communication |
| `packages/core/backend/src/user_workspace/tasks.py` | `vnbroker` DNSE connector, `SubAccount`, `Transaction`, `AccountSnapshot` | Background orchestration |
| `packages/web/src/components/DNSEConnectionPanel.js` | `coreApiAdapter.js` | Credential collection and status display |
| `packages/web/src/pages/PortfoliosPage.js` | `DNSEConnectionPanel` | Main user-facing entry point |
| `packages/web/src/adapters/coreApiAdapter.js` | core API routes | Web client transport |

Public market-data routing (price, intraday, company, listing, news) remains owned by the shared `vnbroker` provider router and is intentionally out of scope for DNSE-only slices.

## 4. Status Legend
- **Draft**: Requirements defined, implementation not started.
- **In-Progress**: Implementation slice active.
- **Verified**: Validation protocol passed and evidence logged.
- **Decommissioned**: Legacy manual path disabled for this requirement.
