# OPEN CORE SPRINT WEEK 1 - QUOTA UNIT DECISION (OC-23)

**Doc ID:** OC-23  
**Ngày tạo:** 2026-04-18 (proposal), effective 2026-04-22 (sprint start)  
**Trạng thái:** READY FOR EXECUTION - awaiting team standup kick-off  
**Mục tiêu:** Chốt Decision 1 - Quota unit (monthly vs daily canonical)  
**Timeline:** Mon 2026-04-22 → Fri 2026-04-26 EOD

---

## 1. Executive Summary

**Decision Statement:**
> Xác định đơn vị tính quota canonical (ngày hay tháng) để align business pricing, runtime implementation, và frontend/backend communication.

**Current State (Drift):**
- Business docs (OC-05, OC-06) ghi theo **ngày** (100 tickers/day quota).
- Runtime backend (opencore_analytics.py) tính theo **tháng** (3000 API calls/month).
- Confusion: user thấy "100/day" trên docs nhưng backend check "3000/month".

**Recommendation:** **Monthly canonical** (align SaaS standard).

---

## 2. Decision Criteria & Phương án

### Phương án A: Monthly Canonical ✅ RECOMMENDED

**Lý do:**
- SaaS industry standard (subscription billing cycle = monthly).
- Simpler pricing communication ("$99/month" → clear quota in month).
- Backend already implemented monthly in analytics schema.
- Easier chargeback + overage calculation in billing.

**Impact:**
- OC-05, OC-06 quota table: update day → month.
- OC-11 numeric lock sheet: 100/day → 3000/month (baseline).
- test_opencore_analytics_quota.py: new test suite covering monthly scenarios.
- No breaking change to existing self-hosters (just documentation update).

**Timeline:** Full decision + PR by **Fri 2026-04-26 EOD**.

**Artifacts:**
1. OC-05 Feature Boundary Matrix (quota table updated to monthly).
2. OC-06 Pricing & Packaging (quota expressed in monthly units).
3. OC-11 Numeric Lock Sheet (canonical monthly quota by tier).
4. backend/tests/test_opencore_analytics_quota.py (new, 12+ test cases).
5. RELEASE_DECISION_QUOTA_UNIT_CANONICAL_MONTHLY_20260426.md (summary).

---

### Phương án B: Daily Quota + Monthly Aggregate (Alternative)

**Lý do:**
- Finer-grained control + early abuse detection.
- More protective for SaaS operations.

**Impact:**
- Runtime complexity ↑ (rolling window + daily check).
- Database schema update required (add daily_quota_consumed column).
- More complex pricing logic ("100/day, 2500/month aggregate").

**Timeline:** Week 2-3 (if chosen).

**Risk:** User confusion from dual-unit pricing.

---

## 3. Decision Owner & Approval

**Decision Owner:** PO  
**Approval Gate:** PO confirms pricing/commercial implication  
**Approval Deadline:** Tue 2026-04-23 14:00 UTC+7 (by standup)

| Role | Input | By |
|---|---|---|
| PO | Final call on A vs B | Tue 2026-04-23 |
| Tech Lead | Arch feasibility review | Tue 2026-04-23 |
| Backend | Implementation estimate | Tue 2026-04-23 |

---

## 4. Implementation Roadmap (if Decision = A: Monthly)

### Phase 1: Analysis & Validation (Mon 2026-04-22)

**Task 1.1:** Document current quota scheme  
- **Owner:** Backend  
- **Effort:** 2h  
- **Deliverable:** 
  ```md
  Current runtime quota in opencore_analytics.py:
  - DPIPlan.max_api_calls_per_month = field
  - Monthly quota enforced via DPIAnalyticsPeriod (month_start, month_end)
  - Rolling reset on 1st of month
  ```

**Task 1.2:** Audit business docs quota references  
- **Owner:** Tech Lead  
- **Effort:** 3h  
- **Deliverable:**
  ```
  Files with quota references:
  - OC-05: "100 tickers/day" (line 45) → change to "3000 calls/month"
  - OC-06: "Quota: 100 tickers" (pricing section) → "3000 API calls/month"
  - OC-11: Numeric table row 1 → update
  - Backend models: no change needed (already monthly)
  ```

**Task 1.3:** Create test plan for monthly quota validation  
- **Owner:** QA + Backend  
- **Effort:** 4h  
- **Deliverable:** test_opencore_analytics_quota.py outline:
  - Test 1: quota reset on month boundary
  - Test 2: quota consumed increments correctly
  - Test 3: overage blocked when quota exceeded
  - Test 4: different tiers have different monthly quota
  - Test 5: grace period not consumed from quota
  - ...12+ total scenarios

**Standup Output (Mon EOD):** 
- Current scheme documented ✓
- Docs drift identified ✓
- Test plan prepared ✓

---

### Phase 2: Documentation Updates (Tue 2026-04-23)

**Task 2.1:** Update OC-05 (Feature Boundary Matrix)  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Change:** Replace daily quota with monthly quota in table  
- **Artifact:** OC-05 section "Community vs Pro vs Enterprise Quota"
- **Review Gate:** PO sign-off on pricing message

**Task 2.2:** Update OC-06 (Pricing & Packaging)  
- **Owner:** PO  
- **Effort:** 3h  
- **Change:** Pricing tier description → "monthly API quota"  
- **Artifact:** OC-06 pricing table + tier description  
- **Review Gate:** PO internal review + legal if needed

**Task 2.3:** Update OC-11 (Numeric Lock Sheet)  
- **Owner:** Backend + Tech Lead  
- **Effort:** 2h  
- **Change:** Canonical quota numbers (daily → monthly conversion)
  ```
  Free:       100 calls/month (was: ~3 calls/day)
  Pro:        3000 calls/month (was: ~100 calls/day)  ← BASELINE
  Enterprise: Unlimited (was: custom)
  ```
- **Artifact:** OC-11 numeric table + rationale note

**Standup Output (Tue EOD):**
- OC-05 updated + reviewed ✓
- OC-06 updated + reviewed ✓
- OC-11 canonical numbers locked ✓
- All 3 docs coherent ✓

---

### Phase 3: Test Implementation (Wed 2026-04-24)

**Task 3.1:** Implement test_opencore_analytics_quota.py  
- **Owner:** Backend  
- **Effort:** 6h  
- **File:** backend/tests/test_opencore_analytics_quota.py (new)  
- **Test Outline:**
  ```python
  class TestMonthlyQuotaCanonical(TestCase):
      def test_quota_reset_on_month_boundary(self):
          # Month 1: consumed 2500/3000
          # Month 2: reset to 3000
      
      def test_quota_consumed_increments(self):
          # Each API call increments monthly counter
      
      def test_overage_blocked(self):
          # Call 3001 → PermissionDenied
      
      def test_tier_boundary(self):
          # Free tier max 100, Pro 3000
      
      def test_grace_period_logic(self):
          # Trial period doesn't consume quota
      
      # ... 12+ scenarios total
  ```
- **Coverage Target:** >90%

**Task 3.2:** Run tests locally + CI validation  
- **Owner:** Backend  
- **Effort:** 2h  
- **Gate:** All tests green before PR

**Standup Output (Wed EOD):**
- test_opencore_analytics_quota.py implemented ✓
- Local tests pass ✓
- CI gate ready ✓

---

### Phase 4: Integration & PR (Thu-Fri 2026-04-25/26)

**Task 4.1:** Create summary doc (Release Decision)  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Deliverable:** RELEASE_DECISION_QUOTA_UNIT_CANONICAL_MONTHLY_20260426.md
  ```md
  Decision Date: 2026-04-23
  Approved By: PO
  Decision: Monthly quota canonical
  Rationale: [...]
  Artifacts Changed: OC-05, OC-06, OC-11, tests
  Impact: No breaking change; docs alignment only
  Effective Date: 2026-04-26
  ```

**Task 4.2:** Create PR + request review  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **PR Details:**
  - Branch: chore/oc22-decision1-quota-monthly
  - Commits: 3 (one per doc + tests)
  - Target: dev (to sync to deploy later)
  - Description: full decision + artifacts

**Task 4.3:** Code review + merge  
- **Owner:** Tech Lead (review), PO (approval)  
- **Effort:** 2h  
- **Merge Gate:** All checks pass + PR template verified (OC-19)

**Standup Output (Fri EOD):**
- Decision summary documented ✓
- PR created + merged ✓
- OC-13 gate "Quota canonical" updated → YELLOW ✓

---

## 5. Resource & Capacity

| Role | Task | Hours | Status |
|---|---|---|---|
| **PO** | Decision approval + OC-06 update | 4h | Ready |
| **Tech Lead** | Analysis + OC-05/OC-11 + review | 8h | Ready |
| **Backend Dev** | Analysis + test suite (12+ cases) | 8h | Ready |
| **QA** | Test plan + validation | 3h | Ready |

**Total:** ~3.5 person-days effort  
**Resource Allocation:** 1 PO (40%), 1 Tech Lead (100%), 1 Backend (50%), 1 QA (30%)

---

## 6. Success Criteria

✅ **By Fri 2026-04-26 EOD:**
1. Decision locked: **Monthly quota canonical** approved by PO.
2. OC-05/OC-06/OC-11 all coherent (monthly units, matching rationale).
3. test_opencore_analytics_quota.py: >90% coverage, all tests green.
4. PR merged to dev branch (per OC-19 governance).
5. OC-13 gate "Quota canonical": RED → **YELLOW** ✓

✅ **Outcome for OC-22 hardening sprint:**
- Decision 1 locked ✓
- Ready for Decision 2 (Package mapping) in Week 2 ✓

---

## 7. Risk Mitigation

| Risk | Mitigation |
|---|---|
| PO approval delay | Escalate Mon afternoon if undecided |
| Test coverage gap | Peer review + measure coverage % |
| Merge conflict | Keep PR small (3-4 files); merge early Fri |
| Communication confusion | Send "Decision Locked" email to team once merged |

---

## 8. Daily Standup Talking Points

### Mon 2026-04-22
- Q: PO - can approve monthly canonical by Tue morning?
- Q: Backend - any runtime impact foreseen?
- Goal: Unblock decision approval

### Tue 2026-04-23
- Decision approved: **Monthly canonical** ✓
- OC-05/06/11 update assignments locked
- Wed test implementation starts

### Wed 2026-04-24
- test_opencore_analytics_quota.py 70% done
- Local test runs green
- PR draft ready

### Thu 2026-04-25
- Tests 100% done + coverage check
- PR created, review in progress

### Fri 2026-04-26
- PR merged to dev ✓
- OC-13 gate updated ✓
- Decision 1 LOCKED ✓

---

## 9. Next Decision

**When Decision 1 complete (Fri EOD):**
- **Decision 2 (Package ↔ Runtime Mapping)** starts Mon 2026-04-29
- See OC-22 §3.2 for details

---

## 10. Approval Checklist

- [ ] **PO** approves monthly canonical + OC-06 content
- [ ] **Tech Lead** approves test plan + OC-05/OC-11 updates
- [ ] **Backend** confirms no runtime breaking changes
- [ ] All agree on Fri merge timeline

**Approval Sign-off:**  
PO: ___________________ Date: _____  
Tech Lead: ____________ Date: _____  

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR SPRINT KICKOFF

---

## Appendix A: Quota Unit Conversion Reference

```
Current Runtime (MONTHLY):
- Free: 100 calls/month
- Pro: 3000 calls/month
- Enterprise: Unlimited

Converting from Daily (historical docs):
- 100 calls/day × 30 days = 3000 calls/month
- 5 calls/day × 30 days = 150 calls/month
- Community hypothesis was ~3 calls/day = 100 calls/month (tighter than free tier)

Recommendation adoption:
- Community/Free: 100/month (allow learning, prevent abuse)
- Pro: 3000/month (current backend baseline)
- Enterprise: Unlimited (custom per deal)
```

