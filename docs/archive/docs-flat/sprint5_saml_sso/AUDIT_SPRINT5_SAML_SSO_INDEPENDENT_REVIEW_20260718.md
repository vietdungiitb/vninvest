# Đánh giá độc lập — Sprint 5: Real SAML SSO

> **Ngày:** 2026-07-18
> **Phạm vi:** Sprint 5 (Step 5.1–5.5) của `docs/TENANT_MANAGEMENT_SPRINT_PLAN.md`
> **Framework:** AGENTS.md AI Audit/Research Framework
> **Phương pháp:** Đọc plan + code thực tế, chạy test thực tế, đối chiếu plan↔code, trace luồng SSO end-to-end.
> **Ngôn ngữ:** Tiếng Việt.

---

## 0. NGUYÊN TẮC

1. Mọi khẳng định kèm `file_path:line_number`.
2. Đã doc `read`/`grep` thực tế toàn bộ file cốt lõi.
3. Test được chạy thực tế (41/41 pass) — không suy diễn.
4. Plan/doc MÂU THUẪN với code → finding quan trọng nhất (mục CONTRADICTIONS).
5. Không viết code — chỉ nghiên cứu, phân tích, đề xuất.

---

## 1. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **Chữ ký SAML KHÔNG được xác thực (P0 security):** `_verify_signature()` tại `packages/core/backend/src/identity_access/saml_service.py:296-306` chỉ `logger.warning(...)` rồi pass-through. Mọi SAML Response đều được chấp nhận bất kể chữ ký giả mạo → **bất kỳ ai cũng có thể spoof login SSO** bằng một assertion tự ký (biết email + IdP entity id). Vi phạm trực tiếp Acceptance Criteria Sprint 5: Step 5.3 ("Invalid signature → 403"), Step 5.1 (yêu cầu `python3-saml`).
2. **Plan Step 5.1 KHÔNG được thực hiện:** Kế hoạch yêu cầu `python3-saml>=1.15.0` trong `requirements.txt` và dùng thư viện đó. Thực tế chỉ có `lxml>=5.0,<6.0` được thêm (`requirements.txt:34-35`). `python3-saml` không được cài; `SAMLService` tự viết bằng lxml. Deviation này chỉ nằm trong claim của user, không được ghi chú trong plan.
3. **Auto-Update Protocol (plan §10) bị bỏ qua:** Không có entry Sprint 5 trong `AGENTS.md` Progress, cũng không có entry trong `CODE_CHANGE_AUDIT_LEDGER.md`. Vi phạm DoD ("CODE_CHANGE_AUDIT_LEDGER.md đã cập nhật", "AGENTS.md Progress section đã cập nhật").
4. **Step 5.6 (frontend SSO page) chưa làm:** `packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx` không gọi endpoint `/partner/sso/test-login/`, vẫn là form config mock-flavored với keys `tenantSSO.*`. Plan liệt kê Step 5.6 riêng biệt; user report không nhắc tới → Sprint 5 chưa thực sự "Complete" theo plan.
5. **PAT / Service Account rò rỉ mỗi login (P1):** `SSOCallbackView._process_response` (`packages/core/backend/src/identity_access/views/sso.py:299-318`) tạo `CoreServiceAccount` tên `SSO Session — {email}` và issue PAT `is_human_session=True` mỗi lần login. Không có cơ chế thu hồi/tái sử dụng session PAT → rò rỉ credential theo thời gian, nhất là với SSO (một user login nhiều lần/ngày).

---

## 2. BẢN ĐỒ KIẾN TRÚC (Sprint 5)

| File | Line count | Trách nhiệm | Note |
|------|-----------|--------------|------|
| `src/identity_access/saml_service.py` | 403 | AuthnRequest, parse_response, metadata, test_connection, _verify_signature (stub) | Không dùng python3-saml; lxml thuần |
| `src/identity_access/views/sso.py` | 446 | 6 view classes: PartnerSSOConfig, SSOLoginInitiate, SSOCallback, SSOMetadata, PartnerSSOTestConnection, PartnerSSOTestLogin | Role check qua `require_tenant_permission('sso:read'/'sso:write')` |
| `src/identity_access/urls.py` | 87 | +2 route (callback, metadata) | OK |
| `src/identity_access/partner_urls.py` | 171 | +2 route (test, test-login) | OK |
| `src/identity_access/tests/test_saml_sso.py` | 636 | 41 tests | Pass 41/41 (đã chạy thực tế) |
| `requirements.txt` | 35 | +lxml | Thiếu python3-saml (plan Step 5.1) |

---

## 3. LUỒNG DỮ LIỆU ĐÃ TRACE (SSO login end-to-end)

1. Browser → `SSOLoginInitiateView.get` (`views/sso.py:122`) → `_find_sso_config` theo domain/email (`views/sso.py:44`) → `SAMLService.from_config` (`views/sso.py:140`) → `create_authn_request` (`saml_service.py:86`) → `HttpResponseRedirect` (`views/sso.py:155`). ✅
2. IdP POST → `SSOCallbackView.post` (`views/sso.py:184`) → `_process_response` (`views/sso.py:212`) → resolve tenant từ RelayState → `SAMLService.parse_response` (`saml_service.py:139`) → `_verify_signature` STUB (`saml_service.py:296`) → user find-or-create (`views/sso.py:277`) → member (`views/sso.py:292`) → SA + PAT (`views/sso.py:300-318`). ⚠️ chữ ký không check.

---

## 4. CONTRADICTIONS (plan vs code)

| Plan | Code | Tác động |
|------|------|----------|
| Step 5.1: `requirements.txt` thêm `python3-saml>=1.15.0` | `requirements.txt:34-35` chỉ có `lxml` | Mọi verify chữ ký tự viết, không dùng lib chuẩn → F2 |
| Step 5.3 Acceptance: "Invalid signature → 403" | `saml_service.py:296-306` stub pass-through | Không bao giờ raise → attacker forge login thành công → F1 |
| Step 5.3: "Verify signature against IdP certificate" | `_verify_signature` ignore `idp_x509_cert` | CERT trong config vô dụng |
| §10 Auto-Update: cập nhật AGENTS.md + Ledger mỗi sprint | Không có entry Sprint 5 trong 2 file | Vi phạm DoD → F6 |
| Step 5.6: Update frontend SSO page (test-login flow) | `TenantAdminSSOPage.tsx` không gọi `/partner/sso/test-login/` | Frontend chưa nối flow thực → F4 |

---

## 5. FINDINGS

| ID | Loại | Mức | file:line | Thực tế | Đề xuất fix |
|----|------|-----|-----------|----------|-------------|
| F1 | RISK/SEC | **P0** | `saml_service.py:296-306` | Signature verify là no-op stub, mọi Response accepted | Cài `python3-saml`+`xmlsec1`, implement verify thực; hoặc ít nhất HMAC/self-signed check. Block production. |
| F2 | GAP | P1 | `requirements.txt:34-35` | Thiếu `python3-saml` như plan Step 5.1 | Thêm dependency hoặc sửa plan + ghi chú deviation rõ ràng |
| F3 | GAP | P1 | `views/sso.py:299-318` | Mỗi login tạo SA + PAT human-session, không thu hồi | Reuse session PAT theo user; TTL + cleanup task |
| F4 | GAP | P2 | `TenantAdminSSOPage.tsx` (toàn file) | Step 5.6 chưa làm; không gọi test-login | Implement test-login flow + error/loading states |
| F5 | RISK | P2 | `saml_service.py:391-397` | `test_connection` gọi `httpx.head` tới IdP mỗi lần test → external network trong request path | Đã có timeout=10 OK; nhưng nên opt-in / async (Celery) để tránh block |
| F6 | GAP | P3 | `views/sso.py` + Ledger/AGENTS | Auto-Update Protocol §10 không được thực thi | Viết ledger entry + AGENTS.md entry cho Sprint 5 |

---

## 6. QUALITY GATES AUDIT

- **Backend tests (A5):** ✅ 41/41 pass (đã chạy thực tế trên test DB: `Ran 41 tests in 23.011s ... OK`).
- **tsc / build / lint (A1-A3, frontend):** Không thể xác minh trong scope này (Sprint 5 chủ yếu backend). Không có sub-step frontend build chạy.
- **i18n (A6):** `TenantAdminSSOPage.tsx` dùng `tenantSSO.*` keys (đã tồn tại) → không có hardcoded string mới. OK.
- **Plan A7 (file reference):** Plan trỏ `views/sso.py:74-118`, `:121-223` — file hiện tại khác cấu trúc (class-based, line khác) nhưng các class tương ứng tồn tại. Không có phantom reference.
- **Plan A8 (cross-border):** Endpoint `/partner/sso/test/` và `/partner/sso/test-login/` khớp `partner_urls.py:63-66`. OK.
- **Compile check:** `python -m py_compile` cho `sso.py`, `saml_service.py`, `test_saml_sso.py` → OK (không có syntax error như nghi ngờ ban đầu; dòng `_require_tenant_permission(request, 'sso:read')` có dấu phẩy hợp lệ).

---

## 7. CÂU HỎI CẦN LÀM RÕ

1. Có chấp nhận rủi ro bảo mật F1 (no signature verification) cho production enterprise không? Nếu không, Sprint 5 chưa thể "Complete".
2. Deviation Step 5.1 (lxml thay python3-saml) là quyết định có chủ đích hay bỏ sót? Cần cập nhật plan + ledger.
3. Step 5.6 có nằm trong scope Sprint 5 này không, hay tách sang Sprint 6?

---

## 8. ĐÁNH GIÁ TỔNG THỂ

- **Implementable:** Có, code chạy, 41 test pass.
- **Blocker:** F1 (P0) — SSO không xác thực chữ ký là lỗ hổng nghiêm trọng với tính năng enterprise. Không nên deploy production mà chưa fix.
- **Ưu tiên sửa:** F1 (P0) → F2/F3 (P1) → F4 (Step 5.6) → F6 (ledger/AGENTS compliance).

**Kết luận:** Sprint 5 "hoàn thành" về mặt functional flow + tests, nhưng **chưa đạt DoD** do (a) deviation an toàn bảo mật cốt lõi (F1), (b) deviation plan Step 5.1 (F2), (c) bỏ qua Auto-Update Protocol (F6), (d) thiếu Step 5.6 frontend (F4). Claim "Signature verification note … conscious tradeoff" là hợp lý về kỹ thuật dev, nhưng phải được ghi nhận rõ trong plan/ledger và KHÔNG được coi là "Complete" cho production enterprise SSO.

---

## 9. PHỤ LỤC — Evidence

- Test run: `python manage.py test identity_access.tests.test_saml_sso` → `Ran 41 tests in 23.011s / OK`.
- `requirements.txt:34-35`: `lxml>=5.0,<6.0` (không có `python3-saml`).
- `saml_service.py:296-306`: `_verify_signature` chỉ warning, không verify.
- `views/sso.py:299-318`: tạo SA + PAT mỗi login.
- `partner_urls.py:63-66`: route `partner/sso/test/`, `partner/sso/test-login/` tồn tại.
- `AGENTS.md` / `CODE_CHANGE_AUDIT_LEDGER.md`: không có entry Sprint 5 Tenant Management (các kết quả tìm kiếm "Sprint 5"/"SAML SSO" chỉ match chương trình "AI SSOT" khác).
