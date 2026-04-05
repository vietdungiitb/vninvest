# Sprint 21-22 Fat Views Execution-Ready Backlog

**Trang thai:** READY FOR SPRINT PLANNING  
**Pham vi:** Chuyen lo trinh refactor Fat Views thanh backlog co the giao viec ngay cho Sprint 21 va Sprint 22  
**Tai lieu nen:**
- `docs/SYSTEM_ARCHITECTURE_AUDIT.md`
- `docs/REFACTOR_FAT_VIEWS_DESIGN.md`
- `docs/REFACTOR_EXECUTION_PLAN.md`

**Dieu kien kich hoat:** Backlog nay chi duoc dua vao sprint planning thuc thi sau khi Sprint 20 i18n da hoan tat va co sign-off.

---

## 1. Nguyen tac lap backlog

1. Khong big-bang rewrite.
2. Khong dung `backend/portfolio/new_views/`.
3. Market Data di truoc, Trading di sau va chi vao khi gate da dat.
4. Moi phase deu co feature flag, regression test, benchmark va rollback trigger.
5. Scope Trading production canary la **co dieu kien**; neu gate Sprint 22 khong dat thi carry sang sprint tiep theo.
6. Khong duoc khoi dong task code trong backlog nay neu Sprint 20 chua dong.

---

## 2. Workstream va owner mac dinh

| Workstream | Owner chinh | Owner du phong |
| :--- | :--- | :--- |
| WS-A Baseline, flags, observability | Tech Lead + DevOps | Backend Lead |
| WS-B Market Data refactor | Backend Engineer | Tech Lead |
| WS-C QA va benchmark | QA Engineer | Backend Engineer |
| WS-D Realtime connection manager | Frontend Engineer | Frontend Lead |
| WS-E Trading boundary preparation | Backend Engineer | Tech Lead |

---

## 3. Sprint 21 - Phase 0 + Phase 1

**Muc tieu sprint:**
1. Chot baseline metric va feature flag.
2. Refactor xong Market Data theo boundary `Views -> Services -> Adapters`.
3. Mo duoc canary 10% cho Market Data tren staging/nhom noi bo.

**Precondition:** Sprint 20 da hoan tat backend `UserConfig.language`, frontend web i18n, sync cross-platform va smoke/sign-off co ban.

### Trang thai thuc thi cap nhat (2026-04-05)

| Sprint 21 task | Trang thai hien tai |
| :--- | :--- |
| S21-01 | PARTIAL - da co rollback thresholds, con can ky measurement contract |
| S21-02 | DONE |
| S21-03 | DONE |
| S21-04 | PENDING OPS - can dashboard baseline + alert fire test runtime |
| S21-05 | DONE |
| S21-06 | DONE |
| S21-07 | DONE |
| S21-08 | DONE |
| S21-09 | DONE |
| S21-10 | DONE |
| S21-11 | DONE |
| S21-12 | PENDING OPS - can benchmark + canary 10% trong cua so 24h |

Tai lieu van hanh de dong Sprint 21:
- `docs/SPRINT21_OPERATIONS_CHECKLIST.md`
- `docs/SPRINT21_OPS_RUNBOOK_COMMANDS.md`
- `docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md`
- `docs/SPRINT21_REVIEW_20260405.md`
- `docs/SPRINT21_EXECUTION_EVIDENCE_STAGING_PREFILL_20260405.md`

### Backlog Sprint 21

| ID | Task | Owner | Estimate | Phu thuoc | Output | Acceptance criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S21-01 | Chot measurement contract va alert thresholds | Tech Lead | 0.5d | Khong | Bang metric chot cuoi | Co van ban chot 4 metric chung, co nguong rollback `5xx > 1.5%/5 phut` va `p95 > 500ms/5 phut` |
| S21-02 | Khai bao feature flags trong Django settings | Backend Engineer | 0.5d | S21-01 | Flags trong settings/env | Co `ENABLE_NEW_MARKET_VIEWS`, `ENABLE_NEW_TRADING_VIEWS`, `ENABLE_REALTIME_CONNECTION_MANAGER`; default deu `false` |
| S21-03 | Tao `portfolio/exceptions.py` va chuan hoa exception map | Backend Engineer | 0.5d | S21-02 | Module exception dung chung | Co `ExternalSystemException` va `BusinessLogicRuleException`; views map duoc sang HTTP theo design doc |
| S21-04 | Tao dashboard baseline va alert rules | DevOps | 1d | S21-01 | Dashboard Grafana/APM | Theo doi duoc p95, 5xx, throttle, cache hit/miss; alert test thu thanh cong 1 lan |
| S21-05 | Lap inventory endpoint Market Data trong `views.py` | Backend Engineer | 0.5d | S21-02 | Bang mapping endpoint | Co danh sach endpoint cu, serializer, query params, auth rule, cache behavior |
| S21-06 | Implement `adapters/vnstock_adapter.py` | Backend Engineer | 1.5d | S21-03, S21-05 | Adapter goi provider | Tat ca network/retry/rate-limit parsing cua Market Data muc tieu khong con nam truc tiep trong fat view |
| S21-07 | Implement `adapters/cache_adapter.py` | Backend Engineer | 0.5d | S21-03, S21-05 | Cache adapter | Cache get/set duoc dong goi thanh mot boundary rieng, co test happy path va miss path |
| S21-08 | Implement `services/market_data_service.py` | Backend Engineer | 1.5d | S21-06, S21-07 | Service Market Data | Business logic chinh da duoc dua vao service; view moi chi con parse/auth/serialize |
| S21-09 | Implement `market_views.py` va router toggle | Backend Engineer | 1d | S21-08 | View moi sau flag | Endpoint contract giu nguyen; bat/tat duoc bang `ENABLE_NEW_MARKET_VIEWS` ma khong sua code nong |
| S21-10 | Viet contract tests cho Market Data | QA Engineer | 1d | S21-09 | Test suite contract | Schema, status code, error shape cua implementation moi khop legacy o cac endpoint da chon |
| S21-11 | Viet regression tests auth/throttle/cache/fallback | QA Engineer + Backend Engineer | 1d | S21-09 | Regression suite | Auth JWT, throttle, cache hit/miss, provider fallback deu co test pass |
| S21-12 | Benchmark va canary 10% cho Market Data | QA Engineer + DevOps | 1d | S21-10, S21-11 | Bao cao benchmark + canary | Canary 10% chay on dinh, khong cham rollback trigger trong cua so quan sat da chot |

### Sprint 21 Exit Gate

**Go khi:**
1. `market_views.py` chay sau feature flag, contract khong doi.
2. Contract tests va regression tests deu pass.
3. Canary 10% on dinh, khong vi pham rollback trigger.

**No-Go khi:**
1. Phat sinh circular import moi.
2. Cach bat/tat feature flag chua du nhanh cho QA/Ops.
3. Benchmark cho thay p95 xau hon legacy > 10% ma khong co ly do ro rang.

---

## 4. Sprint 22 - Phase 2 + Phase 3 Entry

**Muc tieu sprint:**
1. Hoan tat connection manager toan cuc cho realtime.
2. Nhan canary Market Data len 50% roi 100% neu metric an toan.
3. Chuan bi Trading boundary de sang sprint tiep theo co the rollout co kiem soat.

### Trang thai thuc thi cap nhat (2026-04-05)

| Sprint 22 task | Trang thai hien tai |
| :--- | :--- |
| S22-01 | PENDING OPS |
| S22-02 | PENDING OPS |
| S22-03 | DONE (code) |
| S22-04 | DONE (code) |
| S22-05 | DONE (code) |
| S22-06 | READY TO EXECUTE (soak checklist da co) |
| S22-07 | DONE |
| S22-08 | DONE (code) |
| S22-09 | DONE (code) |
| S22-10 | DONE (focused tests) |
| S22-11 | PARTIAL (go/no-go template da co) |

Tai lieu van hanh de dong Sprint 22:
- `docs/SPRINT22_STATUS_TRACKER_20260405.md`
- `docs/SPRINT22_REALTIME_SOAK_CHECKLIST.md`
- `docs/SPRINT22_MARKET_DATA_CANARY_LOG.md`
- `docs/SPRINT22_GO_NO_GO_REVIEW.md`
- `docs/SPRINT22_RUN_DAY_PLAYBOOK_20260405.md`
- `docs/SPRINT22_EXECUTION_EVIDENCE_TEMPLATE.md`
- `docs/SPRINT22_EXECUTION_EVIDENCE_STAGING_PREFILL_20260405.md`
- `docs/SPRINT22_EXECUTION_EVIDENCE_PRODUCTION_PREFILL_20260405.md`

### Backlog Sprint 22

| ID | Task | Owner | Estimate | Phu thuoc | Output | Acceptance criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S22-01 | Mo rong canary Market Data tu 10% len 50% | DevOps + QA | 0.5d | Sprint 21 Go | Bao cao canary 50% | 24h quan sat khong cham rollback trigger, khong co mismatch contract moi |
| S22-02 | Mo rong canary Market Data len 100% | DevOps + QA | 0.5d | S22-01 | Market Data rollout full | 24h sau 100% van on dinh, co bien ban sign-off va rollback rehearsal |
| S22-03 | Implement `RealtimeProvider` va connection manager singleton | Frontend Engineer | 1.5d | Sprint 21 Go | Provider + manager moi | So ket noi socket khong tang theo so component; co reference counting va subscription dedup |
| S22-04 | Tich hop `useRealtimeFeed` vao provider moi | Frontend Engineer | 1d | S22-03 | Hook moi sau refactor | Dashboard/Watchlist/StockDetail van nhan du lieu dung, khong mo socket trung lap |
| S22-05 | Bo sung reconnect policy, jitter, circuit breaker va telemetry | Frontend Engineer | 1d | S22-03 | Telemetry va retry policy | Co metric reconnect rate, circuit breaker co the kich hoat khi loi lap lai, khong spam reconnect |
| S22-06 | Regression va soak test realtime FE/BE | QA Engineer + Frontend Engineer | 1d | S22-04, S22-05 | Bao cao soak/regression | Chuyen trang lien tuc khong leak socket; fallback polling van hoat dong neu WS unavailable |
| S22-07 | Lap inventory Trading endpoints va transaction boundary | Backend Engineer | 0.5d | S22-02 | Bang mapping Trading | Co danh sach endpoint Trading, serializer, auth, transaction scope, dependency model |
| S22-08 | Implement `services/trading_service.py` skeleton | Backend Engineer | 1d | S22-07 | Trading service skeleton | Boundary business logic va `transaction.atomic()` duoc tach khoi view; chua mo traffic production |
| S22-09 | Implement `trading_views.py` sau flag | Backend Engineer | 1d | S22-08 | Trading views behind flag | Co the chay staging bang `ENABLE_NEW_TRADING_VIEWS`; contract legacy chua bi pha vo |
| S22-10 | Viet contract/regression suite toi thieu cho Trading | QA Engineer + Backend Engineer | 1d | S22-09 | Test suite Trading | Happy path va error path critical cho portfolio, sub-account, transaction pass tren staging |
| S22-11 | Go/No-Go review cho Trading rollout | Tech Lead + QA + DevOps | 0.5d | S22-10 | Bien ban quyet dinh | Neu gate dat thi dua Trading canary vao sprint tiep theo; neu khong dat thi carry-over co ly do ro rang |

### Sprint 22 Exit Gate

**Go khi:**
1. Market Data da rollout 100% an toan.
2. Realtime connection manager khong leak socket va khong spam reconnect.
3. Trading code path moi chay duoc tren staging sau flag, test toi thieu da pass.

**No-Go khi:**
1. Realtime refactor lam mat du lieu live hoac polling fallback mat tac dung.
2. Trading regression chua pass o flow tao/sua/xoa giao dich quan trong.
3. Canary Market Data van con dao dong KPI sau 100%.

---

## 5. Definition of Ready cho moi task

1. Co file/endpoint pham vi ro rang.
2. Co owner chinh, owner du phong va estimate.
3. Co acceptance criteria kiem chung duoc.
4. Co rule rollback neu task anh huong runtime.

---

## 6. Definition of Done cho chuong trinh refactor

1. Market Data khong con chua network/cache/business logic trong fat view muc tieu.
2. Feature flag bat/tat duoc trong staging va production theo quy trinh Ops.
3. Contract tests, regression tests, benchmark va canary report duoc luu lai day du.
4. Realtime da chuyen sang connection manager toan cuc ma khong leak socket.
5. Trading da co boundary moi va san sang cho rollout co kiem soat o sprint tiep theo neu gate dat.

---

## 7. Rule van hanh trong sprint

1. Moi thay doi contract phai cap nhat lai test va docs trong ngay.
2. Khong merge task runtime neu chua co rollback path.
3. Moi cuoi tuan phai co 1 smoke report va 1 risk log.
4. Neu cham rollback trigger thi dung rollout, quay ve flag cu va ghi incident note ngay trong ngay.