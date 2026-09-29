# CORE API OpenAPI PR Gate Checklist

Date: 2026-05-13
Status: Mandatory checklist for all API pull requests
Scope: PRs touching endpoint logic, serializer/schema, routing, auth, permission, or OpenAPI metadata

---

## 1. Design Gate (bat buoc)

- [ ] Endpoint co request schema ro rang (type, required, constraints).
- [ ] Endpoint co response schema ro rang (nullable, enums, examples).
- [ ] Danh sach HTTP status codes day du va dung semantics.
- [ ] Error envelope tuan theo chuan thong nhat.
- [ ] OpenAPI metadata da cap nhat trung khop implementation.

---

## 2. Security Gate (bat buoc)

- [ ] Endpoint private bat buoc auth.
- [ ] Tenant isolation duoc enforce o query layer.
- [ ] Auth endpoint da gan rate limit policy.
- [ ] Khong log credential/token/raw secret.
- [ ] Khong co hardcoded localhost/default production fallback nguy hiem.

---

## 3. Reliability Gate (bat buoc)

- [ ] Khong con `except: pass` hoac `except Exception: pass`.
- [ ] Tat ca error path co response ro rang cho client.
- [ ] Co request_id trong log tren error path.
- [ ] Co test cho cac nhanh loi quan trong.

---

## 4. Performance Gate (bat buoc voi list/hot endpoints)

- [ ] List endpoint co pagination (default + max page size).
- [ ] Khong full-scan dataset khong can thiet.
- [ ] Khong N+1 query (da review select_related/prefetch_related).
- [ ] Filter/sort duoc day xuong DB layer, khong lam in-memory cho data lon.

---

## 5. Testing Gate (bat buoc)

- [ ] Test happy path.
- [ ] Test validation fail (400).
- [ ] Test unauthorized (401).
- [ ] Test forbidden (403) neu co permission gate.
- [ ] Test not found (404) neu co resource binding.
- [ ] Test tenant cross-access bi chan neu endpoint tenant-scoped.
- [ ] Test 429 neu endpoint co rate limit.

---

## 6. Governance Gate (bat buoc)

- [ ] Da cap nhat docs/CODE_CHANGE_AUDIT_LEDGER.md.
- [ ] Da cap nhat PROGRESS_DASHBOARD.md.
- [ ] Da cap nhat index docs neu co them tai lieu governance moi.
- [ ] Neu co exception hard rule: co exception ticket + owner + expiry.

---

## 7. CI Gate (khong pass thi khong merge)

- [ ] OpenAPI lint pass.
- [ ] Contract validation scripts pass.
- [ ] Unit/integration tests lien quan pass.
- [ ] Coverage module API dat nguong da dinh.

---

## 8. Reviewer Sign-off

- [ ] Backend reviewer approved.
- [ ] Tech lead approved (bat buoc voi thay doi contract).
- [ ] QA reviewer approved (bat buoc voi endpoint public/partner).

PR canh bao:
- Thay doi contract ma khong cap nhat OpenAPI metadata -> reject.
- Thay doi auth/permission ma khong co test security -> reject.
- Thay doi list endpoint ma khong pagination -> reject.
