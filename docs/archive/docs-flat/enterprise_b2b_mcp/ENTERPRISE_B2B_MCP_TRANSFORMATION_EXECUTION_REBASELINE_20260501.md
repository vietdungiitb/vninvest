# EXECUTION REBASELINE: ENTERPRISE B2B MCP TRANSFORMATION

**Date:** 2026-05-01  
**Updated:** 2026-05-02 - current-code realignment after package-track baseline and core-admin doc audit  
**Status:** Current-code-aligned execution baseline and sequencing override  
**Applies to:** Toan bo bo tai lieu enterprise transformation ngay 2026-05-01 va cac companion docs `core` ngay 2026-05-02

---

## 1. Muc dich va thu tu uu tien

Tai lieu nay ton tai de **neo bo ke hoach enterprise vao code dang ton tai trong repo**, khong cho doi code tiep tuc doc target-state docs theo cach nhu the moi thu van con tren giay.

- Cac tai lieu enterprise ngay 2026-05-01 van dung voi vai tro **target-state architecture**.
- Khi co xung dot giua target-state va thuc te code hien tai, **thu tu trien khai trong tai lieu nay duoc uu tien**.
- Sau dot realignment 2026-05-02, rebaseline nay phai duoc doc cung bo tai lieu `core` 2026-05-02 va bo handoff `current-code realignment` de doi code biet ro: cai gi da co, cai gi moi la hop dong muc tieu, va cai gi van con la backlog.

**Thu tu uu tien de thuc thi:**

1. Current runtime va package-track code dang ton tai trong repo
2. Tai lieu nay
3. Bo `ENTERPRISE_CORE_*` ngay 2026-05-02
4. `PACKAGES_PARALLEL_MIGRATION_EXECUTION_PLAN_20260502`
5. Cac tai lieu target-state 2026-05-01 con lai

---

## 2. Baseline thuc te cua repo hien tai

### 2.1 Hai lane dang ton tai song song

Repo hien tai **khong con o trang thai chi co legacy runtime**. No dang co hai lane ro rang:

#### Legacy runtime dang phuc vu nghiep vu that

- `backend/` - Django + DRF + Channels + Celery, van la noi so huu nghiep vu that, auth that, data serving that.
- `frontend/` - React app dang duoc docker/dev stack build va phuc vu.
- `mobile-app/` - mobile surface rieng.
- `opennews-main/` - lane ho tro tin tuc va sentiment.
- `infra/` - deployment helpers va environment assets.

#### Package-track baseline da ton tai that trong repo

- `packages/core/` - da co Python manifest, compose topology stub, runtime stubs va contract namespaces.
- `packages/web/` - da co build-target config, route catalog, navigation catalog, adapter seams, bootstrap/auth runtime, shell pages va validation script.
- `packages/vip-app/` - da co local backend stub va control-plane skeleton.
- `shared/api-contracts/` - da co JSON contracts cho `build target`, `capability bootstrap`, `session payload`.
- `shared/constants/` - da co shared namespace foundation.

**Ket luan quan trong:**

- `packages/` va `shared/` **da ton tai that**.
- `buildTarget.js` **da ton tai that** o `packages/web/src/config/buildTarget.js`.
- Package track **chua dat parity runtime**, nhung no khong con la y tuong greenfield.
- Vi vay, moi doan van trong bo docs mo ta `packages/*` nhu mot buoc phai tao moi tu dau deu phai duoc hieu la **historical sequencing**, khong phai baseline hien tai nua.

### 2.2 Nhung package-track artifacts da duoc xac nhan co that

#### `packages/core`

- `packages/core/pyproject.toml` - package identity cho `vninvest-core`.
- `packages/core/backend/src/vninvest_core/app_manifest.py` - manifest topology va contract namespaces.
- `packages/core/backend/src/vninvest_core/api_stub.py` - health, manifest, capability bootstrap va session payload stub.
- `packages/core/backend/src/vninvest_core/worker_stub.py` va `beat_stub.py` - execution entrypoints cho worker/beat lane.
- `packages/core/docker-compose.core.yml` - topology `core-db`, `core-redis`, `core-api`, `core-worker`, `core-beat`.

#### `packages/web`

- `packages/web/src/config/buildTarget.js` - canonical build targets `community`, `saas`, `vip`.
- `packages/web/src/app/routeCatalog.js` - route registry cho workspace, signals, system, admin, vip-local.
- `packages/web/src/app/navigationCatalog.js` - navigation registry theo build target va capabilities.
- `packages/web/src/context/bootstrapClient.js` - bootstrap client dung chung cho `core` va `vip-app` adapters.
- `packages/web/src/context/authRuntime.js` va `authReact.js` - package-track auth runtime/provider.
- `packages/web/src/pages/...` - shell pages cho dashboard, watchlist, transactions, portfolios, AI advisory, whale alerts, admin ops, AI command center, VIP local control.
- `packages/web/scripts/check-shell.mjs` - focused validation lane cho shell/package runtime.

#### Host integration trong legacy frontend

- `frontend/src/pages/WhaleAlertsShellHost.jsx` - mount `ShellWhaleAlertsPage` tu `@vninvest/web` trong runtime that.
- `frontend/src/pages/AiAdvisoryShellHost.jsx` - mount lane AI advisory shell trong runtime that.
- `frontend/src/pages/packageShellHostRuntime.js` - glue layer cho auth-aware package shell host.

#### Shared contracts

- `shared/api-contracts/build-target.contract.json`
- `shared/api-contracts/capability-bootstrap.contract.json`
- `shared/api-contracts/session-payload.contract.json`

### 2.3 Nhan dien dung ve maturity hien tai

Package track hien tai nen duoc xem la **foundation baseline + shell/runtime bootstrap baseline**, khong nen bi thoi phong thanh package platform da xong.

Da co that:

1. package ownership baseline,
2. build-target semantics,
3. capability/session bootstrap contracts muc co ban,
4. adapter seams `core` va `vip-app`,
5. mot so shell routes proof-of-runtime trong host frontend that.

Chua xong:

1. `packages/core` chua la backend truth thay cho `backend/`,
2. operator/partner APIs field-complete chua duoc build trong package-core,
3. dev compose chinh van build `./frontend`, khong build `packages/web` truc tiep,
4. package-track auth bootstrap van con transitional semantics o mot so diem,
5. schema/commercial/resource docs van di truoc code.

### 2.4 Nhan dinh lai ve scale foundation, commercial foundation va AI runtime

Nhung nhan dinh sau van dung va duoc giu nguyen:

1. Redis-first async stack trong `backend/` van la nen tang phu hop cho pha dau; chua co trigger thuc te de nhay ngay sang RabbitMQ.
2. PostgreSQL + facts/materialized models van la huong uu tien truoc khi dua ClickHouse vao.
3. `opencore` nen duoc xem la distribution/commercial lane, khong phai backend truth doc lap.
4. AI runtime phai di qua viec mo rong truc `SystemAISettings` va `AICommandCenterConfig` dang ton tai, khong duoc bo qua de ve lai greenfield schema.

---

## 3. Nhung su that quan trong phai ghi ro de tranh doc sai docs

### 3.1 Legacy runtime van la SSOT nghiep vu hien tai

O thoi diem nay, `backend/` va `frontend/` van la noi so huu:

- auth/me,
- tenant-admin runtime that,
- partner service accounts/PAT/usage/billing APIs that,
- operator AI runtime API that,
- portfolio/workspace/whale/advisory routes that.

Do do:

- Khong duoc xem `packages/core` la backend truth hien tai.
- Khong duoc viet docs nhu the package-core da thay the duoc legacy backend.

### 3.2 Package track da vuot qua moc "chi la de xuat"

Sau baseline va package-shell slices 2026-05-02:

- Package track da co code import/run/validate duoc.
- Shared contracts da co that va duoc tieu thu boi package-web runtime.
- Mot so shell routes da duoc host trong legacy frontend that.

Do do:

- Khong duoc mo ta `packages/*` nhu mot muc tieu xa chua bat dau.
- Pha tiep theo phai duoc mo ta la **parity va production hardening**, khong phai `tao scaffold` nua.

### 3.3 Package-track capability bootstrap chua duoc xem la bridge-free final state

Mac du huong di da dung, package-core stub hien tai van co transitional fallback qua ability `manage all` cho staff/superuser. Package-web helpers cung van coi subject `all` la wildcard fallback.

**He qua:**

- Docs khong duoc noi rang bridge semantics da bien mat hoan toan trong package track.
- Tai lieu phai ghi ro: legacy runtime da duoc lam chat hon, nhung package track hien tai van con mot lop bridge tam thoi o stub/auth helper lane.

### 3.4 Bo docs `ENTERPRISE_CORE_*` hien dang la contract/backlog pack, khong phai bang chung code parity

Sau audit 2026-05-02, can coi bo `ENTERPRISE_CORE_*` theo ba nhom sau:

#### Nhom gan voi code hien tai nhat

- `ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502`
- `ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502`
- `ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502`

#### Nhom contract target-state nhung moi phan da co code that

- `ENTERPRISE_CORE_CONTRACT_PACK_20260502`
- `ENTERPRISE_CORE_PARTNER_API_CONTRACT_DRAFT_20260502`
- `ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502`
- `ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502`

#### Nhom schema/resource/convergence van di truoc code

- `ENTERPRISE_CORE_RESOURCE_FREEZE_CHECKLIST_20260502`
- `ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502`
- `ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502`

Noi cach khac: bo docs `core` nay rat gia tri de huong dan implementation, nhung **khong duoc doc nhu inventory cua nhung gi da ton tai day du trong models/routes hien tai**.

---

## 4. Cac quyet dinh rebaseline van giu nguyen

### 4.1 Khong bulk-move legacy folders

Quyet dinh nay van dung 100%.

- Khong rename `backend/` thanh `packages/core/` ngay lap tuc.
- Khong rename `frontend/` thanh `packages/web/` ngay lap tuc.
- Legacy runtime van la rollback lane va semantics reference cho den khi package track dat parity co bang chung.

### 4.2 Redis-first truoc RabbitMQ

Van giu nguyen. Chua co bang chung runtime bat buoc dua RabbitMQ vao pha dau.

### 4.3 PostgreSQL + facts/materialization truoc ClickHouse

Van giu nguyen. Pha dau phai uu tien facts-first, session summaries, cached buckets, selective forensic windows.

### 4.4 Internal realtime tiep tuc bang WebSocket

Van giu nguyen. SSE la lane sau cho external orchestration stream, khong phai ly do de rewrite internal live path.

### 4.5 Kong khong phai entry step cho partner access

Van giu nguyen. Thu tu dung la:

1. chot tenant/service-account/PAT/quota semantics,
2. chot route contracts,
3. build operator va partner read/write surfaces can thiet,
4. toi uu DRF throttling + Redis quota,
5. chi sau do moi can danh gia API gateway mesh.

### 4.6 `packages/web` la frontend source duy nhat

Quyet dinh nay con duoc tang cuong hon nua sau baseline 2026-05-02:

- `packages/web` da co that va da co shell pages dung chung,
- `packages/vip-app` khong co shared React source rieng,
- `packages/opencore` khong duoc fork frontend ra khoi `packages/web`.

---

## 5. Sequencing da duoc cap nhat theo thuc te code

### Phase 0 - Governance freeze va package ownership

**Trang thai:** HOAN THANH

Da chot:

1. `packages-first parallel migration`,
2. package ownership `core/web/opencore/mobile/vip-app`,
3. `packages/web` la frontend source duy nhat,
4. package-track foundation phai di theo slice nho va co validation lane rieng.

### Phase 1 - Package/shared foundation baseline

**Trang thai:** HOAN THANH

Da co:

1. `packages/core` foundation,
2. `packages/web` shell baseline,
3. `shared/api-contracts` baseline,
4. `packages/vip-app` local backend stub baseline,
5. `npm run check:shell` va compile/manifest proof cho package track.

### Phase 2 - Package-shell runtime hardening va host integration

**Trang thai:** DANG DIEN RA TUNG PHAN

Da co mot phan:

1. host pages trong legacy frontend cho advisory/whale shell,
2. auth-aware bootstrap glue,
3. package shell smoke proofs.

Con thieu:

1. route coverage rong hon,
2. dev/runtime lane build truc tiep `packages/web`,
3. cat bot bridge semantics du thua trong package bootstrap,
4. parity test ro hon giua package shell va legacy runtime that.

### Phase 3 - Core admin va partner parity tren legacy truth

**Trang thai:** BAT DAU O MUC DOCS/CONTRACT, CODE MOI MOT PHAN

Thuc te code hien tai:

1. legacy backend da co partner service accounts/PAT/usage/billing APIs,
2. legacy frontend da co tenant-admin surfaces cho usage, billing, service accounts, PATs,
3. legacy backend da co operator AI runtime read API,
4. nhung operator overview, tenant registry, jobs, audit trace, health read models van chua du.

**Pha tiep theo dung:**

- dua bo docs `ENTERPRISE_CORE_*` ve current-code truthful state,
- build read-first operator surfaces tren legacy truth truoc,
- chi sau do moi quyet dinh resource/schema split nao can dua vao package-core that.

### Phase 4 - Schema/commercial/resource convergence

**Trang thai:** CHUA BAT DAU O MUC CODE PUBLIC

Cong viec dung la:

1. chot resource freeze theo current code va target delta,
2. xac dinh object nao can bang moi, object nao moi can read model,
3. lap migration/backfill plan sau khi contract on dinh,
4. khong viet docs nhu the `CoreTenantMembership`, `CoreBillingAccount`, `CoreTokenSecretVersion` da ton tai day du neu code chua co.

### Phase 5 - Package-core/package-web parity va cutover readiness

**Trang thai:** CHUA BAT DAU

Dieu kien vao pha nay:

1. operator/partner contracts chot lai theo current-code truth,
2. read-first parity da co bang chung,
3. schema/resource decisions da qua freeze gates,
4. package-core khong con o muc stub cho cac lane uu tien.

---

## 6. Backlog uu tien sau khi realignment docs

Thu tu uu tien cho doi code sau khi doc pack nay:

1. Lam sach control docs de docs no dung voi code hien tai.
2. Freeze lai capability/admin/operator/partner semantics theo current runtime that.
3. Build P0 operator reads con thieu tren legacy backend truth.
4. Bo sung partner tenant summary route va chinh contract drift giua doc va code.
5. Chot resource freeze/schema strategy theo object nao da co, object nao con la target.
6. Chi sau do moi danh gia slice nao nen dua vao `packages/core` that thay vi tiep tuc o legacy truth.

---

## 7. Hard guardrails cho moi slice tiep theo

1. Khong duoc doc package track nhu parity proof day du cho operator/partner/commercial lanes.
2. Khong duoc doc bo `ENTERPRISE_CORE_*` nhu inventory day du cua tables/routes neu chua doi chieu code.
3. Khong duoc them docs moi ma khong danh dau ro `implemented now`, `partial`, `target-state`.
4. Khong duoc mo schema split hay infra split som hon contract/resource freeze.
5. Khong duoc claim bridge-free auth model trong package track khi stub va helper van con wildcard fallback.
6. Khong duoc cutover package track khi dev/runtime chinh van phu thuoc `frontend/` va `backend/` cho luong nghiep vu that.

---

## 8. Companion docs bat buoc di kem

Doc cung tai lieu nay voi:

1. `./ENTERPRISE_B2B_MCP_TRANSFORMATION_MASTER_INDEX_20260501.md`
2. `./ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_MASTER_20260502.md`
3. `./PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502.md`
4. `./ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md`
5. `./ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md`
6. `./ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md`

Neu mot doc nao khac mau thuan voi tai lieu nay ve `package track da ton tai hay chua`, `build target da ton tai hay chua`, `shared contracts da ton tai hay chua`, thi hieu rang doc do **can duoc cap nhat hoac danh dau la target-state only**.