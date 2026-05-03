# ENTERPRISE B2B MCP TRANSFORMATION CODE TEAM CONTINUATION PLAYBOOK

**Ngay:** 2026-05-03  
**Trang thai:** Current-code execution route after handoff  
**Muc tieu:** Cung cap mot route thuc thi don, one active slice at a time, cho doi code tiep tuc hoan thien cac slice con mo ma khong lam docs drift.

---

## 1. Tai lieu nay dung de lam gi

Tai lieu nay khong thay the handoff master, taskboard hoac traceability matrix. No chot chi mot dieu: khi current-code handoff da xong, doi code phai co mot route thuc thi ro rang, co thu tu, co audit gate, va khong duoc mo nhieu slice cung luc.

Doc theo thu tu:

1. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md`
2. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CURRENT_CODE_HANDOFF_MASTER_20260502.md`
3. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_CODE_TEAM_CONTINUATION_PLAYBOOK_20260503.md`
4. taskboard phu hop voi slice dang lam
5. traceability matrix va evidence template

Neu co xung dot giua playbook nay va mot taskboard cu, uu tien frozen docs + current audit ledger truoc khi code tiep.

---

## 2. Entry conditions truoc khi bat dau slice moi

Chi bat dau slice moi khi tat ca dieu kien sau dung:

1. Handoff master da duoc doc va khong con mismatch voi current code truth.
2. Taskboard dang lam khop voi slice that trong repo.
3. `docs/CODE_CHANGE_AUDIT_LEDGER.md` va `PROGRESS_DASHBOARD.md` da dong bo sau slice truoc.
4. Chi co mot slice trong trang thai `[/]` trong toan bo chuong trinh.
5. Neu slice co code file, module tree phai co the refresh ngay sau khi slice PASS.
6. Neu slice cham UI/runtime, dev stack phai duoc refresh truoc khi claim complete.

---

## 3. Thu tu thuc thi khuyen nghi

### 3.1 Lane 1 - package-track stabilization

Day la lane nen lam truoc neu muc tieu la giu shell/bootstrap parity on dinh va khong de package track drift ngac nhien trong luc con dang hoan thien cac route core/admin.

1. `PKG-01` - Promote package-core access/session stubs to current-code wrappers
2. `PKG-02` - Expand shell host parity proofs
3. `PKG-03` - Define cutover readiness gates

### 3.2 Lane 2 - admin shell va operator UI

Chi mo lane nay sau khi `PKG-03` da dong hoac khi platform lead cap nhat taskboard va ghi ro reprioritization.

1. `CA-01` - Admin shell + route groups
2. `CA-02` - Platform overview + runtime health
3. `CA-03` - Tenant registry + tenant detail
4. `CA-04` - Service accounts
5. `CA-05` - PAT credentials
6. `CA-06` - Usage, quotas, billing
7. `CA-07` - Jobs + audit trace

### 3.3 Drift response lane

Neu docs va code bat dau lech nhau trong luc lam mot slice:

1. Dung ngay slice dang active.
2. Xac dinh lech o route, ability, payload, model hay naming.
3. Sua docs hoac code tren cung mot boundary, khong de drift tre sang slice sau.
4. Cap nhat taskboard, audit ledger va progress dashboard truoc khi mo lai slice.

---

## 4. Audit control bat buoc sau moi slice

Sau moi slice PASS, code team phai lam day du:

1. Cap nhat taskboard voi trang thai that.
2. Append `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
3. Sync `PROGRESS_DASHBOARD.md`.
4. Refresh `module_tree_full.md` neu co code files moi hoac code files doi.
5. Chay focused validation ngay sau edit dau tien.
6. Rebuild hoac restart dev stack neu slice cham backend/frontend/runtime.
7. Thu bang chung UI/runtime neu slice cham surface that.

Khong co audit sync thi slice chua duoc xem la dong.

---

## 5. Evidence pack toi thieu cho tung slice

Moi slice phai co it nhat:

1. Danh sach file doi.
2. Command validation va ket qua.
3. Payload snapshot neu cham contract.
4. Screenshot hoac browser proof neu cham UI/runtime.
5. Residual risk note.
6. Handoff packet cho slice ke tiep.

---

## 6. Stop conditions

Tam dung slice ngay neu mot trong cac dieu kien sau xuat hien:

1. Taskboard va audit ledger khong khop.
2. Validation FAIL.
3. Code claim route/ability/model khong co trong current docs.
4. Co hon mot slice dang `[/]`.
5. UI/runtime thay doi nhung dev stack chua refresh.

---

## 7. Next recommended slice at time of writing

Muc tieu mac dinh hien tai la:

1. `PKG-01` la slice next.
2. Neu platform lead reprioritizes, ghi ro trong taskboard truoc khi code.
3. Sau `PKG-03`, chuyen sang `CA-01` va tiep tuc theo route o Muc 3.2.

---

## 8. Audit note

Tai lieu nay chi co gia tri neu ledger, progress dashboard va taskboard di cung mot nhiet do. Neu mot trong ba surfaces nay bi tre, code team phai dung lai va dong bo truoc khi mo slice moi.
