# SELF-AUDIT AND TEST PROTOCOL - ENTERPRISE B2B MCP TRANSFORMATION SAAS CUTOVER

## 1. Muc dich

Protocol nay chan false-positive SaaS claims. Khong co evidence thi khong xem la done.

---

## 2. Nguyen tac van hanh

1. Chi claim mot slice khi taskboard da duoc claim ro rang.
2. Sau edit thuc chat dau tien phai chay focused validation ngay.
3. Moi validation phai gan voi requirement trong traceability matrix.
4. Legacy decommission chi duoc mo khi shadow run va rollback proof da co.
5. Audit ledger va progress dashboard la history surface, khong thay the taskboard live.

---

## 3. Audit workflow bat buoc

### Buoc 0 - Claim slice

Truoc khi cham file:

1. Doc taskboard SaaS.
2. Kiem tra co slice nao khac dang `[/]` khong.
3. Xac nhan dependency cua slice da done.
4. Ghi ro file se cham va boundary owner chinh.

### Buoc 1 - Khoa pham vi

Ghi ro:

1. Slice ID.
2. Req IDs lien quan.
3. Loai slice: docs-only / backend / frontend / package-track / migration / decommission.
4. Success criteria va rollback criteria.

### Buoc 2 - Focused validation ngay sau edit dau tien

#### Docs-only slice

Validation toi thieu:

1. Cross-reference read-back giua handoff master, execution plan, taskboard, traceability va evidence template.
2. `grep_search` cho cac terms quan trong vua them.
3. `get_errors` neu editor co diagnostics.

#### Backend slice

Validation toi thieu:

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test --noinput portfolio.tests.test_api_routes_auth_profile --keepdb
Pop-Location
```

Neu slice cham partner/commercial/runtime, chon them focused test hep nhat phu hop.

#### Frontend slice

Validation toi thieu:

```powershell
Push-Location ./frontend
$env:CI='true'; npm test -- --runInBand --watch=false
Pop-Location
```

Neu slice cham route/page that, bat buoc co browser proof hoac screenshot proof.

#### Package-track slice

Validation toi thieu:

```powershell
Push-Location ./packages/web
npm run check:shell
Pop-Location
```

va/hoac

```powershell
& ".\.venv\Scripts\python.exe" -m compileall packages/core/backend/src
```

#### Migration/decommission slice

Validation toi thieu:

1. route inventory khong con legacy path trong luong chinh.
2. compose/CI/workspace diff khong con legacy dependency khong can thiet.
3. rollback path va fallback window da duoc nhan dien ro.

---

## 4. Evidence thu bat buoc

Moi slice phai co:

1. command validation va ket qua,
2. payload snapshot neu cham contract,
3. screenshot/browser proof neu cham UI/runtime,
4. residual risk note,
5. rollback note neu co,
6. file list,
7. handoff packet cho slice ke tiep.

---

## 5. Stop conditions

Tam dung slice ngay neu:

1. Taskboard va audit surfaces khong khop.
2. Validation FAIL.
3. Code claim route/ability/model khong co trong current docs.
4. Co hon mot slice `[/]`.
5. UI/runtime thay doi nhung dev stack chua refresh.
6. Legacy decommission duoc de xuat truoc khi co pilot proof.

---

## 6. Audit gate map

| Gate | PASS khi |
|---|---|
| Access gate | capability snapshot versioned va human/machine surface map ro rang |
| Partner gate | PAT machine-auth va audit reason co snapshot proof |
| Commercial gate | tenant lifecycle, usage, quota, billing co parity proof |
| Data gate | freshness/stale/degraded semantics co evidence |
| Shadow gate | dual-run diff va rollback rehearsal da chay |
| Decommission gate | legacy path removal co route inventory va compose diff |

---

## 7. Final note

Neu khong co evidence packet, khong co audit. Neu khong co rollback proof, khong co cutover. Neu khong co taskboard sync, khong co slice PASS.
