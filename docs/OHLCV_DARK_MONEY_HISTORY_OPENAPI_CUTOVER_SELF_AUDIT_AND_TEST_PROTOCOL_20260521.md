# Self Audit and Test Protocol - OHLCV + Dark Money History OpenAPI Cutover

Date: 2026-05-21
Status: Mandatory protocol

---

## 1. Pre-check

- [ ] Read constitution and PR gate checklist.
- [ ] Confirm scoped files and impacted routes.
- [ ] Confirm baseline tests are green before edits.

---

## 2. Self-audit checklist

### Contract
- [ ] Request params validated and documented.
- [ ] Response schema stable and documented.
- [ ] Status code semantics correct.
- [ ] Error envelope standardized.

### Security
- [ ] Auth and permission behavior validated.
- [ ] Tenant isolation validated where applicable.
- [ ] No sensitive token/credential logging.

### Performance
- [ ] Query paths avoid obvious N+1.
- [ ] Timeframe normalization does not cause unbounded scans.

### Governance
- [ ] OpenAPI metadata updated.
- [ ] Traceability matrix updated.
- [ ] CODE_CHANGE_AUDIT_LEDGER + PROGRESS_DASHBOARD updated.

---

## 3. Mandatory test sets

### Backend unit
- timeframe alias normalization
- interval clamp logic
- period normalization

### Backend API integration
- happy path per timeframe
- invalid params (400)
- auth fail (401)
- forbidden (403, where policy applies)
- symbol not found (404)
- throttling behavior (429 if configured)

### Frontend
- adapter route mapping
- adapter error parser behavior
- page regression for chart + dark-money-history consumers

### Parity (dev-only)
- old route vs new route replay on sample symbols/timeframes
- compare key fields with tolerance rules

---

## 4. Exit criteria

- No failed mandatory tests.
- No unresolved critical/high findings.
- Evidence template complete.
- Sign-off recorded in runbooks.
