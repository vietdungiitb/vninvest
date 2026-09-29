# Taskboard - Core API OpenAPI Standardization

Date: 2026-05-13
Status: Ready to execute

---

## Sprint board

### A. Backend contract hardening
- [ ] A1 Inventory endpoint ownership by domain
- [ ] A2 Standardize request serializers for priority endpoints
- [ ] A3 Standardize response serializers and examples
- [ ] A4 Normalize status code semantics
- [ ] A5 Implement error envelope consistency
- [ ] A6 Remove swallow exceptions in API path

### B. Security and isolation
- [ ] B1 Apply rate-limit for auth-sensitive endpoints
- [ ] B2 Validate 429 behavior and envelope
- [ ] B3 Enforce tenant query filters
- [ ] B4 Add cross-tenant denial tests

### C. Pagination and performance
- [ ] C1 Add pagination policies to all list endpoints
- [ ] C2 Validate max_page_size behavior
- [ ] C3 Remove N+1 from hot list/read endpoints

### D. OpenAPI metadata
- [ ] D1 Complete schema coverage for active endpoints
- [ ] D2 Add request/response examples
- [ ] D3 Align metadata status codes with real responses

### E. Frontend contract conformance
- [ ] E1 Update core API adapter mappings
- [ ] E2 Standardize error parser by envelope
- [ ] E3 Update UI flows impacted by contract strictness

### F. Test and governance
- [ ] F1 Add/refresh backend API contract tests
- [ ] F2 Add/refresh frontend adapter tests
- [ ] F3 Enable CI gates for OpenAPI policy
- [ ] F4 Update branch protection and PR mandatory checks

### G. Audit and sign-off
- [ ] G1 Run code review protocol
- [ ] G2 Run integration test protocol
- [ ] G3 Run spec audit protocol
- [ ] G4 Publish final evidence package

---

## Priority mapping

- P0: A4, A5, A6, B1, B3
- P1: C1, D1, D3, F1, F3
- P2: E1, E2, C3, G1-G4

---

## Done definition per task

- Code updated
- Tests added/updated
- Metadata synchronized
- Ledger + progress updated
- Residual risk noted
