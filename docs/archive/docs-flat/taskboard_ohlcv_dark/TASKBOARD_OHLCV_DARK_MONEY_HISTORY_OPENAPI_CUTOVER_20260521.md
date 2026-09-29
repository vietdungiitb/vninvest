# Taskboard - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Ready to execute

---

## A. Discovery and contract freeze

- [ ] A1 Build legacy-to-core endpoint mapping inventory
- [ ] A2 Freeze canonical query param + alias matrix
- [ ] A3 Freeze response field list and nullable policy

## B. Backend implementation

- [ ] B1 Extract shared dark-money-history domain logic
- [ ] B2 Add core route and view for dark-money-history
- [ ] B3 Normalize timeframe parsing in chart endpoint
- [ ] B4 Standardize error envelope and status semantics
- [ ] B5 Add OpenAPI metadata + examples

## C. Frontend cutover

- [ ] C1 Add coreApiAdapter methods for chart and dark-money-history
- [ ] C2 Replace legacy route callers in web package
- [ ] C3 Add adapter tests for request mapping and error handling

## D. Testing and parity

- [ ] D1 Backend unit tests for normalization/clamp rules
- [ ] D2 API integration tests for success + failure matrix
- [ ] D3 Dev parity replay test old vs new endpoint outputs
- [ ] D4 Page-level regression tests for impacted views

## E. Governance and release prep

- [ ] E1 Run code review runbook
- [ ] E2 Run integration tests runbook
- [ ] E3 Run spec audit runbook
- [ ] E4 Complete evidence template and ledger updates

---

## Priority mapping

- P0: A2, B2, B3, B4, C1, D2
- P1: B1, B5, C2, D3
- P2: C3, D4, E1-E4

---

## Done definition per task

- Implementation complete
- Tests updated and passing
- OpenAPI metadata synchronized
- Audit artifacts updated
- Residual risk documented
