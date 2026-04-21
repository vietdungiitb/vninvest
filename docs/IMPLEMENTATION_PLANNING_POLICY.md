# Implementation Planning Policy (Mandatory)

## Muc tieu

Tai lieu nay dat ra quy trinh bat buoc de doi code trien khai tinh nang moi hoac sua doi lon ma khong can hop lai nhieu vong.
Muc tieu la: ro pham vi, ro trach nhiem, ro thu tu thuc hien, ro dieu kien dung/chay tiep.

## Nguyen tac bat buoc

- KHONG duoc code ngay khi chua co ke hoach chi tiet.
- Moi sua doi lon hoac tinh nang moi phai co 1 ke hoach trien khai duoc thong nhat truoc khi bat dau code.
- Ke hoach phai duoc luu trong `docs/` va duoc tham chieu trong audit ledger.
- **Quy dinh Bo tai lieu Tam giac (Mandatory Triad):** Moi khi tao file Implementation Plan, bat buoc phai tao kem theo Tech Spec va Taskboard tuong ung de dam bao tinh nhat quan ve kien truc va thuc thi.
- Khong duoc merge khi thieu cac muc mandatory trong ke hoach.
- Bat ky file `.md` nao trong `docs/` khi tao moi hoac thay doi noi dung deu phai kich hoat auto-audit va lap bao cao chi tiet, khong phu thuoc file do USER, AI, script hay git merge/pull tao ra.
- **Quy dinh bat buoc Campaign Closure Persistence:** Ngay sau khi hoan thanh trien khai (Phases) hoac dong mot chien dich, AI bat buoc phai ghi lai toan bo tai lieu audit va nghiem thu (Plan, Tech Spec, Taskboard, Walkthrough) thanh cac file vat ly trong `docs/`. Khong duoc phep chi de duoi dang artifact tam thoi.
- Moi feature lien quan du lieu thi truong/phan tich bat buoc map ve SSOT domains: `vnstock adapter`, `whale alert`, `darkmoney flow`, `ai advisory`.
- Nghiem cam tao luong tinh toan song song cho cung nghiep vu neu da co SSOT.
- Moi thay doi co lien quan `DailyPrice`/OHLCV/technical indicators bat buoc map vao chuong trinh `MDSU - Market Data Service Unification`.
- Nghiem cam truy van truc tiep `DailyPrice` tai layer views/tasks/services nghiep vu neu da co `MarketDataService` canonical.

## Khi nao bat buoc lap ke hoach

Ke hoach bat buoc neu roi vao it nhat mot dieu kien:

- Chinh sua >= 3 files hoac >= 2 modules.
- Thay doi kien truc, luong du lieu, scheduler/background jobs, cache, DB schema.
- Co rui ro anh huong production, hieu nang, bao mat, hoac chi phi API ben thu 3.
- Tinh nang moi co lien quan den admin workflow, automation, retry/fallback, quan sat he thong.

## Ten file tai lieu (Naming Convention)

Dat ten theo mau:

- `docs/IMPLEMENTATION_PLAN_<SCOPE>_<YYYYMMDD>.md`
- `docs/TECH_SPEC_<SCOPE>_<YYYYMMDD>.md`
- `docs/TASKBOARD_<SCOPE>_<YYYYMMDD>.md`

Vi du:

- `docs/IMPLEMENTATION_PLAN_VNSTOCK_OFFPEAK_PIPELINE_20260415.md`
- `docs/TECH_SPEC_VNSTOCK_OFFPEAK_PIPELINE_20260415.md`
- `docs/TASKBOARD_VNSTOCK_OFFPEAK_PIPELINE_20260415.md`

## Mau ke hoach bat buoc (khong duoc bo muc)

1. Business objective
- Van de can giai quyet.
- KPI/ket qua ky vong do duoc.

2. Scope and non-scope
- In-scope cu the.
- Out-of-scope ro rang.

3. Current-state assessment
- Hien trang code, endpoint, task, schedule lien quan.
- Constraint ky thuat/ha tang.

4. Target design
- Kien truc dich.
- Luong du lieu dau vao/dau ra.
- Luu tru Redis/DB, retention va ownership.

5. Execution phases
- Phase 0: prep + feature flag.
- Phase 1..N: danh sach viec theo thu tu, file/module du kien sua.
- Rollback strategy cho tung phase.

6. API and data contract changes
- Endpoint moi/cap nhat.
- Schema, migration, backward compatibility.

7. Scheduling and operations
- Lich auto (crontab/interval), timezone, guardrail.
- Manual trigger cho admin.
- Lock, retry, timeout, rate-limit, circuit-breaker.

8. Testing and verification
- Unit/integration/e2e can co.
- Test data va cach verify step-by-step.
- Exit criteria de cho phep release.

9. Observability and alerting
- Metric, log, trace can bo sung.
- Nguong canh bao va nguoi nhan canh bao.

10. Security and governance
- Permission model.
- Audit trail.
- Secrets/config management.

11. Release plan
- Canary/phased rollout.
- Backout plan.
- Post-release checklist.

12. Ownership and timeline
- Owner chinh, reviewer, approver.
- Moc thoi gian tung phase.

13. SSOT integration map (mandatory)
- Feature nay noi vao domain SSOT nao (`vnstock adapter` / `whale alert` / `darkmoney flow` / `ai advisory`).
- Call-site, endpoint, cache key, model nao la canonical cua domain.
- Danh sach luong cu/du lieu cu can retire de tranh 2 ket qua cho 1 nghiep vu.

14. MDSU compliance map (mandatory neu co market data)
- API canonical se dung (`get_ohlcv_batch` / `get_latest_snapshot` / `get_historical_indicators`).
- Danh sach query cu can retire (file + ham/module).
- Caching design: local context cache + Redis key/TTL/version + invalidation trigger.
- Migration strategy theo strangler (feature flag + parity test + rollback switch).
- KPI verification: p95 latency, query count/request, cache hit rate, timeout rate.

## Definition of Ready (DoR)

Chi duoc bat dau code khi tat ca dieu kien sau dat:

- Da co file ke hoach theo dung mau.
- Da chot scope/non-scope.
- Da co testing strategy va rollback strategy.
- Da xac nhan owner + reviewer.
- Da co SSOT integration map va xac nhan khong mo them parallel pipeline.
- Neu scope co market data: da co MDSU compliance map day du va duoc reviewer xac nhan.

## Definition of Done (DoD)

Chi duoc dong task khi tat ca dieu kien sau dat:

- Da trien khai dung theo ke hoach hoac co ghi ro phan sai lech.
- Da verify theo checklist test.
- Da cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` day du file-list + ket qua verify.
- Da dinh kem tham chieu den file ke hoach trong entry audit.
- Da xac nhan khong con non-SSOT flow cho nghiep vu vua trien khai (hoac da co ke hoach retire ro rang kem deadline).
- Neu scope co market data: Da xac nhan khong con query truc tiep `DailyPrice` trong module da touch va da co KPI evidence old/new.
- **Da thuc hien Campaign Closure Persistence:** Toan bo bo tai lieu (Plan, Tech Spec, Taskboard, Walkthrough) da duoc luu duoi dang file `.md` trong thu muc `docs/`.

## Quy trinh thuc thi chuan

1. Tao file ke hoach.
2. Review va chot ke hoach.
3. Moi bat dau code theo phase.
4. Verify theo test plan.
5. Cap nhat audit ledger va changelog.
6. **Campaign Closure Documentation:** Luu toan bo tai lieu hop le vao `docs/`.

## Quy dinh khong ngoai le

- Khong bao gio tu y code ngay khi chua xay dung ke hoach chi tiet.
- Neu co su co khan cap: duoc phep patch tam, nhung bat buoc bo sung ke hoach postmortem + hardening trong 24h.
- Khong co ngoai le cho trigger auto-audit doi voi thay doi `.md` trong `docs/`; neu bi delay thi phai ghi ro ly do va tao follow-up bat buoc trong audit ledger.

## Phu luc A - MDSU (Market Data Service Unification) Governance

Ten cong nghe/chien luoc quy chuan cho dai phau du lieu thi truong:
- `MDSU - Market Data Service Unification`.

Thanh phan kien truc bat buoc trong MDSU:
1. Service Layer Architecture.
2. Single Source of Truth (SSOT).
3. Strangler Fig Migration Pattern.
4. Hybrid Caching (local context + Redis).
5. Canonical Data Access Contract.

Merge gate bat buoc cho PR thuoc MDSU:
- Co nhan `MDSU compliance: YES` trong mo ta PR.
- Co bang chung parity old/new.
- Co bang chung KPI sau rollout theo nguong plan.
- Khong con call-site truy van truc tiep `DailyPrice` trong pham vi migration da cam ket.
