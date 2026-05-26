# Run Integration Tests - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21

---

## Test scope

- Core chart history endpoint
- Core dark-money-history endpoint
- Frontend adapter compatibility
- Contract and error envelope conformance
- Dev parity replay old vs new routes

---

## Suggested command groups

### Backend
- Run market_data API tests impacted by chart endpoint.
- Run dark-money-history tests for interval/period matrix.
- Run auth/permission and negative status tests.

### Frontend
- Run coreApiAdapter tests.
- Run impacted page regression tests.

### Contract checks
- OpenAPI schema generation/lint.
- Contract drift checker (if available).

### Dev runtime checks
- Execute start_dev.ps1 before final verification.
- Verify core API health and frontend health.

---

## Pass criteria

- 100% mandatory suites pass.
- No blocker contract drift.
- Parity replay >= 99% on agreed key fields.
- No critical/high review findings.

---

## Failure handling

- Stop cutover progression.
- Attach failing payload snapshots and logs.
- Open blocker ticket and fix.
- Re-run full integration suite.
