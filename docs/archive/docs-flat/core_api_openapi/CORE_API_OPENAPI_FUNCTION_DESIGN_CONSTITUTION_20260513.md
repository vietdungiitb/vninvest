# CORE API OpenAPI Function Design Constitution

Date: 2026-05-13
Status: Mandatory policy (enforced)
Scope: All HTTP APIs in VNInvest core services (existing + new)
Owner: Core API Guild (Tech Lead + Backend Lead + QA Lead)

---

## 1. Muc tieu

Tai lieu nay dinh nghia quy dinh cung bat buoc cho viec thiet ke ham OpenAPI trong du an.

Muc tieu:
- Chuan hoa request/response contracts toan du an.
- Chan bug lap lai: swallow exception, sai HTTP status, thieu validation, leak tenant data.
- Bien quy dinh thanh gate CI, khong phu thuoc danh gia cam tinh.
- Dam bao API san sang tich hop cho frontend noi bo va doi tac ngoai.

---

## 2. Nguyen tac nen tang

1. Contract-first: code phai tuan theo schema, khong viet API roi moi bo sung schema.
2. Explicit over implicit: moi hanh vi bien doi du lieu, fallback, hoac degrade phai duoc mo ta ro.
3. Fail-fast and observable: loi phai phat hien som, co ma loi va request_id de truy vet.
4. Tenant-safe by default: khong co endpoint tenant-scoped nao duoc phep bo filter tenant.
5. Backward compatibility by policy: thay doi breaking phai version hoa va co sunset plan.

---

## 3. Hard Rules bat buoc (khong duoc waive neu khong co exception ticket)

### R1. Request schema bat buoc
- Moi endpoint phai co request schema ro rang.
- Moi field phai co type, nullable, constraints (min/max/pattern/enum neu co).
- Input khong hop le bat buoc tra 400 voi field_errors.

### R2. Response schema bat buoc
- Moi endpoint phai co response schema va vi du payload.
- Timestamp bat buoc ISO8601.
- Nullability phai khai bao ro, cam "null ngau nhien".

### R3. HTTP status semantics dung chuan
- 200/201/204 cho thanh cong.
- 400 cho validation.
- 401/403 cho authz/authn.
- 404 cho not found.
- 409 cho state conflict.
- 429 cho rate limit.
- 500 cho loi he thong.
- Cam tra 200 cho loi nghiep vu.

### R4. Error envelope thong nhat
Tat ca loi phai theo mot khung:

```json
{
  "detail": "Thong diep loi human-readable",
  "code": "error_code_slug",
  "timestamp": "2026-05-13T15:30:00Z",
  "request_id": "req_123...",
  "field_errors": {
    "email": ["Email khong hop le"]
  }
}
```

### R5. Cam swallow exception
- Cam `except: pass` va `except Exception: pass`.
- Moi exception phai duoc log co context.
- Client khong duoc bi silent failure.

### R6. Auth + tenant isolation bat buoc
- Endpoint private bat buoc xac thuc.
- Endpoint tenant-scoped bat buoc filter theo tenant o truy van nguon.
- Bat buoc co test chong truy cap cheo tenant.

### R7. Rate limit bat buoc
- Auth endpoints bat buoc rate limit theo IP va user.
- Endpoint public bat buoc quota/chong abuse.
- OpenAPI metadata phai mo ta limit policy.

### R8. Pagination bat buoc cho list endpoint
- Bat buoc pagination cho endpoint tra danh sach.
- Co default page_size va max page_size.
- Cam full-scan tra full dataset cho list API.

### R9. Performance hygiene bat buoc
- Cam N+1 query tren endpoint nong.
- Su dung select_related/prefetch_related phu hop.
- Co canh bao query cham va theo doi P95/P99.

### R10. Documentation bat buoc
Moi endpoint phai co:
- Muc dich endpoint.
- Input/output schemas.
- Danh sach status codes.
- Vi du request/response.
- Gioi han rate limit neu co.

### R11. Testing toi thieu bat buoc
Moi endpoint phai co test:
- Happy path.
- Validation fail.
- Unauthorized.
- Forbidden (neu co permission gate).
- Not found (neu co resource binding).

### R12. Versioning + deprecation bat buoc
- Breaking change bat buoc qua version moi.
- Endpoint deprecated phai co timeline sunset.
- Changelog API bat buoc cap nhat.

---

## 4. Exception policy (co dieu kien)

Chi duoc tam vuot hard rule khi:
- Co exception ticket duoc phe duyet boi Tech Lead.
- Co owner ro rang.
- Co expiry date.
- Co ke hoach tra no ky thuat.

Exception qua han chua dong se bi block merge.

---

## 5. CI enforcement bat buoc

Pipeline API PR bat buoc fail neu vi pham:
- OpenAPI lint fail.
- Thieu request/response schema.
- Sai HTTP status semantics.
- List endpoint khong pagination.
- Auth endpoint khong rate limit.
- Co swallow exception pattern.
- Thieu regression tests toi thieu.

Khuyen nghi script check:
- scripts/validate_openapi_contracts.py
- scripts/validate_error_envelope.py
- scripts/validate_pagination_rules.py
- scripts/validate_auth_rate_limit.py
- scripts/validate_tenant_isolation_tests.py

---

## 6. Rollout plan (6 tuan)

1. Tuan 1: Khoa toan bo Critical blockers.
2. Tuan 2: Chuan hoa security + tenant isolation.
3. Tuan 3: Cover full OpenAPI metadata.
4. Tuan 4: Chuan hoa performance + observability.
5. Tuan 5: Bat gate CI + PR checklist.
6. Tuan 6: Ap dung toan bo va audit lan 1.

Definition of Done rollout:
- 100% API PR moi pass gate.
- 100% list endpoint co pagination.
- 100% auth endpoint co rate limit.
- 0 swallow exception o vung code API.

---

## 7. KPI quan tri

- Contract completeness: 100% active endpoints.
- API PR first-pass CI success: >= 85% sau 1 thang.
- 5xx rate tren endpoint chinh: < 0.5%.
- Incident do contract drift: 0 trong 2 sprint lien tiep.

---

## 8. Hieu luc va ap dung

- Hieu luc ngay khi merged vao nhanh chinh.
- Ap dung voi moi endpoint moi va moi endpoint duoc sua.
- Khong ap dung hoi to cho endpoint khong dong den, nhung bat buoc ap dung khi endpoint do duoc chinh sua.

Ratification:
- Tech Lead: approved
- Backend Lead: approved
- QA Lead: approved
