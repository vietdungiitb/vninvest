# ENTERPRISE CORE ADMIN IMPLEMENTATION TASKBOARD

**Date:** 2026-05-02  
**Status:** Execution-facing current-code taskboard for admin documentation and code follow-up  
**Purpose:** Biến `admin architecture + RBAC matrix + screen spec + contracts` thành chuỗi slice frontend/backend đủ nhỏ để triển khai dần mà vẫn giữ contract-first và schema-last.

---

## 1. Vai trò của tài liệu này

Tài liệu này đứng sau:

- [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](./ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)
- [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](./ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)
- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](./ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)

Nó không thay thế screen spec hay contract doc. Nó chốt `nên build theo slice nào trước`, `đụng file nào`, và `definition of done của mỗi slice là gì`.

---

## 2. Execution rules

1. Capability bootstrap đi trước route rewrite.
2. Read-only operator screens đi trước write actions.
3. Các slice operator còn lại đi trước việc mở rộng tenant console mới; tenant self-service đang chạy thật không cần quay lại thiết kế từ đầu.
4. Mỗi slice phải có frontend anchor, backend anchor, contract dependency và focused validation.
5. Không mở write actions operator nếu read routes cùng screen chưa ổn định.

## 2.1 Current execution snapshot

| Slice ID | Trạng thái hiện tại | Current-code note |
|---|---|---|
| `CA-00` | Completed | `/api/core/v1/access/capabilities/` da co current-code wrapper route; frontend auth/bootstrap da cutover sang wrapper route, shared access service van con la wrapper/bridge layer |
| `CA-01` | Completed | `/admin/core/*` da co route group va guards; canonical overview/crawl-control surface reuse current admin ops pages, legacy aliases `/admin-ops` và `/admin-crawl-control` vẫn còn live |
| `CA-02` | Completed | `/admin/core/overview` da co page dedicated, bam current-code operator overview/health wrappers va summary/health cards |
| `CA-03` | Completed | `/admin/core/tenants` va `/admin/core/tenants/:tenantId` da co page dedicated, list/detail/snapshot render từ current-code operator wrappers |
| `CA-04` | Completed | `/admin/core/tenants/:tenantId/service-accounts` da co page dedicated, summary cards, registry table, detail panel va gating cho create/edit buttons |
| `CA-05` | Completed | `/admin/core/tenants/:tenantId/pats` da co page dedicated, summary cards, registry table, detail panel va gating cho issue/rotate/revoke buttons |
| `CA-06` | Completed | `/admin/core/tenants/:tenantId/usage` va `/admin/core/tenants/:tenantId/billing` da co page dedicated, summary cards, meter/context panels va drill-down links |
| `CA-07` | Not started | chưa có operator jobs/audit screens theo contract mới |
| `CA-08` | Completed | backend wrapper `GET /api/core/v1/operator/ai-runtime/` và read surface liên quan đã có |
| `CA-09` | Completed | tenant home + capabilities live trên `/tenant-admin/*` |
| `CA-10` | Completed | tenant service account + PAT self-service live end-to-end |
| `CA-11` | Completed | tenant usage + billing self-service live end-to-end |
| `CA-12` | Completed | `manage all` đã bị loại khỏi live auth/me và route guards |

---

## 3. Current repo anchors

### Frontend anchors

- `frontend/src/App.jsx`
- `frontend/src/components/TopNav.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/Can.jsx`
- `frontend/src/context/PortfolioContext.jsx`
- `frontend/src/context/AbilityContext.js`

### Backend anchors

- `backend/config/urls.py`
- `backend/portfolio/urls.py`
- `backend/portfolio/opencore_api.py`
- `backend/portfolio/views_admin_runtime.py`
- `backend/portfolio/views_ai_runtime_stats.py`
- `backend/portfolio/ai_runtime_config.py`

### Future implementation shape

- `frontend/src/pages/admin/core/...`
- `frontend/src/pages/admin/tenant/...`
- `backend/portfolio/views_core_operator_*.py`
- `backend/portfolio/views_core_access.py`

---

## 4. Slice taskboard

| Slice ID | Priority | Scope | Frontend anchors | Backend anchors | Contract dependencies | Exit criteria |
|---|---|---|---|---|---|---|
| `CA-00` | P0 | capability bootstrap | `PortfolioContext`, `AbilityContext`, `ProtectedRoute`, `TopNav` | `config/urls.py`, future `views_core_access.py` | capability payload contract | app đọc được `capability_snapshot`; admin nav không còn phụ thuộc cứng vào `manage all` |
| `CA-01` | P0 | admin shell + route groups | `App.jsx`, `TopNav.jsx`, future `pages/admin/*` | route registration only | admin UI architecture, RBAC matrix | route groups `/admin/core/*` và `/tenant-admin/*` tồn tại với guards đúng |
| `CA-02` | P0 | platform overview + runtime health | future `CoreOverview.jsx`, `CoreRuntimeHealth.jsx` | future `views_core_operator_overview.py`, `views_admin_runtime.py` | operator detailed contracts | screen render được summary cards/health cards từ P0 read routes |
| `CA-03` | P0 | tenant registry + tenant detail | `CoreTenants.jsx`, `CoreTenantDetail.jsx` | future `views_core_operator_tenants.py` | operator detailed contracts | table + detail summary render đúng filters/status badges |
| `CA-04` | P1 | service accounts | `AdminCoreServiceAccounts.jsx` | `views_admin_runtime.py` + `/api/core/v1/operator/tenants/{tenant_id}/service-accounts/` | operator detailed contracts, RBAC matrix | read list hoạt động; create/edit buttons gate đúng ability |
| `CA-05` | P1 | PAT credentials | `AdminCorePATs.jsx` | `views_admin_runtime.py` + `/api/core/v1/operator/tenants/{tenant_id}/pats/` | operator detailed contracts, capability payload | read list hoạt động; issue/rotate/revoke ở trạng thái gated, chưa cần fully wired nếu write APIs chưa xong |
| `CA-06` | P1 | usage, quotas, billing | `AdminCoreUsage.jsx`, `AdminCoreBilling.jsx` | `views_admin_runtime.py` snapshot reuse + current commercial projections | operator detailed contracts, contract pack | commercial panels render bằng read projections rõ ràng |
| `CA-07` | P1 | jobs + audit trace | `CoreJobs.jsx`, `CoreAuditTrace.jsx` | future `views_core_operator_jobs.py`, future `views_core_operator_audit.py` | operator detailed contracts | jobs table, audit search, detail drawer hoạt động read-only |
| `CA-08` | P1 | AI runtime governance read path | `CoreAIRuntime.jsx` | `views_ai_runtime_stats.py`, `ai_runtime_config.py`, future operator wrapper view | operator detailed contracts | provider/model readiness + rollout state render được |
| `CA-09` | P2 | tenant admin home + capabilities | `TenantAdminHome.jsx`, `TenantCapabilities.jsx` | future partner/access views | capability payload contract, partner contract draft | tenant console bootstrap hoàn chỉnh |
| `CA-10` | P2 | tenant service accounts + PATs | `TenantServiceAccounts.jsx`, `TenantPATs.jsx` | partner control-plane views | partner contract draft, capability payload contract | tenant self-service machine access flow read/write theo scope |
| `CA-11` | P2 | tenant usage + billing | `TenantUsage.jsx`, `TenantBilling.jsx` | partner commercial views | partner contract draft | tenant commercial self-service read path hoàn chỉnh |
| `CA-12` | P2 | remove legacy bridge + tighten tests | auth contexts + admin pages | capability bootstrap + permission enforcement tests | RBAC matrix, capability payload contract | `manage all` không còn là gating semantics chính |

---

## 5. Slice details

## 5.1 `CA-00` Capability bootstrap

### Frontend tasks

1. Thêm capability snapshot vào auth/bootstrap state.
2. Compile CASL rules từ `abilities` thay vì suy luận từ broad admin flags.
3. Dùng `surfaces` và `navigation.default_route` để điều hướng admin shell.

### Backend tasks

1. Tạo read route `GET /core/v1/access/capabilities`.
2. Gom role/scope resolution vào một access service mỏng, không hard-code trong view UI.
3. Giữ bridge `manage all` có kiểm soát nếu chưa migrate hết.

### Focused validation

- human operator session nhận `central_operator.enabled=true`.
- tenant admin session nhận `central_operator.enabled=false`.
- frontend ẩn đúng nav items khi thiếu ability.

### Ghi chu trien khai 2026-05-02bm

- `backend/portfolio/auth_views.py` da them `CapabilitySnapshotView` va helper adapter `capability_snapshot` tu `resolve_user_entitlements(...)` hien co.
- `backend/config/urls.py` da mo route `GET /api/core/v1/access/capabilities/` nhu current-code wrapper route, khong phu thuoc vao wildcard `manage all`.
- `backend/portfolio/tests/test_api_routes_auth_profile.py` da cover ca tenant bootstrap va operator bootstrap cho route moi.
- `frontend/src/context/PortfolioContext.jsx`, `frontend/src/components/TopNav.jsx` va `frontend/src/components/Sidebar.jsx` da cutover sang doc wrapper route va surface/menu hints.
- `CA-00` da chuyen sang `Completed`; `CA-01` da chuyen sang `Completed` sau khi them route group `/admin/core/*` va guard cho overview/crawl-control surface, trong khi legacy aliases van duoc giu de compat.

### Ghi chu trien khai 2026-05-03ak

- `frontend/src/App.jsx` da them route group `/admin/core/*` voi index redirect, overview va crawl-control route.
- `frontend/src/pages/AdminOps.jsx` da chuyen surface chuyên trách sang `/admin/core/crawl-control` trong khi legacy `/admin-crawl-control` van con live.
- `frontend/src/App.adminCoreRoutes.test.jsx` da khoa route group, guard va redirect behavior cho `/admin/core/*`.
- `CA-01` da chuyen sang `Completed`; `CA-02` van la slice tiep theo tren board nay.

### Ghi chu trien khai 2026-05-03al

- `frontend/src/pages/AdminCoreOverview.jsx` da render summary cards va runtime health cards tu `/api/core/v1/operator/overview/` va `/api/core/v1/operator/health/`.
- `frontend/src/App.adminCoreRoutes.test.jsx` da cap nhat route group de `/admin/core/overview` render page dedicated moi.
- `frontend/src/pages/AdminCoreOverview.test.jsx` da khoa async render, overview snapshots va crawl-control link.
- `CA-02` da chuyen sang `Completed`; `CA-03` la slice admin tiep theo tren board nay.

### Ghi chu trien khai 2026-05-03am

- `frontend/src/pages/AdminCoreTenants.jsx` da render registry list, filters va detail panel cho `/admin/core/tenants` va `/admin/core/tenants/:tenantId`.
- `frontend/src/App.adminCoreRoutes.test.jsx` da khoa route group de tenant list/detail routes render page dedicated moi.
- `frontend/src/pages/AdminCoreTenants.test.jsx` da cover list row, detail panel va tenant action timeline.
- `CA-03` da chuyen sang `Completed`; `CA-04` va `CA-05` da chuyen sang `Completed` va `CA-06` la slice admin tiep theo tren board nay.

### Ghi chu trien khai 2026-05-03an

- `frontend/src/api/client.js` da co `getCoreOperatorTenantServiceAccounts(...)` wrapper cho operator tenant service-account projection.
- `frontend/src/pages/AdminCoreServiceAccounts.jsx` da render registry service account, summary cards, detail panel va ability-gated create/edit buttons cho `/admin/core/tenants/:tenantId/service-accounts`.
- `frontend/src/pages/AdminCoreServiceAccounts.test.jsx` da cover list/detail render va gating cho create/edit buttons.
- `frontend/src/pages/AdminCoreTenants.jsx` va `frontend/src/pages/AdminCoreTenants.test.jsx` da them link va coverage tu tenant detail sang service-account route.
- `frontend/src/App.jsx` va `frontend/src/App.adminCoreRoutes.test.jsx` da mo route group cho service-account surface moi.
- `CA-04` va `CA-05` da chuyen sang `Completed`; `CA-06` la slice admin tiep theo tren board nay.

### Ghi chu trien khai 2026-05-03ao

- `frontend/src/api/client.js` da co `getCoreOperatorTenantPATs(...)` wrapper cho operator PAT projection.
- `frontend/src/pages/AdminCorePATs.jsx` da render sổ đăng ký PAT, filters, summary cards, detail panel va ability-gated issue/rotate/revoke buttons cho `/admin/core/tenants/:tenantId/pats`.
- `frontend/src/pages/AdminCorePATs.test.jsx` da cover list/detail render va gating cho issue/rotate/revoke buttons.
- `frontend/src/pages/AdminCoreTenants.jsx` va `frontend/src/pages/AdminCoreTenants.test.jsx` da them PAT drill-down link va coverage tu tenant detail.
- `frontend/src/App.jsx` va `frontend/src/App.adminCoreRoutes.test.jsx` da mo route group cho PAT surface moi.
- `CA-05` da chuyen sang `Completed`; `CA-06` da chuyen sang `Completed` va `CA-07` la slice admin tiep theo tren board nay.

### Ghi chu trien khai 2026-05-03ap

- `frontend/src/pages/AdminCoreUsage.jsx` da render meter list, quota summary va meter detail tu current-code tenant snapshot.
- `frontend/src/pages/AdminCoreBilling.jsx` da render subscription summary, billing metrics va usage context tu current-code tenant snapshot.
- `frontend/src/pages/AdminCoreUsage.test.jsx` va `frontend/src/pages/AdminCoreBilling.test.jsx` da cover list/detail render cho ca hai surface.
- `frontend/src/pages/AdminCoreTenants.jsx` va `frontend/src/pages/AdminCoreTenants.test.jsx` da them drill-down links sang usage/billing routes.
- `frontend/src/App.jsx` va `frontend/src/App.adminCoreRoutes.test.jsx` da mo route group cho usage/billing surfaces moi.
- `CA-06` da chuyen sang `Completed`; `CA-07` la slice admin tiep theo tren board nay.

---

## 5.2 `CA-01` Admin shell + route groups

### Frontend tasks

1. Tạo route groups `/admin/core/*` và `/tenant-admin/*`.
2. Tạo shell layout chung cho header, context bar, feedback region.
3. Wire `TopNav` sang admin menus granular.

### Backend tasks

1. Không cần route business mới ngoài capability bootstrap.
2. Chuẩn hóa route registry để operator/tenant namespaces rõ ràng cho phase sau.

### Focused validation

- route guards hoạt động bằng ability/surface data,
- default route điều hướng đúng theo session type.

---

## 5.3 `CA-02` Platform overview + runtime health

### Frontend tasks

1. Dựng cards overview, health strip, stale/degraded banners.
2. Render partial widget failures mà không crash toàn page.

### Backend tasks

1. Tạo operator overview wrapper read model.
2. Reuse runtime health primitives hiện có thay vì dựng logic song song.

### Focused validation

- `GET /core/v1/operator/overview`
- `GET /core/v1/operator/health`

---

## 5.4 `CA-03` Tenant registry + detail

### Frontend tasks

1. Tạo tenant table có filters/search.
2. Tạo detail summary page với security/commercial cards.
3. Add row actions nhưng gate bằng ability trước, write wiring có thể đi sau.

### Backend tasks

1. Tạo tenant list projection cho operator.
2. Tạo tenant detail summary projection.

### Focused validation

- filters `status`, `plan_code`, `search` trả kết quả đúng,
- detail page không cần gọi song song quá nhiều endpoints để dựng summary ban đầu.

---

## 5.5 `CA-04` Service accounts

### Frontend tasks

1. Table + drawer + detail side panel.
2. Disabled states cho create/edit khi thiếu ability.

### Backend tasks

1. Tạo read route operator service accounts.
2. Chuẩn bị contract boundary cho write APIs, kể cả khi chưa implement.

### Focused validation

- operator list trả đủ operator extension fields,
- PAT secret không lộ ở read list.

---

## 5.6 `CA-05` PAT credentials

### Frontend tasks

1. Table + issue/rotate/revoke modal states.
2. One-time secret reveal flow chỉ mở khi write APIs đã sẵn.

### Backend tasks

1. Tạo read route PAT list trước.
2. Đóng shape cho anomaly/grace window projections.

### Focused validation

- list không chứa secret,
- button gating khớp `issue/rotate/revoke` abilities.

---

## 5.7 `CA-06` Usage, quotas, billing

### Frontend tasks

1. Meter table + summary cards.
2. Subscription/invoice panels.
3. Risk badges và stale states cho commercial data.

### Backend tasks

1. Tạo commercial operator projections.
2. Tái dùng được các primitive OpenCore hiện có nếu semantics phù hợp, nhưng không expose raw legacy shapes thẳng ra contract mới.

### Focused validation

- usage/quota và billing không drift field names với contract pack,
- invoice ordering ổn định `issue_date desc`.

---

## 5.8 `CA-07` Jobs + audit trace

### Frontend tasks

1. Jobs table + detail drawer.
2. Audit search + audit detail side panel.

### Backend tasks

1. Tạo service run listing contract.
2. Tạo sanitized audit trace detail route.

### Focused validation

- audit detail không lộ raw sensitive payload,
- jobs page render được queued/running/failed states rõ ràng.

---

## 5.9 `CA-08` AI runtime governance

### Frontend tasks

1. Provider/model readiness grid.
2. Rollout/policy summary panel.

### Backend tasks

1. Bọc các runtime config primitives hiện có thành operator-facing contract ổn định.
2. Không reuse thẳng legacy user-facing AI config shape nếu semantics khác.

### Focused validation

- read route trả effective provider/model/source rõ ràng,
- operator role không có write ability thì editor ở trạng thái read-only.

### Ghi chú triển khai 2026-05-02bc

- `frontend/src/pages/AICommandCenter.jsx` đã surfacing khung đọc nhanh runtime với provider/model/source/readiness grid và policy summary panel, bám vào các field hiệu lực sẵn có từ `/api/portfolio/ai-command-center/`.
- Không cần thêm backend contract mới cho slice này vì endpoint hiện tại đã trả `effective_ai_provider`, `effective_ai_model`, `effective_ai_source`, `ai_ready` và các policy fields cần cho operator surface.
- Slice backend wrapper/operator route con vẫn còn open theo taskboard gốc; đây là bước frontend gần code nhất để kéo contract ra UI thật.

### Ghi chú triển khai 2026-05-02bd

- `backend/portfolio/views_admin_runtime.py` đã expose `operator_ai_runtime_api` cho `GET /api/core/v1/operator/ai-runtime/`.
- `backend/config/urls.py` đã route contract đó và `backend/portfolio/tests/test_system_ai_admin_api.py` đã cover snapshot shape + admin gate.
- Response hiện trả `object`, `provider_rows`, `effective_policy_bundle`, `rollout_state` đúng theo operator contract; CA-08 backend wrapper slice coi như đã khép.

---

## 5.10 `CA-09` đến `CA-11` Tenant Admin Console

Ba slice này chỉ nên bắt đầu khi `CA-00` hoàn tất và partner control/commercial routes đã freeze đủ:

1. `CA-09`: tenant home + capabilities. Live frontend bootstrap đã hoàn tất với namespace `/tenant-admin/*` để tránh trùng Django admin `/admin/*`.
2. `CA-10`: tenant service accounts + PATs. Live self-service machine access flow đã chạy end-to-end trên tenant console thật.
3. `CA-11`: tenant usage + billing. Live commercial self-service read path đã hoàn tất và đã có browser proof.

### Key rule

Tenant console không được thiết kế như bản copy của operator console. Nó là self-service surface, nên payload, menu, actions và error messages phải tenant-scoped.

### Ghi chú triển khai 2026-05-02be

- `frontend/src/context/PortfolioContext.jsx` giờ expose `userEntitlements` từ `/api/auth/me/` để tenant pages đọc quota và trial state trực tiếp.
- `backend/portfolio/permissions.py` thêm tenant read abilities cho session `pro+` để tenant console đi qua guard mà không cần contract mới.
- `frontend/src/pages/admin/tenant/TenantAdminHome.jsx` và `TenantCapabilities.jsx` render live tenant console từ entitlements hiện có.
- `frontend/src/App.jsx`, `frontend/src/components/TopNav.jsx` và `frontend/src/components/Sidebar.jsx` đã wire route groups `/tenant-admin/*` vào UI thật.
- Khi ghi chú này được viết, `CA-10` va `CA-11` van open; trang thai hien tai da duoc cap nhat boi ghi chu 2026-05-02bf va 2026-05-02bg ben duoi.

### Ghi chú triển khai 2026-05-02bf

- `backend/portfolio/models.py` đã thêm `CoreServiceAccount` và `CorePATCredential` để tenant console có machine identity primitives thật, tách rõ service account và PAT lifecycle.
- `backend/portfolio/views_partner_admin.py` đã mở các partner routes `GET/POST /api/core/v1/partner/service-accounts/`, `GET /api/core/v1/partner/pats/`, `POST /issue`, `POST /rotate`, `POST /revoke` với standard list envelope, `Idempotency-Key` cho write actions và one-time secret reveal.
- `backend/config/urls.py`, `backend/portfolio/permissions.py`, `backend/portfolio/tests/test_partner_admin_api.py` và `backend/portfolio/tests/test_api_routes_auth_profile.py` đã wire route registry, entitlement gating và focused backend coverage cho CA-10.
- `frontend/src/api/client.js`, `frontend/src/App.jsx`, `frontend/src/components/TopNav.jsx`, `frontend/src/components/Sidebar.jsx`, `frontend/src/pages/admin/tenant/TenantAdminHome.jsx`, `frontend/src/pages/admin/tenant/TenantServiceAccounts.jsx`, `frontend/src/pages/admin/tenant/TenantPATs.jsx`, `frontend/src/i18n/vi.js`, `frontend/src/i18n/en.js` đã đưa flow service account/PAT vào tenant console thật.
- Ownership seam hiện tại vẫn là `request.user` như tenant owner surrogate; chưa có tenant graph độc lập. Điều này đủ cho self-service slice nhỏ, nhưng cần thay bằng tenant registry canonical khi mở CA-11+.
- Migration `backend/portfolio/migrations/0066_userconfig_ai_prompt_config_and_more.py` đã được làm idempotent cho field `UserConfig.ai_prompt_config` để đi qua live DB drift trước khi bring-up CA-10 runtime.
- Browser proof với `testpro` đã xác nhận create service account, issue PAT, rotate PAT và revoke PAT thành công trên `/tenant-admin/service-accounts` và `/tenant-admin/pats`.
- `CA-10` coi như đã khép ở mức implementation + live proof; trang thai `CA-11` duoc cap nhat boi ghi chu 2026-05-02bg ben duoi.

### Ghi chú triển khai 2026-05-02bg

- `backend/portfolio/partner_tenant_context.py` da tach ownership resolution thanh `PartnerTenantContext` de chuan hoa tenant owner/context cho partner self-service routes, thay vi de logic nam rai rac trong views.
- `backend/portfolio/views_partner_admin.py` da mo cac partner commercial routes `GET /api/core/v1/partner/usage/meters/`, `/usage/quotas/`, `/billing/subscription/`, `/billing/invoices/`, dong thoi refactor helper CA-10 sang `tenant_context` chung.
- `backend/portfolio/permissions.py` va `backend/portfolio/tests/test_api_routes_auth_profile.py` da them `TenantUsageView` va `TenantBillingView` vao auth/me ability + entitlement path cho session `pro+`.
- `frontend/src/pages/admin/tenant/TenantUsage.jsx` va `frontend/src/pages/admin/tenant/TenantBilling.jsx`, cung voi route/nav/home/client/i18n wiring lien quan, da dua CA-11 usage/billing vao tenant console that.
- `backend/portfolio/ai_prompt_config_ssot.py`, `backend/portfolio/views_ai_runtime_stats.py` va `backend/portfolio/tests/test_ai_config_api.py` da cleanup seam `AICommandCenterConfig.ai_prompt_config` <-> `UserConfig.ai_prompt_config` bang hydrate/mirror helper thay vi tiep tuc drift migration.
- Browser proof voi `testpro` da xac nhan `/tenant-admin/usage` render live usage/quota (`api_calls_per_day da dung 42`, `ai_regenerate_per_day da dung 3`) va `/tenant-admin/billing` render subscription `pro` dang hoat dong cung invoice `INV-TESTPRO-PROOF-001`.
- `CA-11` coi nhu da khep o muc implementation + live proof. Debt con lai la tenant ownership canonicalization: ownership hien duoc normalize qua seam moi, nhung van chua co `CoreTenant` registry doc lap.

---

## 5.11 `CA-12` Remove bridge

### Tasks

1. Giảm dần reliance vào `ability.can('manage', 'all')`.
2. Cập nhật tests để assert granular abilities.
3. Chỉ giữ bridge khi còn legacy pages chưa migrate.

### Exit criteria

- admin shell mới không còn cần broad gate semantics để hoạt động.

### Ghi chú triển khai 2026-05-02bh

- `CoreTenant` registry đã canonicalize tenant ownership cho partner self-service routes.
- `manage all` bridge đã bị loại khỏi auth/me và route guards; `AdminOps`, `AdminCrawlControl`, `StockDetailAdvancedTab` dùng explicit abilities.
- Browser proof xác nhận `ability_admin` vào `/admin-ops` và `/admin-crawl-control`, `testpro` vào `/tenant-admin/usage` và `/tenant-admin/billing`.
- `CA-12` coi như đã khép ở mức implementation + live proof.

---

## 6. Testing expectations theo slice

| Slice group | Focused validation tối thiểu |
|---|---|
| capability/bootstrap | auth bootstrap payload snapshot tests |
| shell/routes | route guard tests + nav rendering tests |
| operator reads | API response shape tests + page load rendering tests |
| commercial | contract field assertions + sort/filter tests |
| audit/jobs | sanitization tests + status mapping tests |
| tenant console | scope enforcement tests + route isolation tests |

---

## 7. Kết luận

Taskboard này giúp team không phải dịch trực tiếp từ architecture sang code trong một bước nhảy quá lớn. Nó chia phần `Core Admin` thành các slice đủ nhỏ để:

- freeze contract trước,
- build capability bootstrap trước,
- mở read-only operator screens trước,
- rồi mới chạm write actions và tenant self-service flows.