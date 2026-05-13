## Muc tieu thay doi

- Mo ta ngan gon thay doi chinh trong PR.

## Runtime truth impact

- [ ] Co tac dong OpenCore (boundary, quota/trial, entitlement, docs governance, publication readiness)
- [ ] Khong tac dong OpenCore

Neu co tac dong OpenCore, bat buoc tick day du checklist OC-19 ben duoi.

## OC-19 Mandatory Checklist (OpenCore only)

- [ ] Da doi chieu runtime truth voi docs canonical
- [ ] Da cap nhat docs/CODE_CHANGE_AUDIT_LEDGER.md
- [ ] Da cap nhat PROGRESS_DASHBOARD.md
- [ ] Da cap nhat docs theo trigger mapping OC-19 (T1/T2/T3/T4)
- [ ] Khong con mau thuan giua OC-13, OC-15, OC-11, OC-12

## Trigger mapping xac nhan

- [ ] T1 (bugfix/optimization nho)
- [ ] T2 (doi behavior Free/Pro hoac feature gate)
- [ ] T3 (doi quota/trial/entitlement/runtime mapping)
- [ ] T4 (doi docs governance private/public)

## Audit evidence

- Audit entry: ghi ro ID entry moi trong docs/CODE_CHANGE_AUDIT_LEDGER.md
- Danh sach file audit: dong bo trong PROGRESS_DASHBOARD.md

## Ghi chu reviewer

- Neu checklist khong day du: PR OpenCore = NO-GO.

## OpenAPI Mandatory Gate (Core API)

- [ ] PR co tac dong OpenAPI contract (request/response/status/error/auth/rate-limit/tenant)
- [ ] Da doc va tuan thu `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- [ ] Da tick day du `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- [ ] Da cap nhat OpenAPI metadata neu co doi contract
- [ ] Da bo sung test toi thieu theo constitution

Neu mot trong cac muc tren khong dat: PR API = NO-GO.