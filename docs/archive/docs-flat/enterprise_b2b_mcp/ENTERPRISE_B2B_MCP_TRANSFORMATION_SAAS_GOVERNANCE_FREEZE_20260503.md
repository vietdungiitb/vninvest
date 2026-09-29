# SAAS GOVERNANCE FREEZE - ENTERPRISE B2B MCP TRANSFORMATION

**Ngay:** 2026-05-03  
**Trang thai:** SAAS-00 execution artifact  
**Muc tieu:** Dong dinh nghia legacy hotfix-only, package implementation target, va change policy de cac slice SaaS tiep theo khong bi quay nguoc ve monolith.

---

## 1. Freeze decision

Quyet dinh freeze cho program SaaS nay la:

1. `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` la legacy runtime/reference/fallback lane.
2. Moi nang cap nghiep vu moi phai vao `packages/*` hoac `shared/*`.
3. Legacy path chi duoc cham khi la hotfix, parity fix, rollback fix, hoac decommission cleanup.
4. `packages/web` la frontend source duy nhat cho SaaS/operator/tenant admin, `packages/opencore` va `packages/vip-app` khong duoc fork frontend source rieng.
5. `packages/core` la backend/product truth cho control plane, commercial plane va data plane.

---

## 2. Hotfix-only surfaces

Legacy runtime chi duoc cham trong cac truong hop sau:

1. Sua bug runtime dang gay outage hoac break contract hien tai.
2. Parity fix tam thoi de package track tiep tuc so sanh duoc voi legacy truth.
3. Rollback fix khi cutover/pilot gap xuat hien.
4. Decommission cleanup khi legacy path duoc go bo.

### Hotfix-only list

- `backend/`
- `frontend/`
- `mobile-app/`
- `opennews-main/`
- `infra/`

---

## 3. Package implementation targets

Tat ca workstream SaaS moi phai di vao mot trong cac target sau:

- `packages/core` - tenant, PAT, quota, billing, capability snapshot, partner APIs, data-plane truth.
- `packages/web` - SaaS/operator/tenant admin frontend shell va route gating.
- `packages/opencore` - community/self-host distribution va upgrade funnel.
- `packages/vip-app` - local control plane, local auth, local vault, local orchestration.
- `shared` - API contracts, constants, additive change policy.

---

## 4. Change policy

1. Khong bulk-move runtime code cũ vao packages trong mot dot rename lon.
2. Khong dua business feature moi vao legacy path.
3. Khong cho browser VIP cam machine credential cua core.
4. Khong cho partner API tiep tuc dua vao human session nhu production truth.
5. Khong de package track claim cutover-ready neu chua co audit evidence.

---

## 5. Freeze evidence

Moi thay doi lien quan SAAS-00 phai co:

1. taskboard sync,
2. audit ledger entry,
3. progress dashboard sync,
4. evidence template da dien,
5. handoff packet cho slice tiep theo.

---

## 6. Open questions already blocked by this freeze

Tai thoi diem freeze, cac cau hoi sau khong con duoc mo lai nhu target-state prose:

1. Legacy co con duoc coi la noi phat trien feature moi khong? Khong.
2. Package track co duoc xem la implementation target khong? Co.
3. Cutover co the mo neu chua co parity/auth/commercial/data/shadow/decommission evidence khong? Khong.

---

## 7. Slice exit criteria

SAAS-00 chi duoc xem la dong khi tat ca dieu kien sau co:

1. Freeze boundary ro rang giua legacy hotfix-only va package implementation target.
2. Change policy khong con ambiguity.
3. Taskboard va audit surfaces dong bo.
4. Route tiep theo sang `SAAS-01` da co trong handoff master va execution plan.

---

## 8. Residual note

Tai lieu nay la gatekeeper cho cac slice SaaS tiep theo. Neu moi voi lai legacy de lam nhanh, program se tro ve modular monolith thay vi SaaS.