# Code Quality Constitution - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Mandatory for this package

---

## 1. Contract-first rules

1. New or changed endpoint behavior must be reflected in OpenAPI metadata in the same PR.
2. Route behavior and documented schema must be parity-checked.
3. No undocumented implicit fallback that changes business meaning.

## 2. Reliability rules

1. No swallow exceptions in API paths.
2. Error responses must follow standard envelope.
3. Invalid params must fail fast with explicit code and message.

## 3. Timeframe consistency rules

1. Canonical interval list is immutable for this pack unless approved by Tech Lead.
2. Alias normalization must be centralized and tested.
3. Intraday lookback clamping must be deterministic and tested.

## 4. Frontend integration rules

1. packages/web must call core routes only through coreApiAdapter.
2. No direct fetch for these core endpoints in feature components.
3. Adapter methods must include tests for URL/query mapping.

## 5. Test quality rules

1. Add tests for happy path and failure matrix for each changed endpoint.
2. Include at least one regression test for each previously identified bug class.
3. Keep parity replay evidence for old/new route replacement decision.

## 6. Governance rules

1. CODE_CHANGE_AUDIT_LEDGER and PROGRESS_DASHBOARD updates are mandatory.
2. Runbooks for code review, integration tests, and spec audit are mandatory.
3. Any exception requires owner + expiry + mitigation note.
