# OPEN CORE SPRINT WEEK 2 - PACKAGE MAPPING DECISION (OC-24)

**Doc ID:** OC-24  
**Ngày tạo:** 2026-04-18 (proposal), effective 2026-04-29 (sprint start)  
**Trạng thái:** READY FOR PLANNING - dependent on OC-23 completion  
**Mục tiêu:** Chốt Decision 2 - Map business package ↔ runtime plan  
**Timeline:** Mon 2026-04-29 → Fri 2026-05-03 EOD  
**Dependency:** OC-23 (Decision 1: Quota canonical) MUST be locked by Fri 2026-04-26

---

## 1. Executive Summary

**Decision Statement:**
> Define explicit mapping giữa business package names (Community/Professional/Enterprise) và runtime plan identifiers (free/pro/enterprise) để align frontend display, backend logic, và billing communication.

**Current State (Confusion):**
- Business tier names: Community, Professional, Enterprise (từ OC-06 pricing).
- Runtime plan names: `free`, `pro`, `enterprise` (backend DPIPlan model).
- Frontend doesn't know which runtime plan → which business package → which display name.
- Billing system confused about tier naming.

**Recommendation:** **Explicit 1-to-1 Mapping + Display Name Field**

```
Community Package  →  free plan  →  Display: "Community" or "Free"?
Professional Pkg   →  pro plan   →  Display: "Professional" or "Pro"?
Enterprise Pkg     →  enterprise →  Display: "Enterprise"
```

**Decision Scope:**
1. Lock business package names (3 names, final).
2. Lock runtime plan identifier names (3 identifiers, final).
3. Add `display_name` field to DPIPlan model for flexible UI rendering.
4. Document mapping in authoritative reference (OC-11 + OC-12).
5. Update all docs + code comments.

---

## 2. Phương án Comparison

### Option A: Keep Names As-Is (RECOMMENDED)
- Business: **Community / Professional / Enterprise**
- Runtime: **free / pro / enterprise**
- Mapping: 1-1 correspondence with simple rules
- Display: Let frontend choose language (Community, Professional, etc.)

**Pros:**
- Minimal code change (no enum rename).
- Clear business intent.
- Consistent with pricing tier naming.

**Cons:**
- Frontend needs mapping table.

---

### Option B: Unify All Names To Singular
- Business + Runtime: **free / pro / enterprise**
- Display: Let frontend pick language.

**Pros:**
- Single source of truth; less confusion.

**Cons:**
- "free" sounds less professional than "Community".
- Requires backend enum rename (migration).
- Breaking change for self-hosters.

---

### Option C: Separate Identifiers From Display Names
- Runtime identifier: **tier_0 / tier_1 / tier_2** (neutral)
- Display name field: **"Community" / "Professional" / "Enterprise"** (business-friendly)

**Pros:**
- Decoupled business + technical layers.
- Flexible for future tier changes.

**Cons:**
- More complex schema change.
- Less intuitive.

---

**Recommendation: Option A (1-1 mapping, explicit documentation)**

---

## 3. Mapping Specification (Decision A)

| Business Package | Runtime Plan ID | Display Name | Annual Price | Quota | Notes |
|---|---|---|---|---|---|
| Community | free | Community | Free | 100/mo | Entry tier |
| Professional | pro | Professional | $99 | 3000/mo | Recommended for users |
| Enterprise | enterprise | Enterprise | Custom | Unlimited | For teams/orgs |

**Frontend Localization (i18n):**
```json
{
  "plan.community": "Cộng đồng",
  "plan.professional": "Chuyên nghiệp",
  "plan.enterprise": "Doanh nghiệp",
  
  "plan.community.desc": "Công cụ cơ bản cho cá nhân",
  "plan.professional.desc": "AI advisory + whale alerts",
  "plan.enterprise.desc": "Hỗ trợ toàn diện cho đội"
}
```

---

## 4. Implementation Phases

### Phase 1: Analysis & Alignment (Mon 2026-04-29)

**Task 1.1:** Backend enum audit  
- **Owner:** Backend  
- **Effort:** 2h  
- **Deliverable:** Document current DPIPlan choices:
  ```python
  # Current enum
  PLAN_CHOICES = (
      ('free', 'Free'),
      ('pro', 'Professional'),
      ('enterprise', 'Enterprise'),
  )
  ```

**Task 1.2:** Frontend plan selector audit  
- **Owner:** Frontend  
- **Effort:** 2h  
- **Deliverable:** Map where plans are displayed + hardcoded strings:
  ```jsx
  // Current
  <div>{plan === 'pro' ? 'Pro Plan' : 'Free'}</div>
  // Need: map to business display name
  ```

**Task 1.3:** Docs cross-reference check  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Deliverable:** Find all docs mentioning plan names:
  - OC-05, OC-06, OC-11, OC-12, OC-13
  - API docs, README

**Standup Output (Mon EOD):**
- Current state documented ✓
- All references found ✓
- Decision A feasibility confirmed ✓

---

### Phase 2: Schema & Model Updates (Tue 2026-04-30)

**Task 2.1:** Add display_name field to DPIPlan  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** Migration `00XX_add_display_name_to_dpiplan.py`
  ```python
  class DPIPlan(models.Model):
      plan_id = models.CharField(choices=PLAN_CHOICES)  # 'free', 'pro', 'enterprise'
      display_name = models.CharField(max_length=50, default='')  # 'Community', 'Professional', etc.
      # ... existing fields
      
      def __str__(self):
          return self.display_name  # Use for UI display
  ```

**Task 2.2:** Update plan seed data  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** backend/portfolio/fixtures/dpiplan_seed.json
  ```json
  [
    {"plan_id": "free", "display_name": "Community", "max_api_calls_per_month": 100},
    {"plan_id": "pro", "display_name": "Professional", "max_api_calls_per_month": 3000},
    {"plan_id": "enterprise", "display_name": "Enterprise", "max_api_calls_per_month": null}
  ]
  ```

**Task 2.3:** Create plan mapping constants  
- **Owner:** Backend  
- **Effort:** 1h  
- **Artifact:** backend/portfolio/plan_mappings.py
  ```python
  PLAN_MAPPING = {
      'free': {
          'display_name': 'Community',
          'tier': 0,
          'business_package': 'Community',
      },
      'pro': {
          'display_name': 'Professional',
          'tier': 1,
          'business_package': 'Professional',
      },
      'enterprise': {
          'display_name': 'Enterprise',
          'tier': 2,
          'business_package': 'Enterprise',
      }
  }
  ```

**Standup Output (Tue EOD):**
- DPIPlan migration prepared ✓
- Seed data ready ✓
- Mapping constants defined ✓

---

### Phase 3: Frontend Integration (Wed 2026-05-01)

**Task 3.1:** Create plan constant in frontend  
- **Owner:** Frontend  
- **Effort:** 2h  
- **Artifact:** frontend/src/constants/plans.js
  ```js
  export const PLAN_MAPPING = {
    free: { displayName: 'Community', tier: 0 },
    pro: { displayName: 'Professional', tier: 1 },
    enterprise: { displayName: 'Enterprise', tier: 2 },
  };
  
  export const getPlanDisplay = (planId, locale = 'vi') => {
    const plan = PLAN_MAPPING[planId];
    if (!plan) return planId; // Fallback
    
    // Localized display
    if (locale === 'vi') return TRANSLATIONS_VI[planId] || plan.displayName;
    return plan.displayName;
  };
  ```

**Task 3.2:** Update Entitlement API response  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** Update `GET /api/v1/entitlement/details/` response:
  ```json
  {
    "plan_id": "pro",
    "display_name": "Professional",
    "tier": 1,
    "features": [...]
  }
  ```

**Task 3.3:** Update UI components using plan names  
- **Owner:** Frontend  
- **Effort:** 3h  
- **Artifact:** Update Pricing page, Dashboard header, Settings
  ```jsx
  // Before
  <h2>{plan === 'pro' ? 'Pro' : 'Free'}</h2>
  
  // After
  <h2>{getPlanDisplay(plan, locale)}</h2>
  ```

**Standup Output (Wed EOD):**
- Frontend constants + helpers ready ✓
- API response updated ✓
- UI components refactored ✓

---

### Phase 4: Documentation & Tests (Thu 2026-05-02)

**Task 4.1:** Update OC-11 (Numeric Lock Sheet)  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Change:** Add "Display Name" column to mapping table  
- **Artifact:** OC-11 section "Plan Mapping Reference"

**Task 4.2:** Update OC-12 (Entitlement Checklist)  
- **Owner:** Backend  
- **Effort:** 2h  
- **Change:** Add "display_name field implemented" to checklist  
- **Artifact:** OC-12 section "Plan Identifier Standardization"

**Task 4.3:** Create test suite  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** backend/tests/test_plan_mapping.py
  ```python
  class TestPlanMapping(TestCase):
      def test_plan_constants_defined(self):
          # PLAN_MAPPING has all expected keys
      
      def test_display_name_in_dpiplan(self):
          # DPIPlan.display_name correctly returns localized name
      
      def test_entitlement_api_includes_display_name(self):
          # GET /api/v1/entitlement/details/ returns display_name
      
      def test_tier_boundary(self):
          # free tier < pro tier < enterprise
      
      # 8+ total scenarios
  ```

**Standup Output (Thu EOD):**
- All docs updated ✓
- Tests >90% coverage ✓
- PR ready for review ✓

---

### Phase 5: Integration & Merge (Fri 2026-05-03)

**Task 5.1:** Create summary doc  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Deliverable:** RELEASE_DECISION_PACKAGE_MAPPING_20260503.md

**Task 5.2:** Code review + merge  
- **Owner:** Tech Lead + Backend  
- **Effort:** 2h  
- **Merge Gate:** All tests pass + OC-19 checklist verified

**Standup Output (Fri EOD):**
- Decision 2 locked ✓
- OC-13 gate "Package mapping" updated → YELLOW ✓
- Ready for Decision 3 (Week 3) ✓

---

## 5. Resource Allocation

| Role | Task | Hours | Status |
|---|---|---|---|
| **PO** | Approve display names | 2h | Ready |
| **Tech Lead** | Schema review + docs | 8h | Ready |
| **Backend Dev** | Migration + tests | 8h | Ready |
| **Frontend Dev** | Constants + UI update | 5h | Ready |

**Total:** ~3 person-days (1 PO 20%, 1 Tech Lead 100%, 1 Backend 50%, 1 Frontend 40%)

---

## 6. Success Criteria

✅ **By Fri 2026-05-03 EOD:**
1. Decision locked: **Explicit 1-to-1 mapping (Option A)** approved by PO.
2. DPIPlan.display_name field added + migrated.
3. Plan mapping constants defined (backend + frontend).
4. All UI components use display_name via API.
5. test_plan_mapping.py: >90% coverage, all green.
6. OC-11/OC-12 updated + coherent.
7. PR merged to dev (per OC-19).
8. OC-13 gate "Package mapping": RED → **YELLOW** ✓

✅ **Outcome for OC-22 hardening sprint:**
- Decision 2 locked ✓
- Ready for Decision 3 (Community package boundary) in Week 3 ✓

---

## 7. Dependencies & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| OC-23 not done by Fri | Blocks Week 2 start | Parallel plan as buffer; can start Phase 1 analysis Mon even if OC-23 not merged |
| Migration complexity | Data corruption | Dry-run migration on test DB; backup before apply |
| Frontend UI scattered | Incomplete refactor | Code search to find all plan name references upfront (Task 1.2) |
| PO unavailable for decision | Delay | Schedule approval call Tue morning; async approval via Slack if needed |

---

## 8. Preparation Tasks (Before Mon 2026-04-29)

⚠️ **To be done THIS WEEK (by Fri 2026-04-26):**
1. ✅ OC-23 approved & merged to dev
2. ✅ Week 1 Decision 1 (quota unit) locked
3. ⏳ Team reviews OC-24 (this doc) before standup Mon
4. ⏳ Backend pre-scans DPIPlan model for schema change feasibility

---

## 9. Daily Standup Talking Points (Week 2)

### Mon 2026-04-29
- Review OC-24 requirements
- Confirm Decision A (1-1 mapping) vs alternatives
- Assign Phase 1 tasks (analysis)
- Q: Any blockers from Week 1?

### Tue 2026-04-30
- Analysis complete: current state documented ✓
- PO approval on display names locked
- Phase 2 starts (schema + migration)

### Wed 2026-05-01
- Migration + seed data ready ✓
- Frontend constants ready ✓
- UI component refactor 50% done

### Thu 2026-05-02
- Tests 100% done + coverage check ✓
- Docs updated ✓
- PR ready for review

### Fri 2026-05-03
- PR merged to dev ✓
- OC-13 gate updated ✓
- Decision 2 LOCKED ✓

---

## 10. Next Decision

**When Decision 2 complete (Fri 2026-05-03 EOD):**
- **Decision 3 (Community V1 Package Boundary)** starts Mon 2026-05-06
- See OC-22 §3.3 for details

---

## Approval Checklist

- [ ] **PO** reviews display name options (Option A recommended)
- [ ] **Tech Lead** confirms migration feasibility
- [ ] **Backend** confirms no runtime breaking changes
- [ ] **Frontend** confirms UI refactor scope
- [ ] All agree on Fri merge timeline

**Approval Sign-off:**  
PO: ___________________ Date: _____  
Tech Lead: ____________ Date: _____  

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR STANDUP PLANNING (Mon 2026-04-29)

