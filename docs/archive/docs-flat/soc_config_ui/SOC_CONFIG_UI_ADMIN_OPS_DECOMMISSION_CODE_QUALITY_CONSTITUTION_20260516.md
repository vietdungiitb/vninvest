# CODE QUALITY CONSTITUTION — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: Coding standards bắt buộc cho feature pack này. Violation = block merge.

---

## 1. Hard Rules — Backend

### 1.1 OpenAPI & Schema
- Mọi view mới phải có `@extend_schema(...)` decorator từ `drf_spectacular.utils`.
- Response serializers phải được khai báo trong `@extend_schema(responses={...})`.
- Không thêm endpoint mà không có serializer tương ứng (không naked `Response({})`).

### 1.2 Error handling
- **Cấm tuyệt đối** `except: pass` và `except Exception: pass` trong API path.
- Error response phải dùng DRF standard exception handling hoặc custom exception với `detail`/`code`.
- 404 khi rule không tồn tại: `raise Http404` hoặc `get_object_or_404`.
- 410 GONE response: body phải có `{"error": "gone", "message": "...", "migrate_to": "/api/soc/..."}`.

### 1.3 Request body security
- `legacy_proxy.py` (nếu còn) không được log request body — chỉ `method + path + status_code`.
- Screener rule conditions phải được validated bởi serializer trước khi lưu — không lưu raw JSON mà không validate.

### 1.4 Test requirements
- Mỗi view mới phải có ít nhất 2 unit tests: happy path + error path (404/403).
- `test_screener_rule_crud.py` phải bao gồm: create, update, delete, 404 not found, 403 no permission.

---

## 2. Hard Rules — Frontend

### 2.1 React 19 patterns
- Sử dụng React 19 patterns: function components, hooks (`useState`, `useEffect`, `useCallback`).
- Không dùng class components.
- Không dùng `createRef` — chỉ dùng `useRef`.
- Không dùng `React.forwardRef` nếu không cần thiết — dùng ref props trực tiếp trong React 19.

### 2.2 No raw JSON dumps
- **Cấm tuyệt đối** render `<pre>{JSON.stringify(data, null, 2)}</pre>` trong production UI.
- Mọi data phải được render qua form fields, tables, hoặc structured components.
- Exception duy nhất: debug/dev-only panels với `process.env.NODE_ENV === 'development'` guard.

### 2.3 Config writes phải qua ConfigPreviewModal
- Mọi save action của config panels phải mở `ConfigPreviewModal` để user confirm trước.
- Không silent write — không `await save()` thẳng mà không có confirmation step.
- Pattern: `setPreviewPayload(payload) → modal opens → user clicks Confirm → save()`.

### 2.4 i18n mandatory
- Mọi text hiển thị cho user (labels, tooltips, error messages, button text) phải dùng `t()` từ i18n.
- Không hardcode string tiếng Việt trực tiếp trong JSX — khai báo trong `vi.js` trước.
- Key naming: `soc.screener.rule.create`, `soc.prefetch.warm_now.async`, etc.

### 2.5 JSON rule conditions validation
- Input fields cho screener rule conditions (JSON array) phải có client-side validation.
- Valid conditions schema: `[{"field": string, "op": string, "value": any}]`.
- Nếu JSON parse lỗi: hiển thị inline error, không submit form.

### 2.6 API contract
- `socApi.manualScan()` phải gửi `{symbols: [...]}` — **không phải** `{rule_ids: [...]}`.
- Mọi API call mới phải qua `socApi.js` hoặc `client.js` — không direct fetch.
- Mọi API call từ SOC panels phải dùng `socApi` functions — không dùng `getAdmin*` bridge functions.

### 2.7 WriteGuardBanner
- Mọi panel có write action phải kiểm tra `can_apply` từ config API.
- Nếu `can_apply === false`: render `<WriteGuardBanner />`, disable tất cả write buttons.
- Không bỏ qua write guard vì "chắc chắn là admin".

---

## 3. Decommission Phase Rules

### 3.1 Admin-ops 410 handler (D2)
- Response body **bắt buộc** có `migrate_to` field với path SOC tương ứng.
- HTTP status **bắt buộc** là 410 (không dùng 404 hoặc 301).
- Không để lại business logic trong 410 handler — chỉ return JSON.

### 3.2 Frontend cleanup (D3)
- Xóa toàn bộ 15 bridge functions trong `client.js` — không comment out, không keep "for reference".
- Xóa admin-ops routes trong `App.jsx` — không comment out.
- Xóa import AdminOpsPage nếu còn.
- Sau D3: `grep -r "admin-ops" frontend/src/api/client.js` phải return 0 results.

---

## 4. Performance

- PrefetchPanel, ScreenerPanel: dùng `useCallback` cho event handlers trong loops (rule table rows).
- Pagination: không fetch all records rồi slice client-side — paginate ở API query layer.
- DataOps planner: dry-run là non-blocking (async); hiển thị loading state.

---

## 5. Security

- Rule conditions JSON: sanitize trước khi hiển thị (không dùng `dangerouslySetInnerHTML`).
- DNSE API credentials: không render value, không log — chỉ boolean status.
- SOC endpoints: đảm bảo `IsAuthenticated` + `SOCDomainPermission` trên mọi mutating endpoint.
- Không expose internal error stack traces trong API response về client.

---

## 6. Forbidden patterns

| Pattern | Lý do |
|---------|-------|
| `<pre>{JSON.stringify(...)}</pre>` | Raw JSON dump — không acceptable |
| `except: pass` | Silent failure — không acceptable |
| `{rule_ids: ruleIds}` trong manualScan | Contract mismatch |
| Hardcoded string tiếng Việt trong JSX | Phải qua i18n |
| Direct fetch thay vì socApi | No API client abstraction |
| Write mà không có ConfigPreviewModal | Silent write |
| Endpoint mới không có `@extend_schema` | OpenAPI không update |
| 410 handler thiếu `migrate_to` | User không biết đi đâu |
| `can_apply` bị bỏ qua | Permission bypass |
| Test file không có error path | Coverage không đủ |
