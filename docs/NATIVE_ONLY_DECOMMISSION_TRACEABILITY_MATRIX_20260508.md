# TRACEABILITY MATRIX - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Requirements

| ID | Requirement | Priority | Phase |
|---|---|---:|---|
| NOD-REQ-01 | Khong con request nao di qua legacy proxy fallback | P0 | N5 |
| NOD-REQ-02 | Khong con catch-all route `/api/<path:remaining>` trong runtime | P0 | N5 |
| NOD-REQ-03 | Auth/partner flow phai chay native trong identity_access | P0 | N2 |
| NOD-REQ-04 | Portfolio/workspace phai chay native trong user_workspace | P0 | N2 |
| NOD-REQ-05 | Tracked-symbol bootstrap phai chay native trong stock-management owner | P1 | N2 |
| NOD-REQ-06 | Public legal pages phai chay native, khong dung proxy shim | P1 | N2 |
| NOD-REQ-07 | Compatibility wrappers khong con la runtime dependency | P0 | N4 |
| NOD-REQ-08 | Production compose khong con env legacy bridge | P0 | N5 |
| NOD-REQ-09 | Smoke test production khong con 5xx/console error do hybrid | P0 | N6 |
| NOD-REQ-10 | Audit trail phai dong bo voi taskboard va evidence | P1 | ALL |

---

## 2. Requirement to slice mapping

| Req ID | Slice(s) | Verification |
|---|---|---|
| NOD-REQ-01 | N5.1, N5.2 | Browser network trace = zero proxy hits |
| NOD-REQ-02 | N5.1 | `resolve()` no longer returns proxy handler |
| NOD-REQ-03 | N2.1 | Auth smoke test and focused tests |
| NOD-REQ-04 | N2.2 | Portfolio/workspace smoke test |
| NOD-REQ-05 | N2.3 | Tracked-symbol bootstrap test |
| NOD-REQ-06 | N2.4 | Legal pages fetch test |
| NOD-REQ-07 | N4.1-N4.4 | `grep` shows no active compat route mounts |
| NOD-REQ-08 | N5.3 | Compose file review + runtime env check |
| NOD-REQ-09 | N6.2 | Production browser reload |
| NOD-REQ-10 | ALL | Ledger + dashboard updated after each slice |
