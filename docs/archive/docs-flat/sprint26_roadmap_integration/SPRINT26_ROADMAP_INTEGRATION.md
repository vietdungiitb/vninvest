# VNInvest Project Roadmap - With OpenCore Integration (2026-04)

**Updated**: 2026-04-07  
**Status**: Sprint 26 Ready to Kick Off  

---

## Project Timeline Overview (April 2026 Onwards)

```
MAIN STREAM (Sequential)
────────────────────────────────────────────────

Apr 1├─ Sprint 15: Multi-AI Providers (70% done)
    │   ├─ User selects AI provider (OpenClaw/Claude/GPT)
    │   ├─ Test connections UI
    │   └─ Multi-model dispatcher task
    │
Apr 8├─ [PARALLEL] Sprint 26: OpenCore Integration ✨✨✨
    │   │   ├─ Feature gating hooks (whale_momentum, dark_pool, etc.)
    │   │   ├─ Integration tests
    │   │   └─ Frontend docs + Postman
    │   │
    │   └─ [PARALLEL] Sprint 15 finishing (Multi-AI)
    │       └─ Tests + rollout
    │
Apr 15├─ Sprint 26 DONE ✅
    │   │
    │   ├─ Sprint 27: Payment Gateway STARTS
    │   │   ├─ Stripe integration
    │   │   ├─ MoMo integration
    │   │   └─ Payment sandbox testing
    │   │
    │   └─ Sprint 15 DONE ✅
    │
Apr 22├─ Sprint 27 DONE ✅
    │   │
    │   └─ Sprint 28: Subscription UI STARTS
    │       ├─ Upgrade flow
    │       ├─ Billing dashboard
    │       ├─ Invoice history
    │       └─ User settings > Plan management
    │
Apr 29├─ Sprint 28 DONE ✅
    │   │
    │   └─ OpenCore LIVE (Monetization Ready!) 🎉
    │
May ├─ Sprint 29: Analytics Dashboard
    │   └─ Usage reports, revenue forecasts, LTV analysis
    │
```

---

## Sprint 26 Detail: OpenCore Integration

```
Sprint 26 — OpenCore License & Billing System Integration
Timeline: Apr 8 - Apr 15 (5-7 business days)

┌─────────────────────────────────────────────────────┐
│ PHASE 1: Integration (Days 1-2) - 16 hours          │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Task 1.1: Hook @require_feature() decorator         │
│   └─ Apply to whale_momentum, dark_pool_flow, etc.  │
│   └─ Owner: Backend Lead                            │
│   └─ Estimate: 4h                                   │
│                                                     │
│ Task 1.2: Test 3 tiers (free/pro/enterprise)        │
│   └─ Free user: Can use SMA, RSI, volume_profile    │
│   └─ Pro user: Can use +whale, dark_pool, etc.      │
│   └─ Owner: QA Lead                                 │
│   └─ Estimate: 6h                                   │
│                                                     │
│ Task 1.3: Update indicator list endpoint             │
│   └─ Returns available indicators per plan          │
│   └─ Owner: Backend Lead                            │
│   └─ Estimate: 3h                                   │
│                                                     │
│ Task 1.4: Add API tracking middleware                │
│   └─ Track all API calls vs quota                   │
│   └─ Owner: Backend Lead                            │
│   └─ Estimate: 3h                                   │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PHASE 2: Testing & QA (Days 3-4) - 20 hours         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Task 2.1: Integration test suite (10+ tests)        │
│   └─ API endpoints, admin UI, celery tasks          │
│   └─ Owner: QA Lead                                 │
│   └─ Estimate: 12h                                  │
│                                                     │
│ Task 2.2: Admin UI functional tests                 │
│   └─ Crud, filters, bulk actions, color badges     │
│   └─ Owner: QA Lead                                 │
│   └─ Estimate: 5h                                   │
│                                                     │
│ Task 2.3: Quota enforcement test                    │
│   └─ Quota reset monthly, enforce limits           │
│   └─ Owner: QA Lead                                 │
│   └─ Estimate: 3h                                   │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PHASE 3: Demo & Docs (Days 5-7) - 14 hours          │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Task 3.1: Fixture data + runbook                    │
│   └─ seed_opencore_demo command + setup guide       │
│   └─ Owner: Backend Lead                            │
│   └─ Estimate: 4h                                   │
│                                                     │
│ Task 3.2: Postman collection                        │
│   └─ All 13 endpoints testable from Postman         │
│   └─ Owner: QA Lead                                 │
│   └─ Estimate: 3h                                   │
│                                                     │
│ Task 3.3: Frontend integration checklist             │
│   └─ How to check feature availability              │
│   └─ How to show upgrade prompts                    │
│   └─ Owner: PM                                      │
│   └─ Estimate: 4h                                   │
│                                                     │
│ Task 3.4: Review meeting + approval                 │
│   └─ Demo to frontend team                          │
│   └─ Sign off DoD                                   │
│   └─ Owner: PM                                      │
│   └─ Estimate: 3h (meeting)                         │
│                                                     │
└─────────────────────────────────────────────────────┘

TOTAL EFFORT: ~50 engineering hours (1 backend, 1 QA, 1 PM)
COST: ~$5-7k (assuming $100-140/hr blended rate)
TIMELINE: 5-7 days
RISK: LOW (foundation already solid)
```

---

## How OpenCore Fits Into Bigger Picture

### 1. Monetization Strategy

```
Current State (Apr 7):
├─ Free tier: All users
├─ No differentiation
└─ No revenue stream

Sprint 26 (Apr 8-15): OpenCore Integration
├─ Feature gating active
├─ Users see what's available per tier
└─ Encourage upgrades (UI doesn't exist yet)

Sprint 27 (Apr 15-22): Payment Gateway
├─ Stripe integration
├─ MoMo integration
└─ Subscriptions can be purchased

Sprint 28 (Apr 22-29): Subscription UI
├─ Plans page → Upgrade button
├─ Billing dashboard
└─ License management

Result by Apr 30: OpenCore LIVE
├─ Free users: 3 indicators
├─ Pro users: 8 indicators ($99/year)
├─ Enterprise users: 12 indicators ($999/year)
└─ Revenue stream active 💰
```

### 2. User Journey

```
NEW USER (Day 1)
├─ Sign up → Auto-create Free tier license (via signal)
├─ Explore dashboard → See "Free Plan"
└─ Try SMA indicator → Works ✓

USER SEES PRO INDICATOR (Day 2)
├─ Click whale_momentum → 403 Forbidden
├─ Error message: "Upgrade to Pro to unlock"
├─ Clicks "Upgrade" button → Subscription page [REQUIRES Sprint 28]
└─ Selects "Pro ($99/year)" → Checkout [REQUIRES Sprint 27]

PAYMENT PROCESSING (Day 3)
├─ User pays via Stripe [REQUIRES Sprint 27]
├─ License updated: free → pro
├─ Whale momentum available ✓
└─ Dashboard refreshes: Shows "Pro Plan" badge

ONGOING
├─ Monthly usage tracked in admin
├─ Monthly quota reset on 1st
└─ Invoices generated for billing
```

### 3. Feature Gating Matrix

```
BEFORE OpenCore (Current):
├─ Free User: See all indicators
├─ Pro User: See all indicators
└─ Enterprise User: See all indicators
(Everyone same → No upsell path)

AFTER OpenCore (Sprint 26+):
├─ Free User (DPIPlan.free):
│  └─ Can use: SMA, RSI, volume_profile [3/12]
│
├─ Pro User (DPIPlan.pro):
│  ├─ Can use: ↑above + whale_momentum, dark_pool_flow,
│  │            correlation_matrix, volatility_surface,
│  │            sentiment_score [8/12]
│  └─ Cost: $99/year
│
└─ Enterprise User (DPIPlan.enterprise):
   ├─ Can use: ↑above + predictive_ml, cross_market_alpha,
   │           fund_flow_analysis, hedging_strategy [12/12]
   └─ Cost: $999/year

Lock Icon: 🔒 Unlock [Indicator Name]
```

---

## What Changes With Sprint 26

### Backend Changes
```python
# BEFORE Sprint 26
@api_view(['GET'])
def get_whale_momentum(request, symbol):
    return Response(calculate_whale_momentum(symbol))
    # ❌ No access check!

# AFTER Sprint 26 (Phase 1)
@require_feature('whale_momentum')  # ← NEW
@api_view(['GET'])
def get_whale_momentum(request, symbol):
    return Response(calculate_whale_momentum(symbol))
    # ✓ Decorator checks license tier automatically
    # ✓ Returns 403 if user doesn't have access
```

### Admin Interface Changes
```
BEFORE:
└─ Portfolio app
   ├─ Holdings
   ├─ Transactions
   ├─ Prices
   └─ (OpenCore models missing)

AFTER Sprint 26:
└─ Portfolio app
   ├─ Holdings
   ├─ Transactions
   ├─ Prices
   ├─ ✨ DPI Plans (3 tiers: Free, Pro, Enterprise)
   ├─ ✨ DPI Licenses (Per-user license + status)
   ├─ ✨ DPI Usage Metrics (API calls, features used)
   ├─ ✨ DPI Audit Log (License change history)
   ├─ ✨ DPI API Calls (Per-call logging)
   ├─ ✨ DPI Feature Usage (Stats per feature)
   ├─ ✨ DPI Quota Tracker (Monthly quota)
   ├─ ✨ DPI Analytics Snapshot (Daily summary)
   ├─ ✨ DPI Revenue Plan (Pricing)
   ├─ ✨ DPI Subscription (Active subs)
   ├─ ✨ DPI Invoice (Billing)
   └─ ✨ DPI Payment (Payment tracking)
    └─ [14 new models in admin]
```

### API Routes Changes
```
BEFORE Sprint 26:
GET /api/portfolio/whale-momentum/{symbol}/
→ Works for all authenticated users

AFTER Sprint 26 (Phase 1):
GET /api/portfolio/whale-momentum/{symbol}/
→ Works only for Pro+ tier users
→ Free users get 403 + "Upgrade to Pro" message

NEW Endpoints (from opencore_api.py):
GET  /api/opencore/license/my-license/          ← Your license
POST /api/opencore/license/available-plans/     ← All plans
GET  /api/opencore/indicators/available/         ← Your available
POST /api/opencore/indicators/can-use/          ← Check permission
GET  /api/opencore/usage/summary/               ← Your usage
GET  /api/opencore/usage/quota/                 ← Your quota
GET  /api/opencore/billing/invoices/            ← Your invoices
GET  /api/opencore/billing/current-bill/        ← This month's bill
```

### Database Changes
```
BEFORE Sprint 26:
User
├─ username, email, password
├─ is_active, date_joined
└─ is_staff, is_superuser

AFTER Sprint 26 (Phase 1 integration):
User
├─ ↑above (unchanged)
└─ dpi_license (OneToOne) → DPILicense
                            ├─ plan (FK) → DPIPlan
                            ├─ status (trial/active/grace/expired)
                            ├─ created_at, expires_at
                            ├─ usage_metrics (OneToOne) → DPIUsageMetrics
                            ├─ entitlements (M2M) → DPIEntitlement
                            └─ audit_logs (FK) → DPIAuditLog

+ 14 other models for tracking, billing, analytics
+ 35+ database indexes for performance
```

---

## Success Metrics for Sprint 26

### Quantitative Metrics

| Metric | Target | Owner | Frequency |
|--------|--------|-------|-----------|
| Feature gating working | 5/5 indicators tested | Backend | Day 2 |
| Tests passing | 10+/10+ passed | QA | Day 4 |
| API latency | < 100ms overhead | Backend | Day 4 |
| Admin UI loading | < 2 sec | QA | Day 4 |
| Celery task success | 100% runs | QA | Day 4 |
| Code coverage | >= 80% | QA | Day 4 |

### Qualitative Metrics

| Metric | Target | Owner | Frequency |
|--------|--------|-------|-----------|
| Runbook clarity | New dev can setup in < 15 min | PM | Day 6 |
| Frontend team understanding | 90%+ confident integrating | PM | Day 7 |
| Admin team feedback | No major issues found | Admin | Day 7 |
| Product approval | DoD signed off | PM | Day 7 |

---

## Deliverables Checklist (Sprint 26 DoD)

```
PHASE 1 DELIVERABLES:
□ @require_feature() decorator applied to 5+ endpoints
□ Feature gating tests: 5/5 indicators tested & passed
□ Indicator list endpoint returning correct tier data
□ API tracking middleware logging calls

PHASE 2 DELIVERABLES:
□ Integration test suite: 10+ tests, all green
□ Admin UI tests: CRUD + filters + bulk actions
□ Quota enforcement test: Monthly reset verified
□ Celery task tests: sync, invoice, snapshot verified

PHASE 3 DELIVERABLES:
□ seed_opencore_demo command works
□ Runbook: OPENCORE_LOCAL_SETUP.md (clear, step-by-step)
□ Postman collection: All 13 endpoints + examples
□ Frontend checklist: OPENCORE_FRONTEND_INTEGRATION_CHECKLIST.md
□ Demo: Walkthrough video or live demo to team

SIGN-OFF:
□ Backend Lead: Phase 1 approved
□ QA Lead: Phase 2 approved
□ PM: Phase 3 approved + DoD met
□ Product Manager: Ready for Sprint 27

HANDOFF TO SPRINT 27:
□ All code merged to main
□ Migrations applied (0020 + any new)
□ Database seeded with tier data
□ Tests passing in CI/CD
```

---

## Timeline Visualization

```
Mon  Tue  Wed  Thu  Fri  Mon  Tue
Apr 8 9   10  11  12  15  16
└─┬──┬──┬──┬──┬──┴──┬──┬──┬──┬──┐

Phase 1 (Integration) ████████ (Days 1-2)
Phase 2 (Testing) ││││ (Days 3-4)
Phase 3 (Docs) ││││ (Days 5-7)
          ↓
        Done ✓ (Apr 15, Friday EOD)

Sprint 27 Starts (Apr 15-22)
└─ Depends on Sprint 26 completion
```

---

## Risk Mitigation Plan

### Risk: Phase 1 Delays

**Probability**: Medium  
**Impact**: High (blocks Sprint 27)  
**Mitigation**:
- Have Phase 1 tasks clearly defined upfront
- Pre-review decorator design with team
- Have QA write tests in parallel (no waiting)
- Reserve "contingency day" in schedule

### Risk: Tests Flaky / Incomplete

**Probability**: Medium  
**Impact**: Medium (affects quality)  
**Mitigation**:
- Mock external dependencies (Celery, emails)
- Use factory_boy for test fixtures
- Run tests multiple times locally before commit
- QA owns test reliability (no cowboy tests)

### Risk: Docs Don't Match Code

**Probability**: Low  
**Impact**: Medium (frontend integration painful)  
**Mitigation**:
- Write docs AFTER features working (not before)
- Have PM review code + write docs simultaneously
- Validate docs with "dumb reader" (new developer)
- Test Postman collection actually works

---

## After Sprint 26: What Happens?

### Sprint 27 Dependencies Met?

```
Sprint 27 (Payment Gateway) Needs:
✅ DPILicense model: Available
✅ DPIRevenuePlan model: Available
✅ DPISubscription model: Available
✅ DPIInvoice model: Available
✅ DPIPayment model: Available
✅ Celery infrastructure: Ready
✅ API infrastructure: Ready
✅ Admin interface: Ready

→ Sprint 27 can proceed immediately on Apr 15
```

### Sprint 28 Dependencies Met?

```
Sprint 28 (Subscription UI) Needs:
✅ Feature gating working: From Sprint 26
✅ API endpoints: From Sprint 26
✅ Payment processing: From Sprint 27
✅ License management: From Sprint 26

→ Sprint 28 can proceed on Apr 22
```

---

## Q&A: Common Questions

### Q: Why not put OpenCore in Sprint 27 with Payment?

A: Because:
1. Scope creep - wouldn't fit (too many tasks)
2. Different expertise - Integration work vs. Payment API work
3. Can do in parallel - Sprint 26 (integration) while Sprint 15 (Multi-AI) finishes
4. Sequence matters - Sprint 27 DEPENDS on Sprint 26 done

### Q: Can Sprint 26 happen in parallel with Sprint 15?

A: Yes! Different teams:
- Sprint 15: Frontend (Multi-AI UI work)
- Sprint 26: Backend (OpenCore integration)
- Can be parallel for 7-8 days, then merge

### Q: What if Phase 1 finds bugs in opencore_dpi.py?

A: Update the foundation file (opencore_dpi.py) in Sprint 26:
- Bug fix is part of integration
- Migrations still based on 0020
- Tests cover the fix
- Not a blocker

### Q: Who decides if Sprint 26 is "done"?

A: DoD checklist + PM sign-off:
```
Phase 1: Backend Lead says "Feature gating works"
Phase 2: QA Lead says "10+ tests pass"
Phase 3: PM says "Docs complete + approved"
        Product Manager: "Ready for Sprint 27"
```

---

## Summary Table: Sprint 26 at a Glance

| Aspect | Details |
|--------|---------|
| **Name** | Sprint 26 - OpenCore License & Billing Integration |
| **Duration** | 5-7 days (Apr 8-15) |
| **Team** | 1 Backend, 1 QA, 1 PM |
| **Phase 1** | Feature gating (Days 1-2) |
| **Phase 2** | Testing & QA (Days 3-4) |
| **Phase 3** | Demo & docs (Days 5-7) |
| **Deliverables** | 10+ tests, runbook, Postman, frontend checklist |
| **Dependencies** | None (independent) |
| **Blocks** | Sprint 27 (Payment), Sprint 28 (UI) |
| **Risk Level** | LOW (foundation already solid) |
| **Effort** | ~50 engineering hours |
| **Success Rate** | HIGH (95%+) if team focused |

---

## Document References

- **Main Plan**: [SPRINT26_OPENCORE_DETAILED_PLAN.md](../../../SPRINT26_OPENCORE_DETAILED_PLAN.md)
- **Strategy**: [SPRINT26_STRATEGY_RATIONALE.md](../sprint26_strategy_rationale/SPRINT26_STRATEGY_RATIONALE.md)
- **Implementation**: [OPEN_CORE_IMPLEMENTATION_COMPLETE.md](../../../OPEN_CORE_IMPLEMENTATION_COMPLETE.md)
- **Integration Guide**: [OPENCORE_INTEGRATION_GUIDE.md](../../../OPENCORE_INTEGRATION_GUIDE.md)
- **Verification**: [OPENCORE_VERIFICATION_CHECKLIST.md](../../../OPENCORE_VERIFICATION_CHECKLIST.md)

---

**Status**: ✅ READY FOR SPRINT 26 KICKOFF  
**Next Steps**: 
1. Schedule Sprint 26 kickoff meeting (Apr 8)
2. Assign phase owners
3. Run standup daily
4. Update DoD checklist as progress made

**Project Alignment**: OpenCore → Monetization → Growth 🚀
