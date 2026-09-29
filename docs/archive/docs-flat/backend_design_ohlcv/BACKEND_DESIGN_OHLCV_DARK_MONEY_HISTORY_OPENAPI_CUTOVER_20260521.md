# Backend Design - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Implementation-ready

---

## 1. Scope

- Add core native dark-money-history endpoint with OpenAPI metadata.
- Unify timeframe normalization and interval policies across chart + dark-money-history.
- Keep legacy route operational only during migration window.

---

## 2. Architecture decisions

1. Shared domain logic extraction
- Move dark-money-history computation into a reusable service module.
- Both legacy and core views call shared service during migration.

2. Contract-first API design
- View layer orchestrates only.
- Validation and normalization performed explicitly.
- Response envelope shape fixed and test-snapshotted.

3. Error policy
- Standard error envelope across all failures.
- No swallow exception patterns.

---

## 3. Endpoint design

### 3.1 Chart endpoint
- Existing path retained: /core/v1/stock-management/stocks/{symbol}/chart/
- Extend/normalize timeframe alias handling.

### 3.2 Dark-money-history endpoint
- New core path: /core/v1/stock-management/stocks/{symbol}/dark-money-history/
- Support interval set: 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W
- Support period set: 1M, 3M, 6M, 1Y, 10Y

---

## 4. Data sources

- OHLC candles via canonical vnbroker adapter path.
- dark_flow series from canonical order-flow signal data.
- whale signals from canonical tick/order-flow sources.

---

## 5. Validation logic

- Symbol normalization + validity checks.
- Interval and period whitelist enforcement.
- Intraday lookback clamp by interval policy.
- Deterministic fallback behavior documented in OpenAPI examples.

---

## 6. Testing design

- Unit tests for alias/clamp/period logic.
- API integration tests for all status paths.
- Contract snapshots for response fields.
- Parity replay tests old vs new endpoint in dev.

---

## 7. Migration and deprecation

- Stage 1: implement core endpoint + tests.
- Stage 2: frontend cutover to adapter.
- Stage 3: parity replay + regression pass.
- Stage 4: replace legacy usage and set deprecation policy.
