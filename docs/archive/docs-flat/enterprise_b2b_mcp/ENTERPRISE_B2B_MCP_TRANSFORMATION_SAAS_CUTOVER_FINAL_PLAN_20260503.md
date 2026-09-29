# FINAL PLAN - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

**Ngay:** 2026-05-03  
**Trang thai:** Canonical go-forward plan sau khi SAAS-00 den SAAS-07 da dong  
**Muc tieu:** Dinh nghia mot tai lieu final de phien sau biet can doc gi, lam gi, va di theo route nao de chuyen VNInvest sang mo hinh SaaS that su.

---

## 1. Tai lieu nay dung de lam gi

Tai lieu nay hop nhat route program cuoi cung sau khi package parity va production manifest hardening da hoan tat. No khong thay the taskboard, handoff master, traceability matrix hay evidence template. No chi chot diem vao canonical cho cac phien sau.

Doc theo thu tu:

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_HANDOFF_MASTER_20260503.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_PLAN_20260503.md`
3. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md`
4. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TRACEABILITY_MATRIX_20260503.md`
5. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260503.md`
6. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_TEMPLATE_20260503.md`
7. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CODE_TEAM_CONTINUATION_PLAYBOOK_20260503.md`

---

## 2. Current state

Trang thai hien tai cua repo va program:

1. SAAS-00 den SAAS-07 da completed trong taskboard SaaS.
2. `packages/core`, `packages/web`, `packages/vip-app`, `packages/mobile` va `shared` da co baseline that.
3. Production frontend manifest da chay qua package-shell host build path.
4. Legacy runtime van con live o cap do control-plane/reference, nhung khong con la huong target architecture moi.
5. Moi work future phai di theo package-first va shared-contract-first, khong quay lai monolith-first.

---

## 3. Final target state

Muc tieu cuoi cung cua program la:

1. `packages/core` la backend/product truth cho control plane, commercial plane va data plane.
2. `packages/web` la frontend source duy nhat cho community, saas va vip build targets.
3. `packages/vip-app` chi con local backend + orchestrator, khong con frontend source rieng.
4. `packages/mobile` la mobile app package duy nhat.
5. `shared` la SSOT cho contracts, constants va schema-level definitions.
6. Legacy roots `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` chi con ton tai trong khoang thoi gian cutover ngan va sau do phai bi decommission.

---

## 4. Planned follow-on slices

### SAAS-08 - Core package adoption

Muc tieu:

1. Chuyen backend truth sang `packages/core`.
2. Gom operator APIs, partner APIs, access/session bootstrap, data-plane read models va runtime jobs vao core boundary ro rang.
3. Chuan hoa compose, tests va contracts de core co the chay doc lap nhu runtime chinh.

Exit criteria:

1. `packages/core` co the chay API/worker/beat topology doc lap.
2. Core-facing routes tra ve versioned contracts tu package layer, khong con le thuoc vao legacy backend internals.
3. Core test suites va compose topology chay ma khong can legacy code path de build truth.

### SAAS-09 - Web package consolidation

Muc tieu:

1. Dua toan bo human-facing SaaS/operator/tenant UI sang `packages/web`.
2. Xoa ranh gioi frontend fork va chot build targets `community`, `saas`, `vip` tren mot source tree.
3. Chuan hoa route catalog, navigation catalog va shell adapters de khong con frontend nhieu source.

Exit criteria:

1. Human-facing page source chinh thuoc `packages/web`.
2. Legacy frontend chi con la host transit ngan hoac decommission cleanup.
3. Cac build target duoc sinh tu mot bo source duy nhat va test parity passed.

### SAAS-10 - VIP app completion

Muc tieu:

1. `packages/vip-app` chi giu local backend va orchestrator.
2. VIP UI phai la build variant tu `packages/web`, khong duoc co frontend source rieng.
3. VIP local storage, RBAC, branding, audit va AI keys phai chay doc lap voi core.

Exit criteria:

1. VIP browser khong can frontend fork.
2. VIP local backend giao tiep voi core chi qua versioned APIs/contracts, khong import internals.
3. Local control plane co the van hanh va audit dong bo trong scope vip.

### SAAS-11 - Mobile package completion

Muc tieu:

1. Dua mobile-app vao `packages/mobile`.
2. Giu mobile surface nhe, dung contract shared va core APIs.
3. Khong de mobile tao rieng mot dieu khien business logic song song voi core.

Exit criteria:

1. Mobile build/runtime doc lap voi package layout moi.
2. Mobile consume contract versioned, khong can legacy runtime path.
3. Contract tests va smoke checks tren mobile lane xanh.

### SAAS-12 - Shared contract lock

Muc tieu:

1. Dong JSON schemas va shared contract cho build target, capability bootstrap, session payload va cac contract chinh.
2. Bat buoc change policy additive/breaking ro rang.
3. Chot validator/generator neu package track con thay payload.

Exit criteria:

1. Moi thay doi contract deu bump version hoac qua duoc gate schema.
2. `shared/` tro thanh SSOT khong tranh cai.
3. Package consumers khong con suy dien payload theo cach rieng.

### SAAS-13 - Legacy removal and manifest finalization

Muc tieu:

1. Loai bo `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` khoi luong van hanh binh thuong.
2. Chuyen compose, CI, workspace va deployment sang `packages/*` + `shared/*`.
3. Xoa route/script/doc reference bam vao legacy runtime sau cua so decommission ngan.

Exit criteria:

1. Production manifest va dev manifest khong con legacy runtime la path chinh.
2. Code grep khong con legacy alias hoac import path trong runtime surface.
3. Audit ledger, progress dashboard va evidence packet ghi nhan decommission final.

---

## 5. Final gate model

Neu bo sung bat cu slice nao, phai dat du cac gate sau:

1. Access gate - capability snapshot versioned, human/machine surface map ro rang.
2. Partner gate - PAT machine-auth va audit reason co snapshot proof.
3. Commercial gate - tenant lifecycle, quota, billing co parity proof.
4. Data gate - freshness, stale, degraded semantics co witness.
5. Shadow gate - dual-run diff va rollback rehearsal da chay.
6. Decommission gate - legacy path removal co route inventory va compose diff.
7. Audit gate - taskboard, ledger, progress dashboard va evidence packet dong bo.

---

## 6. What not to do

1. Khong them feature moi vao legacy runtime.
2. Khong quay lai fork frontend cho VIP hoac OpenCore.
3. Khong xem docs target-state la bang chung code parity.
4. Khong claim SaaS-ready neu production manifest con hybrid hoac conflict residue.
5. Khong claim cutover done neu legacy runtime con la path chinh cho business flow.

---

## 7. Handoff for next session

Neu mot phien sau mo tai lieu nay, thu tu thuc thi phai la:

1. Doc handoff master + execution plan + taskboard + traceability + self-audit + evidence template.
2. Kiem tra xem co slice active nao khong.
3. Mo SAAS-08 neu muon tiep tuc code cutover.
4. Neu taskboard da dong, mo board moi chi khi co requirement moi va co evidence obligations ro rang.

---

## 8. Final note

Tai lieu nay la route chuong trinh cuoi cung de khong con phai tim khap noi. Noi dung thuc thi van phai bam taskboard, ledger, progress va evidence. Nhung neu mot phien sau can hieu `van con phai lam gi de chuyen hoan toan sang SaaS`, tai lieu nay la diem bat dau.