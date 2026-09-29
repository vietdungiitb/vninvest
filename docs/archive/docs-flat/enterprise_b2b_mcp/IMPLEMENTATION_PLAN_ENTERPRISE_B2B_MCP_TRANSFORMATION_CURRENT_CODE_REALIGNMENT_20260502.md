# IMPLEMENTATION PLAN - Enterprise B2B MCP Transformation Current-Code Realignment

**Ngay:** 2026-05-02  
**Pham vi chuong trinh:** Realign docs enterprise vao code hien tai va lap backlog thuc thi cho `core`, `admin`, `partner`, `schema`, `package-track`  
**Level:** A (Major - control docs + implementation handoff pack + multi-workstream execution backlog)  
**Trang thai:** READY FOR IMPLEMENTATION HANDOFF

---

## 1. Business objective

### Van de can giai quyet

Bo docs enterprise hien tai co 3 van de lon:

1. mot so docs van mo ta `packages/*` nhu chua ton tai, trong khi repo da co package-track baseline that,
2. mot so docs `core` di truoc code va de doi code de bi nham target-state thanh implemented-now,
3. chua co mot goi planning/audit docs hop nhat de giao viec cho doi code theo slice ma khong phai hoi lai owner.

### Muc tieu nghiep vu

1. Chot lai current-code truth cho bo docs enterprise.
2. Phan tach ro `implemented now`, `partial`, `target-state` tren tung doc family.
3. Lap backlog code implementation co thu tu hop ly dua tren thuc te runtime hien tai.
4. Cung cap self-audit va evidence protocol de moi slice deu co bang chung khach quan.

---

## 2. Scope va non-scope

### In-scope

1. Update `ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501`.
2. Update `ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501`.
3. Tao goi docs handoff moi cho current-code realignment.
4. Lap taskboard chi tiet cho cac nhom viec access/admin, operator, partner, data/schema, package-track.
5. Chot audit protocol va evidence template cho tung slice.

### Out-of-scope cho dot docs nay

1. Khong implement ngay toan bo operator P0 read APIs.
2. Khong freeze ngay tat ca resource/schema neu code chua san sang.
3. Khong claim package-core da thay duoc legacy backend.
4. Khong doi boundary ownership da khoa trong package-track foundation docs.

---

## 3. Chuong trinh duoc chia thanh 2 lane

## 3.1 Lane A - Current-code doc realignment

Muc tieu cua lane nay la sua bo docs de doi code nhin dung thuc te truoc khi code tiep.

### Step A0 - Khoa control docs

**Files target:**

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501.md`
3. bo handoff `current-code realignment`

**Exit criteria:**

1. Rebaseline khong con noi repo chua co `packages/`, `shared/api-contracts`, `buildTarget.js`.
2. Master index co section entry point cho current-code execution control docs.
3. Doi code mo vao la thay duoc thu tu doc tai lieu dung.

### Step A1 - Realign doc family Access/Admin

**Files target:**

1. `docs/ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md`
2. `docs/ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md`
3. `docs/ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md`
4. `docs/ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md`
5. `docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md`

**Muc tieu:**

1. Danh dau ro route/ability nao da co that trong legacy runtime.
2. Danh dau package-track bootstrap cho muc dich nao va chua dung cho muc dich nao.
3. Tach ro phan screen spec live namespace khoi phan package-target namespace.

### Step A2 - Realign doc family Operator/Partner/Core contracts

**Files target:**

1. `docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md`
2. `docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md`
3. `docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md`
4. `docs/ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502.md`
5. `docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md`

**Muc tieu:**

1. Tach route nao da co code that, route nao la missing implementation.
2. Ghi ro operator AI runtime la route operator that duy nhat hien co o muc operator.
3. Ghi ro `GET /core/v1/partner/tenant` la missing route can build, khong phai route da ton tai.

### Step A3 - Realign doc family Resource/Schema

**Files target:**

1. `docs/ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502.md`
2. `docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md`
3. `docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md`

**Muc tieu:**

1. Danh dau object nao da co that trong `backend/portfolio/models.py`.
2. Danh dau object nao van la target-state.
3. Chot khi nao duoc tao migration plan, khi nao chi duoc dung o muc freeze checklist.

---

## 3.2 Lane B - Code implementation backlog sau khi docs da thang hang

Lane nay la backlog chinh giao cho doi code.

### Step B1 - Access/Admin convergence

**Muc tieu:** dua auth/bootstrap/admin docs va code ve cung mot su that.

**Expected slices:**

1. `/core/v1/access/capabilities` route that tren legacy backend hoac wrapper tuong duong.
2. Align `auth/me`, package bootstrap va admin route gating semantics.
3. Cat bot bridge fallback con du trong package-track auth/bootstrap lane.

### Step B2 - Operator P0 read-first APIs

**Muc tieu:** build cac operator reads con thieu tren legacy truth truoc khi ban ve package-core parity.

**Expected slices:**

1. `GET /core/v1/operator/overview`
2. `GET /core/v1/operator/health`
3. `GET /core/v1/operator/tenants`
4. `GET /core/v1/operator/tenants/{tenant_id}`
5. `GET /core/v1/operator/jobs`
6. `GET /core/v1/operator/audit/requests`

### Step B3 - Partner self-service parity

**Muc tieu:** dua partner docs va live routes ve cung contract.

**Expected slices:**

1. them `GET /core/v1/partner/tenant`,
2. align list envelopes, headers, request ids, idempotency semantics,
3. align field names giua docs va code cho service accounts, PATs, usage, billing.

### Step B4 - Resource freeze va schema delta planning

**Muc tieu:** chot object delta truoc khi viet migrations lon.

**Expected slices:**

1. implemented-vs-target matrix cho `CoreTenant`, `CoreServiceAccount`, `CorePATCredential`, `CoreTenantMembership`, `CoreAccessPolicy`, `CoreBillingAccount`, `CoreTokenSecretVersion`.
2. migration/backfill order cho object con thieu.
3. read-model priorities cho `tenant_summary`, `operator_overview`, `quota_snapshot`, `session_facts`.

### Step B5 - Package-track promotion

**Muc tieu:** bien package track tu baseline/stub thanh lane san sang parity cho mot so surfaces uu tien.

**Expected slices:**

1. lo wildcard `manage all` khoi package bootstrap lane,
2. nang host integration coverage,
3. dua package-core tu stub sang tieu thu read models/contracts that cho lane uu tien,
4. lap cutover gates ro rang truoc khi move runtime that.

## 3.3 Lane C - Controlled code-team continuation

Lane nay la route thuc thi thuc te cho doi code sau khi handoff pack va taskboard da on dinh. Playbook continuation la source of truth cho route, con taskboard la noi claim slice va cap nhat trang thai.

### Next execution order

1. `PKG-01` -> `PKG-02` -> `PKG-03`
2. `CA-01` -> `CA-07`
3. Neu co drift, tam dung va repair truoc khi mo slice tiep

### Audit gates

1. Chi mot slice `[/]` tai mot thoi diem.
2. Sau moi edit thuc chat dau tien phai chay focused validation ngay.
3. Sau moi slice PASS phai update taskboard, audit ledger va PROGRESS_DASHBOARD.
4. Neu cham code files thi phai refresh `module_tree_full.md`.
5. Neu cham runtime/UI thi phai rebuild or restart dev stack de auditor co the verify ngay.

---

## 4. Execution order bat buoc

### Step 0 - Cap nhat control docs va taskboard

Khong code tiep neu taskboard, handoff master va rebaseline chua trung nhau.

### Step 1 - Freeze Access/Admin truth

Access/admin la boundary dau tien vi no chi phoi route gating, nav gating, operator va tenant surfaces.

### Step 2 - Build Operator read path tren legacy truth

Khong doi package-core parity de mo operator APIs; phai build read-first tren legacy truth dang chay truoc.

### Step 3 - Build missing partner parity

Missing route `partner/tenant` va envelope/header drift can duoc dong lai truoc khi freeze partner contract pack.

### Step 4 - Freeze resource/schema delta

Schema chi duoc quyet sau khi docs va route semantics da ro.

### Step 5 - Promote package-track lane

Sau khi legacy truth da on dinh va contracts da freeze lai, moi bat dau dua package-core/package-web len parity cao hon.

---

## 5. File-level anchor map theo workstream

| Workstream | Frontend anchors | Backend anchors | Docs anchors |
|---|---|---|---|
| `WS-ACCESS` | `frontend/src/App.jsx`, `PortfolioContext.jsx`, `AbilityContext.js`, `TopNav.jsx`, `ProtectedRoute.jsx` | `backend/portfolio/permissions.py`, `backend/config/urls.py`, `backend/portfolio/views_admin_runtime.py` | access payload, RBAC, UI architecture, screen spec |
| `WS-OPERATOR` | `frontend/src/pages/AICommandCenter.jsx`, future admin pages | `backend/portfolio/views_admin_runtime.py`, future operator views | operator backlog, detailed contracts, contract pack |
| `WS-PARTNER` | `frontend/src/pages/admin/tenant/*`, `frontend/src/api/client.js` | `backend/portfolio/views_partner_admin.py`, `backend/portfolio/models.py` | partner API draft, contract pack |
| `WS-DATA` | minimal direct frontend impact | `backend/portfolio/models.py`, future migrations/read models | resource freeze, schema analysis, storage strategy |
| `WS-PKG` | `packages/web/src/*`, legacy shell host pages | `packages/core/backend/src/*`, `packages/vip-app/local-backend/*` | package foundation handoff + rebaseline |

---

## 6. Definition of done cho moi lane

### Docs lane

1. cross-reference khop,
2. doc family duoc gan nhan ro `implemented now`, `partial`, `target-state`,
3. ledger/progress sync day du.

### Backend lane

1. focused tests xanh,
2. payload shape khop docs,
3. request id/idempotency/audit semantics ro.

### Frontend lane

1. build xanh,
2. route gating va nav gating dung,
3. screenshot/browser proof co that.

### Package lane

1. `npm run check:shell` xanh,
2. `compileall` xanh cho `packages/core`,
3. khong claim parity neu van con stub-only.

---

## 7. Audit sync bat buoc

Sau moi slice PASS noi bo:

1. cap nhat `docs/TASKBOARD_ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_REALIGNMENT_20260502.md`,
2. cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
3. cap nhat `PROGRESS_DASHBOARD.md`,
4. dien evidence template cua chuong trinh nay,
5. refresh `module_tree_full.md` neu co chay code thay doi o `backend/`, `frontend/`, `packages/`.