# SAAS-12 Execution Evidence
## Shared Data-Plane Contract Lock

**Slice ID:** SAAS-12  
**Date:** 2026-05-03  
**Executor:** AI Session (GitHub Copilot)  
**Status:** ✅ COMPLETED

---

## 1. Scope

Lock 6 data-plane contracts in `shared/api-contracts/` + contract validator script.  
Mobile service migration: **DEFERRED** (mobile-app locked by user — will be developed later).

---

## 2. Files Changed / Created

### New Contract Files (6)

| File | Contract Name | Version |
|------|--------------|---------|
| `shared/api-contracts/symbol-snapshot.contract.json` | `symbol-snapshot` | 1.0.0 |
| `shared/api-contracts/session-facts.contract.json` | `session-facts` | 1.0.0 |
| `shared/api-contracts/unified-alert.contract.json` | `unified-alert` | 1.0.0 |
| `shared/api-contracts/whale-feed-aggregate.contract.json` | `whale-feed-aggregate` | 1.0.0 |
| `shared/api-contracts/tenant-lifecycle.contract.json` | `tenant-lifecycle` | 1.0.0 |
| `shared/api-contracts/partner-pat.contract.json` | `partner-pat` | 1.0.0 |

### New Validator Script (1)

| File | Purpose |
|------|---------|
| `shared/scripts/validate-contracts.mjs` | Node.js ESM validator — checks all `*.contract.json` files; supports both legacy raw JSON Schema (SAAS-01 era) and new SAAS-12 wrapper format; exit code 0 = all pass |

### New Directory Created

- `shared/scripts/` (new folder)

### Pre-existing Contracts (Unchanged)

| File | Format | Status |
|------|--------|--------|
| `shared/api-contracts/build-target.contract.json` | Legacy (raw JSON Schema, draft 2020-12) | ✅ Validated |
| `shared/api-contracts/capability-bootstrap.contract.json` | Legacy (raw JSON Schema, draft 2020-12) | ✅ Validated |
| `shared/api-contracts/session-payload.contract.json` | Legacy (raw JSON Schema, draft 2020-12) | ✅ Validated |

---

## 3. Validation Command & Result

```powershell
node "C:\Mujoco Projects\vninvest\shared\scripts\validate-contracts.mjs"
```

**Output:**
```
🔍 VNInvest Contract Validator
   Scanning: C:\Mujoco Projects\vninvest\shared\api-contracts

  ✅ PASS  vninvest/contracts/build-target/v1 [legacy]
  ✅ PASS  vninvest/contracts/capability-bootstrap/v1 [legacy]
  ✅ PASS  partner-pat v1.0.0
  ✅ PASS  session-facts v1.0.0
  ✅ PASS  vninvest/contracts/session-payload/v1 [legacy]
  ✅ PASS  symbol-snapshot v1.0.0
  ✅ PASS  tenant-lifecycle v1.0.0
  ✅ PASS  unified-alert v1.0.0
  ✅ PASS  whale-feed-aggregate v1.0.0

─────────────────────────────────────
  Checked : 9 contracts
  Passed  : 9
  Failed  : 0

✅ All contracts VALID.
```

**Exit code:** 0  
**Result:** ALL 9 CONTRACTS PASS (3 legacy + 6 new)

---

## 4. Contract Key Fields Summary

### symbol-snapshot
- Serving layer: stock price/volume snapshot per symbol
- Key: `symbol`, `price`, `price_change_pct`, `volume`, `session_date`, `market_status` (open/closed/pre-open/halted/ato/atc), `stale`, `source` (live/cache/degraded/legacy_sync/core)

### session-facts
- Aggregate session facts: CVD, buy/institutional strength, whale flow
- Key: `symbol`, `session_date`, `cvd_normalized` [-1,1], `buy_strength` [0,1], `institutional_strength` [0,1], `whale_net_flow` (VND), `dark_flow_score` [0,1]

### unified-alert
- Canonical alert model for all alert types
- Key: `alert_id` (uuid), `alert_type` (whale/dark_flow/signal/system), `symbol`, `severity` (critical/high/medium/low), `direction` (buy/sell/neutral/null), `source_ref`, cursor pagination in `list_response`

### whale-feed-aggregate
- Whale feed aggregate per symbol per session
- Key: `total_whale_buy_vnd`, `total_whale_sell_vnd`, `net_whale_flow_vnd`, `whale_order_count`, `top_orders[]`, cursor pagination in `list_response`

### tenant-lifecycle
- Tenant status, plan, quota, features projection
- Key: `tenant_id`, `status` (active/trial/suspended/deprovisioned/pending_activation), `plan` (free/starter/pro/enterprise/custom), `quota_used/limit`, `features[]`

### partner-pat
- Partner PAT credential for machine auth
- Key: `pat_id`, `service_account_id`, `tenant_id`, `scopes[]`, `token_prefix` (8 chars only — security), `revoked`, `audit_reason`; `issue_response` exposes full `token` one-time only

---

## 5. Mobile Migration (Deferred)

**Decision:** User locked `mobile-app/` for future development.  
**Impact:** `packages/mobile/src/services/` files (`portfolioApi.ts`, `watchlistApi.ts`, `transactionApi.ts`, `authApi.ts`) still reference legacy Django paths directly. No `coreHttp.ts` or `CORE_API_BASE_URL` added to mobile runtime.  
**Residual risk:** Medium — mobile services will drift from new contracts until SAAS-12 mobile migration is executed in a future session.

---

## 6. Residual Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Mobile services not migrated | Medium | Tracked as backlog item; mobile-app locked by user decision |
| Old contracts use draft 2020-12, new use draft-07 | Low | Validator handles both; runtime consumers must be aware of version difference |
| Contracts not yet enforced at runtime | Medium | Runtime enforcement is SAAS-14 scope (Celery materializers + coreApiAdapter) |
| No CI/CD integration for validator | Low | Add `node shared/scripts/validate-contracts.mjs` to CI pipeline in SAAS-15 gate |

---

## 7. Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| 6 new contract JSON files created | ✅ |
| All contracts have `contract_name`, `version`, `schema`, `example`, `changelog` | ✅ |
| Validator script created at `shared/scripts/validate-contracts.mjs` | ✅ |
| Validator supports legacy raw JSON Schema format | ✅ |
| `node validate-contracts.mjs` exits 0, all 9 PASS | ✅ |
| Mobile migration deferred with explicit note | ✅ |
