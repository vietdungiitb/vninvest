# SELF-AUDIT AND TEST PROTOCOL - Enterprise B2B MCP Transformation Current-Code Realignment

## 1. Muc dich

Protocol nay la checklist bat buoc cho moi slice docs/backend/frontend/schema/package-track trong chuong trinh enterprise B2B MCP transformation current-code realignment.

Muc tieu la chan som 6 loai loi nguy hiem nhat:

1. docs tiep tuc noi sai ve baseline hien tai cua repo,
2. contract docs va code drift ma khong co ai phat hien,
3. route admin/operator/partner duoc mo ta nhu da ton tai trong khi code chua co,
4. schema docs di qua xa code va tao migration planning ao,
5. package track bi hieu nham la parity proof du no moi chi o muc baseline/stub,
6. slice da xong nhung khong co file list, validation, screenshot/payload proof va handoff packet.

## 2. Nguyen tac van hanh

1. Khong co evidence thi xem nhu chua lam.
2. Sau edit thuc chat dau tien phai chay focused validation ngay.
3. Docs-only slice phai co cross-reference review, khong chi sua van ban cho dep.
4. UI/runtime slice phai co screenshot hoac browser proof.
5. Package-track slice phai co `npm run check:shell` hoac `compileall` phu hop.
6. Runtime/UI that slice phai refresh dev stack truoc khi claim complete.
7. Taskboard la live status board; ledger va progress la immutable evidence surfaces.

## 3. Workflow audit bat buoc cho moi slice

### Buoc 0 - Resume va claim slice

Truoc khi cham file:

1. doc taskboard hien hanh,
2. doc entry audit moi nhat trong ledger/progress,
3. xac nhan dependency cua slice da `[x]`,
4. xac nhan khong co task khac dang `[/]` trong lane active,
5. claim slice bang taskboard neu taskboard chua dung voi trang thai that.

### Buoc 1 - Khoa pham vi slice

Ghi ro:

1. Slice ID
2. Req IDs lien quan
3. File se cham
4. Loai slice: docs-only / backend / frontend / schema / package-track / audit
5. Boundary owner chinh

### Buoc 2 - Focused validation ngay sau edit dau tien

#### Docs-only slice

Validation toi thieu:

1. cross-reference giua rebaseline, handoff master, plan, taskboard, traceability, self-audit va evidence template,
2. grep hoac read review cho cac anchor quan trong vua cap nhat,
3. `get_errors` tren docs vua sua neu editor co diagnostics.

#### Legacy backend slice

Validation toi thieu:

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_api_routes_auth_profile --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_partner_admin_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_system_ai_admin_api --keepdb
Pop-Location
```

Chon command hep nhat phu hop voi slice vua cham.

#### Legacy frontend slice

Validation toi thieu:

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

Neu cham route/page thuc, bat buoc co them browser proof sau build va refresh stack.

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

#### Schema planning slice

Validation toi thieu:

1. implemented-vs-target matrix phai bam `backend/portfolio/models.py` hoac code anchors that,
2. migration/backfill note phai co rollback gate,
3. khong duoc claim object da ton tai neu chua thay trong code.

### Buoc 3 - Thu bang chung

Bat buoc luu toi thieu:

1. command da chay va PASS/FAIL,
2. payload snapshot neu cham contract,
3. screenshot/browser proof neu cham UI/runtime,
4. residual risk note,
5. danh sach file doi.

### Buoc 4 - Dong bo audit docs

Sau khi slice PASS noi bo:

1. cap nhat taskboard,
2. cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
3. cap nhat `PROGRESS_DASHBOARD.md`,
4. dien evidence template,
5. refresh `module_tree_full.md` neu co code file moi hoac code file doi trong `backend/`, `frontend/`, `packages/`.

### Buoc 5 - Dong goi handoff cho phien sau

Moi slice khi roi trang thai active phai ghi ro:

1. `completed`, `paused` hoac `blocked`,
2. lenh PASS cuoi cung co the chay lai ngay,
3. next recommended task ID,
4. blockers/residual risks/immutable guardrails,
5. audit entry IDs lien quan.

## 4. Test matrix theo be mat rui ro

### A. Docs control

#### A1. Baseline truthfulness

PASS khi rebaseline va master index khong con noi sai ve `packages/*`, `shared/api-contracts`, `buildTarget.js`.

#### A2. Status labeling clarity

PASS khi docs phan biet ro `implemented now`, `partial`, `target-state`.

### B. Access/Admin

#### B1. Capability truth

PASS khi payload/access docs co the map truc tiep ve auth/runtime that ma khong can broad admin bridge mo ho.

#### B2. Route gating truth

PASS khi screen spec, RBAC matrix va route tree noi dung route namespace that va ability gate that.

### C. Operator/Partner

#### C1. Missing-route honesty

PASS khi docs danh dau ro route nao missing implementation, route nao da co.

#### C2. Envelope/header parity

PASS khi docs va code khop ve request id, idempotency, list envelope, ordering semantics.

### D. Schema/Resource

#### D1. Implemented-vs-target matrix

PASS khi object da co trong code duoc tach khoi object chi moi nam tren schema docs.

#### D2. Schema-last discipline

PASS khi migration planning den sau contract/resource freeze, khong di truoc.

### E. Package-track

#### E1. Baseline-vs-parity discipline

PASS khi docs va code khong claim package track la parity proof neu lane do van con stub.

#### E2. Wildcard fallback cleanup

PASS khi package bootstrap lane khong con dua vao `manage all` hoac subject `all` de mo ta admin parity.