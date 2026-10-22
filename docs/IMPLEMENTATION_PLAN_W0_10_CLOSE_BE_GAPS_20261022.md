# IMPLEMENTATION PLAN — W0.10 ĐÓNG 3 LỖI 404 THẬT (BE gap-1/2/3)

**Agent:** `w0-10-close-be-gaps` · **Branch:** `feat/w0-10-close-be-gaps` -> `dev`
**Base:** `origin/dev` @ `e70d8fdb5` · **Worktree:** `C:\Mujoco Projects\agent-w0-10`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.10 — 3 endpoint BE chưa có, FE đang gọi ⇒ **404 thật** (ghi trong allowlist của gate `route-contract`).
**Lessons áp dụng:** L-001 L-002 L-003 L-007 L-008 L-M02 L-M05 L-M08 L-V01 L-V02 L-V04 L-G01 L-G02 L-G04 L-G05 L-G07 L-G08 L-T01 L-T02 L-A01
**Skill:** `multi-agent-workflow` (8 stage) · `tdd-workflow` (RED → GREEN) · `verification-loop` · `project-lessons`

---

## 0. Bối cảnh — 3 lỗi 404 thật, đã khoá trong allowlist có ý

Gate `route-contract` (PR #281) quét **396** lời gọi core API. Sau khi sửa 4 call site double-prefix, còn **3 nhóm path không có route BE** ⇒ FE gọi ⇒ **404 thật**:

| Gap | Path FE gọi | Bằng chứng | Nguyên nhân gốc |
|---|---|---|---|
| **gap-2** | `/partner/service-accounts/{id}/` | `pages/tenant-admin/TenantAdminServiceAccountsPage.tsx:103` (DELETE), `:112` (PATCH) | **`ServiceAccountDetailView` đã TỒN TẠI** (`identity_access/views_tenant.py:190`, `get_object` dùng `self.kwargs['service_account_id']`) nhưng **route chưa được đăng ký** trong `partner_urls.py` ⇒ chỉ thiếu **2 dòng route** |
| **gap-1** | `/partner/billing/invoices/{id}/pdf/` | `TenantAdminBillingPage.tsx:161` (coreGet) + `:166` (`window.open`) | BE **không có** route PDF. **Probe VPS: KHÔNG có thư viện PDF nào** (`reportlab`/`xhtml2pdf`/`weasyprint`/`fpdf`/`PIL` đều `no`) ⇒ sinh PDF server-side cần dependency mới. ⇒ giải pháp không cần dep: **trả HTML hoá đơn** (trình duyệt in ra PDF) |
| **gap-3** | `/ai/agents/{...}` | `adapters/core/workspace.js:725,729,733,737` | App `ai_agents` **RỖNG** — model đã bị xoá (`ai_agents/migrations/0003_delete_agentregistry.py`), 0 route, chỉ còn `apps.py` 5 LOC + khai trong `settings.py:131` ⇒ 4 method adapter trỏ vào app **không tồn tại** ⇒ code chết |

## 1. Scope

| # | Nội dung | File:line | Loại |
|---|---|---|---|
| **S1** | **gap-2 — đăng ký route detail service account** (2 dòng) | `identity_access/partner_urls.py:43-46` | SỬA |
| **S2** | **gap-1 — endpoint hoá đơn HTML** (không cần lib PDF) + sửa FE mở đúng URL (**thiếu `/core/v1` ở `window.open` — bug thứ 2 cùng chỗ**) | `identity_access/views_tenant.py` + `partner_urls.py` + `pages/tenant-admin/TenantAdminBillingPage.tsx:161,166` | SỬA |
| **S3** | **gap-3 — xoá 4 method adapter chết** `/ai/agents/*` + xoá `'ai_agents'` khỏi `INSTALLED_APPS` | `adapters/core/workspace.js:725-737` · `vninvest_core/settings.py:131` | SỬA |
| **S4** | **Cập nhật allowlist của gate `route-contract`**: bỏ 3 gap đã đóng khỏi danh sách (giữ allowlist rỗng + comment giải thích) | `adapters/core/__tests__/route-contract.test.js` | SỬA |

## 2. ĐÍNH CHÍNH 1 CONTRADICTION (L-V02)

Audit/roadmap nói gap-1/2/3 là "3 endpoint BE **chưa implement**" ⇒ **nói thiếu**: gap-2 **đã có view**, chỉ thiếu route; gap-3 là **code chết** (app rỗng) chứ không phải "chưa làm". ⇒ Sửa theo bản chất thật, không theo nhãn.

## 3. TDD

**RED** — test BE mới `packages/core/backend/tests/test_w0_10_close_be_gaps.py`:
1. **gap-2**: route `/core/v1/partner/service-accounts/<public_id>/` **resolve được** và trả 200 (GET) với SA của tenant ⇒ chứng minh route đã đăng ký (dùng `django.urls.resolve` + gọi endpoint với tenant + `sa:read`).
2. **gap-3**: `/ai/agents/` **không còn** trong `adapters/core/workspace.js`; `'ai_agents'` **không còn** trong `INSTALLED_APPS`.
3. **gap-1**: endpoint hoá đơn HTML trả 200 + `Content-Type: text/html` + chứa số tiền/số hoá đơn.

**GREEN**: sau khi sửa. Test chạy trên **VPS staging** (runbook §12.3).

## 4. Cổng chất lượng

| Gate | Nơi chạy |
|---|---|
| **BE `manage.py test`** (file mới + app bị ảnh hưởng) | **VPS staging** (§12.3) — KHÔNG local Docker |
| **BE full suite** (hồi quy) | VPS staging — so với baseline **3466 / 11 fail / 224 err** (Entry 397) |
| **FE `npm run test:components` + `build` + `lint`** | VPS staging (§12.4) — file FE đổi ở S2 |
| `npx tsc --noEmit` · `pre-push-gate` · `check-experiment-env` · `check-lessons` · `check-multi-agent` | local (§12.2) |

**Dọn sau thử nghiệm:** DB tạm VPS **DROP** · worktree VPS **remove** + prune · `node_modules` VPS **xoá** · `docker ps` xác nhận **không còn container thử nghiệm**.

## 5. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Route mới sai kwarg (`sa_id` vs `service_account_id`) | Đọc `get_object` (`views_tenant.py:202`) dùng `service_account_id` ⇒ route dùng đúng tên; test gọi thật |
| Xoá `ai_agents` khỏi INSTALLED_APPS làm hỏng gì đó | Grep toàn `src/` xem có import `ai_agents` không; nếu có thì **giữ app** và chỉ xoá method adapter |
| Hoá đơn HTML lộ dữ liệu tenant khác | Filter `Invoice.objects.filter(tenant=tenant, public_id=...)` + scope/permission như các view billing hiện có |
| Xoá gap khỏi allowlist nhưng route BE chưa đăng ký thật | Chỉ bỏ khỏi allowlist **sau khi** test RED chứng minh route resolve được |

## 6. GHI NHẬN — W0.7 (SAML `strict` verify thật) **BỊ CHẶN BỞI HẠ TẦNG** (không làm trong slice này)

Probe VPS staging (container `vninvest-core-api:staging`): `import xmlsec` ⇒ **`xmlsec.InternalError: (-1, 'lxml & xmlsec libxml2 library version mismatch')** ⇒ `onelogin.saml2` **cũng không import được** (vì `onelogin/saml2/utils.py` import `xmlsec` ở dòng 23).

⇒ `strict` hiện **luôn raise** (`saml_service.py:402-406`) vì `_verify_signature` **không có** đường verify thật. Để có verify thật phải: (a) sửa **version mismatch libxml2** giữa `lxml` và `xmlsec` trong image (build lxml từ source cùng libxml2, hoặc đổi chiến lược sang `xmlsec1` **CLI** binary có sẵn `/usr/bin/xmlsec1` 1.2.41) **hoặc** (b) dùng `xmlsec1` CLI qua subprocess (verify bằng `--pubkey-cert-pem`) — không cần `xmlsec` python module.
⇒ Đây là **việc hạ tầng + security-sensitive**, cần quyết định Owner giữa (a) và (b) ⇒ **ghi vào handoff + ledger, KHÔNG làm nửa chừng**. `SAML_SIGNATURE_VERIFICATION_MODE=noop` (mặc định khi DEBUG/test) ⇒ dev vẫn chạy được; production phải để `strict` ⇒ **hiện không dùng được cho prod** ⇒ Owner cố ý chưa bật enterprise SSO.
