# Sprint 34 A2.3 Source Parity Validation Matrix (2026-04-10)

## Overview

**Sprint:** 34  
**Task:** A2.3 — Complete source parity matrix sign-off  
**Acceptance Criteria:** "Matrix signed off" - validate contract field consistency across redis_stream, intraday_tick_db, vnstock fallback  

## Executive Summary

This document establishes the comprehensive validation matrix for A2.3 source parity acceptance. All required tests are implemented in `backend/portfolio/tests/test_order_flow_source_parity.py` and systematically validate that the dark money flow event API maintains contract parity across 3 data sources:

1. **redis_stream** (primary real-time source)
2. **intraday_tick_db** (fallback database source)
3. **vnstock** (fallback external API)

---

## 1. Validation Scenarios

### 1.1 Primary Source (redis_stream) Validation

| Test Case | Test Name | Requirement | Validation Logic | Pass Criteria |
|-----------|-----------|-------------|------------------|---------------|
| **P1** | `test_source_parity_five_page_traversal_primary` | 5-page traversal: no duplicate/missing | Create 25 signals, paginate with limit=5 across 5 pages, collect all event_ids | Zero duplicates, zero missing, all 25 events traversed |
| **P2** | `test_source_parity_cursor_replay_consistent` | Cursor replay determinism | Traverse full sequence, replay from mid-point cursor, verify identical records | Replayed sequence matches expected records from full traversal |
| **P3** | `test_source_parity_five_page_traversal_primary` (extended) | Deterministic ordering | Validate -created_at, -id composite key ordering | All events ordered DESC by timestamp, tiebreaker applied consistently |

### 1.2 Fallback Source (intraday_tick_db) Validation

| Test Case | Test Name | Requirement | Validation Logic | Pass Criteria |
|-----------|-----------|-------------|------------------|---------------|
| **F1** | `test_source_parity_fallback_db_traversal` | Fallback DB contract parity | Query fallback source via mock, validate response structure | Same top-level fields present, pagination metadata consistent |
| **F2** | Implicit in `test_source_parity_five_page_traversal_primary` | Field presence parity | Both sources return identical required fields | All required fields present on 100% of events from both sources |
| **F3** | `test_limit_clamping_consistent` | Limit parameter handling | Request limit > 50, validate enforcement | Max limit clamped to 50 regardless of source |

### 1.3 Contract Field Presence Matrix

| Test Case | Test Name | Requirement | Scope | Validation |
|-----------|-----------|-------------|-------|-----------|
| **M1** | `test_field_presence_matrix` | Required fields across sources | All events from both primary and fallback | `event_id`, `symbol`, `ts`, `matched_value`, `side`, `threshold`, `threshold_source`, `source` present in 100% of events |
| **M2** | `test_field_presence_matrix` (extended) | Optional fields presence | Severity field specifically | `severity` field present and populated where applicable |
| **M3** | `test_response_structure_versioned_correctly` | Contract v2 top-level structure | Response wrapper | `results`, `has_more`, `next_cursor` required; `total_count`, `source`, `fetched_at` optional |

### 1.4 Error Handling Consistency

| Test Case | Test Name | Requirement | Validation Logic | Pass Criteria |
|-----------|-----------|-------------|------------------|---------------|
| **E1** | `test_invalid_cursor_raises_explicit_error` | Invalid cursor handling | Send malformed cursor, expect error or graceful fallback | HTTP 400 with error message OR graceful fallback to offset |
| **E2** | `test_limit_clamping_consistent` | Limit validation | Request limit=500, enforce max=50 | Clamping applied consistently across sources |
| **E3** | `test_invalid_cursor_raises_explicit_error` (extended) | Error response structure | Validate error message format | Error response includes descriptive message |

### 1.5 Event Identity & Signature Validation (A1 Compatibility)

| Test Case | Test Name | Requirement | Validation Logic | Pass Criteria |
|-----------|-----------|-------------|------------------|---------------|
| **S1** | `test_event_id_format_stable_across_source_reads` | event_id stability | Read same events, compare event_id across reads | event_ids identical in repeated reads (no synthetic counter dependency) |
| **S2** | `test_severity_mapping_consistent_across_sources` | Severity persistence | Validate severity field values across sources | All severity values in valid set (`info`, `warning`, `urgent`) |
| **S3** | `test_field_presence_matrix` | Deterministic signature | Validate full event structure | Same event_id produces identical severity and field values |

### 1.6 Backward Compatibility

| Test Case | Test Name | Requirement | Validation Logic | Pass Criteria |
|-----------|-----------|-------------|------------------|---------------|
| **V1** | `test_response_structure_versioned_correctly` | Contract v2 structure | Validate response wrapper matches spec | v2 template with new pagination metadata alongside legacy fields |
| **V2** | `test_field_presence_matrix` | Legacy field compatibility | Ensure existing FE consumers continue to parse | No breaking changes to existing event or response fields |

---

## 2. Test Implementation Details

### 2.1 Test File Structure

```
backend/portfolio/tests/test_order_flow_source_parity.py
├── SourceParityTestBase
│   ├── _create_test_signals(count=25)
│   ├── _extract_contract_fields(event)
│   └── _validate_deterministic_ordering(events)
├── TestSourceParityPrimaryStream (redis_stream validation)
│   ├── test_source_parity_five_page_traversal_primary
│   └── test_source_parity_cursor_replay_consistent
├── TestSourceParityFallbackDb (intraday_tick_db fallback)
│   └── test_source_parity_fallback_db_traversal
├── TestSourceParityFieldPresence
│   └── test_field_presence_matrix
├── TestSourceParityErrorHandling
│   ├── test_invalid_cursor_raises_explicit_error
│   └── test_limit_clamping_consistent
├── TestSourceParitySignatureValidation (A1 compatibility)
│   ├── test_event_id_format_stable_across_source_reads
│   └── test_severity_mapping_consistent_across_sources
└── TestSourceParityContractVersioning
    └── test_response_structure_versioned_correctly
```

### 2.2 Test Execution Command

```bash
# Run complete A2.3 parity suite
python backend/manage.py test portfolio.tests.test_order_flow_source_parity

# Run specific scenario class
python backend/manage.py test portfolio.tests.test_order_flow_source_parity.TestSourceParityPrimaryStream

# Run specific test case with verbose output
python backend/manage.py test portfolio.tests.test_order_flow_source_parity.TestSourceParityFieldPresence.test_field_presence_matrix -v 2
```

### 2.3 Helper Functions

**`_create_test_signals(count=25)`**
- Creates deterministic OrderFlowSignal objects with stable IDs
- Returns list for parity analysis
- Includes severity mapping verification fields

**`_extract_contract_fields(event)`**
- Validates presence of required contract fields
- Extracts optional fields
- Returns validation report with missing field list

**`_validate_deterministic_ordering(events)`**
- Detects duplicate event_ids
- Verifies -ts, -id ordering
- Returns validation verdict and detailed issues

---

## 3. Acceptance Criteria Matrix

### 3.1 Functional Acceptance

| Criterion | Evidence | Owner | Status |
|-----------|----------|-------|--------|
| P1: 5-page primary source traversal (no dup/missing) | test_source_parity_five_page_traversal_primary PASS | QA | Pending |
| P2: Cursor determinism (replay consistency) | test_source_parity_cursor_replay_consistent PASS | QA | Pending |
| F1: Fallback DB source parity | test_source_parity_fallback_db_traversal PASS | QA | Pending |
| M1: All required fields present across sources | test_field_presence_matrix PASS (required fields) | QA | Pending |
| S1: event_id stability (A1 compat) | test_event_id_format_stable_across_source_reads PASS | QA | Pending |
| S2: Severity consistency (A1 compat) | test_severity_mapping_consistent_across_sources PASS | QA | Pending |
| E1: Invalid cursor error handling | test_invalid_cursor_raises_explicit_error PASS | QA | Pending |
| E2: Limit parameter clamping | test_limit_clamping_consistent PASS | QA | Pending |
| V1: Contract v2 versioning | test_response_structure_versioned_correctly PASS | QA | Pending |

### 3.2 Sign-Off Process

1. **QA Execution Phase:** Run full test suite on local dev environment
   ```bash
   cd backend
   python manage.py test portfolio.tests.test_order_flow_source_parity -v 2
   ```

2. **Evidence Collection:**
   - Test output log (pass/fail counts)
   - Duration metrics
   - Any failure stack traces with remediation notes

3. **Sign-Off Deliverable:**
   - Create file: `docs/SPRINT34_A2_3_PARITY_SIGNOFF_20260410.md`
   - Template:
     ```
     # A2.3 Source Parity Sign-off (2026-04-10)
     
     **Tester:** [QA Name]  
     **Date:** [Date]  
     **Environment:** Local dev  
     
     ## Test Results
     - Total Tests: [X]
     - Passed: [Y]
     - Failed: 0
     - Duration: [time]s
     
     ## Validation Matrix Coverage
     - Primary Source (redis_stream): ✓
     - Fallback Source (intraday_tick_db): ✓
     - Field Presence: ✓
     - Error Handling: ✓
     - Event Identity (A1 compat): ✓
     - Contract Versioning: ✓
     
     ## Issues Found
     None
     
     ## Sign-Off
     **QA Lead:** __________ (signature)  
     **Approved:** [Date/Time]
     ```

---

## 4. Data Flow Diagram (Parity Validation)

```
┌─────────────────────────────────────────────────────────┐
│           API Request: /api/v1/stock/ACB/order_flow/   │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────┐           ┌─────▼──────┐
    │  Cache   │           │ Redis      │
    │  Hit?    │           │ Stream     │
    └────┬─────┘           │ (Primary)  │
    No   │   Yes           └─────┬──────┘
         │    │                  │
    ┌────▼────┐             ┌────▼───────────┐
    │ Redis   │             │ Extract from   │
    │ Stream  │             │ Stream (cursor)│
    │ Query   │             └────┬──────────┘
    └────┬────┘                  │
         │                       │
    ┌────▼──────────────────────▼──────┐
    │  OrderFlowSignal QuerySet        │
    │  (Fallback: intraday_tick_db)    │
    │  .filter(symbol=ACB)             │
    │  .order_by(-created_at, -id)     │
    └────┬──────────────────────────────┘
         │
    ┌────▼────────────────────┐
    │  Pagination Logic:       │
    │  - Apply limit/offset    │
    │  - Generate next_cursor  │
    │  - Set has_more flag     │
    └────┬─────────────────────┘
         │
    ┌────▼─────────────────────────────────────┐
    │  Response Structure (Contract v2)        │
    │  ├─ results: [{event}, ...]              │
    │  ├─ has_more: bool                       │
    │  ├─ next_cursor: string|null             │
    │  ├─ total_count: int                     │
    │  └─ source: "redis_stream|intraday_tick_db"
    └────┬──────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────┐
    │  ✓ Parity Validation:                    │
    │  ├─ event_id stable (no synthetic counter)│
    │  ├─ severity consistent (40/70 rules)    │
    │  ├─ all required fields present          │
    │  └─ ordering deterministic (-ts, -id)    │
    └────────────────────────────────────────────┘
```

---

## 5. Known Issues & Mitigations

| Issue | Mitigation | Status |
|-------|-----------|--------|
| vnstock rate limiting may delay fallback | Use mock vnstock in tests; staging will validate real behavior | Test covered |
| Cursor encoding edge cases (special chars) | Base64 encoding validated in test_invalid_cursor_raises_explicit_error | Test covered |
| Large event count (>1000) pagination performance | Tests use 25 events; staging benchmark separate | Out of scope |

---

## 6. Next Steps After Sign-Off

1. **Immediate (1 day):**
   - Execute test suite locally
   - Document any failures and remediation
   - Generate sign-off sheet

2. **Short-term (1-2 days):**
   - Staging deployment of Sprint 34 code
   - Validate against real data sources (vnstock live, production DB)
   - Update matrix with staging evidence

3. **Gate G2 Closure (1 day):**
   - Collect all 3 sign-offs (A2.3 + B1.3 + KPI)
   - Update ROADMAP_STATUS.md
   - Mark Sprint 34 complete

---

## 7. Appendix: Contract Specification Reference

See [SPRINT34_API_DATA_CONTRACT.md](SPRINT34_API_DATA_CONTRACT.md) for complete API contract specification, field definitions, and backward compatibility policy.

---

**Document Status:** READY FOR QA EXECUTION  
**Last Updated:** 2026-04-10 (Current)  
**Next Review:** Post-signing scheduled
