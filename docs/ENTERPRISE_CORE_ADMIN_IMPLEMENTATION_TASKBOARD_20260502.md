# ENTERPRISE CORE ADMIN IMPLEMENTATION TASKBOARD

**Date:** 2026-05-02  
**Status:** Execution-facing taskboard before coding  
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
3. Central Operator Admin đi trước Tenant Admin Console.
4. Mỗi slice phải có frontend anchor, backend anchor, contract dependency và focused validation.
5. Không mở write actions operator nếu read routes cùng screen chưa ổn định.

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
| `CA-01` | P0 | admin shell + route groups | `App.jsx`, `TopNav.jsx`, future `pages/admin/*` | route registration only | admin UI architecture, RBAC matrix | route groups `/admin/core/*` và `/admin/tenant/*` tồn tại với guards đúng |
| `CA-02` | P0 | platform overview + runtime health | future `CoreOverview.jsx`, `CoreRuntimeHealth.jsx` | future `views_core_operator_overview.py`, `views_admin_runtime.py` | operator detailed contracts | screen render được summary cards/health cards từ P0 read routes |
| `CA-03` | P0 | tenant registry + tenant detail | `CoreTenants.jsx`, `CoreTenantDetail.jsx` | future `views_core_operator_tenants.py` | operator detailed contracts | table + detail summary render đúng filters/status badges |
| `CA-04` | P1 | service accounts | `CoreServiceAccounts.jsx` | future `views_core_operator_service_accounts.py` | operator detailed contracts, RBAC matrix | read list hoạt động; create/edit buttons gate đúng ability |
| `CA-05` | P1 | PAT credentials | `CorePATs.jsx` | future `views_core_operator_pats.py` | operator detailed contracts, capability payload | read list hoạt động; issue/rotate/revoke ở trạng thái gated, chưa cần fully wired nếu write APIs chưa xong |
| `CA-06` | P1 | usage, quotas, billing | `CoreUsage.jsx`, `CoreBilling.jsx` | future `views_core_operator_commercial.py`, `opencore_api.py` reuse candidates | operator detailed contracts, contract pack | commercial panels render bằng read projections rõ ràng |
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

---

## 5.2 `CA-01` Admin shell + route groups

### Frontend tasks

1. Tạo route groups `/admin/core/*` và `/admin/tenant/*`.
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

---

## 5.10 `CA-09` đến `CA-11` Tenant Admin Console

Ba slice này chỉ nên bắt đầu khi `CA-00` hoàn tất và partner control/commercial routes đã freeze đủ:

1. `CA-09`: tenant home + capabilities.
2. `CA-10`: tenant service accounts + PATs.
3. `CA-11`: tenant usage + billing.

### Key rule

Tenant console không được thiết kế như bản copy của operator console. Nó là self-service surface, nên payload, menu, actions và error messages phải tenant-scoped.

---

## 5.11 `CA-12` Remove bridge

### Tasks

1. Giảm dần reliance vào `ability.can('manage', 'all')`.
2. Cập nhật tests để assert granular abilities.
3. Chỉ giữ bridge khi còn legacy pages chưa migrate.

### Exit criteria

- admin shell mới không còn cần broad gate semantics để hoạt động.

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