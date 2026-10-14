# MODULES/identity_access — Identity & Access

> Tin cậy tổng: ✅ (partner surface đã trace file thật 2026-10-14).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Danh tính và truy cập: đăng ký, đăng nhập, Turnstile, PAT, SSO, tenant/member/role,
webhook, mail, partner API. Là gốc của mọi FK tenant (bảng `CoreTenant`).

**Đã giải mã:** `partner/*` KHÔNG phải API đối tác thứ ba — là **tenant self-admin**
(docstring `partner_urls.py:1-7`): tenant summary, service account, PAT, personal
keys, SSO, usage/billing, dashboard, alert-config, forecast, reports, security,
webhook, roles. Mọi route nhân đôi slash/noslash (108 route = ~54 endpoint × 2).

## 2. Models (24 — chi tiết ở `06.02`)

`CoreTenant` (gốc, không FK đi đâu), `TenantMember`, `TenantInvite`,
`TenantSettings`, `TenantSSOConfig`, `TenantWebhookConfig`, `UserDNSECredential`
(Fernet), PAT/audit/token các loại. Hỗn hợp có/không tenant FK trực tiếp
(`CoreTenant`, token dùng một lần không có là hợp lý).

## 3. API (282 route — chi tiết ở `07.02`)

`partner/*` (tenant self-admin — xem §6), `auth/*` (Turnstile bắt buộc), operator,
capabilities. Phân quyền: IsAuthenticated+IsTenantActive (238), AllowAny luồng
auth (28), IsAdminUser (8).

### Mô hình phân quyền 3 lớp của partner API (đọc code thật)

| Lớp | Cơ chế | Điểm code |
|---|---|---|
| 1. Lớp view | `permission_classes = TENANT_PERMISSION_CLASSES` (= IsAuthenticated + IsTenantActive) | `views_tenant.py:50` (lặp lại mỗi module partner) |
| 2. Scope đối tác | `_require_partner_scope(request, PARTNER_SCOPE_*)` từng endpoint (`manage_tenant` ở `:51`, def ở `:74`) | `:167`, `:245` |
| 3. Quyền mịn | `_require_tenant_permission(request, 'tenant:write'/'sa:read'/'pat:read'…)` | `:168`, `:246` |
| 4. Ranh giới tenant | `_get_request_tenant(request)` + queryset lọc theo tenant (vd PAT lọc `service_account__tenant=tenant` ở `:247-251`) | `:169`, `:247` |

## 4. Job/signal

Có `identity_access/tasks.py` (mail) + `identity_access/signals.py` + 2 beat. Onboarding: `identity_access/urls.py:27-28`,
tạo tenant ở `onboarding_views.py:166` (xem `05.01` WF-01).

## 5. Finding mở

- ~~F-IAA-01 (❓): 108 route `partner/partner/*` làm gì~~ — ✅ ĐÃ ĐÓNG slice này:
  tenant self-admin (xem §1), phân quyền 3-4 lớp (xem §3).
- F-IAA-02 (❓ kế thừa từ `07.03`): `/core/v1/access/capabilities` AllowAny vì sao.

## 6. Test khóa + trạng thái

27 test file (nhiều thứ hai; `test_tenantreg_*.py` khóa register thật).
