# VNINVEST Project Delivery Playbook (Production-Ready)

Tai lieu nay chuan hoa quy trinh xay dung du an vninvest sat voi thuc te trien khai hien tai, duoc suy ra tu blueprint chung va cac quy tac governance da ap dung trong repo.

## TUYEN BO BAT BUOC (NO-EXCEPTION POLICY)

Tu ngay 2026-04-18, moi hoat dong phat trien trong vninvest bat buoc tuan thu day du tai lieu nay.

Khong co ngoai le cho bat ky doi tuong nao:
- Feature moi.
- Bugfix.
- Hotfix production.
- Refactor noi bo.
- Tai lieu governance lien quan den trien khai.

Neu mot thay doi khong dap ung day du gate trong playbook (Plan-First, Test Pyramid, Audit Ledger, Release Gate), thay doi do khong du dieu kien merge va khong duoc xem la hoan tat.

---

## 1) Muc tieu va pham vi

- Chuan hoa quy trinh Plan-First cho moi thay doi quan trong.
- Chuan hoa test strategy theo Test Pyramid: Unit 60% / Integration 30% / E2E-UAT 10%.
- Chuan hoa Audit Ledger de truy vet thay doi va quan tri rui ro.
- Dinh nghia stack high-scale va cach ap dung vao tung module.
- Dinh nghia release gate va rollback gate de dat production-ready.

Phan loai thay doi:
- Level A (Major): thay doi schema, API contract, realtime pipeline, auth/permission, tinh nang AI advisory, performance hot-path.
- Level B (Medium): thay doi service/business logic, admin workflow, adapter wrappers.
- Level C (Minor): text/i18n UI, docs, test hardening khong doi contract.

Quy tac gate:
- Level A/B bat buoc Implementation Plan duoc chot truoc khi code.
- Level C co the fast-track, nhung van phai co test evidence + audit file list.

---

## 2) Quy trinh 8 giai doan (ap dung cho vninvest)

### Giai doan 0 - Intake va Scope Lock

Dau vao:
- Feature request, bug report, production incident, hoac governance ask.

Buoc thuc hien:
1. Mo ta van de theo template: symptom -> impact -> scope -> urgency.
2. Gan muc uu tien P0/P1/P2/P3.
3. Phan loai Level A/B/C.
4. Chot owner va due date.

Dau ra bat buoc:
- Scope lock statement (in/out of scope).
- Danh sach API/module co the bi anh huong.

### Giai doan 1 - Plan-First (Definition of Ready)

Dau vao:
- Scope lock da duoc thong nhat.

Buoc thuc hien:
1. Tao Implementation Plan tai docs/ (neu Level A/B).
2. Ghi ro:
   - Business KPI va acceptance criteria.
   - Current-state assessment.
   - Target architecture + data flow.
   - API/schema contract.
   - Risk matrix + rollback strategy.
3. Chia thanh slices nho (co test strategy cho moi slice).
4. Owner xac nhan va chot plan.

Dau ra bat buoc:
- Plan doc (approved).
- Definition of Ready = PASS.

Cam:
- Khong duoc code truoc khi plan duoc chot (Level A/B).

### Giai doan 2 - Design Contract + Migration Strategy

Buoc thuc hien:
1. Chot contract cho API payloads (request/response/errors).
2. Chot backward compatibility:
   - versioning,
   - fallback behavior,
   - deprecation window.
3. Chot migration strategy:
   - DB/data migration,
   - cache invalidation,
   - feature flag rollout.

Dau ra bat buoc:
- Canonical contract doc.
- Migration checklist.

### Giai doan 3 - Implementation by Vertical Slice

Nguyen tac coding:
- Service layer: business logic.
- Adapter layer: external provider access (vnbroker, third-party APIs).
- Views/API layer: auth + orchestration, khong nhan logic nang.
- Frontend: page/container + reusable components + API clients + i18n.

Buoc thuc hien:
1. Implement slice 1 (smallest deployable path).
2. Add tests cho slice 1.
3. Validate locally.
4. Lap lai voi slice 2..N.

Rang buoc quan trong:
- Khong them direct provider calls ngoai adapter (vd: vnbroker).
- Tranh fat-file: canh bao >= 700 lines, chan merge >= 1000 lines neu khong co allowlist.

### Giai doan 4 - Verification (Test Pyramid)

Ty le muc tieu:
- Unit tests ~60%: helper/service/adapter behaviors.
- Integration tests ~30%: Django endpoints, cross-module flows, DB/cache boundaries.
- E2E/UAT ~10%: critical user journeys, staff workflows.

Checklist verification:
1. Functional correctness.
2. Edge cases (null/empty/invalid).
3. Security/permission checks.
4. Performance constraints hot-path.
5. Observability (structured logs + measurable metrics).

Dau ra bat buoc:
- Test evidence list (commands + pass ratios).
- No unresolved P0/P1 defects.

### Giai doan 5 - Ops Readiness + Release Gate

Release gate bat buoc:
1. Contract compatibility verified.
2. Data path safe under load (async/background where needed).
3. Health endpoints va alerts hoat dong.
4. Rollback strategy rehearse-able.
5. Documentation complete.

Rollout pattern uu tien:
- Feature flag on dev -> staging-like verification -> controlled prod enable.
- Neu feature dai latency: dung 202 Accepted + polling/background jobs.

### Giai doan 6 - Audit Ledger + Handover

Bat buoc sau moi task hoan tat:
1. Cap nhat docs/CODE_CHANGE_AUDIT_LEDGER.md.
2. Cap nhat PROGRESS_DASHBOARD.md (audit file list dong bo).
3. Liet ke day du file modified/new + validation evidence.
4. **Campaign Closure Persistence (Mandatory):** Ghi lai toan bo bo tai lieu (Plan, Tech Spec, Taskboard, Walkthrough) thanh cac file `.md` vật lý trong thu muc `docs/`.

Task duoc xem la chua dong vong neu thieu 1 trong 2 tai lieu tren.

### Giai doan 7 - Post-Release Hardening

Buoc thuc hien:
1. Theo doi logs/metrics trong 24-72h.
2. Review slow queries, retry rates, cache hit rates.
3. Chot action hardening tiep theo.

Dau ra:
- Post-release note + hardening backlog.

---

## 3) Cong nghe ap dung cho vninvest (thuc te)

Backend/Core:
- Django 6 + ASGI (Daphne) cho API + realtime gateway.
- Django Channels cho WebSocket flows.
- Celery + Redis cho asynchronous/background processing.
- Redis Streams/pubsub cho realtime ticker/events fanout.
- Pandas vectorized transforms cho khau xu ly du lieu khoi luong lon.
- Adapter architecture cho provider abstraction (vnbroker wrapper).

Frontend:
- React architecture theo page + component + api client.
- i18n dictionary (vi/en), uu tien tieng Viet cho UX thuc te.
- UI update throttling/batching cho dashboard realtime.

Data/Ops:
- PostgreSQL cho persisted operational data.
- Redis cho cache, stream, task broker/result channel.
- Docker Compose cho local/dev/prod-like orchestration.

Testing/Quality:
- Django test framework + targeted module suites.
- Frontend test commands theo feature scope.
- Governance checks: large-file guard, audit file list compliance.

---

## 4) Quy dinh bat buoc (Mandatory Rules)

1. Plan-First policy:
- Level A/B: khong code truoc khi co Implementation Plan duoc xac nhan.

2. Test Pyramid policy:
- Moi feature phai co test theo dung cap; khong chi test happy path.

3. Audit policy:
- Bat buoc cap nhat docs/CODE_CHANGE_AUDIT_LEDGER.md va PROGRESS_DASHBOARD.md sau moi task complete.

4. Adapter policy:
- Cam direct external-provider invocation ben ngoai adapter layer.

5. Security policy:
- Endpoint staff/admin bat buoc role checks.
- Khong expose secrets trong logs/docs/commits.

6. Performance policy:
- Heavy compute/cham network phai duoc async hoa (Celery/background).
- Uu tien SQL projection cho filtering/chon loc va Pandas vectorization cho tinh toan lon.

7. Frontend i18n policy:
- UI text moi phai di qua i18n keys; tranh hardcoded strings.

8. Non-regression policy:
- Moi bug fix can co regression test neu thuc te cho phep.

9. Market Data SSOT policy (MDSU):
- Moi logic truy van gia/chi bao cho `DailyPrice` phai di qua `MarketDataService` (service facade duy nhat).
- Cam query truc tiep `DailyPrice.objects.filter/order_by/annotate` tai views/tasks/backfill modules nghiep vu.
- Bat buoc dung API canonical cua service: `get_ohlcv_batch`, `get_latest_snapshot`, `get_historical_indicators`.

10. Data interpretation policy:
- Dinh nghia `latest`, `reference`, `indicator window` la contract canonical, khong duoc tu dinh nghia lai theo module.
- Bat buoc khai bao timezone/trading-date policy va missing-candle policy trong tech spec khi thay doi.

11. Migration safety policy (strangler):
- Refactor MDSU phai rollout theo feature flag theo module, cam big-bang rewrite.
- Bat buoc co parity checks old/new va rollback switch cho tung phase.

12. Caching policy (hybrid):
- Cho luong batch lon: dung local-context cache de tranh query lap trong 1 request/job.
- Cho luong cross-request: dung Redis cache co TTL/version key ro rang va invalidation theo trading date.

13. Campaign Closure Persistence policy:
- Ngay sau khi hoan tat triển khai và đóng chiến dịch, AI BAT BUOC phai luu toan bo tai lieu audit/nghiem thu thanh file vat ly trong `docs/`. Nghiem cam chi de duoi dang artifact tam thoi.

---

## 5) Workflow thuc thi chuan (day-to-day)

1. Nhan request -> classify Level A/B/C.
2. Tao/duyet plan (neu A/B).
3. Implement theo slices nho.
4. Chay test scope lien quan + smoke regression.
5. Cap nhat audit ledger + progress dashboard.
6. Commit theo logical batch.
7. Push dev + theo doi sau release.

Definition of Done (DoD):
- Acceptance criteria dat.
- Test evidence day du.
- Audit docs da cap nhat (Audit Ledger + Progress Dashboard).
- **Campaign Closure Docs persisted to `docs/` folder.**
- Khong co blocker P0/P1.
- Rollback notes san sang.

---

## 6) Mau checklist van hanh nhanh

Pre-code checklist:
- [ ] Scope lock done.
- [ ] Plan approved (neu Level A/B).
- [ ] Contract + migration strategy defined.
- [ ] Test strategy by layer defined.
- [ ] Neu co `DailyPrice`/market indicators: da co MDSU plan (service API + cache + feature flag + parity test).

Pre-merge checklist:
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] E2E/UAT critical path pass (neu scope can).
- [ ] Security/permission checks pass.
- [ ] Audit ledger + progress dashboard updated.
- [ ] Khong con query truc tiep `DailyPrice` o module vua thay doi (da map qua `MarketDataService`).
- [ ] Da co evidence p95/query-count/cache-hit old vs new cho scope MDSU.

Post-deploy checklist:
- [ ] Health endpoints green.
- [ ] Error rate khong tang bat thuong.
- [ ] Latency nam trong nguong chap nhan.
- [ ] Rollback plan con hieu luc.

---

## 7) De xuat ap dung ngay cho cac du an sau

- Dung tai lieu nay lam template governance goc.
- Tach rieng 3 tai lieu bat buoc cho moi major feature:
  1) PLAN_*.md
  2) SPEC_*.md (contract)
  3) AUDIT_*.md
- Su dung cung mot release gate checklist de giam sai lech chat luong giua cac team.

Ket luan:
- Blueprint da duoc nang cap thanh playbook thuc thi sat vninvest.
- Neu tuan thu day du 8 giai doan + mandatory rules, quy trinh se dat muc production-ready on dinh va truy vet duoc.

---

## 8) Cong nghe dai phau du lieu thi truong (Mandatory Naming)

Ten chuan de dung trong toan bo tai lieu du an:
- `MDSU - Market Data Service Unification`.

MDSU la to hop 5 thuc hanh kien truc bat buoc:
1. `Service Layer Architecture`: mot service facade truy cap gia/chi bao.
2. `Single Source of Truth (SSOT)`: mot dinh nghia canonical cho latest/reference/indicator.
3. `Strangler Fig Migration Pattern`: thay the dan theo module bang feature flag.
4. `Hybrid Caching`: local context cache + Redis cache co version/TTL.
5. `Canonical Data Access Contract`: contract API du lieu thi truong dung chung toan he thong.

Quy tac governance bat buoc:
- Moi Implementation Plan lien quan market data phai ghi ro feature thuoc chuong trinh `MDSU`.
- Moi PR lien quan market data phai co muc "MDSU compliance" (YES/NO + evidence).
- Neu khong dat MDSU compliance thi khong du dieu kien merge.
