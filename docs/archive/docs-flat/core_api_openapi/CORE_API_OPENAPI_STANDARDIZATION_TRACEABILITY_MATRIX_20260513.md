# Traceability Matrix - Core API OpenAPI Standardization

Date: 2026-05-13
Status: Baseline

---

## Matrix

| Requirement ID | Constitution Rule | Implementation Tasks | Test Coverage | Audit Artifact |
|---|---|---|---|---|
| RQ-01 | R1 Request schema | A2, D1 | F1 serializer/api invalid input tests | G1, G2 |
| RQ-02 | R2 Response schema | A3, D1, D2 | F1 response contract tests | G1, G2 |
| RQ-03 | R3 HTTP semantics | A4, D3 | F1 status code matrix tests | G1, G3 |
| RQ-04 | R4 Error envelope | A5, E2 | F1 error payload tests, E2 UI error tests | G1, G2 |
| RQ-05 | R5 No swallow exceptions | A6 | F1 error-path behavior tests | G1 |
| RQ-06 | R6 Auth + tenant | B3, B4 | F1 auth/permission/tenant tests | G1, G2 |
| RQ-07 | R7 Rate limit | B1, B2 | F1 429 tests | G1, G2 |
| RQ-08 | R8 Pagination | C1, C2 | F1 pagination boundary tests | G1, G2 |
| RQ-09 | R9 Performance hygiene | C3 | G2 integration perf checks | G2 |
| RQ-10 | R10 Documentation | D1, D2, D3 | Metadata lint + drift checks | G3 |
| RQ-11 | R11 Testing minimum | F1, F2 | Unit/integration/adapters | G2 |
| RQ-12 | R12 Versioning/deprecation | D3 | Release/deprecation checks | G3 |

---

## Coverage target

- Requirement trace coverage >= 95%
- Test mapping coverage >= 95%
- Unmapped requirement = blocker
