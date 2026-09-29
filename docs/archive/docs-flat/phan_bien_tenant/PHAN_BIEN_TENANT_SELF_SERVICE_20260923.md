# PHẢN BIỆN ĐỘC LẬP — Plan Tenant Self-Service B+A (2026-09-23)

> Đối tượng: `docs/IMPLEMENTATION_PLAN_TENANT_SELF_SERVICE_20260923.md`.
> Phương pháp: đọc code thật kèm `file:line`, không suy luận. Không đổi code.
> **Verdict: APPROVE CÓ ĐIỀU KIỆN** — kiến trúc đúng, tái dùng được hết;
> vá **8 must-fix** dưới đây trước khi giao đội code (+0.5 ngày, chủ yếu sửa chữ + S0 verify).

---

## 1. Xác nhận đúng (tóm tắt)

Hầu hết file:line khớp: `register.py:120-126,288-299`, `authentication.py:54-63`,
`models.py:332-365` (issue), `serializers.py:150-234`, `views_tenant.py`
(helpers/serializers/list/issue/rotate/revoke/usage-summary/lifecycle),
`middleware.py:78-99,137-151`, `permissions.py:39-52`, `resolve_tenant.py`,
`helpers.py:113-135`, FE (`main.tsx`, `pageRegistry.js`, `routeCatalog.js`,
`sidebaritems.ts`, `Sidebar.tsx`, `useTenantAdminQuery.ts`, PATs/Usage pages,
i18n vi/en, menu-contract test). F1 webhook có thật.

## 2. MUST-FIX (8 điểm, vá trước handoff)

### C1 [MUST-FIX] — `_personal_member` dựa vào `request.tenant_member` là SAI
- Plan §3.1: "ưu tiên `request.tenant_member` (middleware đã set, `middleware.py:144,187`)".
- Thực tế: `middleware.py` có **0** lệnh gán `request.tenant_member`
  (chỉ set `request.tenant` + `request.tenant_role` tại `:97-98`;
  `:144` là `request.tenant_role = member.role`, **không phải** `tenant_member`;
  dòng 187 thuộc `_resolve_by_header`, không liên quan).
  `request.tenant_member` chỉ được set trong `utils/resolve_tenant.py:178,188,192`
  (fallback path khi gọi `get_tenant_role()`).
- Hậu quả: đọc trực tiếp → `AttributeError` với mọi request chỉ qua middleware;
  phân biệt owner/member sai → leak hoặc 500.
- Sửa spec: `_personal_member(request)` = `getattr(request,'tenant_member',None)` +
  fallback `TenantMember.objects.filter(tenant=..., user=...).first()`
  (gọi `get_tenant_role(request)` trước để lấp cache). Sửa cite thành
  `resolve_tenant.py:188` + `middleware.py:97-98`.

### C2 [MUST-FIX] — F1 nặng hơn mô tả: cả GET cũng thiếu
- Thực tế `views_webhooks.py`: `get :68-73`, `patch :75-84`, `delete :86-92`
  — cả 3 đều thiếu `_require_tenant_permission` (list `:40` và create `:47` thì có).
  Viewer đọc được config webhook (kể cả HMAC secret) — không chỉ sửa/xoá.
- Sửa plan: S2 fix cả 3 methods + test **GET → 403** cho viewer (bổ sung vào §6).

### C3 [MUST-FIX] — Quota: method của class, cấm import + pin shape
- `_get_tenant_quota_limit(self, tenant)` là **instance method** của
  `TenantQuotaMiddleware` (`middleware.py:386-405`) — import trực tiếp = `ImportError`.
- Sửa spec: **copy truy vấn `QuotaRecord` kỳ hiện tại** (`commercial.models`,
  mẫu đã có tại `middleware.py:359-405`), KHÔNG import.
- Pin shape `quotas` trong `me/summary` (plan ghi "..." mơ hồ):
  `{api_calls_limit, period_start, period_end}` — không có `used`
  (counter Redis ngày, ngoài phạm vi; FE không assert field này).

### C4 [MUST-FIX S0] — `navigationCatalog` zero consumer
- Grep toàn `packages/web/src`: chỉ định nghĩa (`app/navigationCatalog.js:5,44,47-49`),
  re-export (`index.js:3`), nhắc trong `README.md:13`. **Không** import ở
  `Sidebar.tsx`/`sidebaritems.ts`/`main.tsx`/`pageRegistry.js`/`routeCatalog.js`.
- Sửa plan: S0 **xác minh consumer trước**; thêm group `tenant` chỉ để đồng bộ metadata,
  kèm test catalog chứa 2 path mới — nếu đội code thấy vướng thì **cắt khỏi phạm vi**, không ảnh hưởng runtime.

### C5 [MUST-FIX test] — Prefix thật là `vni_`, không phải `vniv_`
- Plan §6 case 2: "prefix `vniv_`-style". Thực tế `models.py:26-28`:
  `f'vni_{plan_code}_' + token_urlsafe(48)`; `_extract_pat_prefix` (`:31-33`) = 12 ký tự đầu.
  Không có chuỗi `vniv_` anywhere ở BE.
- Sửa assertion: `secret.startswith('vni_')` và `token_prefix == raw[:12]`.

### C6 [MUST-FIX] — Nguồn import `TENANT_PERMISSION_CLASSES`
- Plan §3.1: "grep định nghĩa trong `views_tenant.py` (đang dùng tại `:135`)".
  Sai 2 điểm: `:135` là **chỗ dùng**, định nghĩa gốc tại **`views_tenant.py:32`**;
  hằng này còn bị **định nghĩa lại độc lập** ở `views_webhooks.py:32`,
  `views/helpers.py:18`, `commercial_partner_views.py:20`, `views_reports.py:16`.
- Sửa spec: `views_personal.py` import từ **`views/helpers.py:18`** (module nhẹ),
  cấm import từ `views_tenant` (module nặng, coupling không cần thiết).

### C7 [MUST-FIX] — Hai `mark_rotating` + revoked Bearer = 401
- `models.py` có **hai** `mark_rotating`: `:367-373` (positional) và `:388-402`
  (keyword-only) — Python lấy **định nghĩa sau** (`:388` thắng, `:367-373` dead code).
  `partner_rotate_pat` gọi keyword (`views_tenant.py:380-383`) nên tương thích.
- Sửa spec: personal rotate **gọi luôn keyword**; test assert `status==ROTATING` +
  `expires_at` được set (định nghĩa thắng **không** set cột `grace_until` —
  `old_token_grace_until` trong payload chỉ là giá trị return); ghi ticket tech-debt
  xoá dead def `:367-373` trong cùng PR.
- Revoked PAT qua Bearer → **`AuthenticationFailed` = 401** (`authentication.py:26-28`,
  DRF `AuthenticationFailed.status_code=401`), không phải "401/403".
  Pin test §6 case 7: `assertEqual(401)`.

### C8 [MUST-FIX scope] — S1 thiếu file + chốt 403 cho summary
- D2 (chặn prefix `personal:` ở endpoint admin) phải chèn vào 3 hàm
  `issue_pat` / `partner_issue_pat` / `partner_rotate_pat` — nhưng bảng S1 **thiếu
  `views_tenant.py`** trong files chạm. Bổ sung.
- `me/summary` no-tenant: personal views dùng `TENANT_PERMISSION_CLASSES` nên
  middleware chặn trước bằng **403** `tenant_not_found` (`middleware.py:78-86`);
  mẫu 404 của `TenantLifecycleView` (`views_tenant.py:438-445`) chỉ 404 được vì nó dùng
  `permission_classes=[IsAuthenticated]` (`:436`). Chốt **403**, sửa ma trận §2 + §3.3
  (bỏ hứa 404).

## 3. Nice-fix (không chặn handoff, nên vá kèm)

- N1: `mkdir src/pages/tenant/` (thư mục chưa tồn tại) + mirror cả `useTenantAdminMutation`
  (scope hardcode) hoặc tham số hoá scope.
- N2: test usage-summary **seed `PATAuditLog` trực tiếp** (`objects.create(...)`),
  không gọi HTTP rồi đếm (log flush bất đồng bộ qua Redis, `middleware.py:319-351`).
- N3: S0 mở console verify `ability.can('read','TenantPATAdmin')` với rules BE thật
  (BE chỉ cấp `manage`, CASL `manage` khớp mọi action — cần bằng chứng tick R5).
- N4: default scope rỗng = `list(default_sa.scopes)` nguyên vẹn, không hardcode
  (tenant đã activate có thêm `ai:invoke,manage_pats` — `register.py:296-299`).
- N5: test `max_active_pats` bắt buộc `expires_at` tương lai cho cả 2 key
  (model chỉ đếm `expires_at__gt=now`, `models.py:337-343` — key không expiry bypass quota;
  sửa model là ticket riêng, ngoài plan).
- N6: sửa line lệch 1–10 dòng (coreApiAdapter `:164→:163`, UsagePage `:246-286→gate :235`,
  main.tsx `:125-143→:125-142`).

## 4. A2 cross-check — không xung đột B+A

Route/model tách bạch (`/partner/me/*` + `CorePATCredential` của chính mình vs
SOC `users` tab + `User`/`CoreTenant` staff-only); subject CASL disjoint;
i18n disjoint (`tenantKeys.*` vs `soc.users.*`). Điểm hẹn duy nhất:
cả hai chạm menu/`_build_navigation` — triển khai song song được, giữ kỷ luật
tiền tố i18n, không đổi `TENANT_PERMISSION_CLASSES` dùng chung.
