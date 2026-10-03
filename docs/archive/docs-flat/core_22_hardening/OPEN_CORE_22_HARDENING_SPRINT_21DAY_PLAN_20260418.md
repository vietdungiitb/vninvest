# OPEN CORE HARDENING SPRINT PLAN - 21 DAYS (2026-04-18 to 2026-05-09)

**Doc ID:** OC-22  
**Ngày tạo:** 2026-04-18  
**Trạng thái:** PROPOSAL - awaiting owner approval  
**Mục tiêu:** Chốt 5 quyết định then chốt (OC-15 Mục 6) để chuyển từ NO-GO → GO-READY cho public launch

---

## 1. Executive Summary

Hardening sprint này nhằm **lock down 5 quyết định chiến lược bị treo** để:
- Chốt canonical quota unit (ngày vs tháng).
- Map business package ↔ runtime plan rõ ràng.
- Define Community V1 package boundary (modules/endpoints).
- Chốt self-host Pro operating model (license/distribution).
- Define legal/public disclaimer bundle.

Sau 21 ngày, OC-13 sẽ chuyển từ **NO-GO** → **CONDITIONAL GO** cho public lane.

---

## 2. Target Outcomes (Success Criteria)

### By 2026-05-09 End of Sprint:

| Quyết định | Chốt được | Artifact | Owner | Status |
|---|---|---|---|---|
| 1. Quota canonical unit | Day vs Month | OC-11 updated + test suite | PO + Tech Lead | ❌ TO-DO |
| 2. Package ↔ Runtime mapping | Business pkg → free/pro/enterprise | OC-05 + OC-12 updated | PO + Backend | ❌ TO-DO |
| 3. Community V1 package | Module/endpoint list | OC-13 + feature_keys.py | Tech Lead + Backend | ❌ TO-DO |
| 4. Self-host Pro model | License + distribution + enforcement | OC-06 + licensing_policy.md | PO + DevOps | ❌ TO-DO |
| 5. Legal/public bundle | Disclaimer + Terms + Privacy | SPRINT28_LEGAL_CONTENT_EXECUTION_PLAN | Legal + PO | ❌ TO-DO |

### Gate Status Target:

| Gate | Current | Target | Blocker Lifted |
|---|---|---|---|
| Quota/trial canonical | RED | YELLOW | When 1+2 locked |
| Community package boundary | RED | YELLOW | When 3 locked |
| Self-host Pro model | RED | YELLOW | When 4 locked |
| Legal/publication artifacts | RED | YELLOW | When 5 locked |
| Docs lane separation | YELLOW | GREEN | Automated, OC-19 enforcement |

**Overall OC-13 Decision:** NO-GO → **CONDITIONAL GO** (for next review meeting)

---

## 3. 5 Quyết định Chi tiết & Phương án

### 3.1 Decision 1: Quota Canonical Unit (Day vs Month)

**Câu hỏi gốc (OC-15 §6.1):**
> Quota canonical sẽ theo ngày hay theo tháng?

**Background:**
- Docs cũ (OC-05) ghi theo ngày (max 100 tickers/ngày).
- Runtime backend (opencore_analytics.py) tính theo tháng (max 3000 calls/tháng).
- Drift này gây confusing trong pricing + trial.

**Phương án A (Recommend):** Monthly canonical
- **Lý do:** SaaS standard, align với subscription billing.
- **Impact:** OC-11 cập nhật quota table từ daily → monthly; pricing tier adjust.
- **Timeline:** Week 1 (2026-04-22 by).
- **Artifact:** OC-11 updated + test_opencore_analytics_quota.py (new).

**Phương án B (Alternative):** Daily quota + monthly aggregate
- **Lý do:** Finer-grained control, detect abuse earlier.
- **Impact:** Runtime complexity ↑, cần thêm rolling window logic.
- **Timeline:** Week 2.
- **Artifact:** Celery task + analytics schema update.

**Owner:** **PO + Tech Lead**  
**Decision Deadline:** 2026-04-22 EOD  
**Approval Gate:** PO signs off on pricing implication.

---

### 3.2 Decision 2: Package ↔ Runtime Plan Mapping

**Câu hỏi gốc (OC-15 §6.2):**
> Package business sẽ map vào runtime plan names như thế nào?

**Background:**
- Business packages: Community, Professional, Enterprise (từ OC-06 pricing hypothesis).
- Runtime plans: `free`, `pro`, `enterprise` (backend constants).
- Chưa có explicit mapping → frontend/backend communication confusing.

**Phương án (Recommend):** Clear 1-to-1 Mapping

```yaml
Business Package  →  Runtime Plan   →  Quota Tier  →  Price
─────────────────     ────────────      ──────────     ─────
Community          →  free             LOW             Free
Professional       →  pro              HIGH            $99/year
Enterprise         →  enterprise       UNLIMITED       Custom
```

**Implementation Steps:**
1. Update OC-05 (Feature Boundary Matrix) với mapping table.
2. Update OC-12 (Entitlement Checklist) với runtime_plan_name enum.
3. Add migration: `backend/portfolio/migrations/00XX_add_display_name_to_dpiplan.py`
4. Add test: `backend/tests/test_dpiplan_mapping.py`

**Artifact:** 
- OC-05 section "Business ↔ Runtime Mapping"
- OC-12 section "Runtime Plan Constants"
- backend/portfolio/models.py (add display_name field)
- New test suite (8-10 cases)

**Owner:** **PO + Backend Tech Lead**  
**Decision Deadline:** 2026-04-23 EOD  
**Approval Gate:** Backend models reflect mapping; test coverage >90%.

---

### 3.3 Decision 3: Community V1 Package Boundary

**Câu hỏi gốc (OC-15 §6.3):**
> Community V1 package cho public gồm nhưng module/endpoint nào?

**Background:**
- OC-13 đã suggest: watchlist, chart cơ bản, realtime quote (quota), demo seed.
- Cần explicit endpoint allowlist để tránh leak premium endpoint.
- Feature_key system (backend) chưa có documentation.

**Phương án (Recommend):** Explicit Endpoint Allowlist

**Community V1 Include:**
```
Frontend:
  ✓ Dashboard (basic heatmap + watchlist panel only)
  ✓ Watchlist (CRUD + export CSV)
  ✓ StockDetail (quote + chart only, no AI advisory)
  ✓ Realtime ticker (50 tickers max / session, 5min throttle)

Backend API:
  ✓ GET /api/v1/portfolio/watchlist/
  ✓ POST/PUT/DELETE /api/v1/portfolio/watchlist/{id}/
  ✓ GET /api/v1/market/quote/realtime?symbols=VNM,BID,...
  ✓ GET /api/v1/market/chart/{symbol}/intraday
  ✓ GET /api/v1/market/ohlc/{symbol}/{date}
  
  ✗ Whale Advisory (Pro only)
  ✗ AI Thesis (Pro only)
  ✗ Dark Money Flow (Pro only)
  ✗ Team Workspace (Pro only)
  ✗ Audit/Export (Pro only)
```

**Implementation Steps:**
1. Create `backend/portfolio/feature_gates.py` (centralized):
   ```python
   COMMUNITY_V1_FEATURES = {
       'watchlist': True,
       'realtime_ticker': True,
       'chart_basic': True,
       'whale_advisory': False,
       'ai_thesis': False,
   }
   ```

2. Update views to check: `if not has_feature(user, 'whale_advisory'): raise PermissionDenied`

3. Frontend: conditional UI render based on `/api/v1/entitlement/features/`

**Artifact:**
- OC-13 section "Community V1 Endpoint Allowlist" (copy-paste JSON).
- feature_gates.py (new module).
- Entitlement API response (document).
- Integration test: `test_community_vs_pro_features.py`

**Owner:** **Tech Lead + Backend**  
**Decision Deadline:** 2026-04-27 EOD  
**Approval Gate:** Feature gate tests pass; no premium endpoint accessible via community token.

---

### 3.4 Decision 4: Self-Host Pro Operating Model

**Câu hỏi gốc (OC-15 §6.4):**
> Self-host Pro sẽ được phân phối/enforce theo mô hình nào?

**Background:**
- Community = public repo (permissive).
- Pro/Enterprise = private distribution?
- Online vs offline licensing?
- How to prevent "community user" from accessing Pro code locally?

**Phương án A (Recommend): Entitlement-based Runtime Gate**
- **Model:** Same monorepo, but Pro features gated behind feature_key check.
- **License:** Digital license (API key) downloaded from SaaS → stored locally.
- **Offline:** License valid 30 days; auto-sync when online.
- **Enforcement:** Pro features blocked if license absent/expired.
- **Distribution:** Self-hosters can clone public repo; Pro features are no-op without license.

**Phương án B (Alternative): Separate Private Package**
- **Model:** Public monorepo (Community) + private Git package (Pro modules).
- **License:** Private GitHub access token + versioned package.
- **Enforcement:** Import-time check; missing Pro module → graceful degradation.
- **Distribution:** Setup.py installs from private registry.

**Recommendation:** **Phương án A (simpler, compliance-friendly)**

**Implementation Steps:**
1. Centralize licensing check:
   ```python
   # backend/portfolio/licensing.py
   def verify_pro_entitlement(user):
       if not has_pro_license(user):
           raise UpgradeRequired("Pro feature requires license")
   ```

2. Create license model: `DPILicense(user_id, license_key, valid_until, features)`

3. CLI command: `vninvest activate-pro-license <key>`

4. Documentation: `docs/SELF_HOST_PRO_LICENSING_GUIDE.md`

**Artifact:**
- OC-06 section "Self-Host Pro Operating Model"
- licensing.py (new module + 12 tests).
- License admin dashboard (basic form).
- SELF_HOST_PRO_LICENSING_GUIDE.md

**Owner:** **PO + Backend**  
**Decision Deadline:** 2026-05-01 EOD  
**Approval Gate:** License check integrated in 3+ Pro endpoints; manual test pass.

---

### 3.5 Decision 5: Legal/Public Disclaimer Bundle

**Câu hỏi gốc (OC-15 §6.5):**
> License/legal/disclaimer/support policy public sẽ được chốt ra sao?

**Background:**
- SPRINT28 legal content planning (not started).
- Need: License (Apache 2.0?), disclaimer, Terms, Privacy, Investment disclaimer.
- Must prevent liability: "not investment advice", "use at own risk".

**Phương án (Recommend):** Apache 2.0 + Custom Disclaimer Bundle

**Bundle Contents:**
```
1. LICENSE file (Apache 2.0)
2. docs/DISCLAIMER_INVESTMENT.md
   - "Tool is educational, not investment advice"
   - "VNInvest not responsible for losses"
   
3. docs/TERMS_OF_SERVICE.md
   - Community vs Pro SLA
   - Data retention policy
   - Acceptable use policy
   
4. docs/PRIVACY_POLICY.md
   - Data collected (portfolio, watchlist, IP, user-agent)
   - No data sharing (except SaaS ops)
   - GDPR/VN personal data law compliance
   
5. SECURITY.md
   - How to report vulnerabilities
   - No public security disclosure

6. SUPPORT.md
   - Community: GitHub Issues (best-effort)
   - Pro: Email + Slack (24h SLA)
```

**Implementation Steps:**
1. Draft legal templates (ChatGPT assist OK for first version).
2. Legal review (1-2 days).
3. Format + commit to repo root + docs/.
4. Add PR check: no public launch if LICENSE missing.

**Artifact:**
- LICENSE (Apache 2.0).
- docs/DISCLAIMER_INVESTMENT.md
- docs/TERMS_OF_SERVICE.md
- docs/PRIVACY_POLICY.md
- SECURITY.md
- SUPPORT.md
- OC-13 gate checklist updated.

**Owner:** **PO + Legal (external if needed)**  
**Decision Deadline:** 2026-05-03 EOD  
**Approval Gate:** Legal review complete; no liability gaps.

---

## 4. Sprint Timeline (21 Days)

```
Week 1 (Apr 22-26):
  Mon 22: Decision 1 (Quota unit) locked
  Tue 23: Decision 2 (Package mapping) locked
  Wed-Fri: Implementation + tests for 1+2

Week 2 (Apr 29-May 3):
  Mon 29: Decision 3 (Community package) locked
  Tue 30: Implementation (feature_gates.py)
  Wed-Fri: Testing + integration

Week 3 (May 6-10):
  Mon 6: Decision 4+5 final review
  Tue 7: OC-13 gate update (RED → YELLOW/GREEN)
  Wed: PR to dev
  Thu-Fri: Merge + sync deploy branch
  
Sprint EOD: 2026-05-09 23:59
```

---

## 5. Resource Allocation

| Role | Task | Allocation | Notes |
|---|---|---|---|
| **PO** | Decision 1, 2, 4, 5 approval | 40% | Pricing implication, legal review |
| **Tech Lead** | Arch review, feature gates design | 30% | Oversee decisions 1-4 |
| **Backend Dev** | Implementation (models, licensing, tests) | 50% | Quota unit + license module |
| **Frontend Dev** | Feature gate integration + tests | 30% | Community allowlist enforcement |
| **DevOps** | License server setup (if needed) | 20% | For self-host Pro license validation |
| **QA** | Integration testing | 25% | End-to-end community vs pro flow |

**Total Effort:** ~3.5 person-weeks (2.5 developers × 21 days)

---

## 6. Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Decision delay (consensus block) | Slip timeline | PO makes final call by deadline; escalate if needed |
| Legal review slow | Block 5 | Parallel draft + async review; lawyer on retainer |
| Quota unit migration impact | Data corruption | Dry-run + canary update; rollback plan |
| Feature gate performance | Slowdown | Cache feature_key checks; benchmark |

---

## 7. Success Metrics (After Sprint)

✅ All 5 decisions locked (recorded in OC-15, OC-11, OC-13)  
✅ Tests pass for all 5 areas (>85% coverage)  
✅ OC-13 updated: min 3 gates RED → YELLOW  
✅ Legal bundle ready for public repo  
✅ Prepared PR into dev for merge

---

## 8. Next Decision Point

**After Sprint EOD (2026-05-09):**
- **Review Meeting:** Steering committee reviews updated OC-13.
- **Go/No-Go:** If all 5 decisions locked + legal bundle ready → **GO** for public repo mirroring.
- **Timeline:** Public repo launch target = 2026-05-14.

---

## Approval Checklist

- [ ] PO approves roadmap & timeline
- [ ] Tech Lead approves architecture approach
- [ ] Owner commits resource allocation
- [ ] All 5 decision owners (O) agree to deadline

**Sign-off Date:** ___________________  
**PO Name:** ___________________  
**Tech Lead Name:** ___________________

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** AWAITING APPROVAL
