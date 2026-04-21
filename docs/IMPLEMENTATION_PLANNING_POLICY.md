# Implementation Planning Policy (Mandatory)

## Muc tieu

Tai lieu nay dat ra quy trinh bat buoc de doi code trien khai tinh nang moi hoac sua doi lon ma khong can hop lai nhieu vong.
Muc tieu la: ro pham vi, ro trach nhiem, ro thu tu thuc hien, ro dieu kien dung/chay tiep.

## Nguyen tac bat buoc

- KHONG duoc code ngay khi chua co ke hoach chi tiet.
- Moi sua doi lon hoac tinh nang moi phai co 1 ke hoach trien khai duoc thong nhat truoc khi bat dau code.
- Ke hoach phai duoc luu trong `docs/` va duoc tham chieu trong audit ledger.
- Khong duoc merge khi thieu cac muc mandatory trong ke hoach.
- Bat ky file `.md` nao trong `docs/` khi tao moi hoac thay doi noi dung deu phai kich hoat auto-audit va lap bao cao chi tiet, khong phu thuoc file do USER, AI, script hay git merge/pull tao ra.

## Khi nao bat buoc lap ke hoach

Ke hoach bat buoc neu roi vao it nhat mot dieu kien:

- Chinh sua >= 3 files hoac >= 2 modules.
- Thay doi kien truc, luong du lieu, scheduler/background jobs, cache, DB schema.
- Co rui ro anh huong production, hieu nang, bao mat, hoac chi phi API ben thu 3.
- Tinh nang moi co lien quan den admin workflow, automation, retry/fallback, quan sat he thong.

## Ten file ke hoach

Dat ten theo mau:

- `docs/IMPLEMENTATION_PLAN_<SCOPE>_<YYYYMMDD>.md`

Vi du:

- `docs/IMPLEMENTATION_PLAN_VNSTOCK_OFFPEAK_PIPELINE_20260415.md`

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

## Definition of Ready (DoR)

Chi duoc bat dau code khi tat ca dieu kien sau dat:

- Da co file ke hoach theo dung mau.
- Da chot scope/non-scope.
- Da co testing strategy va rollback strategy.
- Da xac nhan owner + reviewer.

## Definition of Done (DoD)

Chi duoc dong task khi tat ca dieu kien sau dat:

- Da trien khai dung theo ke hoach hoac co ghi ro phan sai lech.
- Da verify theo checklist test.
- Da cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` day du file-list + ket qua verify.
- Da dinh kem tham chieu den file ke hoach trong entry audit.

## Quy trinh thuc thi chuan

1. Tao file ke hoach.
2. Review va chot ke hoach.
3. Moi bat dau code theo phase.
4. Verify theo test plan.
5. Cap nhat audit ledger va changelog.

## Quy dinh khong ngoai le

- Khong bao gio tu y code ngay khi chua xay dung ke hoach chi tiet.
- Neu co su co khan cap: duoc phep patch tam, nhung bat buoc bo sung ke hoach postmortem + hardening trong 24h.
- Khong co ngoai le cho trigger auto-audit doi voi thay doi `.md` trong `docs/`; neu bi delay thi phai ghi ro ly do va tao follow-up bat buoc trong audit ledger.
