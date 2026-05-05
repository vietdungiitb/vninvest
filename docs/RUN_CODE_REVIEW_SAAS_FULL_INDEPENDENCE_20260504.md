# RUN CODE REVIEW — SaaS Full Independence

**Ngày**: 2026-05-04  
**Dùng khi**: Review PR/commit cho bất kỳ slice nào trong Option B

---

## Cách dùng

1. Mở file này trước khi review bất kỳ PR nào thuộc Option B
2. Chạy từng check theo danh sách
3. Ghi lại findings với format: `[SLICE_ID][SEVERITY] description`
4. Severity: `[BLOCKER]` = không được merge | `[MAJOR]` = cần fix trước merge | `[MINOR]` = fix sau OK

---

## Phase B1 — Review checklist

### legacy_proxy.py
```
□ Hop-by-hop headers được strip (connection, keep-alive, transfer-encoding, upgrade, ...)
□ Authorization header được forward nguyên vẹn
□ Content-Type header được forward
□ X-Forwarded-For được set đúng
□ Không log request body
□ Không log response body
□ Timeout: connect=5, read=120 (hoặc 300 cho admin-ops paths)
□ Exception handler: trả 502 JSON khi upstream down, không crash
□ Exclusion list không overlap với proxy rule
□ Async view nếu dùng httpx.AsyncClient (không block event loop)
```

### nginx.conf
```
□ location /api/ trỏ đến core-api:8100 (không còn $backend_upstream)
□ proxy_read_timeout >= 300s
□ WebSocket location /ws/ vẫn có upgrade headers
□ Không có location nào còn trỏ đến backend:8000 (ngoài /admin/)
```

### docker-compose.dev.yml
```
□ backend.ports không còn "8000:8000"
□ frontend.depends_on không còn backend
□ core-api.environment có LEGACY_BACKEND_URL
□ LEGACY_BACKEND_URL dùng service name (http://backend:8000), không dùng localhost
```

---

## Phase B2 — Review checklist

### views_auth.py (register + verify + password-reset)
```
□ Email validator dùng Django built-in EmailValidator
□ Password min length >= 8
□ Verification token lưu hash (không lưu plain token)
□ Token expiry: verify=24h, password-reset=1h
□ Rate limiting trên register endpoint (chống spam)
□ Không expose stack trace trong 4xx/5xx response
□ Registration trả 201, không phải 200
□ Không log password trong bất kỳ nơi nào
```

### migrate_users_to_core.py
```
□ Idempotent: có check "already exists" trước khi insert
□ --dry-run mode không commit transaction
□ Output count: Migrated X / Skipped Y / Errors Z
□ Errors được log với details nhưng không crash toàn bộ script
□ Không migrate plain-text passwords (hash phải được preserve đúng)
```

---

## Phase B3 — Review checklist

### signal_intelligence/views.py (realtime endpoints)
```
□ Auth: permission_classes explicit
□ Symbol parameter được validate/sanitize (không inject vào SQL raw)
□ Pagination có default page_size (tránh N+1 response)
□ Database query dùng select_related/prefetch_related đúng chỗ
□ Response schema khớp với legacy (verify bằng sample payload)
□ Redis cache với đúng TTL cho từng endpoint
```

### market_data/views.py (stock management)
```
□ Symbol parameter URL-decoded đúng
□ Error khi symbol không tồn tại: 404 với message rõ ràng
□ Technicals computation không N+1
□ News fetch có timeout (không block indefinitely)
```

---

## Phase B4 — Review checklist (USER DATA — review kỹ nhất)

### user_workspace/models.py
```
□ SubAccount có ForeignKey → Portfolio với on_delete=CASCADE
□ Transaction có ForeignKey → SubAccount với on_delete=CASCADE
□ DecimalField cho price/quantity (không dùng FloatField)
□ DateField (không DateTimeField) cho transaction_date
□ Migrations không có RunSQL raw (phải dùng ORM operations)
```

### user_workspace/views.py
```
□ CRUD chỉ cho phép user xem/sửa portfolio của chính họ
□ Filter: queryset.filter(portfolio__user=request.user)
□ Không expose data của user khác trong bất kỳ endpoint nào
□ Bulk delete có confirmation step
□ P&L calculation dùng Decimal, không dùng float (tránh rounding error)
```

### migrate_portfolios_to_core.py
```
□ --dry-run mode
□ --parity-check mode chạy riêng được
□ Transaction atomic: nếu 1 portfolio lỗi, không rollback toàn bộ (log và tiếp tục)
□ Output parity_score dạng float 0.0–1.0
□ Không migrate dữ liệu test (filter is_test=True hoặc user.is_staff)
```

---

## Phase B5 — Review checklist

### advisory/views.py
```
□ OPENAI_API_KEY không được log
□ AI response không được cache với user-specific content
□ Token budget check trước khi gọi OpenAI API
□ Timeout cho OpenAI API call (khuyến nghị 30s)
□ Không expose raw OpenAI error message ra client
□ Session scope: user chỉ xem session của chính họ
```

---

## Phase B6 — Review checklist

### ops_audit/views.py và signal_intelligence/admin_views.py
```
□ IsCoreOperator permission guard trên tất cả admin views
□ Mọi destructive action (delete, reset) có audit log entry
□ Bulk operations có confirmation hoặc dry-run mode
□ Signal config changes không có immediate effect mà không có preview step
□ vnstock-config update có changelog entry
```

---

## Phase B7 — Review checklist

### signal_intelligence/consumers.py
```
□ Authentication: WebSocket connection phải authenticated
□ Symbol channel name: sanitize trước khi dùng (ví dụ: f"ticker_{re.sub(r'[^A-Z0-9]', '', symbol)}")
□ disconnect() handler gọi channel_layer.group_discard
□ Không send unlimited messages (có rate control)
□ Error trong consumer không crash toàn bộ channel layer
```

---

## Phase B8 — Review checklist

```
□ legacy_proxy.py wildcard route đã bị xóa khỏi urls.py
□ LEGACY_BACKEND_URL đã bị xóa khỏi settings.py và compose files
□ backend, celery_worker, celery_beat không còn trong docker-compose.dev.yml
□ backend, celery_worker, celery_beat không còn trong docker-compose.prod.yml
□ Không còn import nào từ legacy code trong core code
□ module_tree_full.md đã regenerate
□ Git tag v2.0-saas-only đã tạo
```

---

## Severity escalation

| Finding type | Default severity | Escalate nếu |
|-------------|-----------------|-------------|
| Security issue | BLOCKER | — |
| User data exposure | BLOCKER | — |
| Parity không đạt | BLOCKER cho B4 | — |
| Missing permission_classes | BLOCKER | — |
| Missing timeout | MAJOR | — |
| Response schema mismatch | MAJOR | diff > 10% keys |
| Missing test | MINOR | Nếu B4 business logic |
| Naming convention | MINOR | — |
