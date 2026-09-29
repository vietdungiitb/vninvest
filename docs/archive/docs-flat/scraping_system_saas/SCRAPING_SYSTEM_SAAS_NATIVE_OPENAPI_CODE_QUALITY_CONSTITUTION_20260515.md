# CODE QUALITY CONSTITUTION - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15

## 1. Purpose

This constitution defines what quality means for the SaaS-native scraping + OpenAPI workstream.
The slice is only successful when backend contracts, frontend runtime config/admin, and facts-first read paths are all aligned.

---

## 2. Quality targets

| Area | Target |
|---|---:|
| Backend route + contract coverage | 90% risk coverage |
| Runtime config/admin control paths | 90% risk coverage |
| Frontend adapter conformance | 90% risk coverage |
| Selected-session truth in chart/tape/advisory | 95% risk coverage |
| Error envelope and pagination behavior | 95% risk coverage |
| Facts-first read path | 95% risk coverage |

---

## 3. Hard rules

1. No direct provider import outside `market_data.vnbroker_adapter`.
2. No direct fetch bypass in the frontend for in-scope flows.
3. No silent swallow of backend exceptions.
4. No unpaginated list endpoint in the active API surface.
5. No runtime config hidden only in env files when an operator UI is required.
6. No synthetic random production data on the signal/materialization path.
7. No product read path that full-scans raw tick when facts exist.
8. No new UI text without Vietnamese localization in the product surface.

---

## 4. Coverage theater prevention

The following do not count as quality proof by themselves:

1. Build pass without runtime smoke.
2. Test existence without contract assertions.
3. UI render without permission/readonly checks.
4. Route creation without examples and error semantics.
5. Runtime config API without audit history.
6. Selected-session chart without a matching tape/advisory proof.

---

## 5. Human gate

The following require final human judgment:

1. Whether the runtime config/admin UX is clear enough for operators.
2. Whether the API contract is complete enough to stop legacy fallback.
3. Whether the chart and advisory truth stay trustworthy at the selected-session level.
4. Whether any remaining raw data retention needs a longer forensic window.
