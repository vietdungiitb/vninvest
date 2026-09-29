# OPEN CORE SPRINT EXECUTIVE CHECKLIST & COMPLETE GUIDE (OC-25)

**Doc ID:** OC-25  
**Ngày tạo:** 2026-04-18  
**Trạng thái:** READY FOR APPROVAL - executive summary + week-by-week sign-off checklist  
**Mục tiêu:** Provide PO + Tech Lead complete overview + approval gate for entire 21-day sprint  
**Timeline:** Approval Deadline: **Fri 2026-04-19** (by EOD)  
**Next Step:** Kick off Mon 2026-04-22 (Week 1: Decision 1 - Quota canonical)

---

## 1. Sprint Objectives & Success Definition

**Primary Goal:**  
> Lock 5 critical decisions (OC-15 §6) + update OC-13 gates from RED → YELLOW/GREEN to enable public launch planning.

**Sprint Duration:** 21 days (2026-04-22 to 2026-05-09)

**Success Metric:**
- ✅ All 5 decisions locked (recorded in OC-15 + respective docs)
- ✅ OC-13 gate status: min 3 RED → YELLOW
- ✅ All implementation tests >90% coverage
- ✅ PR merged to dev per OC-19 governance

**Post-Sprint Gate:**
- Steering committee review OC-13 (updated with locked decisions)
- Decision: GO (launch public repo) vs NO-GO (continue hardening)
- Target public repo launch: **2026-05-14** (if GO)

---

## 2. Executive Summary: 5 Decisions Breakdown

| # | Decision | Scope | Owner | Est. Effort | Week | Status |
|---|---|---|---|---|---|---|
| 1 | **Quota Unit** | Day vs Month canonical | PO + Tech | 3.5 pd | 1 | READY |
| 2 | **Package Mapping** | Business ↔ Runtime plan | PO + Backend | 3 pd | 2 | READY |
| 3 | **Community Package** | Endpoint + feature allowlist | Tech Lead | 3 pd | 3 | PLANNED |
| 4 | **Self-Host Pro Model** | License + distribution | PO + Backend | 3 pd | 3-4 | PLANNED |
| 5 | **Legal Bundle** | License + disclaimer + Terms | PO + Legal | 2 pd | 4 | PLANNED |

**Total Effort:** ~17.5 person-days (across 4 weeks)  
**Team Capacity:** 3-4 people (1 PO 30%, 1 Tech Lead 100%, 1 Backend 50%, 1 QA 25%)

---

## 3. Week-by-Week Roadmap

### **WEEK 1 (Apr 22-26): Decision 1 - Quota Unit**
**Document:** [OC-23](../core_23_sprint/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md)

**Tasks:**
- Mon: Analysis (current state, docs audit, test plan)
- Tue: Docs update (OC-05, OC-06, OC-11)
- Wed: Tests (test_opencore_analytics_quota.py, >90% coverage)
- Thu-Fri: Integration + PR merge to dev

**Deliverable:** Quota unit locked (monthly canonical), OC-13 gate "Quota canonical": RED → YELLOW

**Owner:** PO + Tech Lead  
**Approval Gate:** Fri 2026-04-26 EOD ✓

---

### **WEEK 2 (Apr 29-May 3): Decision 2 - Package Mapping**
**Document:** [OC-24](../core_24_sprint/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md)

**Tasks:**
- Mon: Analysis (enum audit, docs cross-ref, decision approval)
- Tue: Schema update (add display_name field, migration)
- Wed: Frontend integration (constants, API update, UI refactor)
- Thu: Tests + docs (test_plan_mapping.py, OC-11/OC-12 update)
- Fri: PR merge to dev

**Deliverable:** Package mapping locked (1-1 mapping + display_name), OC-13 gate "Package boundary": RED → YELLOW

**Owner:** PO + Backend + Frontend  
**Approval Gate:** Fri 2026-05-03 EOD ✓

---

### **WEEK 3 (May 6-10): Decision 3 + Start Decision 4**
**Decision 3 Document:** (OC-26 - to be created after OC-24 approval)

**Scope:**
- Decision 3: Community V1 package allowlist (watchlist ✓, whale advisory ✗)
  - Endpoint allowlist definition
  - Feature gate implementation (feature_gates.py)
  - Integration tests + docs

- Decision 4: Self-host Pro operating model
  - License schema design
  - License check integration in 3+ Pro endpoints
  - CLI command + admin UI

**Deliverable:** Decisions 3+4 architecture locked, OC-13 gates "Community package": RED → YELLOW, "Self-host model": RED → YELLOW

**Owner:** Tech Lead + Backend + PO  
**Approval Gate:** Fri 2026-05-10 EOD ✓

---

### **WEEK 4 (May 11-15): Decision 5 + Final Integration**
**Decision 5 Document:** (OC-27 - to be created)

**Scope:**
- Decision 5: Legal bundle finalization
  - License file (Apache 2.0)
  - Disclaimer + Terms + Privacy docs
  - Legal review completion
  - Add to repo root + docs/

- Final integration:
  - Merge all remaining PRs
  - Update OC-13 final gate status
  - Create release decision memo

**Deliverable:** All 5 decisions locked, OC-13 updated, ready for steering committee review

**Owner:** PO + Legal + Tech Lead  
**Approval Gate:** Fri 2026-05-09 EOD (sprint EOD) ✓

---

## 4. Resource Allocation & Capacity

### Team Configuration (Recommended)

| Role | Person | Allocation | Availability | Notes |
|---|---|---|---|---|
| **Product Owner** | TBD | 30-40% | Mon standup + decision approval Tue-Wed | Final sign-off on pricing/legal/business |
| **Tech Lead** | TBD | 100% | Full-time | Architecture + docs + code review |
| **Backend Dev** | TBD | 50% | Design + coding + tests | Focus: quota + licensing + entitlement |
| **Frontend Dev** | TBD (optional Week 2) | 40% | Week 2 + spot check Week 3 | UI refactor + constants |
| **QA** | TBD (shared) | 25% | Test planning + validation | Integration tests + coverage |

### Workload Per Week

| Week | Effort (person-days) | Peak Role | Notes |
|---|---|---|---|
| 1 | 3.5 | PO + Tech | Manageable, low frontend load |
| 2 | 3 | Backend + Frontend | Highest frontend load |
| 3 | 5 | Tech Lead + Backend | Complex licensing design |
| 4 | 2 | PO + Legal | Dependent on legal review speed |

**Total:** ~17.5 person-days ≈ **4 people × 1 week of full-time work**

---

## 5. Critical Paths & Blocking Dependencies

```
Week 1 (Decision 1: Quota) ──→ MUST COMPLETE
         ↓
Week 2 (Decision 2: Mapping) ──→ MUST COMPLETE (builds on quota baseline)
         ↓
Week 3 (Decision 3 + 4)  ──→ Can proceed in parallel
  ├─ Decision 3: Community boundary (independent)
  └─ Decision 4: Self-host model (independent, but needs entitlement design)
         ↓
Week 4 (Decision 5: Legal) + Final Integration ──→ NO BLOCKERS (parallel legal review)
```

**Critical Path:** Week 1 → Week 2 → Week 3 (decisions can split)  
**Float:** Week 4 legal review can happen in parallel with Week 3 (submit for review Mon Week 3)

---

## 6. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **PO unavailable for decisions** | Medium | HIGH - blocks approval | Schedule decision calls Mon before standup; async approval via Slack |
| **Legal review delayed (Week 4)** | Medium | MEDIUM - delays final gate | Submit legal draft Mon Week 3 for parallel review |
| **Database migration complexity (Week 2)** | Medium | HIGH - data loss risk | Dry-run on test DB; backup before apply; rollback plan |
| **UI refactor scope creep (Week 2)** | Low | MEDIUM - schedule slip | Define exact components (Task 1.2) upfront; code search Tue morning |
| **Test coverage gap** | Low | LOW - caught in review | Peer review tests; measure coverage % before merge |

**Escalation Path:** Tech Lead → PO → Steering committee (if blocker)

---

## 7. Success Criteria Per Week

### ✅ **Week 1 Complete (Fri 2026-04-26 EOD)**
- [ ] Decision 1 (Quota unit) locked: Monthly canonical ✓
- [ ] OC-05, OC-06, OC-11 updated + coherent ✓
- [ ] test_opencore_analytics_quota.py: >90% coverage, all green ✓
- [ ] PR merged to dev (OC-19 checks passed) ✓
- [ ] OC-13 gate "Quota canonical": RED → YELLOW ✓

### ✅ **Week 2 Complete (Fri 2026-05-03 EOD)**
- [ ] Decision 2 (Package mapping) locked: Option A (1-1 mapping + display_name) ✓
- [ ] DPIPlan.display_name field migrated ✓
- [ ] Plan mapping constants (backend + frontend) ✓
- [ ] UI components refactored to use display_name ✓
- [ ] test_plan_mapping.py: >90% coverage, all green ✓
- [ ] PR merged to dev (OC-19 checks passed) ✓
- [ ] OC-13 gate "Package mapping": RED → YELLOW ✓

### ✅ **Week 3 Complete (Fri 2026-05-10 EOD)**
- [ ] Decision 3 (Community package) locked: Endpoint allowlist defined ✓
- [ ] feature_gates.py implemented + 10+ tests ✓
- [ ] Decision 4 (Self-host model) locked: Licensing architecture approved ✓
- [ ] licensing.py module design complete + 8+ tests passing ✓
- [ ] OC-13 gates "Community package" + "Self-host model": RED → YELLOW ✓

### ✅ **Week 4 Complete (Fri 2026-05-09 EOD - Sprint EOD)**
- [ ] Decision 5 (Legal bundle) locked: All 5 docs drafted + legal reviewed ✓
- [ ] LICENSE file added to repo root ✓
- [ ] All 5 decisions recorded in OC-15 ✓
- [ ] OC-13 gate status update complete (min 4 RED → YELLOW) ✓
- [ ] RELEASE_DECISION_SUMMARY_20260509.md created ✓
- [ ] Ready for steering committee review (GO/NO-GO public launch) ✓

---

## 8. Approval Checklist (Required Before Sprint Kickoff)

### Executive Sign-Off (Required)

- [ ] **PO** reviews 5 decisions scope + impact
  - Decision 1: Monthly quota + pricing implication OK?
  - Decision 2: Package naming + display_name OK?
  - Decision 4: Self-host licensing model OK?
  - Decision 5: Legal bundle scope (Apache 2.0 + Terms/Privacy/Disclaimer) OK?
  - Timeline + resource allocation OK?

- [ ] **Tech Lead** reviews implementation architecture + effort
  - OC-23 implementation phases feasible?
  - OC-24 schema/migration complexity acceptable?
  - OC-26/27 (Weeks 3-4) architecture viable?
  - Risk mitigations adequate?
  - Resource allocation realistic?

- [ ] **Backend Lead** reviews technical scope
  - Quota analytics system ready for monthly schema?
  - DPIPlan migration low-risk?
  - Licensing module doable in Week 3?
  - Test coverage targets (>90%) achievable?

- [ ] **Frontend Lead** (if available)
  - UI refactor scope defined?
  - API response changes OK?
  - Week 2 effort estimate 5 hours reasonable?

### Sprint Success Criteria (Team Commitment)

- [ ] All team members read OC-22/OC-23/OC-24 docs
- [ ] Team commits to daily standups (Mon-Fri, 15min)
- [ ] Weekly sprint reviews (Fri 16:00) to assess blocker removal
- [ ] No major scope changes mid-sprint (all goes to backlog)

---

## 9. Decision Approval Sign-Off Sheet

**SPRINT APPROVAL AUTHORITY SIGNATURES:**

| Role | Name | Signature | Date | Decision |
|---|---|---|---|---|
| **Product Owner** | ________________ | ________________ | ________________ | ✓ Approve sprint ✓ Conditional (note below) ✗ Block |
| **Tech Lead** | ________________ | ________________ | ________________ | ✓ Approve sprint ✓ Conditional (note below) ✗ Block |
| **Backend Lead** | ________________ | ________________ | ________________ | ✓ Approve sprint ✓ Conditional (note below) ✗ Block |

**Conditional Approval Notes (if applicable):**

```
[Leave space for conditions/requirements if not 100% approved]

_______________________________________________________________________________

_______________________________________________________________________________
```

**SPRINT GO DATE:** Fri 2026-04-19 EOD (Latest)  
**If Not Approved By:** Defer sprint to following week (May 19) to allow for re-planning

---

## 10. Post-Approval Next Steps

### If Approved (✓)
1. **Fri 2026-04-19 EOD:** Email team approval + sprint kickoff memo
2. **Fri 2026-04-19 EOD:** Post sprint docs to Slack + project management system
3. **Mon 2026-04-22 08:00:** Standup kick-off (30 min)
   - Review OC-23 in detail
   - Assign Phase 1 tasks
   - Confirm PO availability for Tue decision approval

### If Conditional Approval
1. **Address conditions** before Mon standup
2. **Update OC-23/OC-24** if scope changed
3. **Re-confirm resource** allocation if adjusted

### If Blocked
1. **Schedule debrief** with PO + Tech Lead (Fri 2026-04-19)
2. **Identify root concerns** + record in memo
3. **Target:** Re-plan sprint for **Mon 2026-05-19** (following week)

---

## 11. Communication Plan

### Internal Comms (Weekly)
- **Mon 09:00:** Sprint standup (15 min, standing)
- **Wed 15:00:** Mid-week sync (15 min, decision/blocker check)
- **Fri 16:00:** Week review + retro (30 min)
- **Fri 17:00:** Next week preview (10 min)

### External Comms (Steering Committee)
- **Fri 2026-05-09 EOD:** Sprint completion summary (email)
- **Mon 2026-05-12:** Steering meeting review (OC-13 updated gates + 5 decisions locked)
- **Decision:** GO (launch public repo) vs NO-GO (continue hardening)

---

## 12. Reference Documents

**Read in This Order:**
1. ✅ OC-15 (Decision Packet Current) - 5 decisions overview
2. ✅ OC-22 (Hardening Sprint 21-Day Plan) - complete roadmap
3. ✅ OC-23 (Sprint Week 1: Quota Decision) - detailed Week 1 tasks
4. ✅ OC-24 (Sprint Week 2: Package Mapping) - detailed Week 2 tasks
5. 📄 OC-25 (This doc) - executive checklist
6. 📋 OC-26 (Week 3: Community Package + Self-Host Model) - TBD after OC-24 approval
7. 📋 OC-27 (Week 4: Legal Bundle) - TBD after OC-24 approval

**Ongoing Governance:**
- OC-19 (Default Team Governance Policy) - enforce on PRs
- OC-13 (Community Publish Readiness) - track gate status updates

---

## 13. Final Checklist Before Approval

- [ ] All 5 decision documents (OC-23, OC-24 + planned OC-26, OC-27) reviewed
- [ ] Effort estimates realistic for team size
- [ ] Resource allocation confirmed (PO 30%, Tech 100%, Backend 50%, QA 25%)
- [ ] Critical dependencies understood (Week 1 → Week 2 mandatory)
- [ ] Risk register reviewed + mitigations assigned
- [ ] Communication plan acceptable (daily standup, Fri reviews)
- [ ] Success criteria understood (RED → YELLOW gates, 5 decisions locked)
- [ ] Post-sprint steering committee review scheduled (Mon 2026-05-12)

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR EXECUTIVE APPROVAL  
**Approval Deadline:** **Fri 2026-04-19 EOD**

---

## Appendix: Quick Reference Cards

### Decision 1 (Week 1) - Quota Unit
- **Question:** Day vs month?
- **Recommendation:** Monthly
- **Impact:** OC-05, OC-06, OC-11 update; new test suite
- **Effort:** 3.5 person-days

### Decision 2 (Week 2) - Package Mapping
- **Question:** Business name ↔ runtime plan?
- **Recommendation:** Option A (1-1 mapping + display_name)
- **Impact:** DPIPlan schema, API response, UI refactor
- **Effort:** 3 person-days

### Decision 3 (Week 3) - Community Package
- **Question:** Which endpoints/features public?
- **Recommendation:** Explicit allowlist (watchlist ✓, whale ✗)
- **Impact:** feature_gates.py module
- **Effort:** 3 person-days

### Decision 4 (Week 3) - Self-Host Pro
- **Question:** License distribution model?
- **Recommendation:** Entitlement-based gate + license check
- **Impact:** licensing.py module, CLI command
- **Effort:** 3 person-days

### Decision 5 (Week 4) - Legal Bundle
- **Question:** License + disclaimer scope?
- **Recommendation:** Apache 2.0 + Terms/Privacy/Disclaimer
- **Impact:** 5 legal docs + repo hygiene
- **Effort:** 2 person-days

