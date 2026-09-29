# Frontend Design - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Implementation-ready

---

## 1. Scope

- Adapter-level integration for core historical chart and dark-money-history endpoints.
- Caller migration from legacy route usage to coreApiAdapter methods.
- Backward-safe UI payload mapping during transition.

---

## 2. Target adapter APIs

Add to packages/web/src/adapters/coreApiAdapter.js:

1. getStockChartHistory(symbol, { timeframe, days })
- Route: /core/v1/stock-management/stocks/{symbol}/chart/

2. getDarkMoneyHistory(symbol, { interval, period })
- Route: /core/v1/stock-management/stocks/{symbol}/dark-money-history/

---

## 3. Contract handling rules

- Normalize symbol to uppercase in adapter.
- Validate param presence in adapter and fail fast with explicit error.
- Keep parameter names aligned with backend contract (no ad-hoc renaming in pages).
- Parse standard error envelope for UI notifications.

---

## 4. Migration strategy for call sites

Step F1:
- Locate all current calls to legacy dark-money-history route.

Step F2:
- Replace with adapter method without changing component business logic.

Step F3:
- Replace chart history calls with getStockChartHistory where applicable.

Step F4:
- Remove temporary compatibility helpers after regression pass.

---

## 5. Frontend test plan

- Adapter URL query composition tests.
- Adapter error envelope parsing tests.
- Page regression tests for:
  - stock detail chart load
  - whale/dark money history panels
  - timeframe switch interactions

---

## 6. Non-functional requirements

- No direct fetch for these core endpoints in page components.
- No hidden fallback to legacy URL in production code path.
- Preserve i18n behavior and existing UX states (loading/empty/error).
