# MODULES/identity_access — Identity & Access

> Tin cậy tổng: ⚠ (đăng ký/onboarding/Turnstile đã verify; partner API chưa).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Danh tính và truy cập: đăng ký, đăng nhập, Turnstile, PAT, SSO, tenant/member/role,
webhook, mail, partner API. Là gốc của mọi FK tenant (bảng `CoreTenant`).

## 2. Models (24 — chi tiết ở `06.02`)

`CoreTenant` (gốc, không FK đi đâu), `TenantMember`, `TenantInvite`,
`TenantSettings`, `TenantSSOConfig`, `TenantWebhookConfig`, `UserDNSECredential`
(Fernet), PAT/audit/token các loại. Hỗn hợp có/không tenant FK trực tiếp
(`CoreTenant`, token dùng một lần không có là hợp lý).

## 3. API (282 route — chi tiết ở `07.02`)

`partner/*` (partner, usage, billing, webhooks, me, pats, reports — ❓ bề mặt lớn
nhất repo, dossier sâu bắt buộc), `auth/*` (Turnstile bắt buộc), operator,
capabilities. Phân quyền: IsAuthenticated+IsTenantActive (238), AllowAny luồng
auth (28), IsAdminUser (8).

## 4. Job/signal

Có `identity_access/tasks.py` (mail) + `identity_access/signals.py` + 2 beat. Onboarding: `identity_access/urls.py:27-28`,
tạo tenant ở `onboarding_views.py:166` (xem `05.01` WF-01).

## 5. Finding mở

- F-IAA-01 (❓): 108 route `partner/partner/*` làm gì — chưa dossier.
- F-IAA-02 (❓ kế thừa từ `07.03`): `/core/v1/access/capabilities` AllowAny vì sao.

## 6. Test khóa + trạng thái

27 test file (nhiều thứ hai; `test_tenantreg_*.py` khóa register thật).
