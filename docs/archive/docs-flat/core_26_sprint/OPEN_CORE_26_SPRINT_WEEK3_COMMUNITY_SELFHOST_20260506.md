# OPEN CORE SPRINT WEEK 3 - COMMUNITY PACKAGE & SELF-HOST MODEL (OC-26)

**Doc ID:** OC-26  
**Ngày tạo:** 2026-04-18 (planning), effective 2026-05-06 (sprint start)  
**Trạng thái:** READY FOR PLANNING - dual decision execution week  
**Mục tiêu:** Lock Decision 3 (Community V1 package) + Decision 4 (Self-host Pro model)  
**Timeline:** Mon 2026-05-06 → Fri 2026-05-10 EOD  
**Dependencies:** OC-24 (Decision 2: Package mapping) MUST be complete by Fri 2026-05-03

---

## 1. Executive Summary

**This Week's Decisions:**

### **Decision 3: Community V1 Package Boundary**
> Define which endpoints + features are available in Community tier to establish product boundary for public launch.

**Current State:** 
- No explicit allowlist; default = "all available" (undefined)
- Whale advisory endpoints sometimes work, sometimes fail
- Frontend doesn't know which features to hide

**Recommendation: Explicit Allowlist + Feature Gates**
```
Community (free):
  ✓ Watchlist CRUD
  ✓ Portfolio analytics
  ✓ Basic DPI metrics
  ✗ Whale advisory (Pro+)
  ✗ Real-time signals (Pro+)
  
Professional (pro):
  ✓ Everything in Community
  ✓ Whale advisory alerts
  ✓ Real-time ticker signals
  ✓ Priority support
  
Enterprise:
  ✓ Everything in Professional
  ✓ Custom data feeds
  ✓ Dedicated support
```

**Decision Scope:**
1. Define endpoint allowlist for Community (3-tier mapping)
2. Implement feature_gates.py module (permission system)
3. Add gate checks to DPI, Whale, Ticker endpoints
4. Tests >90% coverage
5. Update OC-06 (pricing) + OC-11 (mapping)

---

### **Decision 4: Self-Host Pro Operating Model**
> Define how self-hosters can use Pro features: license model, entitlement verification, admin controls.

**Current State:**
- Self-hosters get "free plan" by default (no way to unlock Pro)
- No license/key mechanism
- Whale advisory not available to self-hosters

**Recommendation: Entitlement-Based Licensing**
```
Model: Simple license key validation
- Generate: Admin CLI → license_key (tied to server_id)
- Verify: On every Pro endpoint → check valid license
- Revoke: Admin can disable old keys
- Cost: Free for Community; Pro feature unlock = $5/server/month or enterprise deal
```

**Decision Scope:**
1. Design licensing.py module (4 models: License, LicenseKey, ServerID, LicenseAudit)
2. Create entitlement check integration (3+ Pro endpoints)
3. CLI command: `./manage.py create_license --server_id=<id> --tier=pro`
4. Admin UI: License management page (activate/revoke/audit)
5. Tests >90% coverage
6. Update OC-13 (public readiness gate)

---

## 2. Decision 3: Community Package Boundary

### 2.1 Detailed Scope

**Objectives:**
- Lock which endpoints are available in Community tier
- Implement permission system via feature_gates.py
- Add gate checks to 5+ endpoints
- 100% transparent to frontend (via entitlement API)

**Endpoints Affected:**

| Endpoint | Community | Professional | Enterprise | Notes |
|---|---|---|---|---|
| `GET /api/v1/watchlist/` | ✓ | ✓ | ✓ | Core feature |
| `POST /api/v1/watchlist/add/` | ✓ | ✓ | ✓ | Core feature |
| `GET /api/v1/portfolio/analytics/` | ✓ | ✓ | ✓ | Read-only analytics |
| `GET /api/v1/dpi/metrics/` | ✓ | ✓ | ✓ | Basic metrics |
| `GET /api/v1/whale/signals/` | ✗ | ✓ | ✓ | Premium feature |
| `GET /api/v1/whale/top-traders/` | ✗ | ✓ | ✓ | Premium feature |
| `GET /api/v1/ticker/realtime/` | ✗ | ✓ | ✓ | Real-time (premium) |
| `GET /api/v1/advisor/recommendations/` | ✗ | ✓ | ✓ | AI-powered (premium) |

**Implementation: Feature Gates**
```python
# backend/portfolio/feature_gates.py

FEATURE_GATES = {
    'watchlist_crud': {
        'tier': 'community',  # Available in all tiers
        'description': 'Create/read/update/delete watchlist',
    },
    'whale_signals': {
        'tier': 'pro',  # Pro+ only
        'description': 'Access whale transaction alerts',
    },
    'realtime_ticker': {
        'tier': 'pro',  # Pro+ only
        'description': 'Real-time ticker data stream',
    },
    'ai_advisor': {
        'tier': 'pro',  # Pro+ only
        'description': 'AI-powered recommendations',
    },
    'custom_feeds': {
        'tier': 'enterprise',  # Enterprise only
        'description': 'Custom data feed integration',
    },
}

def check_feature_gate(user, gate_name):
    """Raises PermissionDenied if user tier < required tier"""
    gate = FEATURE_GATES.get(gate_name)
    if not gate:
        return True  # Feature not gated
    
    user_tier = user.entitlement.tier if user.entitlement else 0  # 0=community, 1=pro, 2=enterprise
    required_tier = {'community': 0, 'pro': 1, 'enterprise': 2}[gate['tier']]
    
    if user_tier < required_tier:
        raise PermissionDenied(f"Feature '{gate_name}' requires {gate['tier']} tier")
    return True
```

---

### 2.2 Implementation Phases

#### **Phase 1: Analysis & Design (Mon 2026-05-06)**

**Task 1.1:** Complete endpoint audit  
- **Owner:** Tech Lead  
- **Effort:** 3h  
- **Deliverable:** Comprehensive list of all API endpoints + current tier availability
  ```
  GET /api/v1/watchlist/ → currently accessible: all users (undefined)
  GET /api/v1/whale/signals/ → currently accessible: all users (should be Pro+)
  ...
  ```

**Task 1.2:** Finalize feature gate taxonomy  
- **Owner:** PO + Tech Lead  
- **Effort:** 2h  
- **Deliverable:** Sign-off on gate mapping (which features → which tiers)
  - Community: watchlist, portfolio, basic metrics
  - Professional: whale signals, real-time ticker, AI advisor
  - Enterprise: custom feeds + SLA support

**Task 1.3:** Design entitlement API response  
- **Owner:** Backend  
- **Effort:** 2h  
- **Deliverable:** API response includes available features:
  ```json
  GET /api/v1/entitlement/details/
  {
    "tier": "professional",
    "features": {
      "watchlist": true,
      "whale_signals": true,
      "realtime_ticker": true,
      "ai_advisor": true,
      "custom_feeds": false
    }
  }
  ```

**Standup Output (Mon EOD):**
- Endpoint audit complete ✓
- Gate taxonomy finalized ✓
- API response spec approved ✓

---

#### **Phase 2: Feature Gate Implementation (Tue 2026-05-07)**

**Task 2.1:** Create feature_gates.py module  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** backend/portfolio/feature_gates.py (150 lines)
  ```python
  FEATURE_GATES = {...}  # Complete gate definitions
  check_feature_gate(user, gate_name)  # Permission check function
  get_available_features(user)  # Return dict of feature → enabled
  ```

**Task 2.2:** Add decorators to endpoint views  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** Apply @require_feature('whale_signals') to 5+ endpoints
  ```python
  @api_view(['GET'])
  @require_feature('whale_signals')
  def whale_signals_view(request):
      # Only accessible if user has whale_signals feature
      ...
  ```

**Task 2.3:** Update entitlement API response  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** Modify entitlement endpoint to return features dict
  ```python
  class EntitlementDetailView(APIView):
      def get(self, request):
          features = get_available_features(request.user)
          return Response({
              'tier': request.user.entitlement.tier,
              'features': features,
          })
  ```

**Standup Output (Tue EOD):**
- feature_gates.py complete ✓
- Decorators applied to 5 endpoints ✓
- Entitlement API updated ✓

---

#### **Phase 3: Frontend Integration (Wed 2026-05-08)**

**Task 3.1:** Update feature availability check (frontend)  
- **Owner:** Frontend  
- **Effort:** 2h  
- **Artifact:** frontend/src/hooks/useFeatureGates.js
  ```js
  export const useFeatureGates = () => {
    const { entitlement } = useEntitlement(); // From API
    
    return {
      canAccessWhaleSignals: entitlement?.features?.whale_signals ?? false,
      canAccessRealtime: entitlement?.features?.realtime_ticker ?? false,
      // ... other features
    };
  };
  ```

**Task 3.2:** Hide/disable premium UI elements  
- **Owner:** Frontend  
- **Effort:** 3h  
- **Artifact:** Update components to conditionally show features
  ```jsx
  // Before
  <WhaleAlertsList />
  
  // After
  {canAccessWhaleSignals ? (
    <WhaleAlertsList />
  ) : (
    <UpgradePrompt tier="professional" />
  )}
  ```

**Task 3.3:** Add UI messaging + upsell prompts  
- **Owner:** Frontend  
- **Effort:** 2h  
- **Artifact:** UpgradePrompt component + i18n strings
  ```jsx
  <UpgradePrompt 
    feature="Whale Signals" 
    requiredTier="Professional" 
  />
  ```

**Standup Output (Wed EOD):**
- useFeatureGates hook ready ✓
- UI elements conditionally displayed ✓
- Upsell messaging configured ✓

---

#### **Phase 4: Tests + Documentation (Thu 2026-05-09)**

**Task 4.1:** Create comprehensive test suite  
- **Owner:** Backend  
- **Effort:** 4h  
- **Artifact:** backend/tests/test_feature_gates.py (15+ test cases)
  ```python
  class TestFeatureGates(TestCase):
      def test_community_user_access_watchlist(self):
          # Community can access watchlist
      
      def test_community_user_denied_whale_signals(self):
          # Community cannot access whale signals
      
      def test_pro_user_access_whale_signals(self):
          # Pro can access whale signals
      
      def test_entitlement_api_returns_features(self):
          # API response includes features dict
      
      # 10+ more scenarios
  ```
  **Target:** >90% coverage, all endpoints tested

**Task 4.2:** Update OC-06 (Pricing Tier Features)  
- **Owner:** Tech Lead  
- **Effort:** 2h  
- **Change:** Add "Features Included" section with gate definitions
  ```markdown
  ## Community
  - Watchlist (unlimited)
  - Portfolio analytics
  - Basic DPI metrics
  
  ## Professional ($99/year)
  - Everything in Community +
  - Whale transaction alerts
  - Real-time ticker data
  - AI-powered recommendations
  ```

**Task 4.3:** Update OC-11 (Entitlement Checklist)  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Change:** Add "Feature gates implemented" checkpoint
  ```markdown
  - [x] Quota canonical locked
  - [x] Package display names configured
  - [x] Feature gates per tier defined
  - [x] Endpoint permission checks active
  ```

**Standup Output (Thu EOD):**
- test_feature_gates.py: 15+ tests, >90% coverage ✓
- OC-06 updated with feature list ✓
- OC-11 checkpoints synced ✓

---

#### **Phase 5: Integration & Merge (Fri 2026-05-10)**

**Task 5.1:** Create summary doc  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Deliverable:** RELEASE_DECISION_COMMUNITY_PACKAGE_20260510.md
  ```markdown
  # Community Package Boundary - Locked
  
  Decision: Explicit endpoint allowlist via feature gates
  Implementation: feature_gates.py + @require_feature decorator
  Endpoints Gated: 5+ (whale_signals, realtime_ticker, ai_advisor, custom_feeds)
  Test Coverage: 15 cases, >90%
  Frontend Integration: useFeatureGates hook + upsell prompts
  ```

**Task 5.2:** Code review + merge  
- **Owner:** Tech Lead + Backend  
- **Effort:** 2h  
- **Merge Gate:** All tests pass + OC-19 checklist verified

**Standup Output (Fri EOD):**
- Decision 3 locked ✓
- OC-13 gate "Community package boundary": RED → YELLOW ✓
- Ready for Decision 4 (proceed in parallel) ✓

---

## 3. Decision 4: Self-Host Pro Operating Model

### 3.1 Detailed Scope

**Objectives:**
- Define licensing model for self-hosters to unlock Pro features
- Implement entitlement verification on Pro endpoints
- Provide admin tooling (CLI + UI) for license management
- Enable revenue model (Pro license = $5/server/month)

**Licensing Model:**

```
┌─ License (tied to ServerID)
│  └─ ServerID (unique per self-host deployment)
│  └─ Tier (free/pro/enterprise)
│  └─ ValidFrom / ValidTo (license expiry)
│  └─ Features (JSON: which gates unlocked)
│
└─ LicenseKey (credential)
   └─ Key (hex hash: 32 chars)
   └─ License (FK)
   └─ IsActive (bool)
   └─ CreatedAt / RevokedAt
   └─ UsageCount (audit trail)
```

**Implementation: Licensing Module**
```python
# backend/portfolio/licensing.py

class ServerID(models.Model):
    """Unique identifier per self-host deployment"""
    server_uuid = models.UUIDField(unique=True)
    deployment_name = models.CharField(max_length=100)
    first_seen = models.DateTimeField(auto_now_add=True)

class License(models.Model):
    """Pro license tied to server"""
    server = models.OneToOneField(ServerID, on_delete=models.CASCADE)
    tier_choices = (('pro', 'Professional'), ('enterprise', 'Enterprise'))
    tier = models.CharField(choices=tier_choices, default='pro')
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    features = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)

class LicenseKey(models.Model):
    """Credential for license activation"""
    license = models.ForeignKey(License, on_delete=models.CASCADE)
    key = models.CharField(unique=True, max_length=32)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True)

class LicenseAudit(models.Model):
    """Track license usage for compliance"""
    key = models.ForeignKey(LicenseKey, on_delete=models.CASCADE)
    endpoint = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(choices=[('success', 'Success'), ('denied', 'Denied')])
```

---

### 3.2 Implementation Phases

#### **Phase 1: Analysis & Design (Mon 2026-05-06, parallel with Decision 3)**

**Task 1.1:** Define license lifecycle  
- **Owner:** PO + Tech Lead  
- **Effort:** 2h  
- **Deliverable:** Document license states + transitions
  ```
  DRAFT → ACTIVE → EXPIRED
         → REVOKED (admin action)
  ```

**Task 1.2:** Design ServerID discovery  
- **Owner:** Backend  
- **Effort:** 2h  
- **Deliverable:** Mechanism to uniquely identify self-host deployment
  ```
  Options:
  A) MAC address hash (fragile)
  B) UUID generated on first startup (simple, durable)  ← RECOMMENDED
  C) User-provided hostname (human-friendly, not unique)
  ```
  **Recommendation: Option B** (store in settings.py on first run)

**Task 1.3:** Design entitlement check integration  
- **Owner:** Backend  
- **Effort:** 2h  
- **Deliverable:** Middleware to validate license on Pro requests
  ```python
  class LicenseCheckMiddleware:
      def check_license(request):
          if request.user.tier == 'pro':
              license = License.objects.get(server__server_uuid=SERVER_UUID)
              if not license.is_active or license.valid_to < now():
                  return 403 Forbidden
          return None
  ```

**Standup Output (Mon EOD):**
- License lifecycle defined ✓
- ServerID mechanism approved (UUID) ✓
- Entitlement check design approved ✓

---

#### **Phase 2: Licensing Module + Migration (Tue 2026-05-07, parallel with Decision 3 Phase 2)**

**Task 2.1:** Create licensing.py models  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** backend/portfolio/licensing.py + models
  - ServerID (unique per deployment)
  - License (tied to ServerID + tier + expiry)
  - LicenseKey (credential + revocation)
  - LicenseAudit (compliance trail)

**Task 2.2:** Create migration + seed  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** backend/portfolio/migrations/00YZ_create_licensing_models.py
  - Create 4 new tables
  - Add ServerID unique constraint
  - Create indexes on key fields

**Task 2.3:** Add license validation utility  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** backend/portfolio/licensing.py functions
  ```python
  def validate_license_key(key: str) -> License:
      """Verify key is active + not expired"""
  
  def get_or_create_server_id() -> ServerID:
      """Idempotent: return existing or create on first run"""
  
  def unlock_pro_features(server_id: UUID, key: str) -> License:
      """Activate Pro tier for server"""
  
  def revoke_license(key: str) -> None:
      """Admin: disable key + log revocation"""
  ```

**Standup Output (Tue EOD):**
- Licensing models created ✓
- Migration ready ✓
- License validation utilities ready ✓

---

#### **Phase 3: CLI Command + Entitlement Integration (Wed 2026-05-08, parallel with Decision 3 Phase 3)**

**Task 3.1:** Create CLI command: generate_license  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** `./manage.py create_license --server_id=<uuid> --tier=pro`
  ```python
  class Command(BaseCommand):
      def handle(self, server_id, tier, **options):
          # Generate ServerID (if not provided)
          # Create License record
          # Generate LicenseKey
          # Output key to admin
          self.stdout.write(f"License Key: {key}")
  ```

**Task 3.2:** Add license check to Pro endpoints  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** Add middleware + decorator to 3+ endpoints
  ```python
  @require_license()  # Decorator: auto-validate license
  def whale_signals_view(request):
      # Only accessible if license is valid
  ```

**Task 3.3:** Add audit logging  
- **Owner:** Backend  
- **Effort:** 2h  
- **Artifact:** Log every Pro endpoint call to LicenseAudit
  ```python
  # In middleware or decorator:
  LicenseAudit.objects.create(
      key=license_key,
      endpoint=request.path,
      user=request.user,
      status='success' | 'denied'
  )
  ```

**Standup Output (Wed EOD):**
- create_license CLI ready ✓
- License check applied to Pro endpoints ✓
- Audit logging active ✓

---

#### **Phase 4: Admin UI + Tests (Thu 2026-05-09, parallel with Decision 3 Phase 4)**

**Task 4.1:** Create Django admin interface  
- **Owner:** Backend  
- **Effort:** 3h  
- **Artifact:** admin.py models + custom actions
  ```python
  @admin.register(License)
  class LicenseAdmin(admin.ModelAdmin):
      list_display = ('server', 'tier', 'valid_to', 'is_active')
      actions = ['revoke_license', 'extend_license']
      
      def revoke_license(self, request, queryset):
          # Batch revoke + log
  ```

**Task 4.2:** Create license test suite  
- **Owner:** Backend  
- **Effort:** 4h  
- **Artifact:** backend/tests/test_licensing.py (12+ test cases)
  ```python
  class TestLicensing(TestCase):
      def test_create_license_successful(self):
          # Create ServerID + License + Key
      
      def test_license_expiry_denies_access(self):
          # Expired license → 403 Forbidden
      
      def test_license_revocation_denies_access(self):
          # Revoked key → 403 Forbidden
      
      def test_audit_trail_recorded(self):
          # Each request logged to LicenseAudit
      
      # 8+ more scenarios
  ```
  **Target:** >90% coverage

**Task 4.3:** Update OC-13 gate  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Change:** Add "Self-host Pro model" status to readiness checklist

**Standup Output (Thu EOD):**
- Admin UI complete ✓
- test_licensing.py: 12+ tests, >90% coverage ✓
- OC-13 updated ✓

---

#### **Phase 5: Integration & Merge (Fri 2026-05-10)**

**Task 5.1:** Create summary doc  
- **Owner:** Tech Lead  
- **Effort:** 1h  
- **Deliverable:** RELEASE_DECISION_SELFHOST_LICENSING_20260510.md

**Task 5.2:** Code review + merge  
- **Owner:** Tech Lead + Backend  
- **Effort:** 2h  
- **Merge Gate:** All tests pass + OC-19 checklist verified

**Standup Output (Fri EOD):**
- Decision 4 locked ✓
- OC-13 gate "Self-host model": RED → YELLOW ✓
- Ready for Decision 5 (Week 4) ✓

---

## 4. Resource Allocation

| Role | Task | Hours | Status |
|---|---|---|---|
| **PO** | Decision approval + audit messaging | 4h | Ready |
| **Tech Lead** | Architecture review + docs + PR review | 12h | Ready |
| **Backend Dev** | Models + decorators + tests + CLI | 24h | Ready |
| **Frontend Dev** | useFeatureGates hook + UI updates | 5h | Ready |
| **QA** | Test planning + integration validation | 3h | Ready |

**Total:** ~6.5 person-days (1 PO 25%, 1 Tech Lead 100%, 1 Backend 60%, 1 Frontend 25%, 1 QA 15%)

---

## 5. Dependencies & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Decision 2 (packaging) not complete | Blocks Decision 3 design | Can proceed with analysis; verify by Mon EOD Fri |
| Database migration fails | Data loss | Dry-run on test DB; backup before apply |
| License key algorithm collision | Security issue | Use 32-char hex hash + unique constraint in DB |
| CLI command complexity | User confusion | Create admin guide with examples |
| Frontend component explosion | Scope creep | Define exact components in Task 3.2 upfront |

---

## 6. Success Criteria

✅ **By Fri 2026-05-10 EOD:**

**Decision 3 (Community Package):**
1. Endpoint allowlist locked (5+ endpoints gated)
2. feature_gates.py module complete + integrated
3. Entitlement API returns features dict
4. Frontend conditional rendering implemented
5. test_feature_gates.py: >90% coverage, all green
6. OC-06, OC-11 updated + coherent
7. PR merged to dev (per OC-19)
8. OC-13 gate "Community package": RED → **YELLOW** ✓

**Decision 4 (Self-Host Model):**
1. Licensing module complete (4 models + migrations)
2. create_license CLI command ready
3. License check integrated to 3+ Pro endpoints
4. Admin UI functional (revoke/audit)
5. test_licensing.py: >90% coverage, all green
6. OC-13 gate "Self-host model": RED → **YELLOW** ✓
7. PR merged to dev (per OC-19)
8. Audit logging + compliance trail active

---

## 7. Preparation Tasks (Before Mon 2026-05-06)

⚠️ **To be done THIS WEEK (by Fri 2026-05-03):**
1. ✅ OC-24 (Decision 2) approved + merged to dev
2. ✅ Team reviews OC-26 (this doc) before standup Mon
3. ⏳ Backend pre-scans endpoint locations (find all tier checks)
4. ⏳ PO prepares feature tier mapping document (for Task 1.2)

---

## 8. Daily Standup Talking Points (Week 3)

### Mon 2026-05-06
- Review OC-26 requirements
- Confirm feature gate taxonomy (which features → which tiers)
- Confirm license model (ServerID + License + Key structure)
- Assign Phase 1 analysis tasks (both decisions)
- Q: Blockers from Week 2?

### Tue 2026-05-07
- Feature gate taxonomy finalized ✓
- License model approved ✓
- Phase 2 starts (feature_gates.py + licensing models)

### Wed 2026-05-08
- feature_gates.py + decorators implemented ✓
- Licensing models + migrations ready ✓
- Frontend useFeatureGates hook ready ✓
- CLI command in progress

### Thu 2026-05-09
- CLI + admin UI complete ✓
- Tests 100% done + coverage check ✓
- Docs updated ✓
- PRs ready for review

### Fri 2026-05-10
- Both PRs merged to dev ✓
- OC-13 gates updated ✓
- Decisions 3 + 4 LOCKED ✓

---

## 9. Next Decision

**When Decision 4 complete (Fri 2026-05-10 EOD):**
- **Decision 5 (Legal Bundle)** finalization - Mon 2026-05-13
- See OC-22 §3.4 + OC-27 (to be created) for details

---

## 10. Appendix: Feature Gate Checklist

```
Decision 3 Verification Checklist (before Fri merge):

[ ] Endpoint audit complete: all current tier checks documented
[ ] Feature gate taxonomy locked: community, pro, enterprise mapped
[ ] feature_gates.py module implemented: FEATURE_GATES dict + functions
[ ] @require_feature decorator applied to 5+ endpoints
[ ] Entitlement API response includes features dict
[ ] Frontend useFeatureGates hook created + integrated
[ ] UI components conditionally display features
[ ] Upsell prompts configured for upgrade paths
[ ] test_feature_gates.py: 15+ cases, >90% coverage, all green
[ ] OC-06 (pricing) updated with feature list per tier
[ ] OC-11 (entitlement) checkpoints synced
[ ] Summary doc created (RELEASE_DECISION_COMMUNITY_PACKAGE_20260510.md)
[ ] PR passes OC-19 governance checks
[ ] Decision 3 LOCKED (recorded in OC-15)
```

```
Decision 4 Verification Checklist (before Fri merge):

[ ] License lifecycle documented + approved
[ ] ServerID mechanism chosen: UUID on first startup
[ ] Licensing models created: ServerID, License, LicenseKey, LicenseAudit
[ ] Migrations created + tested on test DB
[ ] create_license CLI command functional
[ ] License key validation utility implemented
[ ] @require_license decorator applied to Pro endpoints
[ ] License check integration tested (valid/expired/revoked)
[ ] Admin UI complete: license list + revoke action
[ ] LicenseAudit logging active on all Pro endpoints
[ ] test_licensing.py: 12+ cases, >90% coverage, all green
[ ] OC-13 gate updated with licensing status
[ ] Summary doc created (RELEASE_DECISION_SELFHOST_LICENSING_20260510.md)
[ ] PR passes OC-19 governance checks
[ ] Decision 4 LOCKED (recorded in OC-15)
```

---

**Document prepared by:** Antigravity (AI Coding Assistant)  
**Date:** 2026-04-18  
**Status:** READY FOR PLANNING (effective Mon 2026-05-06)

