# Handoff Master: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Status:** READY FOR EXECUTION  
**Owner:** Backend Team  
**Reviewer:** Tech Lead / Architect  

---

## 1. Mục tiêu (Objective)

Chuẩn hóa toàn bộ Django SaaS Core API endpoints về tiền tố **`/core/v1/`** duy nhất, loại bỏ hoàn toàn các route trùng lặp, legacy compatibility layer, và dead stubs hiện đang tồn tại dưới `/api/`. Đảm bảo frontend (`packages/web`) chuyển đổi hoàn toàn sang base URL `/core/v1/` trước khi decommission các mount `/api/` còn lại.

---

## 2. Vấn đề đã xác nhận (Confirmed Problems)

| # | Vấn đề | Mức độ | Nguồn |
|---|--------|--------|-------|
| 1 | `identity_access.api_urls` duplicate 100% routes của `/core/v1/` + chứa dead stubs (`ai-options`, `v1/admin/crawl/*`, `health/realtime`) | Critical | Audit |
| 2 | `signal_intelligence.api_urls` duplicate 100% routes (chỉ khác trailing slashes) | Critical | Audit |
| 3 | `market_data.urls` mount **2 lần** dưới `/api/` (namespace `market_data_public` + `market_data_api`) | Critical | Audit |
| 4 | `support.urls` mount duplicate dưới `/api/support/` | High | Audit |
| 5 | `user_workspace` duy trì compatibility layer `/api/portfolio/*` mirror `/core/v1/workspace/*` với legacy stub views | High | Audit |
| 6 | `market_serving.api_urls` chứa legacy bridge views (`RealtimeWhaleFeedAggregateView`, `RealtimeWhaleCampaignsView`, `RealtimeUnifiedAlertsView`) + duplicate native routes | Medium | Audit |
| 7 | `market_data.public_urls` mirror read-only endpoints — cần quyết định product có giữ public access không | Medium | Audit |
| 8 | Frontend vẫn dùng `REACT_APP_CORE_API_BASE_URL=/api/` — blocker cho Phase 1 cleanup | Blocker | Strategy Doc |

---

## 3. Quyết định đã khóa (Decisions Locked)

| ID | Quyết định | Rationale |
|----|------------|-----------|
| D-01 | Xóa hoàn toàn `identity_access/api_urls.py` và `signal_intelligence/api_urls.py` — không migrate logic, chỉ xóa duplicate | Zero unique functionality |
| D-02 | Giữ cả singular (`/operator/mail-config/`) và plural (`/operator/mail-configs/`) trong `identity_access/urls.py` | Backward compat cho existing UIs/tests |
| D-03 | Phase 0: Chỉ xóa 4 mount duplicate + 2 file api_urls — **không đụng frontend** | Risk isolation |
| D-04 | Phase 1: Yêu cầu frontend migration trước khi xóa `user_workspace` mount `/api/` | Frontend dependency |
| D-05 | Phase 2: Xóa `market_serving/api_urls.py` sau khi thêm `realtime/symbol-investigation` vào `urls.py` | Route preservation |
| D-06 | `market_data.public_urls` — **chờ quyết định product** (Chủ đề 3) | Product ownership |
| D-07 | `advertising.api_urls` và `commercial.public_urls` — **giữ nguyên** (public tracking/legal pages đúng chỗ) | Correct placement |
| D-08 | Không cần DB migration — chỉ thay đổi routing configuration | Zero data risk |

---

## 4. Deliverables (Đầu ra bàn giao)

| Doc ID | Tên tài liệu | Mô tả |
|--------|--------------|-------|
| 01 | HANDOFF_MASTER (this) | Tổng quan, quyết định, scope |
| 02 | IMPLEMENTATION_PLAN | Phân phase, task breakdown, DoD, gates |
| 03 | TECH_SPEC | Routing matrix, invariants, API contracts, observability |
| 04 | TASKBOARD | Task IDs, status, gate conditions, blockers |
| 05 | TRACEABILITY_MATRIX | Requirement → Task → Validation mapping |
| 06 | SELF_AUDIT_AND_TEST_PROTOCOL | Checklist A-E, fail conditions, coverage targets |
| 07 | EXECUTION_EVIDENCE_TEMPLATE | Slice metadata, files changed, validation commands |
| 08 | CONFIG_OWNERSHIP_MATRIX | Canonical writer per concern, transition ownership |
| 09 | CODE_QUALITY_CONSTITUTION | Coverage targets, theater prevention, fitness scenarios |
| 10 | RUN_CODE_REVIEW | Bootstrap docs, review focus, grep checks, reject conditions |
| 11 | RUN_INTEGRATION_TESTS | Backend/frontend suites, runtime smoke, mandatory gates |
| 12 | RUN_SPEC_AUDIT | Audit questions, output format findings |

---

## 5. Định nghĩa thành công (Success Criteria)

| Gate | Điều kiện pass | Evidence |
|------|----------------|----------|
| **Phase 0 Gate** | 4 mount duplicate đã xóa, 2 file api_urls đã xóa, test suite `identity_access` + `signal_intelligence` pass | Git diff + test output |
| **Phase 1 Gate** | Frontend đã chuyển `REACT_APP_CORE_API_BASE_URL=/core/v1`, `/api/portfolio/*` và `/api/auth/*` không còn được gọi, `user_workspace` mount `/api/` đã xóa, legacy stubs đã xóa | Network tab + git diff + test pass |
| **Phase 2 Gate** | `market_serving.api_urls` đã xóa, `realtime/symbol-investigation` hoạt động trên `/core/v1/`, quyết định `market_data.public_urls` đã khóa | Git diff + test pass + product sign-off |
| **Final Gate** | Toàn bộ test suite pass, Swagger UI `/core/v1/schema/swagger-ui/` load, smoke tests 7/7 pass, zero 404 trên `/core/v1/` endpoints | Test report + smoke test log |

---

## 6. Phạm vi (Scope)

### In Scope
- `packages/core/backend/src/vninvest_core/urls.py` — root routing config
- `packages/core/backend/src/identity_access/` — urls.py, api_urls.py (delete), tests
- `packages/core/backend/src/signal_intelligence/` — urls.py, api_urls.py (delete)
- `packages/core/backend/src/user_workspace/` — urls.py (cleanup), tests
- `packages/core/backend/src/market_data/` — core_urls.py, public_urls.py (decision), urls.py (duplicate mount)
- `packages/core/backend/src/market_serving/` — urls.py, api_urls.py (delete), native_views.py
- `packages/core/backend/src/support/` — urls.py (duplicate mount removal)
- `packages/core/backend/src/advertising/` — api_urls.py (no action, confirm)
- `packages/core/backend/src/commercial/` — public_urls.py (no action, confirm)
- `packages/web/` — env config, coreApiAdapter (Phase 1)

### Out of Scope
- Database migrations
- Business logic changes in views/serializers/services
- `/api/soc/` (service_ops) — operator only, untouched
- `/admin/` — Django admin, untouched
- New feature development

---

## 7. Rủi ro còn lại (Residual Risks)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Frontend migration delay blocks Phase 1 | High | Medium | Phase 0 independent; shadow rollout 1 sprint |
| `market_data.public_urls` decision pending | Medium | Low | Document as open item; Phase 2 can proceed without |
| Test suite flakiness masks regressions | Low | High | Run full suite 2x; fix baseline bugs (Chủ đề 4) first |
| Unknown external webhook consumers on `/api/` paths | Low | High | Nginx log audit before Phase 1 decommission |

---

## 8. Timeline & Milestones

| Milestone | Target | Dependencies |
|-----------|--------|--------------|
| Phase 0 Complete | T+1 day | None |
| Frontend Config Ready | T+3 days | Frontend team capacity |
| Phase 1 Complete | T+5 days | Frontend migration done |
| Phase 2 Complete | T+8 days | Phase 1 done, product decision on public_urls |
| Final Verification | T+9 days | All phases done |

---

## 9. Liên hệ & Escalation

| Role | Name | Contact |
|------|------|---------|
| Program Owner | Backend Tech Lead | [Slack/Email] |
| Frontend Coordinator | Frontend Tech Lead | [Slack/Email] |
| Product Decision (public_urls) | Product Owner | [Slack/Email] |
| Architect Review | System Architect | [Slack/Email] |

---

## 10. Phê duyệt (Sign-off)

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Backend Tech Lead | | | |
| Frontend Tech Lead | | | |
| Product Owner | | | |
| System Architect | | | |

---

*Generated per VNInvest Governance: handoff-doc-pack-generator skill. 12/12 documents in this pack.*