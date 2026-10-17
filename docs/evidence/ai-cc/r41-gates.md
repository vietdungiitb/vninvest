# AI R4.1 — Tenant Admin AI Policy

**Claim**: `ai-r41` · **Nhánh**: `feat/ai-r41-tenant-policy` → `dev` · **Ngày**: 2026-10-17
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1168-1189`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | Route `/tenant-admin/ai-policy` trong layout + menu | `main.tsx:234` route `ai-policy`; `pageRegistry.js:304` entry `tenant-admin-ai-policy`; `routeCatalog.js:462` id `tenant-admin-ai-policy`; `TenantAdminSidebar.tsx:36` menu; `TenantAdminAIPolicyPage.tsx` + 4 test component | ✅ |
| AC2 | `allow_byok=false` ⇒ user thường không lưu được key; GET báo nền tảng quản lý | `test_user_cannot_save_api_key_when_byok_disabled`: PUT CC ⇒ **422** `byok_not_allowed` + `field_errors['ai_api_key']`; GET CC ⇒ `system_policy.byok_forced=true` | ✅ |
| AC3 | User vượt trần ⇒ **422** + liệt kê field vượt | `test_user_setting_above_tenant_ceiling_is_422_with_field`: **422** `tenant_policy_exceeded` + `field_errors['advisory_max_tokens_per_day']` | ✅ |
| AC4 | Tenant A không đọc/sửa policy tenant B | `test_other_tenant_admin_cannot_change_this_tenant`; `?tenant=` bị bỏ qua với user thường (`_resolve_tenant` chỉ nhận hint cho operator) | ✅ |
| AC5 | Staff xem tổng quan đa tenant, **read-only** | `test_staff_can_read_any_tenant_but_not_write`: GET `?tenant=` 200, PUT ⇒ **403** | ✅ |
| AC6 | Policy có version + audit mỗi lần đổi | `test_each_change_bumps_version_and_writes_audit`: v0→1→2 + 2 dòng `AIAuditLog`; `test_no_change_does_not_bump_version` | ✅ |
| AC7 | `allow_byok=false` **vẫn** dùng khoá hệ thống | `test_byok_disabled_does_not_block_other_settings`: PUT CC vẫn 200, `fallback_quota_max` còn nguyên; `test_clearing_key_still_allowed_when_byok_disabled` | ✅ |

## Ba chỗ **lệch plan** — vì sao, và bằng chứng

1. **Không tạo bảng hạn mức mới.** `AIBudget` (R2.8, `advisory/models.py:628`) đã giữ
   hạn mức **cấp tenant** (`tenant` FK + `dimension` + `limit_value`). Thêm
   `max_tokens_per_day`/`max_cost_per_day` thật vào bảng policy mới sẽ tạo **hai nguồn
   sự thật cho một con số**. `AITenantPolicy` chỉ giữ **quyền** + `version`; `max_tokens_per_day`
   ở đây là **trần cho cấu hình của user**, không phải hạn mức tiêu thụ.
2. **AC3 là đổi hành vi thật.** `advisory/views.py:442-472` khi vượt hạn mức trả **429**
   `ai_budget_exhausted`. R4.1 trả **422** kèm `field_errors` bằng `UnprocessableEntityException`
   (`vninvest_core/exceptions.py:554`, có sẵn từ LED-04 R6) — không phát minh shape lỗi mới.
3. **`system_policy.managed_by_platform` giữ nguyên nghĩa R0.9.** Đo cho thấy 2 test
   (`test_ai_cc_policy_gating.py:69`, `test_ai_management_center.py:171`) ghim nó với nghĩa
   *"template hệ thống do nền tảng quản lý"*. Suy ra nó từ `allow_byok` là **đổi nghĩa
   một trường đã có hợp đồng** và làm đỏ đúng 2 test đó. R4.1 vì vậy thêm cờ **mới**
   `byok_forced` và giữ cờ cũ.

## Lỗi thật phát hiện khi làm (không nằm trong plan)

- **`request.tenant` không tồn tại** trong request thật (đo bằng `wsgi_request.tenant`
  sau khi gọi endpoint: `KHONG-CO-ATTR`, kể cả ở endpoint CC đang chạy tốt). Đọc nó bằng
  `getattr(..., None)` ⇒ policy **không áp dụng mà không báo lỗi** — fail-open âm thầm,
  tức là `allow_byok=false` của admin im lặng vô tác dụng. R4.1 chuyển việc resolve tenant
  vào `advisory/tenant_policy.py:resolve_tenant()`, theo đúng thứ tự của
  `user_workspace/permissions.py:_resolve_tenant` (X-Tenant-ID → owner → first eligible member).
- **`ShellField` khai `disabled` trong `.d.ts` nhưng implementation không có** ⇒ mọi trang
  muốn khoá ô nhập đều không khoá được. Đã thêm prop (additive).
- Runner test BE trên VPS: `psql` không có trên host (phải `docker exec … psql`); IP DB
  container đổi theo lần deploy (`.4` → `.10`) nên phải `docker inspect`; truyền danh sách
  module vào `manage.py test` phải **không quote** nếu không Django sẽ parse "a b" thành
  một tên module.

## Gates

| Gate | Kết quả |
|---|---|
| BE mới `tests.test_ai_tenant_policy` | **15/15 OK** (fail-before: `failures=7, errors=3`) |
| BE hồi quy 44 module (AI + advisory) | **547/548 OK** |
| FE mới `TenantAdminAIPolicyPage.component.test.tsx` | **4/4 OK** |
| FE `pages/tenant-admin` + `components/__tests__` (55 file) | **335/335 OK** |
| FE `npm run test` | 268 test, **9 fail — giống hệt `dev` khi chưa có R4.1** (đo bằng `git stash`: `9 failed / 259 passed` ở cả hai trạng thái) |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `eslint` (4 file của R4.1) | 0 error, 20 warning (`react/jsx-no-literals` — nhiễu nền, trang cũ cũng vậy) |
| `npm run i18n:scan` | exit 0, không sửa file dịch |
| `check:ai-cc-dag` | PASS `46 nodes, 61 edges, 0 cycle, 0 dangling, 5 roots` |
| `check:admin-spa-routes` | PASS |

## Còn mở (không phải R4.1)

- `tests.test_advisory_model_validation::test_dead_models_absent_from_frontend_catalogue` đỏ
  vì cây test chỉ mount `packages/core/backend`, không có `packages/web` để đọc
  `providerModels.ts`. **Tái hiện trên `/opt/vninvest` (dev chưa sửa)** ⇒ môi trường, không
  phải hồi quy.
- `npm run check:shell` **FAIL** ở `check:tokens`: `src/components/brokerData/brokerData.css:#c4b5fd`.
  Hex này **có trong `HEAD`** và file đó không nằm trong diff của R4.1 ⇒ có sẵn trên `dev`.
  Không tự sửa vì nằm ngoài phạm vi slice (sẽ nới diff).
- AC7 mới chứng minh ở mức "policy không chặn các request không đụng BYOK". Chạy advisory
  thật với khoá hệ thống vẫn phụ thuộc provider key của Owner (giống R2.10 AC8).