# Kế Hoạch Thực Hiện: Core API Compliance & Test Suite Alignment

**Target**: Tuân thủ Hiến pháp OpenAPI Core API (2026-05-13) & Đưa Test Suite về trạng thái GREEN  
**Baseline**: 282 tests, 111 failures/errors (61 failures + 50 errors)  
**Deadline**: 2 tuần (10 ngày làm việc)  
**Team**: 3-4 Engineers (2 Backend, 1 QA/Dev, 1 FE Sync)  
**Branch Strategy**: 3 nhánh song song (xem chi tiết ở Phase 0)  
**Merge Strategy**: **Atomic Merge** (Monorepo advantage) - 3 PRs merge cùng lúc vào `main` sau khi verify trên Staging, **KHÔNG dùng Feature Flag** runtime.

---

## 🎯 PHASE 0: FOUNDATION & HOTFIX (Ngày 1 - 2h đầu tiên)
*Unblock Dev/QA ngay lập tức*

| Task ID | Task | Owner | Effort | Acceptance Criteria |
|---------|------|-------|--------|---------------------|
| **P0-1** | **Hotfix Swagger UI Access**: Thêm `/core/v1/schema/`, `/core/v1/schema/swagger-ui/`, `/core/v1/schema/redoc/` vào `TENANT_EXEMPT_PATHS` trong `identity_access/middleware.py` | BE-1 | 0.5h | Swagger UI load được ở `/core/v1/schema/swagger-ui/` mà không cần tenant header, không trừ quota |
| **P0-2** | **Cài đặt `drf-spectacular-sidecar`**: Thêm vào `requirements.txt`, config `SPECTACULAR_SETTINGS['SWAGGER_UI_DIST'] = 'SIDECAR'` trong `settings.py` | BE-1 | 0.5h | Swagger UI hoạt động offline (không load CDN), không lỗi CSP |
| **P0-3** | **Tạo branch strategy**: `compliance/openapi-20260513` (BE), `test/routing-sync-core-v1` (QA), `feat/fe-error-envelope-sync` (FE) | TL | 0.5h | 3 branch sẵn sàng, CI/CD config cho từng branch |
| **P0-4** | **Sync FE Team**: Gửi payload mẫu Error Envelope mới + Cursor Pagination meta cho FE cập nhật `api/client.js` interceptor + **FE Pagination Component Migration Plan** (Infinite Scroll / Load More) | TL + FE | 1h | FE confirm format mới, tạo branch `feat/fe-error-envelope-sync`, commit plan migration Pagination UI |

> **Deliverable Phase 0**: Swagger UI accessible offline, branch strategy ready, FE aligned.

---

## 🌿 NHÁNH 1: COMPLIANCE REMEDIATION (Backend Core)
*Branch: `compliance/openapi-20260513` | Owner: BE-1, BE-2 | Duration: 6 ngày*

### Sprint 1.1: Error Envelope Standardization (Ngày 1-2)
**Mục tiêu**: Tất cả error response tuân thủ `{detail, code, timestamp, request_id, meta?}`

| Task ID | File/Module | Action | Effort | Notes |
|---------|-------------|--------|--------|-------|
| **C1-1** | `core/exceptions.py` (tạo mới nếu chưa có) | Định nghĩa `APIException` base class + `ValidationErrorException`, `NotFoundErrorException`, `PermissionDeniedException`, `QuotaExceededException` kế thừa từ `APIException` + `rest_framework.exceptions.APIException` | 2h | `detail` có thể là `str` hoặc `dict`; `code` = error code string (VD: `VALIDATION_ERROR`, `NOT_FOUND`); tự động inject `timestamp` (ISO8601), `request_id` (UUID từ request header `X-Request-ID` hoặc generate mới) |
| **C1-2** | `core/exception_handler.py` (tạo mới) | Custom `custom_exception_handler(exc, context)`: wrap DRF exceptions → format chuẩn, log structured (JSON) với `request_id` | 2h | Register trong `settings.py`: `REST_FRAMEWORK['EXCEPTION_HANDLER'] = 'core.exception_handler.custom_exception_handler'` |
| **C1-3** | **Audit & Refactor**: `advisory/views.py`, `workspace/views.py`, `auth/views.py`, `commercial/views.py` | Tìm tất cả `return Response({'ok': False...}, status=...)` → thay bằng `raise ValidationErrorException(detail=..., code=...)` hoặc exception tương ứng | 8h | **Grep pattern**: `return Response.*ok.*False` \| `return Response.*error.*True` \| `Response.*status=4` \| `Response.*status=5`. Ưu tiên endpoint public/external trước. |
| **C1-4** | `core/middleware.py` | Đảm bảo `X-Request-ID` được generate/set cho mọi request (nếu client không gửi) để exception handler có `request_id` | 1h | Middleware chạy trước TenantMiddleware |
| **C1-5** | `core/middleware.py` + `signals.py` | **Redis Cache Tenant Status**: Cache `tenant.status` (TTL 60s) trong `TenantResolutionMiddleware`. Tạo Django Signal `tenant_status_changed` → invalidate Redis cache ngay khi admin khóa/mở tenant. | 2h | Tránh query DB mỗi request. Signal emit từ `TenantAdminViewSet.update()` hoặc Admin action. |

**Acceptance Criteria Sprint 1.1**:
- Tất cả 4xx/5xx response có format: `{"detail": "...", "code": "...", "timestamp": "2026-06-16T...", "request_id": "uuid", "meta": {...}}`
- Không còn `return Response({'ok': False...})` nào trong codebase (grep = 0).
- Unit test cho `custom_exception_handler` cover: ValidationError, PermissionDenied, NotFound, generic Exception.
- **Tenant Status Cache**: Middleware đọc `tenant.status` từ Redis (TTL 60s), invalidation < 1s sau khi admin thay đổi status.

---

### Sprint 1.2: Cursor Pagination Migration (Ngày 3-4)
**Mục tiêu**: Thay thế `PageNumberPagination` & manual slice bằng `CoreCursorPagination`

| Task ID | File/Module | Action | Effort | Notes |
|---------|-------------|--------|--------|-------|
| **C2-1** | `core/pagination.py` (review/tạo) | Đảm bảo `CoreCursorPagination` kế thừa `CursorPagination` (DRF), config: `page_size = 50`, `ordering = '-created_at'`, `cursor_query_param = 'cursor'` | 1h | Kiểm tra đã hỗ trợ `next`, `previous`, `results` format chuẩn. |
| **C2-2** | **Audit endpoints**: `market/`, `signal/`, `audit/`, `tenant/members/`, `workspace/` | Tìm `pagination_class = StandardPageNumberPagination` hoặc `qs[offset:offset+limit]` | 2h | Grep: `PageNumberPagination` \| `offset` \| `limit` \| `slice` |
| **C2-3** | Refactor từng ViewSet/ListAPIView | Thay `pagination_class = CoreCursorPagination`, xóa manual slice, đảm bảo queryset có `ordering` deterministic (PK hoặc `created_at` + `id`) | 8h | **Lưu ý**: Cursor pagination yêu cầu ordering unique. Nếu model không có `created_at`, dùng `-id`. |
| **C2-4** | Update OpenAPI schema cho pagination | Thêm `@extend_schema` với `parameters=[OpenApiParameter('cursor', ...), OpenApiParameter('page_size', ...)]` và response `CursorPaginationSerializer` | 3h | Tạo `CursorPaginationSerializer` trong `core/serializers.py` |
| **C2-5** | **FE Sync**: `packages/web/src/components/common/Pagination*` | FE Team refactor Pagination Components: bỏ số trang (Page Numbers) → **Infinite Scroll** hoặc nút **Load More** (`next` cursor). Cập nhật `useQuery`/`useInfiniteQuery` (React Query) hoặc `swr` config. | 4h (FE) | **Breaking UI Change**: Không còn `count`, `total_pages`. Chỉ có `next` cursor. FE phải deploy cùng lúc với BE (Atomic Merge). |

**Acceptance Criteria Sprint 1.2**:
- Tất cả list endpoints trả về: `{"next": "url|cursor", "previous": "url|cursor", "results": [...]}`
- Không còn `page`, `page_size` trong request params (trừ `page_size` optional).
- Performance test: 10k records → cursor query < 50ms (vs offset > 200ms).
- **FE Pagination Migration**: 100% components dùng Infinite Scroll / Load More, không còn UI "Trang 1 của N".

---

### Sprint 1.3: OpenAPI Schema Coverage (Ngày 5-6)
**Mục tiêu**: 100% public endpoints có `@extend_schema` đầy đủ

| Task ID | Module | Endpoints Ưu tiên | Effort | Notes |
|---------|--------|-------------------|--------|-------|
| **C3-1** | `advisory/views.py` | `AdvisoryViewSet`, `ReportViewSet` | 3h | Request/Response serializers, examples, error responses (400, 401, 403, 429) |
| **C3-2** | `workspace/views.py` | `WorkspaceViewSet`, `ProjectViewSet` | 3h | |
| **C3-3** | `auth/views.py` | `LoginView`, `RegisterView`, `TokenRefreshView`, `SSOCallbackView` | 2h | |
| **C3-4** | `commercial/views.py` | `BillingViewSet`, `SubscriptionViewSet`, `InvoiceViewSet` | 3h | |
| **C3-5** | `identity_access/views/sso.py` | `SSOConfigView`, `SSOLoginView` | 2h | Phase 3 SSO endpoints |
| **C3-6** | Global | Chạy `python manage.py spectacular --validate` → fix tất cả warnings | 2h | |

**Acceptance Criteria Sprint 1.3**:
- `spectacular --validate` exit code 0, 0 warnings.
- Swagger UI hiển thị đầy đủ: params, request body, response codes, examples.
- Schema download được tại `/core/v1/schema/` (JSON/YAML).

---

## 🌿 NHÁNH 2: TEST SUITE ALIGNMENT (QA/Dev)
*Branch: `test/routing-sync-core-v1` | Owner: QA + BE-1 (support) | Duration: 5 ngày*

### Sprint 2.1: URL Routing Migration (Ngày 1-2)
| Task ID | Action | Tool/Script | Effort | Target Files |
|---------|--------|-------------|--------|--------------|
| **T1-1** | **Chạy script migration có sẵn** | `python scripts/migrate_test_urls.py --dry-run` → `--apply --backup` | 1h | Script: `scripts/migrate_test_urls.py` (Regex-based, multi-pattern, dry-run support) |
| **T1-2** | Review thủ công + fix dynamic URLs | Manual review các file changed | 2h | `test_session_facts_api.py`, `test_stock_management_api_routes.py`, `test_tenant_member_views.py`, `test_*.py` |
| **T1-3** | Cập nhật `pytest fixtures` (`conftest.py`) | Manual | 2h | `api_client`, `authenticated_client` → set default prefix `/core/v1/` |
| **T1-4** | Fix hardcoded URL trong test helpers/utils | Manual | 2h | `test_utils.py`, `api_helpers.py` |

---

### Sprint 2.2: Assertion & Response Format Alignment (Ngày 3-4)
| Task ID | Action | Effort | Notes |
|---------|--------|--------|-------|
| **T2-1** | Cập nhật assert error response: `assert response.data['detail'] == ...`, `assert 'code' in response.data`, `assert 'request_id' in response.data` | 4h | Thay thế `assert response.data['ok'] == False` |
| **T2-2** | Cập nhật assert pagination: `assert 'next' in response.data`, `assert 'results' in response.data`, `assert 'page' not in response.data` | 3h | |
| **T2-3** | Cập nhật test data/factories cho tenant context | 2h | Đảm bảo `tenant_id` resolve đúng qua middleware |
| **T2-4** | Chạy test suite lặp lại cho đến khi GREEN | 4h | `pytest -x --tb=short` |

---

### Sprint 2.3: Regression & Coverage (Ngày 5)
| Task ID | Action | Effort |
|---------|--------|--------|
| **T3-1** | Chạy full test suite: `pytest packages/core/backend/tests/ -v` | 2h |
| **T3-2** | Coverage report: `pytest --cov=src --cov-report=html` | 1h |
| **T3-3** | So sánh baseline: 282 tests, 0 failures, coverage ≥ 80% | 1h |

---

## 🔗 DEPENDENCY MANAGEMENT & MERGE STRATEGY

### Atomic Merge Strategy (Monorepo Optimized)
**Không dùng Feature Flag runtime**. 3 nhánh phát triển độc lập, verify trên Staging, sau đó **merge cùng lúc (atomic)** vào `main` qua 3 PRs đồng thời.

```mermaid
gitGraph
    commit id="main"
    branch compliance/openapi-20260513
    branch test/routing-sync-core-v1
    branch feat/fe-error-envelope-sync
    
    checkout compliance/openapi-20260513
    commit id="C1: Error Envelope"
    commit id="C2: Cursor Pagination"
    commit id="C3: OpenAPI Schema"
    tag "compliance-ready"
    
    checkout feat/fe-error-envelope-sync
    commit id="FE: Error Interceptor + Pagination UI Migration"
    tag "fe-ready"
    
    checkout test/routing-sync-core-v1
    merge compliance/openapi-20260513 tag="test-base-compliance"
    commit id="T1: URL Migration (script)"
    commit id="T2: Assertion Sync"
    commit id="T3: Full Suite GREEN"
    tag "tests-green"
    
    checkout main
    merge compliance/openapi-20260513
    merge feat/fe-error-envelope-sync
    merge test/routing-sync-core-v1
    tag "v2.6.0-compliance"
```

**Merge Process (Atomic)**:
1. Tạo 3 PRs cùng lúc: `#PR-Compliance`, `#PR-FE-Sync`, `#PR-Test-Sync`
2. Tất cả 3 PRs pass CI/CD trên Staging environment
3. **Merge 3 PRs trong vòng 5 phút** (squash merge) → `main` nhận tất cả changes cùng lúc
4. Deploy `main` → Production (zero-downtime nếu FE/BE compatible)

---

## 📊 TRACKING & REPORTING

| Metric | Baseline | Target | Tracking Tool |
|--------|----------|--------|---------------|
| Test Pass Rate | 60.6% (171/282) | 100% (282/282) | GitHub Actions / GitLab CI |
| OpenAPI Validation | Fail (warnings) | Pass (0 warnings) | `spectacular --validate` |
| Swagger UI Access | 403 Forbidden | 200 OK (offline) | Manual + E2E test |
| Error Envelope Compliance | ~40% endpoints | 100% endpoints | Grep audit script |
| Cursor Pagination Adoption | ~20% list endpoints | 100% list endpoints | Grep audit script |
| FE Integration Errors | N/A | 0 console errors | FE staging + Sentry |
| **FE Pagination Component Migration** | 0% (Page Numbers) | 100% (Infinite Scroll / Load More) | FE Storybook / Visual Regression |
| **Tenant Status Cache Hit Rate** | 0% (DB every request) | > 95% (Redis) | Redis INFO / Prometheus |

**Daily Standup Sync (15 phút)**:
- BE-1: Compliance progress (C1/C2/C3)
- BE-2: Compliance support + Test fixture fix
- QA: Test migration progress (T1/T2/T3)
- TL: Blocker removal, FE sync, Merge decision

---

## 🚨 RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Breaking FE mobile/3rd party** | High | Critical | **Atomic Merge**: FE & BE deploy cùng lúc. Không dùng Feature Flag. Rollback = revert 3 PRs trên `main`. |
| **Cursor pagination breaks existing FE pagination UI** | High | High | **C2-5**: FE migrate sang Infinite Scroll / Load More **trước** khi merge. Test trên Staging với BE compliance branch. |
| **Test migration misses dynamic URL construction** | Medium | Medium | Script `migrate_test_urls.py` có dry-run + backup. Review thủ công 100% file changed. Grep `reverse(` sau migration. |
| **`drf-spectacular-sidecar` version conflict** | Low | Medium | Pin version trong `requirements.txt`, test `pip install` trong CI. |
| **Tenant middleware blocks schema endpoints sau merge** | Low | Critical | Integration test trong CI: `GET /core/v1/schema/swagger-ui/` không cần auth header. |
| **Tenant Status Cache Stale** | Medium | High | **C1-5**: Signal `tenant_status_changed` invalidate Redis ngay lập tức. TTL 60s làm safety net. |

---

## ✅ DEFINITION OF DONE (DoD) - PROJECT LEVEL

1. [ ] **Compliance Branch**: `pytest packages/core/backend/tests/` pass trên branch `compliance/openapi-20260513` (với test chưa migrate URL - expected 404).
2. [ ] **Test Branch**: `pytest packages/core/backend/tests/` **282 passed, 0 failed** trên branch `test/routing-sync-core-v1` (rebased trên compliance).
3. [ ] **FE Staging**: Zero console errors liên quan đến API response format, pagination, SSO flow. **Pagination UI = Infinite Scroll / Load More**.
4. [ ] **Swagger UI**: Accessible tại `/core/v1/schema/swagger-ui/` offline, hiển thị đầy đủ 4 module (Advisory, Workspace, Auth, Commercial).
5. [ ] **Tenant Status Cache**: Middleware đọc Redis (hit rate > 95%), invalidation < 1s via Signal.
6. [ ] **Documentation**: `CHANGELOG.md` ghi nhận breaking changes, migration guide cho FE/3rd party.
7. [ ] **Atomic Merge to Main**: 3 PRs merged cùng lúc, CI/CD green, tag `v2.6.0-compliance` created.

---

## 🛠️ SCRIPTS & TOOLS CẦN CHUẨN BỊ (Pre-work)

1. **`scripts/audit_error_envelope.py`**: Scan codebase tìm non-compliant error returns.
2. **`scripts/audit_pagination.py`**: Scan tìm `PageNumberPagination` / manual slice.
3. **`scripts/migrate_test_urls.py`**: ✅ **ĐÃ TẠO** - Regex-based URL migration cho test suite (multi-pattern, dry-run, backup).
4. **`scripts/validate_openapi.py`**: Wrapper `spectacular --validate` + custom rules (bắt buộc `@extend_schema` cho public views).
5. **`scripts/audit_tenant_cache.py`** (mới): Verify Redis cache hit/miss cho tenant status, simulate signal invalidation.

---

*Tài liệu được tạo tự động từ phân tích baseline test report. Cập nhật lần cuối: 2026-06-16*  
*Đã áp dụng 4 tối ưu hóa từ Code Review: Atomic Merge, FE Infinite Scroll Migration, Script Migration Ready, Redis Tenant Cache.*