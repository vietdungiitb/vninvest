# OPEN CORE SPRINT WEEK 4 - LEGAL BUNDLE & FINAL INTEGRATION (OC-27)

**Doc ID:** OC-27  
**Ngày tạo:** 2026-04-18 (planning), effective 2026-05-13 (sprint start)  
**Trạng thái:** READY FOR PLANNING - legal finalization + sprint wrap-up  
**Mục tiêu:** Lock Decision 5 (Legal bundle) + complete all gate updates for public launch readiness  
**Timeline:** Mon 2026-05-13 → Fri 2026-05-16 EOD (sprint completion)  
**Dependency:** OC-26 (Decisions 3 & 4) MUST be complete by Fri 2026-05-10

---

## 1. Executive Summary

**Decision 5: Legal Bundle Finalization**
> Establish complete legal framework for public repository launch: License + Terms of Service + Privacy Policy + Disclaimers.

**Current State:**
- No LICENSE file in repo root
- No Terms of Service document
- No Privacy Policy
- No copyright/attribution language
- Self-hosters + users have no legal clarity

**Recommendation: Apache 2.0 + Terms/Privacy/Disclaimer Suite**

```
Artifact Checklist:
1. LICENSE (Apache 2.0 - permissive, commercial-friendly)
2. TERMS_OF_SERVICE.md (usage boundaries + limitations)
3. PRIVACY_POLICY.md (data collection + handling)
4. DISCLAIMER.md (liability + accuracy)
5. COPYRIGHT_NOTICE.md (attribution for dependencies)
```

**Decision Scope:**
1. Select license: Apache 2.0 (recommended for open-source + self-host use)
2. Draft Terms of Service (OpenCore cloud usage conditions)
3. Draft Privacy Policy (data retention + third parties)
4. Draft Disclaimer (no financial advice + liability limits)
5. Legal review + sign-off
6. Repo deployment (add files to root + docs/)

---

## 2. Decision 5: Legal Bundle Details

### 2.1 License Selection

**Options Comparison:**

| Option | Type | Commercial Use | Self-Host | Dependencies | Recommendation |
|---|---|---|---|---|---|
| Apache 2.0 | Permissive | ✓ Yes | ✓ Yes | GPL incompatible | **✅ RECOMMENDED** |
| MIT | Permissive | ✓ Yes | ✓ Yes | GPL incompatible | Similar (simpler) |
| GPL v3 | Copyleft | ⚠️ Restricted | ⚠️ Restricted | GPL compatible | Too restrictive |
| SSPL | Proprietary | ✗ No | ⚠️ Limited | Custom | Too restrictive |

**Recommendation: Apache 2.0**
- Allows commercial use + self-hosting
- Includes patent protection clause
- Popular in FinTech (compatible with VN regulations)
- Clear: "Don't remove attribution"

**License Text:** 129 lines, standard Apache header

---

### 2.2 Terms of Service

**Scope:** Usage boundaries + limitations for OpenCore cloud platform

**Key Sections:**
```
1. Service Description
   - What OpenCore provides (API endpoints + data feeds)
   - Availability SLA (99.5% uptime for Pro users)
   
2. User Responsibilities
   - Don't use for market manipulation
   - Don't redistribute data
   - API rate limits must be respected
   
3. Limitations of Liability
   - No liability for trade losses
   - Data provided "as-is" without warranty
   - 3rd-party data accuracy not guaranteed
   
4. Termination
   - We can terminate for ToS violations
   - User can terminate anytime
   
5. Changes to Service
   - We reserve right to modify pricing/features
   - 30-day notice for material changes
```

**Estimated Length:** 1500 words (8-10 sections)

---

### 2.3 Privacy Policy

**Scope:** Data collection + handling + retention for OpenCore users

**Key Sections:**
```
1. Information We Collect
   - Account data (name, email, plan tier)
   - Usage data (API calls, endpoints, timestamps)
   - Device data (IP, browser, OS for security)
   
2. How We Use Your Data
   - Service operation (storing watchlists, portfolios)
   - Analytics (aggregated usage patterns, no PII)
   - Compliance (regulatory requirements, audit)
   
3. Data Retention
   - Account data: retained while active + 90 days after deletion
   - Usage logs: 365 days for audit trail
   - Deleted accounts: pseudonymized after 30 days
   
4. Third Parties
   - Data sharing: minimal (no selling to advertisers)
   - Subprocessors: [list: payment provider, analytics, hosting]
   - User consent: opt-in for marketing emails
   
5. Your Rights (GDPR/CCPA compliance)
   - Right to access your data
   - Right to delete (right to be forgotten)
   - Right to export (data portability)
   
6. Cookie Policy
   - Session cookies: required for authentication
   - Analytics cookies: optional, can be disabled
```

**Estimated Length:** 2000 words (8-10 sections)

---

### 2.4 Disclaimer

**Scope:** Liability limitations + accuracy notices for financial data

**Key Sections:**
```
1. Not Investment Advice
   - OpenCore: informational tool, NOT financial advisor
   - Users: consult licensed professionals before trading
   
2. Data Accuracy
   - Best efforts to provide accurate data
   - Delays: real-time data may be delayed by 5-30 minutes
   - Errors: data errors happen, not responsible for losses
   
3. Market Risks
   - Stock markets: volatile, can lose money
   - Leverage: risky, can lose more than invested
   - Past performance: does not guarantee future results
   
4. No Liability
   - OpenCore not liable for trading losses
   - OpenCore not liable for system downtime
   - OpenCore not liable for data inaccuracies
   
5. Regulatory Notice
   - Vietnam: Compliant with regulations
   - Self-hosting: Users responsible for local compliance
```

**Estimated Length:** 1000 words (5-6 sections)

---

### 2.5 Copyright Notice

**Scope:** Attribution for dependencies + third-party data

**Content:**
```
OpenCore Copyright © 2026 VietDung & Contributors

Third-Party Licenses:
- Django: BSD 3-Clause
- React: MIT
- vnbroker: MIT (attribution to maintainers)
- [List all major dependencies with licenses]

Data Attribution:
- Stock prices: Vietstock/VNDirect/finabase
- Company data: Vietnam Stock Exchange (HNX/HOSE)
- Economic data: Vietnam State Bank of Vietnam

All dependencies comply with their respective licenses.
Users of OpenCore must comply with all included licenses.
```

**Estimated Length:** 500 words

---

## 3. Implementation Timeline

### **Phase 1: Legal Drafting (Mon-Tue 2026-05-13 to 2026-05-14)**

**Task 1.1:** Prepare Apache 2.0 LICENSE file  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Artifact:** LICENSE (root of repo)
  ```
  Apache License, Version 2.0
  
  [Standard 129-line Apache header]
  [Include NOTICE file reference]
  ```

**Task 1.2:** Draft Terms of Service  
- **Owner:** PO + Tech Lead  
- **Effort:** 3h  
- **Artifact:** docs/TERMS_OF_SERVICE.md (1500 words)
  - Service description
  - User obligations
  - Limitations
  - Termination clause

**Task 1.3:** Draft Privacy Policy  
- **Owner:** PO  
- **Effort:** 3h  
- **Artifact:** docs/PRIVACY_POLICY.md (2000 words)
  - Data collection + usage
  - Third-party disclosure
  - User rights (GDPR/CCPA)
  - Retention policy

**Task 1.4:** Draft Disclaimer  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Artifact:** docs/DISCLAIMER.md (1000 words)
  - Not investment advice
  - Data accuracy notice
  - Risk disclaimers

**Standup Output (Tue EOD):**
- LICENSE file ready ✓
- Terms of Service draft complete ✓
- Privacy Policy draft complete ✓
- Disclaimer draft complete ✓
- Submitted to legal review (external or internal PO) ✓

---

### **Phase 2: Legal Review (Wed 2026-05-15, can parallel with Phase 1)**

**Task 2.1:** Internal legal review (PO)  
- **Owner:** PO  
- **Effort:** 2h  
- **Scope:**
  - Compliance with Vietnam regulations
  - License compatibility with Apache 2.0
  - Data handling + privacy requirements
  - Liability language appropriate

**Task 2.2:** Terms adjustment based on feedback  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Changes:** Update docs based on legal feedback
  - Adjust liability clauses
  - Clarify data retention
  - Add regulatory notices for Vietnam

**Task 2.3:** Final sign-off  
- **Owner:** PO  
- **Effort:** 1h  
- **Output:** Approval memo
  ```
  LEGAL APPROVAL - DECISION 5
  
  [Date] 2026-05-15 EOD
  
  Documents reviewed + approved for public release:
  - LICENSE (Apache 2.0) ✓
  - TERMS_OF_SERVICE.md ✓
  - PRIVACY_POLICY.md ✓
  - DISCLAIMER.md ✓
  
  All documents comply with Vietnam law + international standards.
  Ready for public repo deployment.
  
  Signature: _________________
  ```

**Standup Output (Wed EOD):**
- Legal review complete ✓
- All docs approved for publication ✓
- No blockers for Fri merge ✓

---

### **Phase 3: Deployment + Final Integration (Thu 2026-05-16, can overlap with Phase 2)**

**Task 3.1:** Deploy legal docs to repo  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Files:**
  - LICENSE (repo root)
  - docs/TERMS_OF_SERVICE.md
  - docs/PRIVACY_POLICY.md
  - docs/DISCLAIMER.md
  - docs/COPYRIGHT_NOTICE.md

**Task 3.2:** Update README  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Changes:**
  ```markdown
  ## License
  
  OpenCore is licensed under Apache License 2.0. See LICENSE file for details.
  
  ## Legal
  
  Please review our Terms of Service and Privacy Policy before use.
  
  - [Terms of Service](docs/TERMS_OF_SERVICE.md)
  - [Privacy Policy](docs/PRIVACY_POLICY.md)
  - [Disclaimer](../disclaimer/DISCLAIMER.md)
  ```

**Task 3.3:** Update OC-13 gate (final sprint)  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Changes:**
  - Mark "Legal bundle" gate: RED → GREEN ✓
  - Mark "Community package" gate: YELLOW (locked) ✓
  - Mark "Self-host model" gate: YELLOW (locked) ✓
  - Mark "Quota canonical" gate: YELLOW (locked) ✓
  - Mark "Package mapping" gate: YELLOW (locked) ✓
  - **Result:** 4 RED → YELLOW/GREEN, ready for public launch

**Task 3.4:** Create sprint completion summary  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Artifact:** docs/SPRINT_COMPLETION_SUMMARY_20260516.md
  ```markdown
  # Sprint Completion Summary (Apr 22 - May 16, 2026)
  
  ## Decisions Locked (5/5)
  - [x] Decision 1: Quota Unit (monthly canonical)
  - [x] Decision 2: Package Mapping (1-1 mapping + display_name)
  - [x] Decision 3: Community Package (endpoint allowlist + feature gates)
  - [x] Decision 4: Self-Host Model (entitlement-based licensing)
  - [x] Decision 5: Legal Bundle (Apache 2.0 + Terms/Privacy/Disclaimer)
  
  ## OC-13 Gates Updated
  - Quota canonical: RED → YELLOW
  - Package mapping: RED → YELLOW
  - Community package: RED → YELLOW
  - Self-host model: RED → YELLOW
  - Legal bundle: RED → GREEN
  
  ## Deliverables
  - 12 new documentation files (OC-19 through OC-27)
  - 5 decision artifacts (recorded in OC-15)
  - 40+ implementation tasks completed
  - 40+ test cases added (>90% coverage)
  - 3 main PRs merged to dev
  
  ## Ready for Public Launch
  - All 5 critical decisions locked
  - OC-13 readiness gates mostly GREEN/YELLOW
  - Legal framework complete + approved
  - Team documentation + onboarding complete
  - Self-host model enabled + tested
  
  ## Next Steps (Post-Sprint)
  - Steering committee review (Mon 2026-05-19)
  - GO/NO-GO decision for public repo launch
  - Target launch date: 2026-05-26 (if GO)
  ```

**Standup Output (Thu EOD):**
- Legal docs deployed ✓
- README updated ✓
- OC-13 final status computed ✓
- Sprint summary doc ready ✓

---

### **Phase 4: Final Merge + Sprint Close (Fri 2026-05-16 EOD)**

**Task 4.1:** Code review  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Gate:** All legal docs reviewed for accuracy

**Task 4.2:** Create final PR + merge  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Merge Gate:** OC-19 checklist verified

**Task 4.3:** Update OC-22 completion status  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Changes:**
  ```markdown
  # OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN (COMPLETED)
  
  Status: ✅ SPRINT COMPLETE (Fri 2026-05-16 EOD)
  
  All 5 decisions locked. All gates updated.
  Ready for steering committee review Monday 2026-05-19.
  ```

**Standup Output (Fri EOD):**
- Decision 5 LOCKED ✓
- Sprint 100% COMPLETE ✓
- Ready for steering review ✓

---

## 4. Success Criteria

✅ **By Fri 2026-05-16 EOD (Sprint EOD):**

1. Apache 2.0 LICENSE file deployed to repo root ✓
2. TERMS_OF_SERVICE.md complete + legal approved ✓
3. PRIVACY_POLICY.md complete + legal approved ✓
4. DISCLAIMER.md complete + legal approved ✓
5. COPYRIGHT_NOTICE.md deployed ✓
6. README updated with legal links ✓
7. OC-13 gate status updated:
   - Quota canonical: YELLOW ✓
   - Package mapping: YELLOW ✓
   - Community package: YELLOW ✓
   - Self-host model: YELLOW ✓
   - Legal bundle: GREEN ✓
8. Decision 5 recorded in OC-15 ✓
9. PR merged to dev (OC-19 verified) ✓
10. Sprint completion summary doc created ✓

---

## 5. Post-Sprint: Steering Review (Mon 2026-05-19)

**Steering Committee Meeting Agenda:**

```
TIME: Mon 2026-05-19 14:00 UTC+7 (2 hours)

AGENDA:

1. Sprint Completion Review (15 min)
   - All 5 decisions locked ✓
   - OC-13 gates updated (4 YELLOW, 1 GREEN)
   - Demo of Decision 3 + 4 in staging
   
2. OC-13 Readiness Gate Assessment (30 min)
   - Quota canonical: YELLOW (ready for enforcement)
   - Package mapping: YELLOW (ready for GA)
   - Community package: YELLOW (ready for launch)
   - Self-host model: YELLOW (ready for partners)
   - Legal bundle: GREEN (approved, deployed)
   - **Overall:** YELLOW → Green Eligible
   
3. Public Launch Decision (30 min)
   - GO: Launch public repo 2026-05-26
   - NO-GO: Require additional hardening (specify blockers)
   - Condition: Continue hardening if <80% gates GREEN
   
4. Post-Launch Roadmap (15 min)
   - Marketing strategy
   - Self-hosted deployment guide
   - Community contribution guidelines

DECISION GATE:
- GO: Public repo open for community + self-hosters
- NO-GO: Defer + schedule next review 2026-06-02
```

**Expected Outcomes:**
- ✅ All decisions documented + accessible
- ✅ Legal framework approved
- ✅ Technical implementation completed + tested
- ✅ Team ready for public support

---

## 6. Pre-Decision 5 Checklist

⚠️ **To be done THIS WEEK (by Fri 2026-05-10):**
1. ✅ OC-26 (Decisions 3 & 4) approved + merged to dev
2. ✅ Team reviews OC-27 (this doc) before standup Mon
3. ⏳ PO schedules legal review meeting (internal or external)
4. ⏳ Tech Lead gathers dependency list for COPYRIGHT_NOTICE.md

---

## 7. Daily Standup Talking Points (Week 4)

### Mon 2026-05-13
- Review OC-27 requirements
- Confirm legal review schedule (internal/external)
- Assign drafting tasks (ToS, Privacy, Disclaimer)
- Q: Blockers from Week 3?

### Tue 2026-05-14
- Legal drafts complete (4 docs ready) ✓
- Submitted for legal review ✓
- Phase 2 (review) starts

### Wed 2026-05-15
- Legal review complete ✓
- Adjustments made ✓
- Final sign-off received ✓
- Ready for deployment

### Thu 2026-05-16
- Docs deployed to repo ✓
- README updated ✓
- OC-13 final status computed ✓
- Sprint summary ready ✓

### Fri 2026-05-16 EOD
- Final PR merged ✓
- Sprint 100% COMPLETE ✓
- Ready for steering review Mon ✓

---

## 8. Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Legal review delays | Blocks merge | Submit draft Mon AM; request expedited review by Wed |
| Vietnam-specific regulations unclear | Delay in drafting | PO to research before Mon (consult lawyer if needed) |
| Third-party license conflicts | Repo can't be published | Audit dependencies now; remove incompatible packages before sprint |
| Missing copyright attribution | Legal liability | Generate NOTICE file from dependencies (tool: license-checker) |

---

## 9. Related Documents

**Previous Weeks (Completed):**
- OC-23 (Week 1: Quota decision) ✓
- OC-24 (Week 2: Package mapping) ✓
- OC-26 (Week 3: Community + Self-host) ✓

**This Week (OC-27):**
- Legal bundle finalization
- Sprint completion
- Steering committee prep

**Post-Sprint:**
- Public repo launch (if GO)
- Community onboarding
- Self-host deployment guide

---

## 10. Approval Checklist (PO + Legal)

- [ ] **PO** reviews ToS + Privacy + Disclaimer drafts
- [ ] **Legal** (internal or external) approves all 4 legal docs
- [ ] **Tech Lead** confirms LICENSE file correct + repo-ready
- [ ] **All** agree on Friday merge timeline

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR PLANNING (effective Mon 2026-05-13)

