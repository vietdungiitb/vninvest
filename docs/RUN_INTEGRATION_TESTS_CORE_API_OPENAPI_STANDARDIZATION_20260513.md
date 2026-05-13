# Run Integration Tests - Core API OpenAPI Standardization

Date: 2026-05-13

---

## Test scope

- Core API endpoint contracts
- Frontend adapter compatibility
- Auth/tenant/rate-limit behavior
- Error envelope consistency

---

## Suggested command groups

### Backend (example)
- Run domain API tests by module
- Run contract-focused test suite
- Run tenant/rate-limit negative test suite

### Frontend (example)
- Run adapter/unit tests
- Run integration tests for error and pagination flows

### Contract checks
- Run OpenAPI lint
- Run custom policy validators

---

## Pass criteria

- 100% mandatory test suites pass
- No blocker contract drift
- No blocker security behavior mismatch

---

## Failure handling

- Stop rollout
- Open blocker ticket
- Attach failing payload snapshots
- Re-run full suite after fix
