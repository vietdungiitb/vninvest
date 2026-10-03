# Execution Plan - Next 4 Weeks

Muc tieu:
- Bien roadmap va playbook thanh ke hoach thuc thi co the chay ngay.
- Dam bao team co viec ro rang theo ngay, theo owner, theo KPI.

Tai lieu lien quan:
- docs/IMPLEMENTATION_PLAYBOOK_L2_1_TO_L2_2.md
- docs/SPRINT7_P0_P1_BACKLOG.md
- docs/BACKEND_TECHNICAL_DIAGRAM_L2_1.md
- docs/BACKEND_TECHNICAL_DIAGRAM_L2_2.md

## Tuan 1 - Route Ownership va Contract Freeze

### Muc tieu tuan
1. Chot mapping endpoint old -> new.
2. Chot ownership namespace portfolio vs stock-management.
3. Dong bo frontend API map khong con route mo ho.

### Ke hoach theo ngay

Day 1:
- BE: Xuat endpoint inventory hien tai.
- BE Lead: Chot bang ownership endpoint.
- FE: Kiem ke endpoint dang su dung trong client.

Day 2:
- BE: Tao draft namespace target theo L2.2.
- BE + FE: Hop contract 60 phut, chot response/error schema.
- QA: Tao danh sach smoke test endpoint critical.

Day 3:
- BE: Refactor route include va namespace.
- FE: Chuyen API client sang route moi.
- QA: Chuan bi test case regression Dashboard/Transactions/Watchlist.

Day 4:
- BE: Chuan hoa deprecation notes cho route cu.
- FE: Hoan tat fallback UX khi API fail/stale.
- QA: Chay smoke test dot 1.

Day 5:
- Team: Bugfix va khoa scope.
- Lead: Review KPI tuan + carry-over plan.

### Deliverables
- Endpoint ownership table.
- Namespace route da chot.
- Frontend API map da dong bo.
- Smoke report dot 1.

### KPI tuan
- 0 endpoint trung ownership.
- 0 loi 404 tren 3 flow chinh.

## Tuan 2 - Backend Stabilization va Contract Tests

### Muc tieu tuan
1. On dinh endpoint P0.
2. Co contract tests cho auth/portfolio/stock-management.
3. Co rollback note su dung duoc.

### Ke hoach theo ngay

Day 1:
- BE: Chuan hoa error payload (code/message/detail).
- QA: Viet skeleton contract tests.

Day 2:
- BE: Hoan tat sync endpoint namespace (admin-sync hoac quy uoc da chot).
- FE: Tinh chinh call-site con lai.

Day 3:
- QA + BE: Chay contract tests dot 1, ghi loi mismatch.
- BE: Sua mismatch theo test report.

Day 4:
- DevOps: Soan release/rollback checklist.
- QA: Chay regression day du.

Day 5:
- Team: Demo sprint progress.
- Lead: Ky xac nhan P0 done.

### Deliverables
- Contract test suite pass.
- Error schema thong nhat.
- Release + rollback checklist.

### KPI tuan
- Contract test pass >= 95%.
- Khong co loi blocker tren luong auth va portfolio.

## Tuan 3 - Realtime Foundation (Skeleton)

### Muc tieu tuan
1. Dung khung /api/realtime/*.
2. Co Redis key schema va doc cache endpoint.
3. Co worker polling skeleton (chua can full scale).

### Ke hoach theo ngay

Day 1:
- BE: Chot Redis key schema.
- DevOps: Chuan bi Redis/Celery env local.

Day 2:
- BE: Tao realtime read endpoint + stale flag.
- FE: Tao polling hook 5s co pause khi tab hidden.

Day 3:
- BE: Tao collector worker skeleton + logging.
- QA: Test cache miss/cache hit.

Day 4:
- BE: Gan compute VWAP/whale placeholder.
- FE: Hien thi trang thai du lieu stale.

Day 5:
- Team: Benchmark nhe p95 latency.
- Lead: Chot backlog tuan 4 theo ket qua benchmark.

### Deliverables
- Realtime API skeleton.
- Redis key schema doc.
- Worker skeleton chay local.

### KPI tuan
- p95 realtime read < 80ms local.
- 0 crash frontend khi cache miss.

## Tuan 4 - Hardening truoc Sprint tiep theo

### Muc tieu tuan
1. Khoa chat luong va monitor can ban.
2. Chuan bi giao cho sprint Performance + TWR.

### Ke hoach theo ngay

Day 1:
- DevOps: Cau hinh structured logging.
- BE: Bo sung metric counter cho sync/realtime.

Day 2:
- QA: Chay full regression + smoke sau deploy thu.
- FE: Sua bug UI/UX theo regression.

Day 3:
- BE: Don debt P1 con lai (deprecation, data fix command neu can).
- QA: Verify lai P1.

Day 4:
- Team: Dress rehearsal release.
- DevOps: Test rollback mot lan.

Day 5:
- Team: Retro + chot handover cho sprint sau.
- Lead: Chot KPI tong 4 tuan.

### Deliverables
- Monitoring can ban (log + metric).
- Regression report full.
- Go-live readiness checklist.

### KPI tuan
- 0 blocker mo truoc sprint tiep theo.
- Rollback dry-run thanh cong.

## Bang phan cong mac dinh

| Vai tro | Trach nhiem chinh |
|---|---|
| BE Lead | Chot route ownership, review contract |
| BE Dev | Refactor API, sync endpoint, realtime skeleton |
| FE Dev | API remap, fallback UX, polling client |
| QA | Contract tests, regression, smoke |
| DevOps | Env, logging/metric, release/rollback |

## Rule van hanh bat buoc

1. Moi thay doi route phai cap nhat OpenAPI va docs trong ngay.
2. PR lien quan namespace phai duoc review boi BE Lead va FE owner.
3. Khong merge neu contract tests endpoint critical dang fail.
4. Moi tuan co 1 smoke report va 1 risk log.

---

## Rebaseline 2026-04-04 - Sprint 18 (Google Mail OAuth2 in Django Admin)

Muc tieu bo sung:
- Dua sprint moi ve quan tri tai khoan gui mail Google theo OAuth2 token.
- Giu tuong thich nguoc voi SMTP legacy, rollout an toan theo canary.

### Tuan R1 - Schema + OAuth foundation

Day 1:
- BE: Finalize model fields + migration cho `SystemEmailAccount` OAuth2.
- DevOps: Chot env var matrix cho OAuth client id/secret va callback URI.

Day 2:
- BE: Implement admin connect URL + callback handler + state validation.
- QA: Viet test case callback success/failure/state mismatch.

Day 3:
- BE: Luu refresh token encrypted + metadata status trong admin.
- QA: Chay regression SMTP legacy gui test mail.

Deliverables:
- Migration pass.
- Connect Google flow chay duoc tren local/staging.

### Tuan R2 - Gmail send integration + hardening

Day 1:
- BE: Implement gmail send adapter va token refresh service.
- BE: Noi adapter vao `send_system_email` branch theo `auth_type`.

Day 2:
- BE + QA: Mapping loi API va message van hanh.
- QA: Integration test `send_test_email` qua OAuth2 account (mock + staging).

Day 3:
- DevOps: Canary rollout 1 account default.
- Team: Theo doi metric gui mail + refresh fail trong 24h.

Deliverables:
- OAuth2 send mail end-to-end.
- Checklist Sprint 18 sign-off.

### KPI bo sung cho sprint moi

- Test mail thanh cong voi OAuth2 >= 98% tren moi truong test.
- 0 regression flow email verification.
- 100% secret/token duoc mask trong logs.
