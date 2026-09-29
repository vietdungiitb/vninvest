# Traceability Matrix - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Baseline traceability

---

| Requirement ID | Requirement | Implementation Tasks | Test Coverage | Audit Artifact |
|---|---|---|---|---|
| RQ-01 | Core endpoint exists for dark-money-history | B2, B5 | D2 | E3 |
| RQ-02 | OHLCV timeframe normalization unified | B3 | D1, D2 | E1 |
| RQ-03 | Canonical interval set supported | A2, B3 | D1, D2 | E2 |
| RQ-04 | Intraday clamp limits enforced | B3 | D1, D2 | E2 |
| RQ-05 | Error envelope standardized | B4 | D2, C3 | E1, E3 |
| RQ-06 | Correct HTTP status semantics | B4 | D2 | E3 |
| RQ-07 | OpenAPI metadata complete and aligned | B5 | D2 schema checks | E3 |
| RQ-08 | Frontend adapter uses core routes only | C1, C2 | C3, D4 | E1 |
| RQ-09 | Legacy route replacement readiness in dev | D3, E4 | D3 | E2, E4 |
| RQ-10 | Audit obligations completed | E4 | N/A | E4 |

---

## Coverage goals

- Requirement mapping coverage: >= 95%
- Test mapping coverage: >= 95%
- Any unmapped requirement is a merge blocker.
