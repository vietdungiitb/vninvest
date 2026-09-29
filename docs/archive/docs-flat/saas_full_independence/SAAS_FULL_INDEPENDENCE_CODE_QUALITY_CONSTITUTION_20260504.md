# CODE QUALITY CONSTITUTION — SaaS Full Independence

**Ngày**: 2026-05-04  
**Scope**: Option B — proxy gateway, domain expansion, data migration

---

## 1. Các quy tắc bất biến (không được vi phạm)

### 1.1 Proxy layer
- Proxy KHÔNG được modify request body
- Proxy KHÔNG được cache responses
- Proxy KHÔNG được log request/response body (chỉ log method + path + status)
- Proxy PHẢI forward `Authorization` header nguyên vẹn
- Proxy PHẢI trả HTTP 502 với JSON body khi legacy backend down: `{"error": "upstream_unavailable"}`
- Proxy timeout: connect ≤ 5s, read ≤ 300s (cho admin-ops), default 120s

### 1.2 Auth & Security
- KHÔNG hardcode API keys, passwords, secrets trong code
- KHÔNG dùng `DEBUG=True` hoặc wildcard trong `ALLOWED_HOSTS` trong production
- PAT validation phải dùng HMAC so sánh constant-time (không plain SHA-256)
- Password hash phải dùng `django.contrib.auth.hashers` (không MD5/SHA1)
- Email verification token phải expire sau 24h
- Password reset token phải expire sau 1h

### 1.3 Data migration
- Scripts migration phải idempotent (chạy nhiều lần không tạo duplicate)
- Scripts phải có `--dry-run` mode
- Scripts phải có output count rõ ràng
- KHÔNG được cutover B4 trước khi `parity_score >= 0.99` trên 3 ngày trade

### 1.4 Django
- Mỗi domain app phải có migration files riêng
- KHÔNG dùng `raw()` SQL trừ khi có comment giải thích và reviewed
- ViewSets phải có explicit `permission_classes` — không inherit từ global default
- Không dùng `select_related('__all__')` hay `prefetch_related('__all__')`

### 1.5 packages/web (nếu có thay đổi)
- Không dùng JSX — dùng `createElement` only
- Mọi API calls phải qua `coreApiAdapter.js`
- Text UI mới phải qua i18n tiếng Việt đầy đủ dấu

---

## 2. Quy chuẩn code

### 2.1 Python
```python
# Tên view: {Action}{Domain}View (e.g., TickerDetailView, WhaleFeedListView)
# Tên serializer: {Model}Serializer (e.g., PortfolioSerializer)
# Tên URL name: {domain}-{action} (e.g., ticker-detail, whale-feed-list)

# Ví dụ view đúng chuẩn:
class TickerDetailView(APIView):
    permission_classes = [IsAuthenticated]  # explicit
    
    def get(self, request, symbol):
        # logic here
        return Response(data)
```

### 2.2 URL patterns
```python
# Core native endpoints: /core/v1/{domain}/{action}/
# Compat endpoints (mirrors legacy): /api/{legacy-path}/
# Proxy fallback: /api/<path:remaining> (CUỐI CÙNG, không được đặt trước)
```

### 2.3 Proxy exclusion list format
```python
# legacy_proxy.py
PROXY_EXCLUSION_PREFIXES = (
    # Auth — native trong core
    'api/auth/token',
    'api/auth/token/refresh',
    'api/auth/me',
    'api/portfolio/userconfig',
    # Sau B2:
    'api/auth/register',
    'api/auth/verify-email',
    # ...etc
)
```

---

## 3. Review checklist trước merge

Mỗi PR phải check tất cả items sau:

### Proxy layer (B1)
- [ ] Không log body (chỉ log path + status)
- [ ] Hop-by-hop headers được strip
- [ ] Timeout config đúng (120s default, 300s cho admin-ops paths)
- [ ] 502 fallback có JSON body
- [ ] Exclusion list không bị override nhầm

### Auth views (B2)
- [ ] Token expiry được set
- [ ] Password validation đủ mạnh (min 8 chars)
- [ ] Email validation dùng Django validator
- [ ] Không expose stack trace trong error response

### Data migration scripts (B4)
- [ ] Idempotent test: chạy 2 lần, count giống nhau lần 2
- [ ] Dry-run mode không ghi gì vào DB
- [ ] Parity check logic đúng (so sánh theo portfolio_id + total P&L)

### Admin ops views (B6)
- [ ] `IsCoreOperator` permission guard
- [ ] Audit log entry tạo khi thực hiện action
- [ ] Không expose internal error details ra response

### WebSocket consumers (B7)
- [ ] Authentication middleware stack đúng
- [ ] Channel group name không chứa user input thô (sanitize symbol)
- [ ] Disconnect handler dọn dẹp channel group

---

## 4. Forbidden patterns

```python
# ❌ Không được làm:
password = "admin123"  # hardcode secret
ALLOWED_HOSTS = ["*"]  # trong production settings
permission_classes = []  # admin endpoint không bảo vệ
raw("SELECT * FROM auth_user")  # không có comment review
sha256(token)  # plain hash cho PAT

# ✅ Được làm:
password = os.environ.get("PASSWORD")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")
permission_classes = [IsAuthenticated, IsCoreOperator]
# Reviewed by Tech Lead: raw SQL vì ORM không support window functions
hmac.new(pepper.encode(), token.encode(), hashlib.sha256).hexdigest()
```

---

## 5. Performance constraints

| Endpoint type | p95 target | Caching allowed |
|--------------|-----------|----------------|
| Realtime ticker | < 50ms | Redis TTL 15s |
| Whale feed | < 100ms | Redis TTL 30s |
| Portfolio summary | < 200ms | Redis TTL 60s |
| Admin ops | < 500ms | No cache |
| Stock chart | < 300ms | Redis TTL 5 phút |
| Proxy fallback overhead | < 20ms thêm | N/A |

---

## 6. Migration data quality rules

| Data type | Quality rule | Verification |
|-----------|-------------|-------------|
| Portfolio P&L | Diff ≤ 0.01% | Test 5 portfolios |
| Transaction count | Exact match | SELECT count() |
| Watchlist items | Exact match | SET comparison |
| User email | Exact match | SELECT email |
| Advisory session | Không bắt buộc migrate | Fresh start OK |

---

## 7. Không được làm trong Option B

1. **Không tắt proxy fallback trước khi domain đó đã migrate** — sẽ gây 404 cho users
2. **Không thay đổi URL structure của frontend client** — `/api/*` phải giữ nguyên
3. **Không dùng legacy DB cho write** từ core containers (CoreRouter đang block, không bypass)
4. **Không skip shadow run** dù chỉ 1 ngày — user data là P0
5. **Không merge B8 (decommission)** trước khi tất cả 7 gates pass và Tech Lead sign-off
