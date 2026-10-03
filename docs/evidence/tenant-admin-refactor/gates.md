# Evidence — Tenant Admin Refactor R0–R7 (thực thi 2026-09-23/24)

## Gates tổng (chạy thật)

| Gate | Kết quả |
|---|---|
| `npx tsc --noEmit` | 0 (cuối R6) |
| `npm run build` | PASS 47.18s (chunk-size warning pre-existing) |
| `npm run lint` | 0 errors, 3853 warnings (pre-existing pattern) |
| vitest full | 420/421 (1 fail pre-existing `useAlertCenterSnapshot.pagination` — file team đang sửa dở, ngoài scope, không chạm) |
| vitest 8 files R-slices | 26/26 PASS |
| jest `soc.test.js` | 96/96 PASS |
| `i18n:scan` | exit 0, diff chỉ keys mới (không junk) |
| `manage.py check` | 0 issues |
| BE 5 files mới | 22/22 OK (`test_operator_tenants` 5, `test_soc_billing` 3, `test_soc_usage` 3, `test_soc_audit` 4, `test_soc_staff_switch` 7) |

## Theo slice

- **R0**: StaffRoute+TenantRoute (4 tests), 9 routes, 8 catalog, menu Tenant, i18n 10 keys, 8 pages links+gates, dead-link grep 0, Tenants fetch-skip. vitest 14/14 (staff-route 4 + menu 8 + tenants 2).
- **R1**: BE paginate (5 tests incl. N+1 ≤8 queries); FE pager + modal Xem hộ (4 tests).
- **R2**: BE overview/invoices (3 tests, MRR đối chiếu seed 600k); FE fleet page (2 tests).
- **R3**: BE overview (3 tests, calls/top/quota); FE page (2 tests); runtime-kpi link → `/admin/usage`.
- **R4**: BE audit-events (4 tests, incl. staff-có-tenant regression); FE page (2 tests).
- **R5**: BE switch+audit (7 tests); middleware `X-Staff-Switch`; transport header; banner+exit (2 tests).
- **R6**: `can*=true` grep 0; SA page test 2/2.
- **R7**: gates trên + ledger Entry 182.

## Lệch plan đã xử lý (ghi nhận)

1. `/tenant-admin` bọc `TenantRoute` (cần tenant) thay vì `StaffRoute` — tránh khoá owner tự quản (regression). Ghi vào báo cáo close.
2. R1 modal POST sai prefix `/api/soc/` → sửa dùng adapter `staffSwitch` (`/operator/soc/`).
3. Test switch-header: `force_authenticate` không qua middleware → dùng `client.login`.
4. Test tenants `max` page: dùng `hasNext/hasPrev` từ response thay vì suy luận.
5. `from .views import` 2 dòng thiếu ngoặc → lỗi syntax, đã bọc parentheses.
