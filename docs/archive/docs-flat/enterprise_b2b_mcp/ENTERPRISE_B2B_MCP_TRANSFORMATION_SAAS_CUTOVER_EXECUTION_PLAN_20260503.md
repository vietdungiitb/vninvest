# EXECUTION PLAN - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

**Ngay:** 2026-05-03  
**Trang thai:** Owner-facing execution plan cho chuyen doi SaaS that su  
**Pham vi:** Mo hinh chuyen tu monolith co package baseline sang SaaS co audit kiem chung, bao gom access plane, control/commercial plane, data plane, shadow run, pilot va legacy decommission.

---

## 0. Muc tieu cuoi

Muc tieu khong phai chi la co package track, admin shell, hay contract pack. Muc tieu la:

1. `core` la SSOT cho tenant, PAT, quota, billing, data truth va audit truth.
2. `web` la single frontend source cho SaaS/operator/tenant admin.
3. `opencore` la distribution and upgrade funnel, khong phai backend truth.
4. `vip-app` la local control plane, khong phai mot frontend source rieng.
5. Legacy runtime duoc decommission sau khi package track dat parity va cutover da duoc kiem chung.

---

## 1. Current-code reality

Tai thoi diem nay repo da co nhung neo sau:

1. Legacy `backend/` va `frontend/` van dang live va van la rollback/reference lane.
2. Package track da co baseline that trong `packages/core`, `packages/web`, `packages/vip-app` va `shared/api-contracts`.
3. Current-code realignment pack da dong admin/operator slices va package parity gates.
4. Vi vay con lai khong phai scaffold nua ma la SaaS cutover, machine-auth hardening, lifecycle parity va decommission.

---

## 2. Khung thuc thi

### Phase 0 - Governance freeze

**Muc tieu:** Khong de cutover plan tro thanh target-state prose.

**Task bat buoc:**

1. Chot file/dir legacy hotfix-only.
2. Chot file/dir package implementation target.
3. Chot audit model: parity, auth, commercial, data freshness, rollback, decommission.
4. Chot single active slice rule cho SaaS board.

**Exit criteria:**

1. Taskboard, traceability matrix va evidence template co link tron bo.
2. Audit ledger/progress dashboard co entry cho moi slice.
3. Nguoi doc co the resume slice moi ma khong can hoi lai owner.

### Phase 1 - Access plane finalization

**Muc tieu:** Tach human session va machine auth de partner APIs co SaaS semantics that.

**Task bat buoc:**

1. Dedicated access service/phat hanh capability snapshot versioned.
2. Hidden bridge semantics cua auth/me va manage-all fallback duoc loai bo hoac doc thanh transitional only.
3. Browser admin/tenant UI chi gate bang snapshot payload, khong suy luan tu flag broad.

**Exit criteria:**

1. Capability bootstrap co versioning, surface map va constraint map ro rang.
2. Human operator va human tenant admin co surface/role/doc truth riemg.
3. Machine PAT khong con la pathway tam cho browser.

### Phase 2 - Partner machine-auth cutover

**Muc tieu:** Partner APIs phai bat dau song voi tenant PAT va scope bundle, khong tiep tuc dua vao human session nhu production truth.

**Task bat buoc:**

1. Issue/rotate/revoke PAT co Idempotency-Key va audit reason.
2. PAT tokens phai map duoc tenant/service-account.
3. Partner route contract phai versioned, list envelope va error model on dinh.

**Exit criteria:**

1. `Authorization: Bearer <tenant_pat>` la auth target cho partner APIs.
2. Browser khong dung machine credential de goi core nhu runtime truth.
3. PAT usage audit co the truy ve actor, service account va request id.

### Phase 3 - Control/commercial parity

**Muc tieu:** Tenant lifecycle va commercial plane co reading/writing truth ro rang.

**Task bat buoc:**

1. Tenant onboard/activate/upgrade/downgrade/suspend/unsuspend/deprovision.
2. Service account va PAT lifecycle gan voi tenant state machine.
3. Usage/quota/subscription/invoice projections khop nhau va co audit replay.

**Exit criteria:**

1. Mot tenant co the di het vong doi SaaS ma khong can manual DB surgery.
2. Suspension va unsuspension co semantics ro rang cho control-plane va data-plane.
3. Billing/usage discrepancy co the truy ve ledgers/projections.

### Phase 4 - Data-plane parity and freshness

**Muc tieu:** Doi sang facts-first serving path.

**Task bat buoc:**

1. Symbol snapshot, session facts va unified alert phai la contract serving truth.
2. Stale/degraded semantics phai co header/field de UI khong noi doi.
3. Raw ticks, fallback scans va ad-hoc query-time composition khong duoc la primary path.

**Exit criteria:**

1. Selected-session path co the chay facts-first.
2. Data-plane read models co freshness witness.
3. UI co the degrade co chu y khi snapshot stale.

### Phase 5 - Shadow run and pilot

**Muc tieu:** Xac minh package track co the thay legacy runtime tren flow that.

**Task bat buoc:**

1. Dual run so payload, auth, gating, route behavior va UX.
2. Pilot cohort nho truoc khi cutover rong.
3. Ghi nhan diff va rollback rehearsal.

**Exit criteria:**

1. Package track khop contract cho flows da scope.
2. Pilot users khong gap regression blockers.
3. Rollback path da duoc thu tren sandbox/hardening env.

### Phase 6 - Cutover and decommission

**Muc tieu:** Chuyen runtime chinh sang packages va loai bo legacy runtime.

**Task bat buoc:**

1. Chuyen compose, CI, workspace va deployment sang `packages/*`.
2. Legacy runtime chi con read-only fallback trong cua so ngan.
3. Xoa routes/scripts/docs/runtime references khong con can.

**Exit criteria:**

1. Runtime chinh chay hoan toan tren package track.
2. Legacy aliases, wrappers va fallback bi go bo theo decommission window.
3. Audit ledger va progress dashboard co entry decommission ro rang.

---

## 3. Cutover gates bat buoc

| Gate | Minimum evidence | Pass khi |
|---|---|---|
| Parity gate | route catalog diff, payload snapshots, shell/backend proof | flows uu tien khop expectation |
| Auth gate | capability snapshot, PAT audit, surface map | human/machine auth da tach ro |
| Commercial gate | tenant/quota/subscription/invoice snapshots | lifecycle va billing khop nhau |
| Data gate | freshness/stale/degrade snapshots | serving truth co witness ro rang |
| Rollback gate | rollback runbook, switchback path | quay ve legacy duoc khong doan |
| Audit gate | taskboard diff, ledger entry, progress mirror, evidence packet | tat ca surfaces dong bo |
| Decommission gate | route inventory, compose/CI/workspace diff | khong con legacy runtime path trong luong van hanh binh thuong |

---

## 4. Deliverables theo workstream

| Workstream | Deliverable chinh | Code/doc surface |
|---|---|---|
| Access plane | capability snapshot versioned, dedicated access service | backend + shared contracts |
| Partner auth | tenant PAT auth path, scope bundle, audit trail | backend + partner API contract |
| Control/commercial | tenant lifecycle, quota, billing, invoices | backend + operator/partner docs |
| Data plane | symbol snapshot, session facts, unified alert | backend + UI data contracts |
| Shadow/pilot | dual-run diff reports, pilot signoff, rollback proof | audit docs + test evidence |
| Decommission | legacy route removal, compose switch, docs cleanup | runtime config + docs |

---

## 5. Decommission checklist

1. Go tat ca path runtime cu trong compose/CI/workspace.
2. Go script/dev helper chi phuc vu legacy.
3. Go docs huong dan deploy bam legacy runtime neu da loi thoi.
4. Dam bao package code khong import/call nguoc legacy internals.
5. Ghi lai evidence decommission trong ledger, progress va handoff packet.

---

## 6. Residual risk note

Neu access plane chua tach xong hoac partner machine-auth chua duoc cutover, SaaS program se chi la monolith co ten moi. Neu data-plane parity chua co freshness witness, UI co the dep nhung van noi doi. Neu legacy decommission chua co rollback gate, cutover co the tao outage thay vi chuyen doi.