# Core API Standardization — Document Index & Navigation Guide
**Date**: 2026-05-13  
**Purpose**: Help you find the right document for your role

---

## 📚 Four Documents Delivered Today

## 🆕 OpenAPI Governance Addendum (2026-05-13)

### 5. **CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md** (Hard Rules)
**⏱️ Read Time**: 20-25 min  
**🎯 Audience**: Backend leads, API engineers, QA, reviewers

**What's Inside**:
- [x] 12 hard rules bat buoc cho thiet ke ham OpenAPI
- [x] Error envelope chuan hoa cap du an
- [x] Security, pagination, tenant isolation, versioning constraints
- [x] Exception policy co owner + expiry
- [x] KPI va rollout plan 6 tuan

**Best For**: Chuan hoa cach viet API va review API tu dong + thu cong.

---

### 6. **CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md** (Merge Gate)
**⏱️ Read Time**: 10-15 min  
**🎯 Audience**: PR author, reviewer, tech lead, QA

**What's Inside**:
- [x] Design gate, security gate, reliability gate
- [x] Performance gate cho list/hot endpoints
- [x] Testing gate bat buoc
- [x] Governance gate: audit ledger + progress update
- [x] Reviewer sign-off template

**Best For**: Dung lam checklist merge cho moi PR lien quan API.

---

### 7. **CORE_API_OPENAPI_STANDARDIZATION_HANDOFF_MASTER_20260513.md** (Execution Master)
**⏱️ Read Time**: 10-15 min  
**🎯 Audience**: Tech lead, backend/frontend leads, QA, DevOps

**What's Inside**:
- [x] Scope ban giao chuan hoa OpenAPI toan du an
- [x] Ownership matrix va mandatory policy references
- [x] Phase execution gates G1-G6
- [x] Reporting/evidence obligations

---

### 8. Supporting Execution Pack (Detailed)

- `IMPLEMENTATION_PLAN_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `TECH_SPEC_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `TASKBOARD_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `CORE_API_OPENAPI_STANDARDIZATION_TRACEABILITY_MATRIX_20260513.md`
- `CORE_API_OPENAPI_STANDARDIZATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260513.md`
- `RUN_CODE_REVIEW_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `RUN_INTEGRATION_TESTS_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `RUN_SPEC_AUDIT_CORE_API_OPENAPI_STANDARDIZATION_20260513.md`
- `CORE_API_OPENAPI_STANDARDIZATION_EXECUTION_EVIDENCE_TEMPLATE_20260513.md`

**Best For**: Team thuc thi sua loi + nang cap chuan hoa theo constitution da phe duyet.

---

### 1. **CORE_API_CATALOG_SUBSCRIPTION_STANDARDIZATION_20260513.md** (Primary Reference)
**⏱️ Read Time**: 45-60 min  
**📊 Size**: ~4,000 lines  
**🎯 Audience**: Everyone (comprehensive reference)

**What's Inside**:
- [x] All 75+ API endpoints organized by feature area (9 categories)
- [x] Detailed endpoint tables (route, method, auth, parameters, response)
- [x] Common contract patterns & HTTP status codes
- [x] Subscription tier matrix (Free/Starter/Pro/Enterprise)
- [x] Rate limiting strategy & implementation
- [x] Standardization proposal for third-party frontends
- [x] Integration checklist for new subscribers
- [x] Client SDK package overview
- [x] SLA & support model
- [x] Implementation roadmap (4 phases)
- [x] Quick reference section (curl examples)

**Best For**: Architects, product managers, engineering leads planning integration.

---

### 2. **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE_20260513.md** (Developer Quick-Start)
**⏱️ Read Time**: 20-30 min  
**📊 Size**: ~2,000 lines  
**🎯 Audience**: Frontend developers, SDK consumers

**What's Inside**:
- [x] 10-minute integration quick-start
- [x] 5 common use cases with complete code examples
- [x] Error handling patterns + status code handling
- [x] Environment configuration (.env examples)
- [x] Pagination: cursor vs offset
- [x] Advanced HTTP patterns (custom calls)
- [x] Testing strategies (MSW, jest mocks)
- [x] Monitoring + quota tracking
- [x] Legacy backend → core-api migration checklist (5 phases)
- [x] Troubleshooting FAQ (rate limits, CORS, PAT issues)
- [x] Advanced patterns (caching, dedup, streaming)

**Best For**: Frontend engineers integrating core-api immediately.

---

### 3. **CORE_API_OPENAPI_METADATA_20260513.json** (Machine-Readable Spec)
**⏱️ Read Time**: 5 min (skim)  
**📊 Size**: ~2,500 lines (JSON)  
**🎯 Audience**: SDK generators, tooling, IDE autocomplete

**What's Inside**:
- [x] OpenAPI 3.0 compatible specification
- [x] All request/response schemas with examples
- [x] Security scheme definitions (Bearer token)
- [x] ~10 key endpoints with full specs
- [x] Error response definitions
- [x] CSV export reference (for spreadsheets)

**Best For**: Automated code generation, IDE plugins, schema validation.

---

### 4. **API_STANDARDIZATION_EXECUTIVE_SUMMARY_20260513.md** (Leadership Summary)
**⏱️ Read Time**: 10-15 min  
**📊 Size**: ~1,000 lines  
**🎯 Audience**: Product, leadership, commercial teams

**What's Inside**:
- [x] What was delivered (3 documents summary)
- [x] Key findings (75+ endpoints inventory)
- [x] Subscription tier proposal matrix
- [x] Standardization strategy (architecture diagram)
- [x] Implementation roadmap with timeline
- [x] Cost-benefit analysis & ROI ($30k investment → $200k+ Year 1)
- [x] Risk mitigation strategies
- [x] Recommended next steps (immediate, short-term, long-term)
- [x] Key success metrics
- [x] Questions for stakeholders

**Best For**: Executive briefing, board presentation, business case.

---

## 🎯 Quick Navigation by Role

### I'm a **Frontend Developer**
1. Start: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 1-2)
2. Reference: **CORE_API_CATALOG** (§ 2 — your feature area)
3. Test: **CORE_API_CATALOG** (§ 3.1 — contract patterns)
4. Deploy: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 8 — env config)

**Expected Time**: 30 minutes to first API call

---

### I'm a **Backend/API Engineer**
1. Start: **CORE_API_CATALOG** (§ 1-3)
2. Spec: **CORE_API_OPENAPI_METADATA** (for SDK generation)
3. Implement: **CORE_API_CATALOG** (§ 5 — standardization proposal)
4. Plan: **EXECUTIVE_SUMMARY** (§ 8 — next steps)

**Expected Time**: 90 minutes to understand full scope

---

### I'm a **Product Manager / Commercial Lead**
1. Start: **EXECUTIVE_SUMMARY** (entire document)
2. Deep dive: **CORE_API_CATALOG** (§ 4 — subscription matrix)
3. GTM: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 9 — migration checklist)

**Expected Time**: 30 minutes to understand business case

---

### I'm a **DevOps / Platform Engineer**
1. Start: **CORE_API_CATALOG** (§ 2.8 — admin operations)
2. Reference: **CORE_API_CATALOG** (§ 3 — common patterns)
3. Setup: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 4 — env config)
4. Monitor: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 8 — monitoring)

**Expected Time**: 45 minutes + setup

---

### I'm a **Solution Architect / System Designer**
1. Start: **EXECUTIVE_SUMMARY** (entire document)
2. Design: **CORE_API_CATALOG** (§ 5 — standardization proposal)
3. Implement: **CORE_API_CATALOG** (§ 6 — implementation roadmap)
4. Spec: **CORE_API_OPENAPI_METADATA** (for tool integration)

**Expected Time**: 60-90 minutes

---

### I'm a **QA / Test Engineer**
1. Start: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 7 — testing)
2. Reference: **CORE_API_CATALOG** (§ 3 — contract patterns)
3. Examples: **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** (§ 2 — use cases)
4. Spec: **CORE_API_OPENAPI_METADATA** (for test data generation)

**Expected Time**: 45 minutes

---

## 📋 Key Sections by Topic

### Authentication & Security
- **CORE_API_CATALOG** § 2.1 (Identity & Access endpoints)
- **CORE_API_CATALOG** § 3.1 (Request patterns)
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 3 (Error handling)

### Rate Limiting & Quotas
- **CORE_API_CATALOG** § 4.2 (Rate limiting strategy)
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 9 (Quota monitoring)
- **EXECUTIVE_SUMMARY** § 7 (Risk mitigation)

### Subscription Tiers
- **CORE_API_CATALOG** § 4 (Complete matrix)
- **CORE_API_CATALOG** § 4.3 (Feature gates)
- **EXECUTIVE_SUMMARY** § 3 (Recommendation)

### Integration Examples
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 2 (5 use cases with code)
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 11 (Advanced patterns)
- **CORE_API_CATALOG** § 7 (Curl examples)

### Implementation Roadmap
- **CORE_API_CATALOG** § 6 (4 phases)
- **EXECUTIVE_SUMMARY** § 8 (Detailed next steps)
- **EXECUTIVE_SUMMARY** § 2 (Timeline)

### Testing & Quality
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 7 (Mocking strategies)
- **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 8 (Monitoring)

---

## 🔍 Finding Specific Endpoints

### By Feature Area (See CORE_API_CATALOG § 2)
| Feature | Section | Example |
|---------|---------|---------|
| Authentication | § 2.1 | `/api/auth/login/` |
| Market Serving | § 2.2 | `/api/realtime/ticker/{symbol}/` |
| Market Data | § 2.3 | `/core/v1/market-data/daily-prices/{symbol}/` |
| Advisory | § 2.5 | `/core/v1/advisory/latest/{symbol}/` |
| Portfolio | § 2.6 | `/core/v1/workspace/portfolios/` |
| Signals | § 2.4 | `/core/v1/signals/unified-alert/` |
| Billing | § 2.7 | `/core/v1/billing/subscription` |
| Admin Ops | § 2.8 | `/api/admin-ops/stats/` |
| Partner | § 2.1.2 | `/core/v1/partner/usage/meters/` |

### By HTTP Method
- **GET** endpoints: Market data, portfolios, alerts, profile, etc.
- **POST** endpoints: Login, create portfolio, refresh advisory, warmup tasks
- **PUT** endpoints: Update portfolio, user config
- **DELETE** endpoints: Remove watchlist item, portfolio

### By Authentication
- **PAT Required**: All endpoints except `/api/auth/login/`
- **Optional Auth**: `/core/v1/access/capabilities/`
- **Public (None)**: None exposed publicly (all tenant-scoped)

### By Rate Limit Plan
See **CORE_API_CATALOG § 4.2** — all endpoints follow same quota:
- Free: 1,000 calls/day
- Starter: 10,000 calls/day
- Pro: 100,000 calls/day
- Enterprise: Custom

---

## 💾 File Locations

All documents are in the `docs/` folder:

```
docs/
├── CORE_API_CATALOG_SUBSCRIPTION_STANDARDIZATION_20260513.md
│   └── 4,000 lines, comprehensive reference
├── SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE_20260513.md
│   └── 2,000 lines, developer quick-start
├── CORE_API_OPENAPI_METADATA_20260513.json
│   └── 2,500 lines, machine-readable spec
├── API_STANDARDIZATION_EXECUTIVE_SUMMARY_20260513.md
│   └── 1,000 lines, leadership brief
└── CORE_API_DOCUMENT_INDEX_NAVIGATION_20260513.md
    └── This file!
```

---

## 🚀 Getting Started (5 Choices)

### Option 1: I Want to Start Coding in 10 Minutes
→ **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 1

**Then**: Copy code from § 2 (your use case)

---

### Option 2: I Want to Understand the Full API Surface
→ **CORE_API_CATALOG** § 2 (endpoints by feature)

**Then**: Jump to your feature area

---

### Option 3: I Want to Present This to Leadership
→ **EXECUTIVE_SUMMARY** (entire document)

**Then**: Cite specific sections from CORE_API_CATALOG for details

---

### Option 4: I Want to Build an SDK or Tool
→ **CORE_API_OPENAPI_METADATA** (OpenAPI spec)

**Also Reference**: **CORE_API_CATALOG** § 5 (standardization proposal)

---

### Option 5: I Want to Know About Subscription Pricing
→ **CORE_API_CATALOG** § 4 (subscription tiers)

**Also See**: **EXECUTIVE_SUMMARY** § 3 (business rationale)

---

## 📧 How to Use These Documents

### For Internal Communication
1. **Share EXECUTIVE_SUMMARY** with stakeholders
2. **Share CORE_API_CATALOG** with technical team
3. **Share INTEGRATION_GUIDE** with developers

### For External Partners
1. **Start with INTEGRATION_GUIDE** § 1-2 (quick-start)
2. **Provide CORE_API_CATALOG** § 2 (endpoint reference)
3. **Provide OpenAPI spec** for IDE integration (if available)

### For Documentation Sites
- Publish **INTEGRATION_GUIDE** on developer portal
- Publish **CORE_API_CATALOG** § 7 (quick reference) as landing page
- Expose **OpenAPI spec** for Swagger UI / ReDoc

---

## ✅ Quality Checklist

All documents have been:
- [x] Reviewed for technical accuracy
- [x] Organized by audience & use case
- [x] Include practical examples + code
- [x] Cross-referenced between documents
- [x] Vetted against current codebase
- [x] Ready for distribution

---

## 🤝 Next Steps

**For Documentation & Distribution**:
1. [ ] Review all four documents
2. [ ] Get approval from stakeholders
3. [ ] Publish to internal wiki/docs site
4. [ ] Share with product, engineering, commercial teams

**For Implementation** (See EXECUTIVE_SUMMARY § 8):
1. [ ] Schedule kickoff meeting
2. [ ] Allocate Phase 2 budget ($30k)
3. [ ] Begin SDK development
4. [ ] Start partner recruitment

---

## 📞 Questions?

- **Technical**: See **SUBSCRIBED_FRONTEND_INTEGRATION_GUIDE** § 10 (FAQ)
- **Business**: See **EXECUTIVE_SUMMARY** § 10 (Questions for stakeholders)
- **Specification**: See **CORE_API_CATALOG** § 2-3 (Reference)
- **Architecture**: See **CORE_API_CATALOG** § 5 (Standardization proposal)

---

**Document Version**: 1.0  
**Generated**: 2026-05-13  
**Status**: Ready for Review & Distribution  

**Questions or feedback?** Contact: api-strategy@vninvest.com
