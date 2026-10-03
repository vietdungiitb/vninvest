# Tech Spec - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Approved spec baseline

---

## 1. Scope

In scope:
- Core OpenAPI endpoint for OHLCV historical chart by timeframe.
- Core OpenAPI endpoint for dark-money-history by timeframe.
- Frontend adapter integration and legacy read-path replacement.

Out of scope:
- New alpha models beyond existing dark-flow logic.
- Production traffic canary/shadow-run.

---

## 2. Canonical endpoint contracts

### 2.1 Chart history endpoint

Method: GET
Path: /core/v1/stock-management/stocks/{symbol}/chart/

Query params:
- timeframe: enum {1m,5m,15m,30m,1h,2h,4h,1D,1W,1M}
- days: int [1..3650]

Response (200) envelope fields:
- symbol
- days
- timeframe
- interval
- start_date
- end_date
- points[]: {date, open, high, low, close, volume}
- technical

### 2.2 Dark-money-history endpoint

Method: GET
Path: /core/v1/stock-management/stocks/{symbol}/dark-money-history/

Query params:
- period: enum {1M,3M,6M,1Y,10Y}
- interval: enum {1m,5m,15m,30m,1h,4h,1D,1W}

Response (200) envelope baseline fields:
- ok
- symbol
- period
- interval
- candles[]
- dark_flow_series[]
- whale_signals[]
- moving_averages
- smfi
- strategy_table

---

## 3. Canonical normalization rules

### 3.1 Timeframe/interval alias map

Accepted aliases must map to canonical values:
- 1M -> 1m (minute)
- 5M -> 5m
- 15M -> 15m
- 30M -> 30m
- 1H -> 1h
- 4H -> 4h
- 1D/d -> 1D
- 1W/w -> 1W

### 3.2 Lookback clamping for intraday intervals

- 1m: max 1 day
- 5m: max 3 days
- 15m: max 7 days
- 30m: max 7 days
- 1h: max 14 days
- 4h: max 30 days

### 3.3 Timestamp conventions

- Intraday points: Unix seconds
- Daily/weekly points: YYYY-MM-DD

---

## 4. Error and status semantics

- 200 success
- 400 invalid symbol/invalid interval/invalid period
- 401 unauthenticated
- 403 permission denied
- 404 symbol not found
- 429 throttled
- 500 internal error

Error payload uses standard envelope:
- detail
- code
- timestamp
- request_id
- field_errors

---

## 5. Data source and behavior

- OHLCV candles: canonical vnbroker adapter path
- dark-flow aggregates: OrderFlowSignal and related canonical data sources
- whale signals: canonical tick/order-flow models
- No client-side synthesis for core truth fields

---

## 6. Security and tenancy

- Endpoint permission classes must match tenant-scoped policy where applicable.
- Query layer must enforce tenant boundaries for tenant-owned resources.
- Add explicit cross-tenant denial tests if endpoint accesses tenant-scoped records.

---

## 7. Observability requirements

- Include request_id in error logs.
- Log contract validation failures with endpoint + symbol + normalized params.
- Emit counters for invalid interval/period requests.

---

## 8. Backward compatibility strategy

- Keep legacy route readable during migration window.
- Adapter-based frontend cutover first.
- After parity+regression pass, disable legacy consumption path.

---

## 9. Non-functional acceptance

- P95 response latency target for read endpoints maintained or improved in dev benchmark.
- No critical/high findings in code review runbook.
- 100% OpenAPI metadata present for new/changed endpoints.
