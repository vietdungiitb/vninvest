# Execution Evidence Template — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Mục đích**: Template chuẩn để ghi bằng chứng cho từng slice thực thi

---

## Slice metadata

- Slice ID:
- Owner:
- Branch/commit:
- Ngày thực thi:
- Liên kết docs liên quan:

---

## Files changed

1.
2.
3.

---

## Contract touched

- Endpoint(s):
- Route ID(s):
- Page/component(s):
- Capability changes:

---

## Validation commands

```powershell
npm --prefix packages/web test -- --runInBand
npm --prefix packages/web run build-community
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" packages/core/backend/manage.py test commercial identity_access --keepdb
./start_dev.ps1
```

### Results

- Frontend tests:
- Build-community:
- Backend contract verification:
- Runtime smoke:

---

## UI evidence

- Screenshot Billing Center:
- Screenshot Payment Return pending:
- Screenshot Payment Return success/failure:
- Responsive/mobile evidence:

---

## Payload evidence

- `GET /core/v1/billing/subscription` sample:
- `GET /core/v1/billing/invoices` sample:
- `POST /core/v1/payments/create/` response sample:
- `GET /core/v1/payments/status/{txn_ref}/` sample:

---

## Audit checks

- `git diff --check`:
- Direct fetch grep:
- Legacy import grep:
- Hardcoded callback/base URL grep:

---

## Residual risks

1.
2.
3.

---

## Sign-off

- Developer:
- Reviewer:
- QA/Auditor: