# Implementation Playbook: L2.1 -> L2.2

Muc dich:
- Chuyen kien truc backend tu trang thai hien tai (Level 2.1) sang trang thai muc tieu (Level 2.2).
- Su dung lam tai lieu trien khai cho Sprint 7 -> Sprint 10.

Tai lieu tham chieu:
- docs/BACKEND_TECHNICAL_DIAGRAM_L2_1.md
- docs/BACKEND_TECHNICAL_DIAGRAM_L2_2.md
- docs/SPRINT7_P0_P1_BACKLOG.md
- docs/IMPLEMENTATION_BOARDS.md

## 1) Scope chuyen doi

In-scope:
1. Chuan hoa namespace API.
2. Giam route overlap va endpoint trung y nghia.
3. Dong bo frontend API client theo contract moi.
4. Bo sung khung /api/realtime/* va /api/admin-sync/*.
5. Contract testing + migration/rollback playbook.

Out-of-scope (giai doan sau):
1. Hoan chinh toan bo Robo-Advisor.
2. Toi uu hieu nang nang cao tren production traffic that.

## 2) Roadmap thuc thi theo phase

### Phase 0 - Baseline va freeze (0.5-1 ngay)
Muc tieu:
- Dong bo baseline truoc khi doi route.

Cong viec:
1. Export endpoint inventory hien tai.
2. Chot ownership endpoint: portfolio vs stock-management.
3. Dong bo branch naming va migration policy.

Exit criteria:
- Co bang endpoint inventory signed-off.

### Phase 1 - Namespace standardization (1-2 ngay)
Muc tieu:
- Dinh nghia route to-be khong overlap.

Cong viec:
1. Tao namespace /api/portfolio/* ro rang.
2. Giu /api/stock-management/* cho stock catalog/group/item.
3. Tao namespace /api/admin-sync/* (hoac route sync nhat quan).
4. Danh dau deprecation cac route legacy.

Exit criteria:
- Mapping old -> new route day du, khong ambiguities.

### Phase 2 - Backend implementation (2-3 ngay)
Muc tieu:
- Refactor route/view/service theo namespace moi.

Cong viec:
1. Chuyen urlpatterns va include theo ownership.
2. Chuan hoa response schema loi API.
3. Dam bao command sync tra trang thai ro rang.
4. Tao placeholder /api/realtime/* voi contract co ban.

Exit criteria:
- Tat ca endpoint P0 pass smoke test.

### Phase 3 - Frontend alignment (1-2 ngay)
Muc tieu:
- Frontend khong con goi route legacy.

Cong viec:
1. Cap nhat API client constants.
2. Cap nhat pages Dashboard/Transactions/Watchlist.
3. Them fallback UX khi API stale/timeout.

Exit criteria:
- 3 luong chinh chay end-to-end khong 404.

### Phase 4 - Contract test va hardening (1-2 ngay)
Muc tieu:
- Khoa chat luong cho rollout.

Cong viec:
1. Viet contract tests cho namespace moi.
2. Them smoke tests sau deploy.
3. Cap nhat OpenAPI v1.1.
4. Chot migration note + rollback note.

Exit criteria:
- Test pass va rollout checklist dat 100%.

## 3) Bang cong viec trien khai chi tiet

| Workstream | Task | Owner | Estimate | Dependency | Deliverable |
|---|---|---|---|---|---|
| API Design | Old->New mapping table | BE Lead | 0.5d | None | Route mapping doc |
| API Design | Deprecation policy | BE Lead | 0.5d | Mapping | Deadline + warning text |
| Backend | Refactor URL include | BE | 1d | Mapping | New namespace routes |
| Backend | Sync endpoints standardization | BE | 0.5d | Refactor URL | /api/admin-sync/* ready |
| Backend | Error response normalization | BE | 0.5d | Refactor URL | Unified error schema |
| Frontend | API client remap | FE | 1d | New routes | No legacy calls |
| Frontend | Fallback UX | FE | 0.5d | API remap | Graceful degraded mode |
| QA | Contract tests | QA/BE | 1d | API + FE done | Contract suite pass |
| DevOps | Rollback script + runbook | DevOps | 0.5d | Backend done | Rollback checklist |

## 4) Checklist trien khai truoc/sau release

Pre-release:
- [ ] OpenAPI da cap nhat namespace moi.
- [ ] Frontend khong con endpoint legacy trong client.
- [ ] Smoke test qua luong auth/portfolio/stock-management.
- [ ] Co feature flag hoac deprecation gate (neu can).

Release:
- [ ] Deploy backend.
- [ ] Run migration (neu co thay doi DB).
- [ ] Deploy frontend.
- [ ] Chay smoke test ngay sau deploy.

Post-release:
- [ ] Theo doi 404/500 rate trong 60 phut dau.
- [ ] Theo doi login success rate.
- [ ] Theo doi API latency p95.
- [ ] Chot bien ban release va issue phat sinh.

## 5) Test plan toi thieu

1. Auth flow:
- token obtain
- token refresh

2. Portfolio flow:
- list/create portfolio
- list/create transactions theo subaccount
- holdings/summary/chart/allocation

3. Stock-management flow:
- list stocks
- list groups
- list group items
- trigger sync endpoint

4. Regression:
- Dashboard load
- Transactions load + create/delete
- Watchlist load + sync button

## 6) Risk register va giam thieu

Risk 1: FE goi route cu sau khi BE doi namespace
- Giam thieu: lock-step release + contract test + grep endpoint legacy.

Risk 2: Sync endpoint treo do subprocess
- Giam thieu: timeout + response error code chuan + logging output.

Risk 3: Overlap route gay nham ownership
- Giam thieu: route mapping table bat buoc review boi BE lead.

Risk 4: Regression man hinh Watchlist
- Giam thieu: smoke script cho watchlist APIs truoc va sau deploy.

## 7) Rollback strategy

Dieu kien rollback:
1. 5xx tang bat thuong > nguong canh bao.
2. Login/portfolio flow fail lien tuc.
3. Frontend khong load du lieu tren >30% session test.

Buoc rollback:
1. Rollback frontend ve ban release truoc.
2. Rollback backend ve image truoc.
3. Neu co migration schema, apply rollback migration da duyet.
4. Verify 3 flow chinh (auth, dashboard, watchlist).

## 8) DoD cho tai lieu trien khai

- Co mapping 2.1 -> 2.2 ro rang.
- Co task list theo owner va estimate.
- Co checklist release va rollback.
- Co test plan toi thieu de chan regression.
