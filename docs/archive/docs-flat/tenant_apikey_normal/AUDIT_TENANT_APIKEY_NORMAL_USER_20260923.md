# AUDIT: Feature Tenant Management + API Key với User Thường (2026-09-23)

> **Kết luận ngắn gọn**: Menu bị ẩn (staffOnly) nhưng **chức năng KHÔNG bị khóa**.
> User thường (đã đăng ký bình thường) mở thẳng URL `/tenant-admin/pats` là dùng được
> API key + quản lý tenant đầy đủ — vì backend coi mọi user có tenant là **owner (wildcard quyền)**.
> Ngoài ra còn 1 lỗ hổng thật HIGH (webhook detail thiếu token check).

---

## 1. Câu hỏi audit

> "Khi đăng nhập vào với vai trò người dùng bình thường sẽ **không có** các tính năng
> quản lý tenant, API key của người dùng đó."

**Phạm vi**: packages/web (React) ↔ packages/core (Django). Trace từ login → route/menu →
API permission cho user **non-staff, non-superuser**.

---

## 2. Bản đồ kiến trúc

| File | Trách nhiệm | Note |
|---|---|---|
| `packages/core/.../identity_access/views/register.py:120-126` | Tạo CoreTenant khi đăng ký | **Mọi user đăng ký = tenant owner** |
| `packages/core/.../identity_access/utils/resolve_tenant.py:25-55` | Ma trận permission token theo role | `owner` = `['*']` |
| `packages/core/.../identity_access/utils/resolve_tenant.py:247-262` | `require_tenant_permission()` | Chốt chặn chính BE |
| `packages/core/.../identity_access/views/helpers.py:113-135` | `_build_abilities()` | **Cấp toàn bộ tenant-admin ability vô điều kiện** |
| `packages/core/.../identity_access/middleware.py:78-99` | TenantResolutionMiddleware | Chặn user **không** có tenant |
| `packages/core/.../identity_access/permissions.py:39-52` | `require_pat_scopes_or_human_session()` | Chỉ check machine PAT; human session bỏ qua |
| `packages/core/.../identity_access/views_tenant.py:133-334` | Tenant/SA/PAT views | Gate bằng `_require_partner_scope` + `_require_tenant_permission` |
| `packages/core/.../identity_access/views_webhooks.py:68-92` | WebhookConfigDetailView | **THIẾU token check (F1)** |
| `packages/core/.../identity_access/views_tenant.py:225-245` | `issue_pat` legacy | Function thuần, không DRF view (F3) |
| `packages/core/.../commercial/views.py:37-63` | billing/subscription/quota | Chỉ `IsAuthenticated` → 500 cho non-owner (F2) |
| `packages/web/src/main.tsx:61-82,125-142` | Router + ProtectedRoute | **Chỉ check auth, không staff-guard** |
| `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts:46` | Menu item tenant-admin | `staffOnly: true` — điểm chặn DUY NHẤT FE |
| `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx:126-127` | Filter staffOnly | Ẩn menu nếu `!isStaff` |
| `packages/web/src/components/TenantAdminSidebar.tsx:163-164` | Filter theo CASL ability | Ability BE cấp đủ → không mục nào bị ẩn |
| `packages/web/src/components/TenantAdminLayout.tsx:82-98` | Layout tenant-admin | Không guard |
| `packages/web/src/pages/tenant-admin/TenantAdminPATsPage.tsx:116,255` | Page API key | Gate bằng `ability.can` (BE cấp → true) |

---

## 3. Luồng dữ liệu đã trace

### Case: user thường đăng ký → truy cập API key

1. **Đăng ký** → `register.py:120-126` auto tạo `CoreTenant.objects.create(owner_user=user)`.
2. **Login** → FE `syncAuthState` gọi `GET /identity/profile/` (`adapters/core/auth.js:123-125`).
3. **BE build profile** → `views_tenant.py:248-282` gọi `_build_abilities(user, tenant)`
   (`views/helpers.py:107-176`) → trả `is_staff=false` + **toàn bộ** ability tenant-admin
   (`helpers.py:113-135`).
4. **FE map ability** → `PortfolioContext.js:94` → CASL `ability` (`AbilityContext.js:18-20`).
5. **Menu main**: group Quản trị có `staffOnly` (`sidebaritems.ts:42,46`) → `Sidebar.tsx:126-127`
   ẩn với `isStaff=false`. ✅ User thường **không thấy** menu.
6. **Nhưng route**: `main.tsx:125-142` `/tenant-admin/*` chỉ qua `ProtectedRoute`
   (`main.tsx:61-82` = check `isAuthenticated` + token storage thôi). **KHÔNG check staff/role**.
7. **User gõ thẳng URL** `/tenant-admin/pats` → `TenantAdminLayout.tsx:82` render →
   `TenantAdminPATsPage.tsx:116` `canRead = ability.can('read','TenantPATAdmin') ?? false`
   → BE đã cấp → **true** → page fire request thật `GET /partner/pats/`.
8. **BE nhận request**: middleware `middleware.py:78-99` resolve tenant (user là owner → pass).
   `PATListView` `views_tenant.py:210-222`: `_require_partner_scope('manage_pats')` =
   `require_pat_scopes_or_human_session` (`permissions.py:39-42`) → **human session: return ngay**;
   `_require_tenant_permission('pat:read')` → owner `['*']` → **PASS**. → **200 + dữ liệu thật**.

### Kết luận trace

- **An toàn hiện tại CHỈ dựa trên việc ẩn menu** — security by obscurity.
- Bỏ qua UI, contract BE **cho phép** user thường (tenant owner) dùng mọi endpoint
  tenant/SA/PAT/webhook/billing vì owner = wildcard.
- Bé ngoại lệ thật: user **KHÔNG có tenant** bị middleware chặn toàn bộ `/core/v1/*`
  bằng 403 `tenant_not_found` (`middleware.py:79-86`) — nhưng đăng ký tự tạo tenant nên hiếm gặp.

---

## 4. CONTRADICTIONS (thiết kế)

| Plan/Metadata | Thực tế code | Tác động |
|---|---|---|
| Menu tenant-admin đánh `staffOnly: true` (`sidebaritems.ts:46`) — ngụ ý "chỉ staff" | BE cấp mọi tenant-admin ability cho **mọi user có tenant**, kể cả FREE (`views/helpers.py:113-135`), và owner được wildcard (`resolve_tenant.py:25,218`) | Mâu thuẫn thiết kế: menu nói staff-only, BE nói tenant self-service |
| `routeCatalog.js` ghi `requiredCapabilities: ["admin.operator.read"]` cho tenant-admin | `main.tsx` **không đọc/không enforce** field này | Metadata "chết" — tool/audit đọc catalog tưởng đã gate |

---

## 5. Findings

| ID | ERROR/GAP | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|---|
| **F1** | GAP | **HIGH** | `identity_access/views_webhooks.py:68-92` | `WebhookConfigDetailView` GET/PATCH/DELETE **thiếu** `_require_tenant_permission('webhook:read/write')` — chỉ có `require_pat_scopes_or_human_session('manage_tenant')` (vô hiệu với human session). List/create ở `:40,:47` thì có check → không khớp | Member viewer/editor **PATCH/DELETE được webhook config** của tenant (đọc/xoá bí mật HMAC) | Thêm `_require_tenant_permission(request, 'webhook:read'/'webhook:write')` vào 3 method, + test viewer → 403 |
| **F2** | ERROR | MED | `commercial/views.py:37-63` | `SubscriptionDetailView`/`QuotaListView`/`InvoiceListView` chỉ `permission_classes = [permissions.IsAuthenticated]` + `CoreTenant.objects.get(owner_user=...)` | Member non-owner path → `DoesNotExist` → **500** thay vì 403 sạch; máy PAT thường (có tenant) đọc được billing | Dùng `_get_request_tenant` + `_require_tenant_permission('billing:read')` |
| **F3** | ERROR | LOW | `views_tenant.py:225-245` + `urls.py:35` | `issue_pat` là function thuần (không `@api_view`/trả DRF Response) — `urls.py:35` mount trực tiếp → `request.data` AttributeError → **500** | Endpoint legacy `service-accounts/<id>/pat/issue` hỏng với mọi request hợp lệ | Gỡ hoặc chuyển DRF `@api_view(['POST'])` + `TENANT_PERMISSION_CLASSES` như `partner_issue_pat` (`:319-320`) |
| **F4** | GAP | LOW | `ops_audit/views.py:37-47` | `PartnerAuditLogsView` không check token; catalog `KNOWN_PERMISSION_TOKENS` (`resolve_tenant.py:58-72`) không có `audit:*` | Viewer đọc được tenant lifecycle events | Thêm token `audit:read` vào catalog + check |
| **F5** | GAP | MED | `main.tsx:61-82,125-142`; `TenantAdminLayout.tsx:82` | Toàn bộ `/tenant-admin/*` (và `/operations-center`, `/admin-crawl-control`, `/admin/advertising`, `/settings/ai/*`) chỉ có guard auth | defense-in-depth thiếu: user thường mở URL được UI + fire request thật | Thêm guard role ở route (isStaff HOẶC ability) hoặc redirect access-denied |
| **F6** | GAP | LOW | `main.tsx` vs `routeCatalog.js` | `requiredCapabilities` không được enforce | Metadata ghi nhầm | Xoá field hoặc implement enforce |
| **F7** | GAP | INFO | `views_tenant.py:436` | `TenantLifecycleView` chỉ `IsAuthenticated` | Đúng mô hình (dữ liệu giới hạn tenant của chính user) — không cần sửa | — |

---

## 6. Khoảng trống test

Không có test nào phủ:
- FE route-level: "normal user vào `/tenant-admin/pats` → redirect/no-permission"
  (chỉ có `main-menu-contract.component.test.tsx:71-78` test menu ẩn).
- BE: viewer PATCH webhook → 403 (F1); machine PAT thường đọc billing (F2);
  `issue_pat` legacy (F3); `partner/audit-logs` perms (F4).

---

## 7. Đánh giá tổng thể & Quyết định cần lấy

**Verdict**: Audit hoàn tất (nghiên cứu, không sửa code). Có 1 blocker thật (F1) + 1
defense-in-depth lớn (F5) + 1 mâu thuẫn thiết kế (CONTRADICTION §4).

Cần user quyết định hướng thiết kế cho feature "tenant-admin":

- **Hướng A — Giữ mô hình tenant self-service**: mọi user có tenant được tự quản tenant
  của mình (đúng ý định comment `helpers.py:113`). Sửa nhỏ: bỏ `staffOnly` khỏi item
  tenant-admin trong menu + thêm `_require_tenant_permission` đầy đủ (sửa F1-F4).
- **Hướng B — Thực sự giấu với user thường**: tách "tenant-admin" thành quyền riêng
  (staff hoặc chủ thuê bao xác nhận), thêm staff-guard ở route FE (F5), và BE thu hẹp
  ability (`helpers.py:113-135`) + siết scope cho owner (hiện wildcard).

---

## 8. Quality gates (audit doc-only)

- Đọc file thật kèm `file:line` — tất cả claims verify trực tiếp, không suy luận.
- Không chạy lint/test/build (tài liệu, không đổi code — đúng bản chất entry **doc-only**).

## 9. Evidence

Mọi file:line trong tài liệu này đã đọc trực tiếp ngày 2026-09-23:
`views/register.py`, `utils/resolve_tenant.py`, `views/helpers.py`, `middleware.py`,
`permissions.py`, `views_tenant.py`, `views_webhooks.py`, `commercial/views.py`,
`identity_access/urls.py`, `commercial/urls.py`, FE `main.tsx`, `sidebaritems.ts`,
`Sidebar.tsx`, `TenantAdminLayout.tsx`, `TenantAdminSidebar.tsx`,
`TenantAdminPATsPage.tsx` (+ 11 page khác grep `canRead`).