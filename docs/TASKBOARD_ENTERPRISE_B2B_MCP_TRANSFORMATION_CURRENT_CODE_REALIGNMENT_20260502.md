# TASKBOARD - Enterprise B2B MCP Transformation Current-Code Realignment

**Ngay:** 2026-05-02  
**Muc tieu:** Giao viec theo slice cho current-code doc realignment va code implementation backlog cua chuong trinh enterprise B2B MCP transformation.

---

## 1. Quy uoc trang thai

- `[ ]` Chua bat dau
- `[/]` Dang lam
- `[x]` Hoan thanh

Nguyen tac:

1. Tai mot thoi diem chi duoc co mot task dang `[/]` trong lane active.
2. Khong tick `[x]` neu chua co focused validation sau edit dau tien.
3. Khong tick `[x]` neu chua sync ledger va progress dashboard.
4. Docs slice phai co cross-reference review; code slice phai co command/runtime proof.

---

## 2. Governance va docs control

- `[x]` `DOC-01` Realign rebaseline theo current repo state  
Owner: Platform Lead  
Estimate: 1h  
Dependency: none  
Anchor files: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md`, `packages/*`, `shared/*`  
DoD: rebaseline khong con noi repo chua co `packages/`, `shared/api-contracts`, `buildTarget.js`; sequencing phan biet ro legacy truth va package baseline.

- `[x]` `DOC-02` Realign master index thanh current-code entry point  
Owner: Platform Lead  
Estimate: 1h  
Dependency: DOC-01  
Anchor files: `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501.md`  
DoD: master index co `PHAN 0` cho current-code control docs va tro toi handoff pack moi.

- `[x]` `DOC-03` Tao current-code handoff pack  
Owner: Platform Lead  
Estimate: 2h  
Dependency: DOC-01, DOC-02  
Anchor files: handoff master, implementation plan, taskboard, traceability, self-audit, evidence, audit report  
DoD: doi code co du pack de nhan viec ma khong hoi lai owner.

- `[x]` `DOC-04` Realign bo Access/Admin docs theo implemented-now truth  
Owner: Platform Lead + Frontend Lead  
Estimate: 3h  
Dependency: DOC-03  
Anchor files: access payload, RBAC matrix, admin UI architecture, screen spec, admin implementation taskboard  
DoD: moi doc danh dau ro route/ability nao da co trong legacy runtime, package lane nao chi la partial, bridge semantics nao van con transitional.
Status note 2026-05-02: Completed. Access/Admin docs nay da duoc cap nhat de tach ro `/api/auth/me/` current bootstrap, tenant console live namespace `/tenant-admin/*`, legacy operator pages `/admin-ops`, `/admin-crawl-control` va target-state `/admin/core/*`.

- `[x]` `DOC-05` Realign bo Operator/Partner contract docs  
Owner: Platform Lead + Backend Lead  
Estimate: 4h  
Dependency: DOC-03  
Anchor files: contract pack, operator backlog, operator detailed contracts, partner API draft, platform blueprint  
DoD: operator AI runtime duoc danh dau la implemented-now; `partner/tenant` duoc danh dau missing; operator read backlog phan tach ro implemented vs target.
Status note 2026-05-02: Completed. Operator/Partner docs nay da chot lai su that current runtime: `GET /api/core/v1/operator/ai-runtime/` la wrapper operator route live duy nhat, partner self-service control/commercial routes la live, machine-auth PAT va data-plane partner routes van la target-state.

- `[x]` `DOC-06` Realign bo Resource/Schema docs  
Owner: Platform Lead + Backend Lead  
Estimate: 4h  
Dependency: DOC-05  
Anchor files: resource freeze checklist, schema analysis, storage strategy  
DoD: object nao da co trong code thi duoc danh dau implemented/partial; object nao chua co thi duoc giu la target-state va co migration gate ro.
Status note 2026-05-02: Completed. Resource/Schema docs nay da co current-code snapshot cho `CoreTenant`, `CoreServiceAccount`, `CorePATCredential`, quota/billing projections reuse va danh dau ro cac object `CoreUsageMeter`, `CoreBillingAccount`, `SessionFacts`, `UnifiedAlertProjection` la target-state/backlog.

---

## 3. Access va admin convergence

- `[x]` `ACC-01` Ship current-code capability bootstrap route truth  
Owner: Backend Lead  
Estimate: 4h  
Dependency: DOC-04  
Anchor files: `backend/config/urls.py`, `backend/portfolio/permissions.py`, future `views_core_access.py` hoac equivalent wrapper  
DoD: co route current-code truth cho capability bootstrap hoac access wrapper, phan biet operator vs tenant session ro, khong can suy dien bang `manage all`.
Status note 2026-05-02: Completed. `backend/portfolio/auth_views.py` da them wrapper `CapabilitySnapshotView`, `backend/config/urls.py` da expose `GET /api/core/v1/access/capabilities/`, va `backend/portfolio/tests/test_api_routes_auth_profile.py` da xac nhan tenant/operator session duoc phan biet bang explicit surfaces thay vi `manage all`.

- `[x]` `ACC-02` Align frontend auth bootstrap va admin route gating  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: ACC-01  
Anchor files: `frontend/src/context/PortfolioContext.jsx`, `frontend/src/context/AbilityContext.js`, `frontend/src/App.jsx`, `TopNav.jsx`, `ProtectedRoute.jsx`  
DoD: route gating, nav gating, disabled-state semantics bam capability payload thay vi fallback bridge.
Status note 2026-05-02bm: Completed. `PortfolioContext.jsx` da doc `GET /api/core/v1/access/capabilities/` va luu `capabilitySnapshot`; `TopNav.jsx` va `Sidebar.jsx` uu tien `navigation/surfaces` tu wrapper route; `npm run build` trong `frontend` xanh va browser proof tren `/dashboard` cho thay tenant/admin nav render dung.

- `[x]` `ACC-03` Remove package-track wildcard fallback  
Owner: Frontend Lead + Backend Lead  
Estimate: 3h  
Dependency: ACC-02  
Anchor files: `packages/core/backend/src/vninvest_core/api_stub.py`, `packages/web/src/pages/coreShellPageHelpers.js`, `packages/web/scripts/check-shell.mjs`  
DoD: package bootstrap khong con dua vao `manage all`/subject `all` de claim admin parity.
Status note 2026-05-02bn: Completed. Package-core stub da thay `manage all` bang explicit capabilities `admin.operator.read` va `system.ai_command_center.manage`; package-web helper khong con co wildcard `subject === "all"`; `npm run check:shell` trong `packages/web` xanh.

---

## 4. Operator P0 read-first backlog

- `[x]` `OPS-01` Implement operator overview va health projections  
Owner: Backend Lead  
Estimate: 6h  
Dependency: DOC-05  
Anchor files: `backend/config/health.py`, `backend/portfolio/views_admin_runtime.py`, `backend/config/urls.py`, `backend/portfolio/views.py`, `backend/portfolio/tests/test_operator_admin_runtime_api.py`  
DoD: `GET /api/core/v1/operator/overview/` va `GET /api/core/v1/operator/health/` tra read models on dinh, co degraded semantics ro.
Status note 2026-05-02bo: Completed. Operator overview/health da compose tu healthcheck, realtime, streams, prefetch, market observability, admin runtime KPI va AI runtime; focused backend tests xanh, backend dev stack da rebuild/restart, va runtime endpoints da co current-code read projections on dinh.

- `[x]` `OPS-02` Implement tenant registry va tenant detail  
Owner: Backend Lead  
Estimate: 8h  
Dependency: OPS-01  
Anchor files: `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/tests/test_operator_tenant_registry_api.py`, `backend/config/urls.py`, `backend/portfolio/views.py`  
DoD: `GET /api/core/v1/operator/tenants/` va `GET /api/core/v1/operator/tenants/{tenant_id}/` co filters, ordering, summary cards va detail projections.
Status note 2026-05-02bp: Completed. Tenant registry/detail da co current-code wrapper routes, filter/search/suspension semantics on dinh, summary/detail projections co security/commercial postures va recent action timeline.

- `[x]` `OPS-03` Implement operator service-account va PAT read projections  
Owner: Backend Lead  
Estimate: 8h  
Dependency: OPS-02  
Anchor files: `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/tests/test_operator_tenant_registry_api.py`, `backend/config/urls.py`, `backend/portfolio/views.py`  
DoD: `GET /api/core/v1/operator/tenants/{tenant_id}/service-accounts/` va `GET /api/core/v1/operator/tenants/{tenant_id}/pats/` co audit metadata, risk hints, va khong lo secret.
Status note 2026-05-02bp: Completed. Operator service-account va PAT list projections da live; response co rotation/anomaly metadata, no secret leakage, va live backend probe da xac nhan JSON shape on dinh.

- `[x]` `OPS-04` Implement operator jobs va audit trace reads  
Owner: Backend Lead  
Estimate: 8h  
Dependency: OPS-01  
Anchor files: `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/views.py`, `backend/config/urls.py`, `backend/portfolio/tests/test_operator_jobs_audit_api.py`  
DoD: `GET /api/core/v1/operator/jobs/` va `GET /api/core/v1/operator/audit/requests/` co cursor/order semantics ro, UI doc co the map truc tiep vao payload.
Status note 2026-05-02bq: Completed. Operator jobs table da bao ve `SignalServiceRun` va `CrawlRun`; audit trace routes da bao ve `SystemAISettingsAuditLog`, `WhaleConfigAuditLog`, `AdvisoryAggregateAuditLog` va `CrawlAuditLog` voi detail lookup theo `request_id` composite.

- `[x]` `OPS-05` Converge operator AI runtime contract  
Owner: Backend Lead + Frontend Lead  
Estimate: 4h  
Dependency: DOC-05  
Anchor files: `backend/portfolio/views_admin_runtime.py`, `backend/portfolio/tests/test_system_ai_admin_api.py`, `frontend/src/pages/AICommandCenter.jsx`  
DoD: operator AI runtime route, docs va UI naming khop nhau; doc khong con mo ta no nhu backlog thuan tuy.
Status note 2026-05-03: Completed. `GET /api/core/v1/operator/ai-runtime/` da co test coverage trong `portfolio.tests.test_system_ai_admin_api`, va `AICommandCenter.jsx` la current human-facing AI Command Center surface cho runtime nay; khoang cach giua route name va UI naming da duoc dong lai trong current-code truth.

---

## 5. Partner parity va tenant self-service convergence

- `[x]` `PART-01` Implement missing partner tenant summary route  
Owner: Backend Lead  
Estimate: 4h  
Dependency: DOC-05  
Anchor files: `backend/portfolio/views_partner_admin.py`, `backend/config/urls.py`, `backend/portfolio/models.py`  
DoD: `GET /api/core/v1/partner/tenant/` ton tai va khop contract current-code truth.
Status note 2026-05-03: Completed. Tenant Home da co current live wrapper route `GET /api/core/v1/partner/tenant/` tra tenant snapshot tu `CoreTenant.ensure_for_user(...)`, va focused partner tests xanh.

- `[x]` `PART-02` Align partner envelope, headers va request-id semantics  
Owner: Backend Lead  
Estimate: 3h  
Dependency: PART-01  
Anchor files: `backend/portfolio/views_partner_admin.py`, `frontend/src/api/client.js`  
DoD: service-account/PAT/usage/billing routes co envelope, request-id, idempotency, ordering va error semantics dung nhu docs freeze.
Status note 2026-05-03: Completed. `frontend/src/api/client.js` now exposes `getTenantSummary()` and attaches `coreRequestId` metadata from partner responses, while mutating partner helpers keep the required `Idempotency-Key` headers; `npm run build` xanh sau thay doi.

- `[x]` `PART-03` Freeze tenant-admin docs against live routes  
Owner: Frontend Lead + Platform Lead  
Estimate: 3h  
Dependency: DOC-04, PART-02  
Anchor files: tenant admin pages, screen spec, RBAC matrix  
DoD: tenant-admin screen docs khop namespace, route availability, ability gates va live data state hien co.
Status note 2026-05-03: Completed. `ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md`, `ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md`, `ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md`, `ENTERPRISE_CORE_CONTRACT_PACK_20260502.md`, `ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md` va `ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md` da duoc sync de reflect `/api/core/v1/partner/tenant/` va live Tenant Home mapping.

---

## 6. Resource freeze va schema delta planning

- `[x]` `DATA-01` Build implemented-vs-target resource matrix  
Owner: Backend Lead + Platform Lead  
Estimate: 4h  
Dependency: DOC-06  
Anchor files: `backend/portfolio/models.py`, contract pack, resource freeze, schema analysis  
DoD: ma tran chi ro cho tung object `implemented`, `partial`, `missing`, `read-model only`, `target-state only`.
Status note 2026-05-03: Completed. `ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md` now has the canonical implemented-vs-target resource matrix, va `ENTERPRISE_CORE_CONTRACT_PACK_20260502.md` / `ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md` only cross-reference it de giu truth table runtime wording.

- `[x]` `DATA-02` Freeze migration order cho identity/commercial deltas  
Owner: Backend Lead  
Estimate: 6h  
Dependency: DATA-01  
Anchor files: future migrations, schema strategy, resource freeze checklist  
DoD: co migration/backfill/rollback order ro cho `CoreTenantMembership`, `CoreAccessPolicy`, `CoreBillingAccount`, `CoreTokenSecretVersion` neu van can tao.
Status note 2026-05-03: Completed. `ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md` now has the canonical migration/backfill/rollback order section, va `ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md` chi cross-reference it.

- `[x]` `DATA-03` Freeze read-model priorities  
Owner: Backend Lead  
Estimate: 4h  
Dependency: DATA-01  
Anchor files: operator contracts, partner contract, storage strategy  
DoD: chot read-model uu tien cho `operator_overview`, `tenant_summary`, `quota_snapshot`, `session_facts`, `unified_alert`.
Status note 2026-05-03: Completed. `ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md` now has the canonical read-model priority ladder, va `ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md` / `ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md` only cross-reference it.

---

## 7. Package-track parity promotion

- `[x]` `PKG-01` Promote package-core access/session stubs to current-code wrappers  
Owner: Backend Lead  
Estimate: 6h  
Dependency: ACC-01, PART-01  
Anchor files: `packages/core/backend/src/vninvest_core/*`, shared contracts  
DoD: package-core bootstrap lane co the phan anh current-code wrappers thay vi stub-only payloads o lane uu tien.
Status note 2026-05-03: Completed. `packages/web/src/adapters/core/coreAdapter.js` now points session bootstrap at `/core/v1/auth/me`, `packages/core/backend/src/vninvest_core/api_stub.py` exposes both `/auth/me` and `/core/v1/auth/me` aliases while keeping `/session/me` for compatibility, and `packages/web/scripts/check-shell.mjs` locks the new wrapper-style endpoint.

- `[x]` `PKG-02` Expand shell host parity proofs  
Owner: Frontend Lead  
Estimate: 5h  
Dependency: PKG-01  
Anchor files: `frontend/src/pages/AiAdvisoryShellHost.jsx`, `WhaleAlertsShellHost.jsx`, package web pages  
DoD: host runtime co proof cho package-shell lanes uu tien ma khong do len admin wildcard semantics.
Status note 2026-05-03: Completed. Added `frontend/src/pages/packageShellHostRuntime.test.jsx` to lock the shared loader wiring, query carry-over, and frontend identity overlay for both `AiAdvisoryShellHost` and `WhaleAlertsShellHost`, while keeping the same-origin `/core/v1` host runtime glue unchanged.

- `[x]` `PKG-03` Define cutover readiness gates  
Owner: Platform Lead  
Estimate: 3h  
Dependency: PKG-01, PKG-02, OPS-05, PART-02, DATA-03  
Anchor files: rebaseline, package migration plan, current-code handoff pack  
DoD: co gate ro cho parity, validation, rollback, route coverage va runtime ownership truoc khi ban cutover.
Status note 2026-05-03aj: Completed. `docs/PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502.md` now has the explicit readiness gate matrix for parity, validation, rollback, route coverage, runtime ownership va approval, so package track has a concrete cutover bar thay vi chi mo ta generic.

---

## 8. Audit hygiene

- `[ ]` `AUD-01` Sync ledger/progress sau moi slice  
Owner: Platform Lead  
Estimate: 0.5h moi slice  
Dependency: moi slice PASS noi bo  
Anchor files: `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`  
DoD: file list, validation, residual risks va handoff packet khop taskboard.

- `[ ]` `AUD-02` Refresh module tree sau moi code slice  
Owner: Platform Lead  
Estimate: 0.5h moi code slice  
Dependency: slices cham `backend/`, `frontend/`, `packages/`  
Anchor files: `module_tree_full.md`  
DoD: module tree phan anh dung files code moi; docs-only slice khong bat buoc refresh.

---

## 9. Code-team continuation route

Sau khi current-code handoff pack da READY, route mac dinh cho doi code la:

1. `PKG-01` -> `PKG-02` -> `PKG-03` trong taskboard nay.
2. Khi `PKG-03` dong, chuyen sang `docs/ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md` va lam `CA-01` -> `CA-07` theo thu tu taskboard do.
3. Chi mot task o trang thai `[/]` tai mot thoi diem trong toan bo chuong trinh.
4. Sau moi slice phai dong bo `docs/CODE_CHANGE_AUDIT_LEDGER.md` va `PROGRESS_DASHBOARD.md` truoc khi claim slice tiep.
5. Neu docs va code lech, tam dung va sua drift truoc khi tiep tuc.
6. `CA-01` da dong xong ben admin board; neu tiep tuc lane admin thi slice mo tiep theo la `CA-02`.