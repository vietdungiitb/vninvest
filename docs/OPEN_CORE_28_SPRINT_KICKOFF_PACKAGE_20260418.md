# OPEN CORE SPRINT KICKOFF PACKAGE (OC-28)

**Doc ID:** OC-28  
**Ngày tạo:** 2026-04-18  
**Trạng thái:** READY FOR TEAM ONBOARDING  
**Mục tiêu:** Final integration guide + team preparation for sprint kickoff Mon 2026-04-22  
**Target Audience:** PO, Tech Lead, Backend Dev, Frontend Dev, QA  
**Pre-Kickoff Deadline:** Complete reading + prep by **Sun 2026-04-21 EOD**

---

## 1. Executive Overview (5-min read)

**Sprint Mission (21 days, 5 decisions):**
- Lock all critical architectural decisions for OpenCore community launch
- Update public readiness gates (OC-13) from RED → YELLOW/GREEN
- Prepare steering committee GO/NO-GO decision (May 19)

**5 Key Decisions:**
1. **Quota Unit** (Week 1): Day vs month? → **MONTHLY CANONICAL** (recommended)
2. **Package Mapping** (Week 2): Business name ↔ runtime plan? → **1-1 EXPLICIT MAPPING**
3. **Community Package** (Week 3): Which endpoints public? → **EXPLICIT ALLOWLIST + FEATURE GATES**
4. **Self-Host Model** (Week 3): How self-hosters use Pro? → **ENTITLEMENT-BASED LICENSING**
5. **Legal Bundle** (Week 4): License + Terms + Privacy? → **APACHE 2.0 + SUITE**

**Success Outcome:**
- All 5 decisions locked + documented
- 4+ OC-13 gates: RED → YELLOW
- PR merged to dev (OC-19 governance enforced)
- Steering ready for GO/NO-GO decision

---

## 2. Document Navigation Guide

### Reading Order by Role

**🔴 PRODUCT OWNER (35 min total read)**
1. This doc (OC-28) - Executive Overview + PO Checklist (5 min)
2. [OC-25 §8](docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md#8-approval-checklist-required-before-sprint-kickoff) - Approval checklist (10 min)
3. [OC-22 §3-4](docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md#3-week-by-week-roadmap) - All 5 decisions overview (10 min)
4. [OC-23 §2-3](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#2-decision-options-recommendation) - Week 1 decision options (10 min)

**Target:** Understand 5 decisions + be ready to approve Decision 1 (quota) on Tue

---

**🟢 TECH LEAD (65 min total read)**
1. This doc (OC-28) - Overview + Tech Lead Checklist (5 min)
2. [OC-22 complete](docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md) - Full roadmap + architecture (20 min)
3. [OC-23 Phase breakdown](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#3-implementation-phases) - Week 1 details (15 min)
4. [OC-24 Phase breakdown](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md#2-2-implementation-phases) - Week 2 details (15 min)
5. [OC-25 §4-7](docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md#4-resource-allocation--capacity) - Resources + risks + dependencies (10 min)

**Target:** Master full roadmap + be ready to lead team through execution

---

**🔵 BACKEND DEVELOPER (45 min total read)**
1. This doc (OC-28) - Overview + Backend Checklist (5 min)
2. [OC-23 §3.1-3.2](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#31-implementation-phases) - Week 1 (quota) tasks (10 min)
3. [OC-24 §2.2-2.3](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md#22-implementation-phases) - Week 2 (schema) tasks (10 min)
4. [OC-26 §3.2 & 3.3](docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md#32-implementation-phases) - Week 3 (feature gates + licensing) tasks (15 min)
5. [OC-25 §6](docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md#6-success-criteria-per-week) - Success criteria + tests (5 min)

**Target:** Know your Week 1-3 tasks + effort estimates + success criteria

---

**🟡 FRONTEND DEVELOPER (optional, 30 min total read)**
1. This doc (OC-28) - Overview + Frontend Checklist (5 min)
2. [OC-24 §3](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md#3-frontend-integration) - Week 2 UI refactor tasks (10 min)
3. [OC-26 §3.2](docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md#32-implementation-phases) - Week 3 UI conditional rendering (10 min)
4. [OC-25 §6](docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md#6-success-criteria-per-week) - Week 2 + 3 success metrics (5 min)

**Target:** Know UI work scope for Weeks 2-3 + dependencies on backend

---

**🟣 QA / TESTING (30 min total read)**
1. This doc (OC-28) - Overview + QA Checklist (5 min)
2. [OC-23 §3.3](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#33-tests--documentation) - Week 1 test suite (5 min)
3. [OC-24 §3.1](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md#31-create-comprehensive-test-suite) - Week 2 test cases (5 min)
4. [OC-26 §4.1-4.2](docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md#phase-4-tests--documentation-thu-2026-05-09) - Week 3 tests (10 min)
5. [OC-25 §6](docs/OPEN_CORE_25_SPRINT_EXECUTIVE_CHECKLIST_20260418.md#6-success-criteria-per-week) - Coverage targets >90% (5 min)

**Target:** Know test scope + coverage expectations for Weeks 1-3

---

## 3. Week-by-Week Decision Snapshot

### **Week 1: Quota Unit (Apr 22-26)**
```
Decision Question: Day vs month for canonical quota unit?

Options:
  A) Day canonical (fine-grained analytics) - requires complex aggregation
  B) Monthly canonical (simple, aligns with pricing) - RECOMMENDED ✓
  C) Flexible (both) - too complex for MVP

Recommendation: Monthly canonical
Impact: All analytics, OC-05/06/11 docs, new test suite (15+ tests)
Owner: PO + Tech Lead
Deadline: Tue 2026-04-23 for approval
Success: Tests >90% coverage, PR merged by Fri EOD
```

**Key Links:**
- Detailed decision: [OC-23 §2](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#2-decision-options-recommendation)
- Tasks: [OC-23 §3](docs/OPEN_CORE_23_SPRINT_WEEK1_QUOTA_DECISION_20260422.md#3-implementation-phases)
- Timeline: [OC-22 §3.1](docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md#week-1-apr-22-26-decision-1---quota-unit)

---

### **Week 2: Package Mapping (Apr 29-May 3)**
```
Decision Question: Map business package ↔ runtime plan?

Options:
  A) Explicit 1-1 mapping + display_name field - RECOMMENDED ✓
  B) Unify all names to single source
  C) Separate identifiers from display names

Recommendation: Option A (explicit 1-1 mapping)
Impact: DPIPlan schema change, API response update, frontend constants
Owner: PO + Backend + Frontend
Dependency: Decision 1 (quota) must be locked
Success: Schema migrated, tests >90%, PR merged by Fri EOD
```

**Key Links:**
- Detailed decision: [OC-24 §2](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md#2-2-implementation-phases)
- Implementation phases: [OC-24 §2.2](docs/OPEN_CORE_24_SPRINT_WEEK2_PACKAGE_MAPPING_20260429.md)
- Timeline: [OC-22 §3.2](docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md#week-2-apr-29-may-3-decision-2---package-mapping)

---

### **Week 3: Community Package + Self-Host (May 6-10)**
```
Decision 3: Which endpoints/features public in Community tier?
  → Explicit allowlist via feature_gates.py module
  → 5+ endpoints gated, >90% tests

Decision 4: How self-hosters unlock Pro features?
  → Entitlement-based licensing (license key validation)
  → ServerID + License + LicenseKey models
  → CLI command for admin to generate keys

Recommendation: Explicit allowlist + entitlement licensing
Owner: Tech Lead + Backend + QA
Dependencies: Decisions 1 + 2 must be locked
Success: Both features implemented, tests >90%, PRs merged
```

**Key Links:**
- Community decision: [OC-26 §2](docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md#2-decision-3-community-package-boundary)
- Self-host decision: [OC-26 §3](docs/OPEN_CORE_26_SPRINT_WEEK3_COMMUNITY_SELFHOST_20260506.md#3-decision-4-self-host-pro-operating-model)
- Timeline: [OC-22 §3.3](docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md#week-3-may-6-10-decision-3--4)

---

### **Week 4: Legal Bundle (May 13-16)**
```
Decision 5: Complete legal framework?

Deliverables:
  ✓ Apache 2.0 LICENSE (permissive, commercial-friendly)
  ✓ TERMS_OF_SERVICE.md (usage boundaries, SLA, termination)
  ✓ PRIVACY_POLICY.md (data collection, GDPR/CCPA compliance)
  ✓ DISCLAIMER.md (not investment advice, liability limits)
  ✓ COPYRIGHT_NOTICE.md (dependency attribution)

Owner: PO + Tech Lead (legal review is bottleneck)
Success: All docs approved + deployed to repo root
Post-Sprint: Steering committee review Mon 2026-05-19 for GO/NO-GO
```

**Key Links:**
- Legal details: [OC-27 §2](docs/OPEN_CORE_27_SPRINT_WEEK4_LEGAL_BUNDLE_20260513.md#2-decision-5-legal-bundle-details)
- Implementation: [OC-27 §3](docs/OPEN_CORE_27_SPRINT_WEEK4_LEGAL_BUNDLE_20260513.md#3-implementation-timeline)
- Post-sprint gate: [OC-27 §5](docs/OPEN_CORE_27_SPRINT_WEEK4_LEGAL_BUNDLE_20260513.md#5-post-sprint-steering-review-mon-2026-05-19)

---

## 4. Pre-Kickoff Checklist

### **🔴 PRODUCT OWNER - Complete by Sun 2026-04-21 EOD**

- [ ] Read OC-25 §8 (approval checklist)
- [ ] Read OC-22 §3-4 (5 decisions overview)
- [ ] Read OC-23 §2 (quota options A/B/C)
- [ ] Confirm Decision A (monthly quota) is acceptable for pricing/business
- [ ] Schedule 15min decision approval call for Tue 2026-04-23 14:00 UTC+7
- [ ] Prepare backup decision (if concerns with Decision A)
- [ ] Clear calendar for Fri standup + review (30 min each)
- [ ] Assign team members: PO/Tech/Backend/QA if not already named

**By Sun EOD, know:**
- ✓ 5 decisions outline + your decision A approval
- ✓ What you need to do Week 1 (approve Decision 1 on Tue)
- ✓ Calendar blocked for Mon-Fri standups

---

### **🟢 TECH LEAD - Complete by Sun 2026-04-21 EOD**

- [ ] Read full OC-22 (complete roadmap, 20 min)
- [ ] Read OC-23 §3 (Week 1 phases, 15 min)
- [ ] Read OC-24 §2.2 (Week 2 phases, 15 min)
- [ ] Skim OC-26 §3 (Week 3 phases, architecture review, 10 min)
- [ ] Read OC-25 §4-7 (resources, risks, success criteria, 10 min)
- [ ] Confirm resource allocation realistic (PO 30%, Tech 100%, Backend 50%, QA 25%)
- [ ] Clear calendar for full sprint Mon-Fri (daily standups + sprints)
- [ ] Prepare Monday standup talking points (phase transitions, blockers)

**By Sun EOD, know:**
- ✓ Complete roadmap + resource reality (can team deliver?)
- ✓ Week 1 phase breakdown (what do we do Mon-Fri?)
- ✓ Risk awareness (DB migration, schema changes, etc.)
- ✓ You're ready to lead standup + make decisions

---

### **🔵 BACKEND DEVELOPER - Complete by Sun 2026-04-21 EOD**

- [ ] Read OC-23 §3.1-3.2 (Week 1 quota tasks, effort estimates)
- [ ] Read OC-24 §2.2-2.3 (Week 2 schema + tests tasks)
- [ ] Read OC-26 §3.2 & 3.3 (Week 3 feature gates + licensing)
- [ ] Audit current quota implementation (prep for Week 1 change)
- [ ] Audit DPIPlan model (prep for Week 2 migration)
- [ ] Clear calendar Mon-Fri for sprinting (will be heavy coding weeks)
- [ ] Ensure dev environment ready (latest code pulled, .env configured)

**By Sun EOD, know:**
- ✓ Your tasks Weeks 1-3 (quota → schema → licensing)
- ✓ Effort estimates + what's blockers
- ✓ You're ready for Mon standup + Week 1 Phase 1 (analysis)

---

### **🟡 FRONTEND DEVELOPER - Complete by Sun 2026-04-21 EOD** (if participating)

- [ ] Read OC-24 §3 (Week 2 UI tasks, 10 min)
- [ ] Read OC-26 §3.2 (Week 3 conditional UI rendering, 10 min)
- [ ] Audit current pricing/plan display components (prep for UI refactor)
- [ ] Clear calendar for Week 2 + 3 (5 hours Week 2, 5 hours Week 3 estimated)
- [ ] Prepare dev environment ready

**By Sun EOD, know:**
- ✓ Your tasks Week 2 (display names + constants, 5h)
- ✓ Your tasks Week 3 (conditional rendering, upsell prompts, 5h)
- ✓ Dependencies on backend (when are APIs ready?)

---

### **🟣 QA / TESTING - Complete by Sun 2026-04-21 EOD**

- [ ] Read OC-23 §3.3 (Week 1 test suite scope, >90% target)
- [ ] Read OC-24 §3.1 (Week 2 test cases, coverage validation)
- [ ] Read OC-26 §4.1-4.2 (Week 3 test suites for 2 decisions)
- [ ] Understand >90% coverage requirement (not just "tests pass")
- [ ] Clear calendar for Weeks 1-3 (15-20% of sprint time for test planning + validation)
- [ ] Prepare test environment (test DB, test fixtures, coverage tools)

**By Sun EOD, know:**
- ✓ Test scope per week + coverage targets
- ✓ Which backend devs to pair with for test design
- ✓ Coverage validation tools + reporting

---

## 5. Monday Standup Agenda (Apr 22, 30 min)

**TIME:** Mon 2026-04-22 09:00-09:30 UTC+7

### **Agenda:**

**1. Welcome + Sprint Mission (5 min)**
- Tech Lead: 21-day sprint to lock 5 decisions + GO/NO-GO for public launch
- Expected outcome: 4+ RED → YELLOW gates by May 9
- Steering review: Mon May 19

**2. Week 1 Preview (10 min)**
- Tech Lead: Present OC-23 (4 phases, quota canonical decision)
- Backend: Task breakdown (Task 1.1-1.3 analysis, Task 2.1-2.3 docs, Task 3.1-3.2 tests)
- Q&A: Any questions on Phase 1 (analysis) starting Mon?

**3. Decision 1 Approval Path (5 min)**
- PO: "By Tue 14:00, we approve Decision A (monthly canonical) or provide feedback"
- Backend: "Based on approval, we update OC-05/06/11 and write tests Tue-Wed"
- QA: "Wed we run soak tests, Thu-Fri we finalize + merge"

**4. Resource Confirmation (5 min)**
- Tech Lead: Confirm allocations (PO 30%, Tech 100%, Backend 50%, QA 25%)
- Blockers? Anyone can't commit this % time?
- On-call coverage? (Who covers if someone goes down?)

**5. Next Check-in (5 min)**
- Wed 15:00: Mid-week sync (Decision 1 progress, any blockers?)
- Fri 16:00: Week review (Phase 1 → 4 complete, ready for Week 2)

### **Talking Points for Tech Lead:**
- "We need monthly quota canonical by Tue approval. This unblocks analytics + pricing alignment."
- "Week 1 is analysis-heavy. Mon we audit current state. By Tue EOD we have decision approval. Tue-Wed we update docs. Wed-Thu we test. Fri we merge."
- "If quota changes cause issues, we escalate Tue morning. No surprises Wed."

---

## 6. Daily Standup Template (Mon-Fri, 15 min each)

**FORMAT:** 3 questions per person (follow Agile standup)

```
PERSON 1: What did I complete yesterday?
          What am I working on today?
          Any blockers?

PERSON 2: ...
          ...
          ...

...continue around table...

TECH LEAD SUMMARY (3 min):
- Week progress vs plan (on track? ahead? behind?)
- Any blockers requiring escalation?
- Next day preview
```

**Sample Mon 09:00 Standup (first day):**
```
BACKEND:
  Yesterday: N/A (first day)
  Today: Task 1.1 - Audit current quota analytics system + document state
  Blockers: Need access to analytics logs (check DB perms?)

TECH LEAD:
  Yesterday: N/A (first day)
  Today: Task 1.2 - Finalize quota gate taxonomy with PO + Task 1.3 - Spec entitlement API
  Blockers: PO availability for Tue decision approval (scheduled 14:00)

QA:
  Yesterday: N/A (first day)
  Today: Task 1.3 - Review current quota test coverage + design test plan
  Blockers: None yet

FRONTEND (if present):
  Yesterday: N/A (first day)
  Today: Standby (Week 2 work) - prep dev environment + review OC-24 UI tasks
  Blockers: None

TECH LEAD SUMMARY:
  Week 1 on track. All team members clear on Phase 1 tasks.
  Key blocker: PO approval on Decision A by Tue 14:00 (scheduled).
  If approval delayed, we have 6-hour buffer to adjust timeline.
  Next: Phase 1 analysis complete by Tue EOD, decision approval call Tue 14:00.
```

---

## 7. Success Metrics Dashboard (Track Weekly)

### **Week 1 Success (Apr 22-26)**
- [ ] Task 1.1-1.3: Analysis 100% complete (Mon-Tue)
- [ ] Decision 1 approval: PO approves "Monthly canonical" (Tue 14:00)
- [ ] Task 2.1-2.3: Docs update (OC-05/06/11) complete (Tue-Wed)
- [ ] Task 3.1-3.2: test_opencore_analytics_quota.py: >90% coverage (Wed-Thu)
- [ ] Task 4.1-4.2: PR review + merge to dev (Fri)
- [ ] OC-13 gate "Quota canonical": RED → YELLOW ✓

**Fri EOD Check-in:** All 6 success items ✓ = WEEK 1 SUCCESS

---

### **Week 2 Success (Apr 29-May 3)**
- [ ] Task 1.1-1.3: Analysis + Decision A approval (Mon-Tue)
- [ ] Task 2.1-2.3: DPIPlan schema + migration + seed data (Tue-Wed)
- [ ] Task 3.1-3.3: Frontend constants + API update + UI refactor (Wed)
- [ ] Task 4.1-4.3: test_plan_mapping.py: >90% coverage + docs update (Thu)
- [ ] Task 5.1-5.2: PR review + merge to dev (Fri)
- [ ] OC-13 gate "Package mapping": RED → YELLOW ✓

**Fri EOD Check-in:** All 6 success items ✓ = WEEK 2 SUCCESS

---

### **Week 3 Success (May 6-10)**
- [ ] Decision 3 (Community): feature_gates.py + @require_feature + tests (Mon-Thu)
- [ ] Decision 4 (Self-host): licensing.py models + CLI + tests (Mon-Thu)
- [ ] test_feature_gates.py: >90% coverage ✓
- [ ] test_licensing.py: >90% coverage ✓
- [ ] OC-13 gates "Community" + "Self-host": RED → YELLOW ✓
- [ ] Both PRs merged to dev (Fri)

**Fri EOD Check-in:** All 6 success items ✓ = WEEK 3 SUCCESS

---

### **Week 4 Success (May 13-16)**
- [ ] All 4 legal docs drafted + approved (Mon-Wed)
- [ ] Docs deployed to repo root + README updated (Thu)
- [ ] OC-13 gate "Legal": RED → GREEN ✓
- [ ] Sprint completion summary doc created (Thu)
- [ ] OC-22 marked COMPLETE (Fri)
- [ ] Ready for steering committee review (Mon May 19)

**Fri EOD Check-in:** All 6 success items ✓ = WEEK 4 SUCCESS + SPRINT COMPLETE

---

## 8. Quick Reference - Decision Summary Card

**Print this for your desk!**

```
╔════════════════════════════════════════════════════════════╗
║        OPEN CORE SPRINT - 5 DECISIONS (21 DAYS)           ║
║              Apr 22 - May 16, 2026                         ║
╠════════════════════════════════════════════════════════════╣
║ WEEK 1 (Apr 22-26): QUOTA UNIT                            ║
║ ├─ Question: Day or month canonical?                      ║
║ ├─ Answer: MONTHLY (recommended)                          ║
║ ├─ Owner: PO + Tech Lead                                  ║
║ └─ Success: Tests >90%, PR merged Fri                     ║
├────────────────────────────────────────────────────────────┤
║ WEEK 2 (Apr 29-May 3): PACKAGE MAPPING                    ║
║ ├─ Question: Business ↔ runtime mapping?                  ║
║ ├─ Answer: 1-1 explicit + display_name field              ║
║ ├─ Owner: PO + Backend + Frontend                         ║
║ └─ Success: DPIPlan migrated, tests >90%, PR merged       ║
├────────────────────────────────────────────────────────────┤
║ WEEK 3 (May 6-10): COMMUNITY + SELF-HOST (PARALLEL)       ║
║ ├─ Decision 3: Community allowlist?                       ║
║ │  └─ Answer: Explicit allowlist + feature_gates.py       ║
║ ├─ Decision 4: Self-host licensing?                       ║
║ │  └─ Answer: Entitlement + license keys                  ║
║ ├─ Owner: Tech Lead + Backend + QA                        ║
║ └─ Success: Both features + tests >90%, PRs merged        ║
├────────────────────────────────────────────────────────────┤
║ WEEK 4 (May 13-16): LEGAL BUNDLE + CLOSURE                ║
║ ├─ Question: Complete legal framework?                    ║
║ ├─ Answer: Apache 2.0 + ToS/Privacy/Disclaimer            ║
║ ├─ Owner: PO + Tech Lead (legal review)                   ║
║ └─ Success: All docs approved + deployed                  ║
╠════════════════════════════════════════════════════════════╣
║ STEERING REVIEW: Mon May 19 (GO/NO-GO for public launch)  ║
╚════════════════════════════════════════════════════════════╝
```

---

## 9. Common Questions (FAQ)

**Q: What if we don't get PO approval on Tue 2026-04-23?**
A: We have a 6-hour buffer built into Week 1. If approval delayed until Wed, we push Phase 2 docs update to Wed-Thu, tests to Thu-Fri, merge to Fri EOD. Still achievable but tight.

**Q: What if a decision changes mid-week?**
A: Document the change in OC-15 (Decision Packet). Update dependent docs the same day. Escalate to steering if decision conflicts with downstream weeks.

**Q: What if we miss Week 1 deadline?**
A: Decision 1 (quota) is CRITICAL PATH. Week 2 depends on it. If we slip Week 1, we must slip Week 2 + move steering review from May 19 to May 26.

**Q: Are we guaranteed to launch public repo after sprint?**
A: No. Steering committee decides GO/NO-GO on May 19. If >80% OC-13 gates are GREEN, we GO. Otherwise NO-GO + continue hardening.

**Q: Who is responsible if a phase fails?**
A: Phase owner (per OC-23/24/26/27). Tech Lead oversees. Escalate to PO if blocking.

---

## 10. Document Linkage Map

**All Sprint Documents (OC-22 through OC-28):**
```
OC-22: Hardening Sprint 21-Day Plan (strategic roadmap)
├─ OC-23: Week 1 Quota Decision (execution detail)
├─ OC-24: Week 2 Package Mapping (execution detail)
├─ OC-25: Executive Approval Checklist (sign-off gate)
├─ OC-26: Week 3 Community + Self-Host (execution detail)
├─ OC-27: Week 4 Legal Bundle (execution detail + post-sprint)
└─ OC-28: This doc - Kickoff Package (team onboarding + integration)

Governance:
└─ OC-19: Default Team Governance Policy (enforcement layer)

Reference Docs:
├─ OC-13: Community Publish Readiness (GO/NO-GO gates)
├─ OC-15: Decision Packet Current (decisions tracker)
└─ OC-00: Document Index (navigation)
```

---

## 11. Final Pre-Kickoff Checklist (Tech Lead, by Sun EOD)

- [ ] All team members have read this doc (OC-28)
- [ ] All team members completed role-specific reading (per §2)
- [ ] All team members completed pre-kickoff checklist (per §4)
- [ ] Monday standup calendar invitation sent (09:00 UTC+7, 30 min)
- [ ] Tech environment prep: latest dev code pulled, .env configured
- [ ] Slack channel created or prepared (#opencore-sprint or similar)
- [ ] Decision 1 approval call scheduled with PO (Tue 14:00 UTC+7, 15 min)
- [ ] Weekly syncs scheduled: Wed 15:00, Fri 16:00 (weekly 30 min each)
- [ ] GitHub PR ready (chore/oc19-hardening-sprint branch, 6 commits, ~4200 lines docs)
- [ ] Steering committee meeting scheduled (Mon May 19, 14:00 UTC+7, 2 hours)

**If all 10 items ✓, you're ready for Monday 09:00 kickoff!**

---

## Conclusion

**You now have everything you need to execute a successful 21-day hardening sprint.**

**Road to Success:**
1. ✅ Complete pre-kickoff reading (by Sun EOD)
2. ✅ Attend Monday standup (09:00 UTC+7)
3. ✅ Execute Week 1 phases (Mon-Fri Apr 22-26)
4. ✅ Approve Decision 1 by Tue 14:00
5. ✅ Merge PR to dev by Fri EOD
6. ✅ Repeat Weeks 2-4 with same discipline
7. ✅ Present to steering committee Mon May 19
8. ✅ Launch public repo (if GO decision)

**Remember:**
- 5 decisions = 5 approval gates = 5 opportunities to course-correct
- >90% test coverage = quality gate = no surprises at steering review
- Daily standups = early blocker detection = schedule confidence
- OC-19 governance = PR enforcement = no docs drift

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR TEAM DISTRIBUTION  
**Target Distribution:** Fri 2026-04-19 (1 day before reading deadline)

---

**Next Step:** Share with team on Fri 2026-04-19. Have them complete §4 by Sun EOD. See you at Monday standup! 🚀

