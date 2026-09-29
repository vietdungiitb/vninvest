# HANDOFF MASTER - Enterprise B2B MCP Transformation Current-Code Realignment

**Ngay:** 2026-05-02  
**Trang thai:** READY FOR IMPLEMENTATION HANDOFF  
**Muc tieu:** Bien bo docs enterprise B2B/MCP tu trang thai pha tron giua target-state va current-state thanh mot chuong trinh co the giao thang cho doi code, co workstream, taskboard, audit protocol va evidence template ro rang.

---

## 1. Ket qua cuoi bat buoc

Sau goi handoff nay, doi code phai co du 7 thu sau ma khong can hoi lai owner:

1. Mot execution baseline noi ro code hien tai dang o dau giua legacy runtime va package track.
2. Mot implementation plan chia ro lane docs realignment va lane code implementation.
3. Mot taskboard live co slice ids, dependencies, owners, anchors va definition of done.
4. Mot traceability matrix map tung nhom tai lieu va nhom contract vao cac slice phai lam.
5. Mot self-audit protocol chi ro command validation va proof toi thieu cho tung loai slice.
6. Mot evidence template de dong goi bang chung hoan thanh tung slice.
7. Mot audit report noi ro residual risks de auditor biet cai gi da current-code aligned, cai gi van la backlog.

---

## 2. Bo tai lieu trong goi nay

### 2.1 Control docs va planning pack

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501.md`
3. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_MASTER_20260502.md`
4. `docs/IMPLEMENTATION_PLAN_ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_REALIGNMENT_20260502.md`
5. `docs/TASKBOARD_ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_REALIGNMENT_20260502.md`
6. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CODE_TEAM_CONTINUATION_PLAYBOOK_20260503.md`
7. `docs/PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502.md`

### 2.2 Control docs cho audit va execution evidence

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_TRACEABILITY_MATRIX_20260502.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_SELF_AUDIT_AND_TEST_PROTOCOL_20260502.md`
3. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_EXECUTION_EVIDENCE_TEMPLATE_20260502.md`
4. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_AUDIT_REPORT_20260502.md`

---

## 3. Input doc families nam trong pham vi chuong trinh

| Doc family | Files in scope | Vai tro trong chuong trinh |
|---|---|---|
| Execution control | `ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501`, `ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501` | Chot current-code entry points va thu tu uu tien |
| Access/Admin | `ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502`, `ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502`, `ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502`, `ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502`, `ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502` | Chot auth semantics, route surfaces, screen scope va admin implementation order |
| Core contracts | `ENTERPRISE_CORE_CONTRACT_PACK_20260502`, `ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502`, `ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502`, `ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502`, `ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502` | Chot resource semantics, operator/partner contracts va route backlog |
| Schema/resource | `ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502`, `ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502`, `ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502` | Chot resource freeze, schema-last discipline va migration gates |

---

## 4. Thu tu uu tien tai lieu

Khi co xung dot dien giai, dung thu tu sau:

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_MASTER_20260502.md`
3. `docs/IMPLEMENTATION_PLAN_ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_REALIGNMENT_20260502.md`
4. `docs/TASKBOARD_ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_REALIGNMENT_20260502.md`
5. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_TRACEABILITY_MATRIX_20260502.md`
6. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_SELF_AUDIT_AND_TEST_PROTOCOL_20260502.md`
7. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_EXECUTION_EVIDENCE_TEMPLATE_20260502.md`
8. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_AUDIT_REPORT_20260502.md`
9. Bo `ENTERPRISE_CORE_*` ngay 2026-05-02
10. `docs/PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502.md`
11. Cac docs target-state enterprise 2026-05-01 con lai

---

## 5. Cac quyet dinh da khoa

### 5.1 Current runtime va package-track

1. `backend/` va `frontend/` van la SSOT nghiep vu hien tai.
2. `packages/core`, `packages/web`, `packages/vip-app`, `shared/api-contracts` da ton tai that va da co baseline code/contract.
3. Package track chua duoc xem la parity proof cho operator/partner/commercial lanes.
4. `packages/web` la frontend source duy nhat cho future `saas`, `community`, `vip` builds.

### 5.2 Access/admin semantics

1. Legacy runtime da tien gan hon toi granular abilities; khong duoc mo docs moi theo `manage all` semantics.
2. Package-track bootstrap van con wildcard fallback o stub/auth helper lane; khong duoc claim bridge-free final state cho package track.
3. `tenant-admin/*` la namespace UI that trong legacy frontend; docs phai bam namespace nay khi mo ta live tenant console.

### 5.3 Operator/partner/core contracts

1. Operator AI runtime read route da ton tai trong legacy backend.
2. Partner service-account/PAT/usage/billing self-service routes da ton tai trong legacy backend.
3. `GET /core/v1/partner/tenant` van chua co code that; docs phai danh dau ro la missing implementation.
4. Operator overview, tenant registry, jobs, audit trace, health read models van la backlog read-first.

### 5.4 Schema/resource discipline

1. `CoreTenant`, `CoreServiceAccount`, `CorePATCredential` da co code that trong legacy backend.
2. `CoreTenantMembership`, `CoreAccessPolicy`, `CoreBillingAccount`, `CoreTokenSecretVersion` va nhieu read models trong bo schema docs van la target-state.
3. Khong duoc viet migration plan public neu contract/resource freeze chua chot lai theo current-code truth.

---

## 6. Workstream map cho doi code

| Workstream | Muc tieu | Ket qua chinh |
|---|---|---|
| `WS-DOC` | Realign docs cho dung current code | Rebaseline/master index current-code truthful, doc families duoc gan nhan implemented/partial/target-state |
| `WS-ACCESS` | Chot capability bootstrap va admin shell semantics | Access payload, RBAC, route guards, admin screen scope va nav semantics khop current runtime |
| `WS-OPERATOR` | Build operator P0 read-first surfaces con thieu | overview, tenants, health, jobs, audit trace, AI runtime operator reads |
| `WS-PARTNER` | Chot partner self-service parity | tenant summary route, envelope/header parity, service account/PAT/commercial contract convergence |
| `WS-DATA` | Chot resource freeze va schema-last decisions | implemented-vs-target delta cho tenant/commercial/token/resource models va migration gates |
| `WS-PKG` | Dua package track tu baseline len parity-ready lane | bo manage-all fallback o package bootstrap, tang host integration va package-core read-model readiness |

---

## 7. Current code anchors phai duoc ton trong

### 7.1 Legacy runtime anchors

1. `backend/config/urls.py`
2. `backend/portfolio/models.py`
3. `backend/portfolio/permissions.py`
4. `backend/portfolio/views_partner_admin.py`
5. `backend/portfolio/views_admin_runtime.py`
6. `frontend/src/App.jsx`
7. `frontend/src/context/PortfolioContext.jsx`
8. `frontend/src/context/AbilityContext.js`
9. `frontend/src/pages/admin/tenant/*`

### 7.2 Package-track anchors

1. `packages/core/backend/src/vninvest_core/api_stub.py`
2. `packages/web/src/config/buildTarget.js`
3. `packages/web/src/context/bootstrapClient.js`
4. `packages/web/src/context/authRuntime.js`
5. `packages/web/src/app/routeCatalog.js`
6. `packages/web/src/app/navigationCatalog.js`
7. `frontend/src/pages/AiAdvisoryShellHost.jsx`
8. `frontend/src/pages/WhaleAlertsShellHost.jsx`
9. `shared/api-contracts/*.json`

---

## 8. Validation commands can ban

### 8.1 Docs-only va contract review slices

1. Cross-reference review giua handoff master, implementation plan, taskboard, traceability, self-audit va evidence template.
2. `get_errors` tren cac docs vua sua neu editor co diagnostics.

### 8.2 Legacy backend slices

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_api_routes_auth_profile --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_partner_admin_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_system_ai_admin_api --keepdb
Pop-Location
```

### 8.3 Legacy frontend slices

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

### 8.4 Package-track slices

```powershell
Push-Location ./packages/web
npm run check:shell
Pop-Location
```

```powershell
& ".\.venv\Scripts\python.exe" -m compileall packages/core/backend/src
```

### 8.5 Runtime refresh khi cham UI/runtime that

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

### 8.6 Module tree refresh khi cham code files

```powershell
& ".\.venv\Scripts\python.exe" scripts/ops/generate_module_tree.py
```

---

## 9. Operating discipline bat buoc

1. Lam theo slice nho, contract-first, read-first, schema-last.
2. Sau edit thuc chat dau tien cua moi slice phai chay focused validation ngay.
3. Khong danh dau slice complete neu chua cap nhat taskboard, ledger va progress dashboard.
4. Tai mot thoi diem chi duoc co mot slice o trang thai `[/]` trong taskboard cua chuong trinh nay.
5. Docs phai danh dau ro `implemented now`, `partial`, hoac `target-state`; khong duoc tron lan ba muc nay trong cung mot mo ta.
6. Neu slice cham runtime/UI that thi phai refresh dev stack truoc khi claim xong.
7. Khong duoc dung transcript chat thay cho evidence template va handoff packet.

---

## 10. Evidence obligations

Moi slice bat buoc phai co toi thieu:

1. danh sach file doi,
2. command validation va ket qua,
3. payload snapshot neu cham contract,
4. screenshot/browser proof neu cham UI/runtime,
5. residual risk note,
6. ledger/progress sync proof,
7. handoff packet cho phien sau.

Neu thieu mot trong 7 muc tren thi slice chua duoc xem la PASS cho implementation handoff.

---

## 11. Code team continuation route

Sau khi handoff pack nay READY, code team phai doc playbook continuation truoc khi claim slice moi.

1. Current-code realignment lane con mo truoc het la `PKG-01` -> `PKG-02` -> `PKG-03`.
2. Sau khi `PKG-03` dong, code team chuyen sang admin implementation board va lam `CA-01` -> `CA-07` theo thu tu taskboard chinh.
3. Chi duoc co mot slice `[/]` trong toan bo chuong trinh tai mot thoi diem.
4. Sau moi slice phai cap nhat taskboard, audit ledger va progress dashboard truoc khi bat dau slice tiep.
5. Neu co drift giua docs va code, dung slice va sua drift truoc khi tiep tuc.

## 12. SaaS cutover route

Sau khi current-code realignment va package/admin hardening da dong, route tiep theo khong con la `PKG-*` hay `CA-*` nua. Route chinh phai la bo SaaS cutover:

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_HANDOFF_MASTER_20260503.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_PLAN_20260503.md`
3. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md`
4. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TRACEABILITY_MATRIX_20260503.md`
5. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260503.md`
6. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_TEMPLATE_20260503.md`

One active slice rule van giu nguyen, nhung active slice luc nay phai nam trong SaaS board moi.