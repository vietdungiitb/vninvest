# Self Audit and Test Protocol - Core API OpenAPI Standardization

Date: 2026-05-13
Status: Mandatory protocol

---

## 1. Pre-check

- [ ] Read constitution and PR gate checklist
- [ ] Confirm task scope and impacted endpoints
- [ ] Confirm baseline tests passing before changes

---

## 2. Self-audit checklist

### Contract
- [ ] Request schema complete
- [ ] Response schema complete
- [ ] Status code semantics correct
- [ ] Error envelope normalized

### Security
- [ ] Authn/authz behavior validated
- [ ] Tenant isolation validated
- [ ] Rate-limit behavior validated

### Performance
- [ ] Pagination present on list endpoints
- [ ] No obvious N+1 in changed path

### Governance
- [ ] Metadata updated
- [ ] PR gate checklist fully checked
- [ ] Ledger and progress docs updated

---

## 3. Required test sets

### Backend tests
- Happy path
- Validation fail
- Unauthorized/forbidden
- Not found/conflict
- Tenant denial
- Rate-limit 429

### Frontend tests
- Adapter contract parsing
- Error envelope UI behavior
- Pagination/empty-state handling

### Integration tests
- End-to-end request/response contract conformance
- Cross-service contract compatibility

---

## 4. Exit criteria

- No failed mandatory tests
- No unresolved critical/high findings
- Traceability matrix updated
- Evidence template completed

---

## 5. Residual risk policy

Bat ky residual risk nao cung phai co:
- risk description
- impact
- owner
- mitigation plan
- due date
