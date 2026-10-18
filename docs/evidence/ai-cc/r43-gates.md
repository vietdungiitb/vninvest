# AI R4.3 — Audit append-only + retention + export theo tenant

**Claim**: `ai-r43` · **Nhánh**: `feat/ai-r43-audit-export` → `dev` · **Ngày**: 2026-10-18
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1212-1223`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | Không có API sửa/xoá log | `AppendOnlyGuardTests` quét `urls.py` + view **đọc** audit: không route có `.delete/.put/.patch`; không view đọc nào có `def put/patch/delete` | ✅ |
| AC2 | Retention theo `AI_AUDIT_RETENTION_DAYS` (mặc định 365) | `settings.AI_AUDIT_RETENTION_DAYS` + task `advisory.purge_ai_audit_logs` + beat `purge-ai-audit-logs`; 3 test (xoá đúng ngưỡng · ngưỡng cấu hình được · beat có đăng ký) | ✅ |
| AC3 | Export CSV cap 5000 + BOM + cờ `truncated` | `test_export_returns_csv_with_bom_and_header`, `test_export_cap_is_5000_and_never_larger`, `test_export_marks_truncated_when_over_cap` (header `X-Audit-Export-Truncated`) | ✅ |
| AC4 | Staff tenant A export không chứa tenant B | `test_export_of_tenant_a_excludes_tenant_b`; hint sai ⇒ **rỗng**, không phải "trả hết" (`test_hint_without_membership_returns_empty_not_everything`) | ✅ |

## R4.3 nhỏ hơn vẻ ngoài — và ba chỗ dễ làm ngược

1. **Không cần migration.** `AIAuditLog` (`advisory/models.py:721`) đã có `user` FK +
   `tenant` FK + `created_at` index. AC1 vốn cũng **đã đúng** (chỉ một endpoint GET) —
   nhưng nó chỉ được chứng minh bằng **grep**, thứ chạy được ngoài CI. R4.3 thêm **test
   quét source** để lỗi đó quay lại là **test đỏ** chứ không phải grep thủ công.
2. **Retention audit tách khỏi retention trace.** `AITrace` xoá sau 90 ngày (R3.1);
   audit log là **dấu vết kiểm toán**, mặc định **365 ngày**, task **riêng**. Gộp
   chung nghĩa là đặt ngưỡng 90 ngày lên cả hai — xoá nhầm audit log là mất khả năng
   truy vết, thứ không tạo lại được bằng cách thêm dòng.
3. **Append-only ≠ cấm ghi audit.** Bản đầu test AC1 quét mọi class chứa `AIAuditLog`
   và đòi không có `put/post` — **đỏ ngay vì lý do đúng**: `PortfolioAICommandCenterView.put`
   **tạo** audit log, đó là hành vi **cần** của R0.7. Chặn nhầm thành cấm ghi tức là
   cấm append, trái ngược AC1. Đã sửa tiêu chí: chỉ chặn class **đọc** log
   (có `objects.all()`/`.filter(...)` mà **không** `create(...)`).

## Ba bẫy đã mắc trong lúc làm

- **`OpenApiTypes.NULLABLE_OBJECT` không tồn tại** — chỉ xuất hiện trong chính dòng tôi
  vừa viết. Đã đổi về `OpenApiTypes.OBJECT` như các view khác.
- **Fixture tôi viết vi phạm unique `CoreTenant.owner_user`.** Tạo 2 tenant cùng một
  owner để test isolation ⇒ `IntegrityError`. Đã đổi sang mỗi tenant một owner, staff
  là **member** của cả hai — đúng hình dạng cần kiểm (staff thấy được cả hai tenant, nên
  chỉ *hint* mới quyết định cái gì lọt ra).
- **Hint là `public_id`, KHÔNG phải `tenant_code`.** Test đầu dùng `tenant_code` và
  **xanh vì lý do sai**: `is_plausible_tenant_public_id` loại `r43-a` ngay ⇒ queryset
  rỗng ⇒ trông giống isolation đúng nhưng thực chất chỉ là hint sai hình dạng. Đã dùng
  `tenant.public_id` và ghi lý do vào docstring.

## Tái dùng thay vì viết mới

Endpoint export **không** có resolver riêng: nó gọi đúng
`PortfolioAICommandCenterAuditLogView._scope_operator_by_tenant` (R0.7) và lọc
non-operator y hệt endpoint đọc. R0.11 đã vá một lần vì `AIAuditLog.objects.all()` +
`IsAuthenticated` khiến mọi user đọc được log của user khác; một endpoint export tự
scope riêng là chỗ dễ lọt **đúng lỗi đó** lần nữa, lần này nó mất dữ liệu ra file.

## Gates

| Gate | Kết quả |
|---|---|
| BE mới `tests.test_ai_audit_retention_export` | **12/12 OK** (fail-before: `failures=4, errors=7`) |
| BE hồi quy 46 module | **580 test — 579 OK** |
| `check-lessons.mjs` | exit 0 (không đụng `docs/LESSONS/` ở slice này) |

Lỗi còn lại: `test_dead_models_absent_from_frontend_catalogue` — cây test BE chỉ mount
`packages/core/backend`, không có `packages/web` để đọc `providerModels.ts`. Đã tái hiện
ở R4.1 trên `/opt/vninvest` ⇒ môi trường, không phải hồi quy.

## Còn mở

- **Chưa có nút export trên UI.** Endpoint đã sẵn sàng; AI Audit tab chưa gắn nút tải CSV.
- Export chưa có lịch chạy tự động (định kỳ gửi báo cáo cho khách hàng) — chưa có AC nào yêu cầu.
- Retention chạy **hằng ngày** (`schedule: 86400`); chưa kiểm số dòng bị xoá theo thời gian
  trên staging (không có dữ liệu đủ lâu để đo).