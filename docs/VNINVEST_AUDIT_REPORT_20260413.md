# BÁO CÁO AUDIT KỸ THUẬT CHUYÊN SÂU — VNInvest

**Ngày thực hiện**: 13/04/2026  
**Phạm vi**: Backend (Django/Celery/Channels), Frontend (React), Hạ tầng (Redis/DB)  
**Phương pháp**: Đọc từng dòng code, truy vết luồng dữ liệu, phân tích static  
**Mục tiêu**: Phát hiện bug tiềm ẩn, lỗ hổng bảo mật, bottleneck hiệu năng, technical debt

---

## MỤC LỤC

1. [BUG NGHIÊM TRỌNG (Critical Bugs)](#1-bug-nghiêm-trọng-critical-bugs)
2. [LỖ HỔNG BẢO MẬT (Security Vulnerabilities)](#2-lỗ-hổng-bảo-mật-security-vulnerabilities)
3. [RACE CONDITIONS & CONCURRENCY](#3-race-conditions--concurrency)
4. [MEMORY LEAK & RESOURCE LEAK](#4-memory-leak--resource-leak)
5. [BOTTLENECK HIỆU NĂNG (Performance)](#5-bottleneck-hiệu-năng-performance)
6. [KHUYẾT ĐIỂM KIẾN TRÚC (Architectural Debt)](#6-khuyết-điểm-kiến-trúc-architectural-debt)
7. [FRONTEND BUGS & ANTI-PATTERNS](#7-frontend-bugs--anti-patterns)
8. [DATA INTEGRITY RISKS](#8-data-integrity-risks)
9. [KHUYẾN NGHỊ CẢI TIẾN (Prioritized)](#9-khuyến-nghị-cải-tiến-prioritized)

---

## 1. BUG NGHIÊM TRỌNG (Critical Bugs)

### 1.1. `_build_fernet()` tái tạo Fernet instance mỗi lần gọi — Rò rỉ hiệu năng & rủi ro mất dữ liệu khi đổi SECRET_KEY

**File**: `portfolio/encryption_utils.py` — Dòng 9-14

```python
def _build_fernet() -> Fernet:
    secret = (getattr(settings, 'SECRET_KEY', '') + ':portfolio-ai-key').encode('utf-8')
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)
```

**Vấn đề**:
- Fernet key được derive trực tiếp từ `SECRET_KEY`. Nếu `SECRET_KEY` thay đổi (rotate theo best practice), **toàn bộ API key AI đã mã hóa trước đó sẽ không thể giải mã được** — hàm `decrypt_text()` silent fail trả về chuỗi rỗng `''` (dòng 30-31).
- Không có migration path: Khi user config có `ai_api_key_encrypted` hợp lệ nhưng key bị đổi, hệ thống sẽ âm thầm dùng key rỗng, gọi AI provider sẽ fail hết nhưng log chỉ báo "API key invalid" — **rất khó debug**.
- Không cache Fernet instance — mỗi lần encrypt/decrypt đều chạy `sha256()` + tạo `Fernet()` mới.

**Khuyến nghị**:
```python
# Cache Fernet instance, thêm key versioning
_fernet_cache = {}
def _build_fernet(key_version: int = 1) -> Fernet:
    cache_key = (settings.SECRET_KEY, key_version)
    if cache_key not in _fernet_cache:
        secret = (settings.SECRET_KEY + f':portfolio-ai-key:v{key_version}').encode()
        _fernet_cache[cache_key] = Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret).digest()))
    return _fernet_cache[cache_key]
```

---

### 1.2. `monitor_whale_config_rollout_anomalies` — Filter logic mâu thuẫn, exclude vô nghĩa

**File**: `portfolio/services.py` — Dòng 1103-1108

```python
monitored_rollouts = list(
    WhaleConfigRollout.objects
    .select_related('version', 'initiated_by')
    .filter(status__in=[
        WhaleConfigRollout.StatusChoices.RUNNING,
        WhaleConfigRollout.StatusChoices.COMPLETED,
    ])
    .exclude(status=WhaleConfigRollout.StatusChoices.ROLLED_BACK)
    # ^^^ exclude này vô nghĩa vì filter trên đã loại ROLLED_BACK rồi
    .order_by('-started_at', '-created_at')[:10]
)
```

**Bug tương tự ở dòng 926-938** (`get_latest_whale_config_anomaly_overview`):
```python
.filter(status__in=[...RUNNING, COMPLETED])
.exclude(status=...ROLLED_BACK)  # redundant, wasted query clause
```

**Vấn đề**: Mặc dù không gây sai logic, nhưng cho thấy developer copy-paste không kiểm tra, có thể che giấu trường hợp filter thực sự bị thiếu (ví dụ: cần exclude `PAUSED` nhưng viết nhầm).

---

### 1.3. `auto_revert_whale_config_rollout` — Gọi `activate_whale_config_version` bên trong `db_transaction.atomic()` có thể gây deadlock

**File**: `portfolio/services.py` — Dòng 1046-1063

```python
with db_transaction.atomic():
    rollout.status = WhaleConfigRollout.StatusChoices.ROLLED_BACK
    rollout.save(update_fields=['status', 'finished_at', 'note'])
    
    if rollout.version.status == WhaleConfigVersion.StatusChoices.ACTIVE:
        rollout.version.status = WhaleConfigVersion.StatusChoices.ROLLED_BACK
        rollout.version.save(update_fields=['status', 'updated_at'])

    activation_rollout, propagation = activate_whale_config_version(
        fallback_version, initiated_by=actor, ...
    )
    # ^^^ activate_whale_config_version nội bộ cũng có thể sử dụng
    # db_transaction.atomic() → nested savepoint
    # + gửi email notification VÀ create audit log TRONG transaction
    notification = notify_whale_config_auto_revert(...)
    WhaleConfigAuditLog.objects.create(...)
```

**Vấn đề**:
- Gửi email (`send_system_email`) nằm **bên trong** `db_transaction.atomic()` (gián tiếp qua `notify_whale_config_auto_revert`). Nếu email gửi chậm (SMTP timeout 30s), transaction giữ lock DB suốt thời gian đó.
- Nếu `activate_whale_config_version` cũng dùng `atomic()`, sẽ tạo nested savepoint — nếu inner transaction fail, outer transaction rollback toàn bộ bao gồm cả status đã update.

**Khuyến nghị**: Tách email notification ra ngoài transaction:
```python
with db_transaction.atomic():
    # ... save rollout, version, create log ...
    pass

# SAU KHI transaction commit thành công:
notification = notify_whale_config_auto_revert(...)
```

---

### 1.4. `fetch_and_save_daily_prices` — Toàn bộ dữ liệu nằm trong 1 transaction lớn, lỗi 1 row = rollback ALL

**File**: `portfolio/services.py` — Dòng 1526-1554

```python
with db_transaction.atomic():
    for _, row in df.iterrows():
        # ... parse date ...
        try:
            _, created = DailyPrice.objects.update_or_create(...)
        except Exception as db_exc:
            logger.warning(...)
            result['errors'] += 1
            continue  # ← BUG: continue NOT skip — exception bị catch
                       # nhưng atomic() vẫn commit nếu không re-raise
```

**Vấn đề thực sự**: Mặc dù `continue` hoạt động đúng (catch exception rồi tiếp tục), nhưng nếu exception là `IntegrityError` hoặc `DatabaseError` ở mức PostgreSQL, Django sẽ đánh dấu transaction là "dirty" và **tất cả câu lệnh SQL tiếp theo trong cùng atomic block sẽ fail** với `TransactionManagementError`. Lúc đó dữ liệu hợp lệ trước đó cũng mất.

**Khuyến nghị**: Dùng savepoint cho mỗi row hoặc bỏ outer atomic():
```python
for _, row in df.iterrows():
    try:
        with db_transaction.atomic():  # savepoint per row
            DailyPrice.objects.update_or_create(...)
    except Exception:
        result['errors'] += 1
```

---

### 1.5. `sync_portfolio_prices` — N+1 query pattern, gọi vnstock tuần tự cho từng symbol

**File**: `portfolio/services.py` — Dòng 1583-1588

```python
for symbol in symbols:
    res = fetch_and_save_daily_prices(symbol, start_date=start_date)
    results.append(res)
```

**Vấn đề**: Nếu portfolio có 30 symbols, hệ thống gọi vnstock API **30 lần tuần tự** với timeout 8s mỗi lần — worst case **4 phút** để sync. Không có concurrency, không có batch API.

Tương tự ở `sync_watchlist_prices` (dòng 1701-1703).

---

## 2. LỖ HỔNG BẢO MẬT (Security Vulnerabilities)

### 2.1. WebSocket Authentication — JWT token trong query string, không hết hạn khi revoke

**File**: `portfolio/consumers.py` — Dòng 129-146

```python
async def _authenticate_user(self):
    token = self._get_query_token()
    # ...
    access_token = AccessToken(token)
    user_id = access_token.get("user_id")
    return await self._get_user(user_id)

def _get_query_token(self) -> str | None:
    query_string = self.scope.get("query_string", b"").decode()
    query_params = parse_qs(query_string)
    token = query_params.get("token", [None])[0]
    return token
```

**Vấn đề**:
- **JWT token truyền qua URL query string** — sẽ bị log trong access log (Nginx, Django, CDN). Attacker có access log = có token.
- Token chỉ được validate **1 lần khi connect**. Nếu token bị revoke (user logout, password change), WebSocket connection **vẫn tiếp tục hoạt động** cho đến khi đóng.
- Không có cơ chế periodic re-auth: connection có thể sống hàng giờ với token hết hạn.

**Khuyến nghị**:
- Thêm heartbeat re-auth: mỗi 5 phút, consumer verify lại token expiry.
- Log rotation: cấu hình Nginx không log query params cho endpoint `/ws/`.
- Long-term: chuyển sang ticket-based auth (issue short-lived ticket, consume 1 lần).

---

### 2.2. `RegisterSerializer` — Thiếu `validate_password()` của Django

**File**: `portfolio/auth_views.py` — Dòng 107-140

```python
class RegisterSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=8, write_only=True)
    # ...
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError(...)
        return data
    # ^^^ KHÔNG gọi validate_password(data['password'])
```

So sánh với `PasswordResetConfirmView` (dòng 346):
```python
validate_password(new_password, user=user)  # ← có validate
```

**Vấn đề**: Khi đăng ký, password chỉ cần ≥ 8 ký tự là đủ. Không kiểm tra:
- Password quá phổ biến (CommonPasswordValidator)
- Password giống username (UserAttributeSimilarityValidator)  
- Password chỉ toàn số (NumericPasswordValidator)

User có thể đăng ký với password `12345678` hoặc `password`.

**Khuyến nghị**: Thêm `validate_password()` trong `RegisterSerializer.validate()`:
```python
from django.contrib.auth.password_validation import validate_password
def validate(self, data):
    validate_password(data['password'])
    # ...
```

---

### 2.3. `GoogleOAuthView` — Account Takeover qua email collision

**File**: `portfolio/auth_views.py` — Dòng 392-401

```python
with transaction.atomic():
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        # Tạo user mới — OK
    else:
        # ← User đã tồn tại với email này! 
        # Không kiểm tra oauth_provider ban đầu là gì
```

**Vấn đề**: Nếu user A đăng ký bằng email+password (email `victim@gmail.com`), rồi attacker dùng Google OAuth login với cùng email đó — hệ thống **sẽ link account Google vào user A** (dòng 403-406):

```python
cfg.oauth_provider = 'google'
cfg.oauth_uid = email
cfg.email_verified = True  # auto-verify!
```

Attacker bây giờ có thể login vào tài khoản của victim. Đây là lỗi **Account Takeover** cổ điển.

**Khuyến nghị**: Khi user đã tồn tại và chưa link OAuth, yêu cầu xác minh quyền sở hữu:
```python
if user is not None:
    cfg = getattr(user, 'user_config', None)
    if cfg and cfg.oauth_provider and cfg.oauth_provider != 'google':
        raise ValidationError('Tài khoản đã liên kết với provider khác.')
    if not cfg or not cfg.oauth_provider:
        # Gửi email xác nhận merge, KHÔNG auto-link
        raise ValidationError('Tài khoản đã tồn tại. Vui lòng đăng nhập bằng mật khẩu.')
```

---

### 2.4. `_get_plan()` — Plan bypass khi user không có `user_config`

**File**: `portfolio/permissions.py` — Dòng 101-108

```python
def _get_plan(user) -> str:
    cfg = getattr(user, 'user_config', None)
    if not cfg:
        return 'free'
    if cfg.plan_expires_at and cfg.plan_expires_at < timezone.now():
        return 'free'
    return cfg.plan
```

**Vấn đề**: `getattr(user, 'user_config', None)` phụ thuộc vào Django reverse relation. Nếu `user_config` không được prefetch (ví dụ user object lấy từ `User.objects.get(pk=id)` thay vì `select_related`), thì:
- Django sẽ thực hiện **1 query thêm mỗi lần check plan** (N+1).
- Nếu caching interceptor trả về stale UserConfig, plan có thể sai.

Quan trọng hơn: Logic không kiểm tra `cfg.plan` có hợp lệ trong `PLAN_ORDER` không. Nếu ai đó inject giá trị `plan='admin'` trực tiếp vào DB (hoặc via Django admin), hệ thống chấp nhận.

---

### 2.5. WebSocket — Không rate-limit subscribe/unsubscribe

**File**: `portfolio/consumers.py` — Dòng 49-63

```python
async def receive_json(self, content, **kwargs):
    action = content.get("action")
    symbols = [str(symbol).upper() for symbol in content.get("symbols", []) if symbol]

    if action == "subscribe":
        await self._subscribe_symbols(symbols)
        # ^^^ Không giới hạn số lượng symbols
        # Không giới hạn tần suất gọi

    if action == "unsubscribe":
        await self._unsubscribe_symbols(symbols)
```

**Vấn đề**:
- Client có thể subscribe **không giới hạn** symbols — mỗi symbol tạo 2 channel groups (`ticker_` + `whale_`). 1000 symbols = 2000 groups trên 1 connection.
- Client có thể gửi subscribe/unsubscribe liên tục (spam) — tạo load lên Redis channel layer.
- Không validate symbol format — có thể subscribe vào arbitrary group names.

---

## 3. RACE CONDITIONS & CONCURRENCY

### 3.1. `_get_gate()` Semaphore — Semaphore không bao giờ bị reset khi concurrency thay đổi

**File**: `portfolio/adapters/vnstock_adapter.py` — Dòng 71-88

```python
_VNSTOCK_GATE_BY_LIMIT: dict[int, threading.BoundedSemaphore] = {}
_VNSTOCK_GATE_LOCK = threading.Lock()

def _get_gate(limit: int) -> threading.BoundedSemaphore:
    with _VNSTOCK_GATE_LOCK:
        gate = _VNSTOCK_GATE_BY_LIMIT.get(limit)
        if gate is None:
            gate = threading.BoundedSemaphore(value=limit)
            _VNSTOCK_GATE_BY_LIMIT[limit] = gate
        return gate
```

**Vấn đề**: Nếu admin thay đổi `max_concurrency` từ 12 xuống 4 qua runtime config, hệ thống **tạo semaphore mới** (key=4) nhưng semaphore cũ (key=12) **vẫn tồn tại trong dict** và các thread đang dùng nó vẫn tiếp tục. Kết quả: concurrency limit mới không có hiệu lực cho đến khi worker restart.

Tệ hơn: nếu `max_concurrency` dao động giữa các giá trị, dict sẽ accumulate nhiều semaphores vô dụng.

---

### 3.2. `flush_merged_advisory_event` — Cache race giữa read và delete

**File**: `portfolio/tasks_whale_advisory.py` — Dòng 48-63

```python
state = cache.get(cache_key)        # ← T1: đọc state
if not state:
    return {'status': 'skipped'}

threshold_vnd = _safe_float(state.get('threshold_vnd'), 100_000)
# ... xử lý state ...

cache.delete(cache_key)              # ← T1: xóa key
# Nhưng giữa cache.get() và cache.delete():
#   T2 có thể đã ghi state MỚI vào cùng cache_key
#   → T1 xóa state của T2 → mất event!
```

**Vấn đề**: Không có atomic "get-and-delete". Trong môi trường multi-worker Celery, 2 task có thể chạy đồng thời trên cùng `(user_id, symbol)` pair — one flushes stale data, another's fresh data gets deleted.

**Khuyến nghị**: Sử dụng Redis `GETDEL` hoặc Lua script để atomic get+delete.

---

### 3.3. `UserMeView` — Truy cập `user.user_config` không prefetch, stale read

**File**: `portfolio/auth_views.py` — Dòng 58-79

```python
def get(self, request, *args, **kwargs):
    user = request.user
    cfg = getattr(user, 'user_config', None)
    entitlements = resolve_user_entitlements(user)
    # ^^^ resolve_user_entitlements gọi _get_plan(user) 
    # → lại getattr(user, 'user_config') lần nữa
    # → 2 queries cho cùng user_config (nếu không có prefetch)
```

**Vấn đề**: `request.user` từ DRF JWT middleware không `select_related('user_config')`. Mỗi request `/api/auth/me/` tạo **ít nhất 2 DB queries** cho `UserConfig`.

---

## 4. MEMORY LEAK & RESOURCE LEAK

### 4.1. `_run_with_timeout` — ThreadPoolExecutor leak khi vnstock gọi `sys.exit()`

**File**: `portfolio/adapters/vnstock_adapter.py` — Dòng 174-189

```python
try:
    with cf.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn)
        return future.result(timeout=timeout)
except cf.TimeoutError as exc:
    last_error = ExternalSystemException(...)
except (Exception, SystemExit) as exc:
    # ...
finally:
    if gate is not None:
        gate.release()
```

**Vấn đề**: Khi `future.result(timeout=X)` timeout, `ThreadPoolExecutor.__exit__` sẽ chờ worker thread kết thúc (default `wait=True`). Nhưng vnstock thỉnh thoảng gọi `sys.exit()` trong thread — thread bị kill nhưng **executor không cleanup properly**, có thể giữ thread objects trong memory.

Tương tự ở `_fetch_exchange_lookup` (services.py dòng 2056-2085): daemon thread chạy vnstock, nếu timeout xảy ra, thread **vẫn chạy ngầm** tiêu tốn CPU và có thể gây side effect.

---

### 4.2. Frontend `latencySamplesMs` — Mảng unbounded grow

**File**: `frontend/src/hooks/useRealtimeFeedLegacy.js` — Dòng 471

```javascript
setLatencySamplesMs((prev) => [...prev.slice(-199), latency]);
```

**Vấn đề**: Mỗi ticker update và heartbeat đều push vào mảng này. Với 30 symbols gửi 1 update/s + heartbeat mỗi 30s, sau 1 giờ = ~108,000 state updates. Mặc dù slice giữ max 200 items, **mỗi lần set state tạo mảng mới** → GC pressure.

Nhưng vấn đề lớn hơn: `setLatencySamplesMs` trigger re-render cho `uiRefreshP95Ms` memo (dòng 184-189), nhưng `uiRefreshP95Ms` chỉ được dùng trong `metrics` — hiếm khi cần render. **Toàn bộ chain re-render này là wasted**.

---

## 5. BOTTLENECK HIỆU NĂNG (Performance)

### 5.1. `build_whale_rollout_anomaly_snapshot` — 4 DB queries không batched

**File**: `portfolio/services.py` — Dòng 840-864

```python
# Query 1: filter ticks + annotate matched_value
tick_queryset = IntradayTick.objects.filter(...).annotate(
    matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
).filter(matched_value__gte=whale_threshold_vnd)

# Query 2: count current ticks
current_tick_count = current_ticks.count()
# Query 3: count baseline ticks
baseline_tick_count = baseline_ticks.count()
# Query 4: sum current tick notional
current_tick_notional = float(current_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)
# Query 5: sum baseline tick notional
baseline_tick_notional = float(baseline_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)
# Query 6: count current advisories
current_advisory_count = advisory_queryset.filter(created_at__gte=current_window_start).count()
# Query 7: count baseline advisories
baseline_advisory_count = advisory_queryset.filter(created_at__lt=current_window_start).count()
```

**Vấn đề**: Chạy **7 queries riêng lẻ** trong 1 function call. Có thể gộp count+sum vào 1 query bằng conditional aggregation:

```python
from django.db.models import Case, When, Value, IntegerField
result = tick_queryset.aggregate(
    current_count=Count(Case(When(created_at__gte=current_window_start, then=1))),
    baseline_count=Count(Case(When(created_at__lt=current_window_start, then=1))),
    current_notional=Sum(Case(When(created_at__gte=current_window_start, then='matched_value'), default=0)),
    baseline_notional=Sum(Case(When(created_at__lt=current_window_start, then='matched_value'), default=0)),
)
```

→ 7 queries → **2 queries** (1 cho ticks, 1 cho advisories).

---

### 5.2. `get_price_changes` — N+1 query per symbol

**File**: `portfolio/services.py` — Dòng 1638-1667

```python
for symbol in upper_symbols:
    prices = list(
        DailyPrice.objects
        .filter(symbol=symbol)
        .order_by('-date')
        .values('close_price', 'date')[:2]
    )
    # ...
```

**Vấn đề**: 1 query per symbol. Cho 50 symbols trong portfolio = 50 queries. Hoàn toàn có thể batch:

```python
from django.db.models import Window, RowNumber
# Sử dụng window function để lấy 2 dòng mới nhất PER symbol trong 1 query
```

---

### 5.3. `get_realtime_ticker` — Hàm helper `_select_symbol_row` định nghĩa lại MỖI LẦN gọi

**File**: `portfolio/market_data_service.py` — Dòng 156-178

```python
if df is not None and not df.empty:
    def _select_symbol_row(frame, expected_symbol):
        # 22 dòng logic...
        return frame.iloc[0]
    
    row = _select_symbol_row(df, normalized_symbol)
```

**Vấn đề**: Closure `_select_symbol_row` + `_safe_float` + `_safe_int` được **tạo lại bên trong if block mỗi lần cache miss** (dòng 156, 188, 195). Mặc dù Python handle closures tốt, việc define 3 functions mỗi request là wasteful và khó maintain.

---

### 5.4. `get_rvol` — Import pandas **2 lần** trong cùng function

**File**: `portfolio/market_data_service.py` — Dòng 690 + 705

```python
# Lần 1 (trong loop):
import pandas as pd
ts = pd.Timestamp(str(raw_time))

# Lần 2 (ngoài loop):
import pandas as pd
frame = pd.DataFrame(rows).set_index('ts').sort_index()
```

**Vấn đề**: `import pandas` bên trong loop (dòng 690) — mặc dù Python cache module imports, cú pháp này **chạy import lookup mỗi iteration** = overhead nhỏ nhưng không cần thiết.

---

## 6. KHUYẾT ĐIỂM KIẾN TRÚC (Architectural Debt)

### 6.1. `UserConfig` — God Object với 30+ fields

**File**: `portfolio/models.py` — Model `UserConfig`

Một model duy nhất chịu trách nhiệm cho:
- **UI preferences**: `theme`, `whale_alert_threshold`
- **Plan management**: `plan`, `plan_expires_at`, `plan_source`, `plan_assigned_at`, `plan_locked_by_admin`, `auto_downgrade_enabled`, `downgraded_at`
- **AI configuration**: `ai_api_key_encrypted`, `ai_provider`, `ai_model`, `advisory_language`
- **Email state**: `email_verified`, `email_verified_at`, `email_verification_sent_at`
- **OAuth state**: `oauth_provider`, `oauth_uid`
- **Advisory settings**: `daily_token_budget`, `auto_advisory_enabled`, `advisory_max_batch_size`, `advisory_interval_minutes`

**Vấn đề**:
- Vi phạm SRP nghiêm trọng. Mỗi khi update theme, Django load toàn bộ 30+ columns.
- `update_fields` phải liệt kê rất dài, dễ quên field → stale data.
- Migrate trở nên rủi ro: thêm column mới cho AI config ảnh hưởng toàn bộ auth flow.

**Khuyến nghị**: Tách thành 4 models nhỏ:
```
UserPreferences (theme, language, alert_threshold)
UserPlanConfig  (plan, plan_expires_at, plan_source, ...)
UserAIConfig    (ai_api_key_encrypted, ai_provider, ai_model, ...)
UserAuthState   (email_verified, oauth_provider, oauth_uid, ...)
```

---

### 6.2. `tasks.py` — Barrel re-export file, không chứa logic nào

**File**: `portfolio/tasks.py` — 177 dòng, toàn bộ là imports

```python
from portfolio.tasks_whale_advisory import (
    generate_whale_advisory_task,
    auto_generate_advisories_for_all_tracked,
    flush_merged_advisory_event,
    ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY,
    ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX,
)
from portfolio.tasks_prefetch import (
    prefetch_ticker_price_board,
    _prefetch_runtime_defaults,
    _get_prefetch_runtime_settings,
    # ... 15+ more private functions re-exported
)
```

**Vấn đề**:
- Re-export **private functions** (prefix `_`) phá vỡ encapsulation — các module khác import `from portfolio.tasks import _prefetch_runtime_defaults`.
- File này là single point of coupling: thay đổi bất kỳ sub-module nào đều phải touch `tasks.py`.
- Circular import risk cao.

---

### 6.3. `views.py` — Barrel import hub, 291 dòng chỉ toàn import

**File**: `portfolio/views.py` — Tương tự `tasks.py`, file này import từ ~20 sub-modules khác nhau. Không chứa logic view nào.

**Vấn đề**: Django URL resolver ref đến `views.SomeView`, nhưng load `views.py` = load TẤT CẢ 20 modules ngay cả khi request chỉ cần 1 view → **startup time chậm**, memory footprint cao.

---

### 6.4. `normalize_whale_config_payload` — "Flexible input" Anti-pattern

**File**: `portfolio/services.py` — Dòng 1134-1182

```python
def normalize_whale_config_payload(config_json: dict | None) -> dict:
    whale_threshold_m = _coerce_float(
        _extract_first(payload, [
            'whale_threshold_million',
            'whale_threshold',
            'whale_alert_threshold',
            'threshold'
        ]),
        float(default_whale_threshold_m),
    )
```

**Vấn đề**: Mỗi field chấp nhận **3-4 tên khác nhau** ("whale_threshold_million", "whale_threshold", "whale_alert_threshold", "threshold"). Điều này:
- Tạo contract API mơ hồ — client không biết dùng key nào là "chuẩn".
- Debug nightmare: cùng 1 giá trị có thể đến từ 4 sources khác nhau.
- Mỗi lần thêm alias mới = thêm surface area cho bugs.

**Khuyến nghị**: Chốt 1 canonical key per field, deprecated aliases có warning log.

---

## 7. FRONTEND BUGS & ANTI-PATTERNS

### 7.1. `useRealtimeFeed` — Luôn gọi CẢ HAI hooks (managed + legacy) bất kể flag

**File**: `frontend/src/hooks/useRealtimeFeed.js` — Dòng 7-18

```javascript
export default function useRealtimeFeed({ symbols, pollInterval, maxAlerts }) {
  const managedFeed = useRealtimeFeedFromManager({ symbols, pollInterval, maxAlerts });
  const useManager = ENABLE_REALTIME_CONNECTION_MANAGER && !!managedFeed;

  const legacyFeed = useRealtimeFeedLegacy({
    symbols, pollInterval, maxAlerts,
    enabled: !useManager,
  });

  return useManager ? managedFeed : legacyFeed;
}
```

**Vấn đề**: React hooks **không thể conditional call** — cả `useRealtimeFeedFromManager` và `useRealtimeFeedLegacy` đều chạy MỌI LẦN render. Mặc dù `enabled: !useManager` ngăn legacy hook tạo WS connection, nó vẫn:
- Allocate state (6 `useState` calls trong `useRealtimeFeedLegacy`)
- Set up `useMemo` computations
- Create closure objects

Với mỗi component dùng `useRealtimeFeed`, overhead nhân đôi.

---

### 7.2. `useRealtimeFeedLegacy` — Polling interval không tự adjust khi symbol list thay đổi

**File**: `frontend/src/hooks/useRealtimeFeedLegacy.js` — Dòng 332-334

```javascript
const start = () => {
  poll();
  intervalId = window.setInterval(poll, pollIntervalRef.current);
};
```

**Vấn đề**: `setInterval` được tạo 1 lần với `pollIntervalRef.current` tại thời điểm đó. Nếu `pollInterval` thay đổi (component re-render với prop mới), interval CŨ vẫn giữ nguyên cho đến khi effect cleanup. Ref update (dòng 170) không ảnh hưởng interval đã tạo.

---

### 7.3. `RealtimeContext` — Closure stale trên `register`/`update`/`unregister`

**File**: `frontend/src/context/RealtimeContext.jsx` — Dòng 89-111

```javascript
const value = useMemo(() => {
    return {
      register,    // ← closure from component body, NOT memoized
      update,      // ← same
      unregister,  // ← same
      feed: { ...feed },
    };
}, [feed, subscriptions, aggregatedSymbols]);
```

**Vấn đề**: `register`, `update`, `unregister` là **inline functions** (dòng 52-87), không được wrap trong `useCallback`. Nhưng chúng được đưa vào `useMemo` deps — mỗi lần component render, functions mới được tạo, nhưng `useMemo` chỉ recalc khi `feed/subscriptions/aggregatedSymbols` thay đổi → **consumers giữ stale closure**.

---

### 7.4. Token storage — `localStorage` không secure

**File**: `frontend/src/api/client.js` — Dòng 23, 44, 50

```javascript
const token = localStorage.getItem('access_token');
localStorage.setItem('access_token', data.access);
localStorage.setItem('refresh_token', data.refresh);
```

**Vấn đề**: `localStorage` accessible bởi **bất kỳ JavaScript nào** trên cùng origin. Nếu có XSS vulnerability (dù chỉ 1 chỗ), attacker extract cả access + refresh tokens.

**Khuyến nghị**: Lưu refresh token trong HttpOnly cookie, chỉ giữ access token (short-lived) trong memory.

---

## 8. DATA INTEGRITY RISKS

### 8.1. `TransactionSerializer.validate_symbol` — Soft-bootstrap tạo StockProfile rác

**File**: `portfolio/serializers.py` — Logic "soft-bootstrap"

Khi user nhập symbol chưa tồn tại trong `StockProfile`, serializer tự tạo record mới thay vì reject. Nếu user typo (ví dụ "VNMM" thay vì "VNM"), hệ thống tạo `StockProfile(symbol='VNMM')` vĩnh viễn.

**Vấn đề**: Không có mechanism để cleanup StockProfiles không hợp lệ. Qua thời gian, bảng sẽ accumulate "ghost symbols".

---

### 8.2. `PasswordResetConfirmView` — Không invalidate token sau sử dụng

**File**: `portfolio/auth_views.py` — Dòng 333-354

```python
def post(self, request, *args, **kwargs):
    # ...
    user = resolve_password_reset_token(token)
    # ← token vẫn hợp lệ cho đến khi hết hạn (max_age)
    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=['password'])
```

**Vấn đề**: Token-based reset thường dùng `django.core.signing` với `max_age`. Nhưng sau khi reset password thành công, token **không bị blacklist** — attacker có thể re-use token trong window còn lại để reset password lần nữa.

---

### 8.3. `onboarding_trial_service.process_expired_onboarding_trials` — `fallback_plan` hardcoded BASIC

**File**: `portfolio/onboarding_trial_service.py` — Dòng 151

```python
fallback_plan = (policy.fallback_plan if policy else UserConfig.PlanChoices.BASIC)
```

**Vấn đề**: Nếu không có active policy (tất cả policies expired hoặc bị deactivate), user bị downgrade xuống `BASIC` thay vì `FREE`. User hết trial nhưng vẫn giữ `BASIC` features miễn phí — **revenue leakage**.

---

### 8.4. `WhaleAdvisory` cooldown chỉ dựa trên cache, không persistent

Cooldown logic dùng Redis cache key (dạng `advisory:cooldown:{user_id}:{symbol}`). Nếu Redis restart hoặc eviction xảy ra, cooldown mất → advisory generation spam AI provider ngay lập tức.

---

## 9. KHUYẾN NGHỊ CẢI TIẾN (Prioritized)

### 🔴 P0 — Critical (Fix ngay, ảnh hưởng security/data)

| # | Vấn đề | File | Effort |
|---|--------|------|--------|
| 1 | Account Takeover via Google OAuth | `auth_views.py:392` | 2h |
| 2 | Missing `validate_password` on register | `auth_views.py:127` | 30min |
| 3 | Encryption key không có migration path | `encryption_utils.py` | 4h |
| 4 | Password reset token reuse | `auth_views.py:341` | 2h |
| 5 | WebSocket subscribe không rate-limit | `consumers.py:49` | 3h |

### 🟠 P1 — High (Fix trong Sprint tới, ảnh hưởng stability)

| # | Vấn đề | File | Effort |
|---|--------|------|--------|
| 6 | Email gửi bên trong DB transaction | `services.py:1064` | 2h |
| 7 | `fetch_and_save_daily_prices` atomic rollback | `services.py:1526` | 1h |
| 8 | Flush advisory cache race condition | `tasks_whale_advisory.py:48` | 3h |
| 9 | Trial fallback plan = BASIC thay vì FREE | `onboarding_trial_service.py:151` | 30min |
| 10 | WS token trong query string bị log | `consumers.py:142` | 2h |

### 🟡 P2 — Medium (Plan cho Sprint+1, ảnh hưởng performance)

| # | Vấn đề | File | Effort |
|---|--------|------|--------|
| 11 | `get_price_changes` N+1 queries | `services.py:1638` | 3h |
| 12 | Anomaly snapshot 7 queries → 2 | `services.py:840` | 2h |
| 13 | `sync_portfolio_prices` sequential calls | `services.py:1583` | 4h |
| 14 | Frontend hooks double-allocate state | `useRealtimeFeed.js` | 2h |
| 15 | `UserConfig` God Object refactor | `models.py` | 2-3 sprints |

### 🟢 P3 — Low (Technical debt, plan dài hạn)

| # | Vấn đề | File | Effort |
|---|--------|------|--------|
| 16 | `tasks.py` barrel re-export cleanup | `tasks.py` | 4h |
| 17 | `views.py` barrel import split | `views.py` | 4h |
| 18 | Semaphore dict accumulation | `vnstock_adapter.py:71` | 1h |
| 19 | Config payload flexible key anti-pattern | `services.py:1134` | 4h |
| 20 | `localStorage` token → HttpOnly cookie | `client.js` | 8h |

---

## TỔNG KẾT

| Hạng mục | Số lượng phát hiện |
|----------|-------------------|
| Bug nghiêm trọng | 5 |
| Lỗ hổng bảo mật | 5 |
| Race conditions | 3 |
| Memory/Resource leak | 2 |
| Performance bottleneck | 4 |
| Architectural debt | 4 |
| Frontend bugs | 4 |
| Data integrity risks | 4 |
| **Tổng** | **31** |

**Đánh giá tổng thể**: Codebase có kiến trúc tốt ở mức macro (phân tách rõ services/views/tasks), nhưng ở mức micro-level tồn tại nhiều vấn đề nghiêm trọng — đặc biệt ở authentication flow (Google OAuth Account Takeover) và data pipeline reliability (transaction management, race conditions). Ưu tiên P0 cần được fix trước khi deploy production hoặc mở rộng user base.

---

## PHỤ LỤC A — PHÁT HIỆN BỔ SUNG (Deep-Dive Round 2)

Các phát hiện dưới đây được bổ sung sau khi đào sâu thêm vào các module: Celery realtime tasks, quota enforcement, realtime publisher, serializer validation, password reset, settings, và Google OAuth service.

---

### A.1. `collect_and_publish_realtime` — N+1 DB queries trong vòng lặp whale signal

**File**: `portfolio/tasks_realtime.py` — Dòng 131-160

```python
for signal in tasks_facade.detect_whale_signals(...):
    # ...
    tracked_rows = list(
        TrackedSymbol.objects.filter(symbol=signal.symbol)
        .values('user_id', 'whale_alert_threshold_million')
    )
    for tracked_row in tracked_rows:
        tracked_user_id = int(tracked_row.get('user_id') or 0)
        # ...
        user_cfg = UserConfig.objects.filter(user_id=tracked_user_id).first()
        # ^^^ 1 DB query PER tracked user PER whale signal
```

**Vấn đề**: Với 10 symbols × 3 whale signals × 50 tracked users = **1,500 DB queries** trong 1 task execution. `UserConfig` không được batch-loaded hay cached.

**Khuyến nghị**: Prefetch toàn bộ UserConfig cho tracked users trước vòng lặp:
```python
tracked_user_ids = TrackedSymbol.objects.filter(
    symbol__in=symbols
).values_list('user_id', flat=True).distinct()

user_configs_by_id = {
    cfg.user_id: cfg
    for cfg in UserConfig.objects.filter(user_id__in=tracked_user_ids)
}
```

---

### A.2. `collect_and_publish_realtime` — Dedup cache key dùng `event_id` nhưng không check collision

**File**: `portfolio/tasks_realtime.py` — Dòng 109-116

```python
event_id = whale_payload.get("event_id", "")
if event_id:
    dedup_cache_key = f"whale:dedup:{event_id}"
    if cache.get(dedup_cache_key):
        record_whale_dedup_observation(hit=True)
        continue
    cache.set(dedup_cache_key, 1, timeout=300)
```

**Vấn đề**: Nếu `event_id` rỗng (`""`) — dedup bị bypass hoàn toàn, whale alert sẽ được publish mỗi lần task chạy (mỗi 10s theo beat schedule). Không có fallback dedup cho trường hợp `event_id` generation fail.

---

### A.3. `RealtimePublisher` — Dual-publish (Redis Pub/Sub + Channel Layer) gây duplicate events

**File**: `portfolio/realtime/publisher.py` — Dòng 28-52

```python
def publish(self, channel: str, payload: dict) -> bool:
    redis_ok = False
    group_ok = False
    if self.client is not None:
        self.client.publish(channel, message)  # Redis Pub/Sub
        redis_ok = True

    if self.channel_layer is not None:
        async_to_sync(self.channel_layer.group_send)(  # Django Channels
            self._channel_to_group(channel), {...}
        )
        group_ok = True

    return redis_ok or group_ok
```

**Vấn đề**: Mỗi event được publish **2 lần** — 1 lần qua Redis Pub/Sub, 1 lần qua Django Channels group_send. Nếu Channel Layer backend cũng là Redis (cấu hình chuẩn), consumer nhận **duplicate messages**. Frontend dedup dựa trên `event_id` nhưng heartbeats và ticker updates không có `event_id` → duplicate renders.

**Khuyến nghị**: Chỉ dùng 1 transport. Nếu Channel Layer đã handle WebSocket fanout, Redis Pub/Sub raw publish là thừa.

---

### A.4. `RealtimePublisher.__init__` — Redis connection tạo mỗi instance, không pooling

**File**: `portfolio/realtime/publisher.py` — Dòng 17-22

```python
class RealtimePublisher:
    def __init__(self) -> None:
        redis_url = os.getenv("REALTIME_REDIS_URL", ...)
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)
        # ^^^ Tạo connection MỚI mỗi lần instantiate
        self._sequence = defaultdict(int)
        self.channel_layer = get_channel_layer()
```

**Vấn đề**: `collect_and_publish_realtime` task tạo `RealtimePublisher()` mỗi lần chạy (mỗi 10s). Mỗi instance mở 1 Redis TCP connection mới. Với 4 Celery workers × mỗi 10s = **24 new connections/minute** — không bao giờ close.

**Khuyến nghị**: Dùng `redis.ConnectionPool` singleton hoặc module-level client:
```python
_PUBLISHER_REDIS_POOL = None
def _get_redis_client():
    global _PUBLISHER_REDIS_POOL
    if _PUBLISHER_REDIS_POOL is None:
        _PUBLISHER_REDIS_POOL = redis.ConnectionPool.from_url(redis_url)
    return redis.Redis(connection_pool=_PUBLISHER_REDIS_POOL)
```

---

### A.5. `RealtimePublisher._sequence` — Sequence counter không persistent, reset mỗi task

**File**: `portfolio/realtime/publisher.py` — Dòng 21, 24-26

```python
self._sequence = defaultdict(int)

def next_seq(self, channel: str) -> int:
    self._sequence[channel] += 1
    return self._sequence[channel]
```

**Vấn đề**: `_sequence` là in-memory `defaultdict`. Vì `RealtimePublisher` được tạo mới mỗi task call, sequence **luôn bắt đầu từ 1**. Nếu frontend dùng `seq` để detect gaps hoặc ordering, nó sẽ thấy seq restart liên tục → false "gap detected" warnings.

---

### A.6. `quota_service.consume_quota` — Race condition giữa read và write

**File**: `portfolio/quota_service.py` — Dòng 99-114

```python
used = int(cache.get(cache_key, 0) or 0)      # ← T1: đọc used = 99
next_used = used + max(int(amount), 0)          # ← T1: next = 100

if limit <= 0 or next_used > limit:             # ← limit = 100, 100 > 100 = False
    return {"allowed": False, ...}

cache.set(cache_key, next_used, ...)            # ← T1: set 100
# NHƯNG giữa cache.get() và cache.set():
# T2 cũng đọc used = 99, tính next = 100, set 100
# → 2 requests both allowed, but only 1 counted!
```

**Vấn đề**: `cache.get` + check + `cache.set` không atomic. Hai concurrent requests có thể cùng đọc `used=99` (limit=100), cả hai tính `next_used=100` ≤ 100 → cả hai allowed → thực tế dùng 101/100.

**Khuyến nghị**: Sử dụng `cache.incr()` (atomic increment trên Redis):
```python
try:
    next_used = cache.incr(cache_key)
except ValueError:
    cache.set(cache_key, 1, timeout=ttl)
    next_used = 1

if next_used > limit:
    cache.decr(cache_key)  # rollback
    return {"allowed": False, ...}
```

---

### A.7. `quota_service._resolve_limit` — Trial users bị cắt 30% quota một cách thầm lặng

**File**: `portfolio/quota_service.py` — Dòng 51-53

```python
trial_state = entitlements.get("trial_state")
if trial_state == "trial_active" and limit > 0:
    return int(limit * 0.7)  # ← Cắt 30% không thông báo
```

**Vấn đề**: User trial `pro` plan (quota 3000 API calls/day) thực tế chỉ được 2100. Frontend hiển thị `limit: 3000` (từ `resolve_user_entitlements`) nhưng backend enforce 2100. User thấy "quota exceeded" khi usage mới chỉ 70% — extremely confusing.

**Khuyến nghị**: Trả `effective_limit` trong response thay vì `limit` gốc, hoặc hiển thị trial reduction rõ ràng.

---

### A.8. `cleanup_old_intraday_ticks` — `.delete()` trên toàn bộ queryset, không batch

**File**: `portfolio/tasks_maintenance.py` — Dòng 53-54

```python
cutoff = date.today() - timedelta(days=keep_days)
deleted, _ = IntradayTick.objects.filter(trade_date__lt=cutoff).delete()
```

**Vấn đề**: Nếu `IntradayTick` có 10 triệu rows > 7 ngày, `DELETE FROM ... WHERE trade_date < X` sẽ:
- Lock toàn bộ bảng trong PostgreSQL (không partitioned)
- Django ORM cascade check — load related objects vào memory trước khi delete
- Transaction log fill up → disk spike

**Khuyến nghị**: Delete theo batch:
```python
batch_size = 10_000
while True:
    ids = list(IntradayTick.objects.filter(trade_date__lt=cutoff)
               .values_list('id', flat=True)[:batch_size])
    if not ids:
        break
    IntradayTick.objects.filter(id__in=ids).delete()
```

---

### A.9. `password_reset.py` — Token không bao gồm password hash → reuse attack

**File**: `portfolio/password_reset.py` — Dòng 26-33

```python
def generate_password_reset_token(user: User) -> str:
    return signing.dumps(
        {
            'user_id': user.id,
            'email': user.email,
        },
        salt=PASSWORD_RESET_SALT,
    )
```

So sánh với Django built-in `PasswordResetTokenGenerator` — nó bao gồm `user.password` hash trong token payload. Khi password thay đổi, **token cũ tự động invalid**.

**Vấn đề ở VNInvest**: Token chỉ chứa `user_id` + `email`. Sau khi user reset password thành công, token CŨ vẫn valid cho đến khi `max_age` hết hạn. Attacker có token (ví dụ từ intercepted email) có thể reset password lần nữa trong window còn lại.

**Khuyến nghị**: Thêm password hash fragment vào token:
```python
signing.dumps({
    'user_id': user.id,
    'email': user.email,
    'pw_hash': user.password[:20],  # partial hash
}, salt=PASSWORD_RESET_SALT)
```

`resolve_password_reset_token` kiểm tra `pw_hash` match — nếu password đã đổi, hash khác → token invalid.

---

### A.10. `email_verification.py` — Cùng vấn đề token reuse

**File**: `portfolio/email_verification.py` — Dòng 26-33

Token chỉ chứa `user_id` + `email`, không chứa `email_verified` state. Nếu email đã verified, token cũ vẫn resolve thành công (chỉ idempotent ở view layer). Nhưng nếu user **đổi email** rồi re-verify, token cũ vẫn match email cũ → `BadSignature` raised đúng. Tuy nhiên, nếu user KHÔNG đổi email, token cũ vẫn có thể dùng để re-verify account của mình — vô hại nhưng cho thấy thiếu single-use mechanism.

---

### A.11. `google_oauth_service.fetch_google_user_email` — Không verify `email_verified` flag

**File**: `portfolio/google_oauth_service.py` — Dòng 88-98

```python
def fetch_google_user_email(*, access_token: str, timeout_seconds: int = 20) -> str:
    response = httpx.get(
        GOOGLE_OAUTH_USERINFO_URL,
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    return str(payload.get('email') or '').strip()
    # ^^^ Không check payload.get('email_verified')
```

**Vấn đề**: Google userinfo endpoint trả về field `email_verified`. Nếu là `false`, email chưa được Google xác nhận — nhưng VNInvest vẫn trust email đó và auto-verify tài khoản. Kẻ tấn công có thể tạo Google account với email chưa verify → bypass email verification.

**Khuyến nghị**:
```python
email = str(payload.get('email') or '').strip()
if not payload.get('email_verified', False):
    raise ValueError('Google email chưa được xác thực.')
return email
```

---

### A.12. `settings.py` — Ephemeral SECRET_KEY trong DEBUG → Encryption dữ liệu bị mất

**File**: `config/settings.py` — Dòng 56-62

```python
elif DEBUG:
    import secrets as _secrets
    SECRET_KEY = "dev-ephemeral-" + _secrets.token_urlsafe(40)
```

**Vấn đề**: Mỗi lần restart dev server, `SECRET_KEY` thay đổi. Theo phát hiện 1.1 (`encryption_utils.py`), Fernet key derive từ `SECRET_KEY` → **toàn bộ `ai_api_key_encrypted` trong DB trở thành unreadable** sau restart. Developer phải nhập lại API key mỗi lần restart — data loss ở môi trường dev.

---

### A.13. `TransactionSerializer.validate_symbol` — Tạo StockProfile không có DB constraint validation

**File**: `portfolio/serializers.py` — Dòng 44-55

```python
def validate_symbol(self, value):
    normalized_symbol = value.upper().strip()
    if not StockProfile.objects.filter(symbol=normalized_symbol).exists():
        StockProfile.objects.create(
            symbol=normalized_symbol,
            company_name=normalized_symbol,  # ← company_name = symbol?
            industry='Unknown',
            exchange='UNKNOWN',
            is_active=True,
        )
    return normalized_symbol
```

**Vấn đề chi tiết**:
1. `company_name=normalized_symbol` — StockProfile của "VNMM" (typo) sẽ hiển thị company name là "VNMM" thay vì actual company name.
2. Không validate symbol format — `"A!@#"` sẽ tạo StockProfile hợp lệ.
3. Race condition: 2 concurrent requests cho cùng symbol → `exists()` = False cho cả hai → `IntegrityError` nếu có unique constraint trên `symbol`.
4. Không validate symbol against vnstock listing — hoàn toàn có thể tạo profile cho symbol không tồn tại trên sàn.

**Khuyến nghị**: Validate symbol format + sử dụng `get_or_create` + warning log:
```python
import re
if not re.match(r'^[A-Z0-9]{1,10}$', normalized_symbol):
    raise serializers.ValidationError('Mã CK không hợp lệ.')
profile, created = StockProfile.objects.get_or_create(
    symbol=normalized_symbol,
    defaults={'company_name': '', 'industry': '', 'exchange': 'UNKNOWN'}
)
if created:
    logger.warning('Soft-bootstrap StockProfile for unknown symbol: %s', normalized_symbol)
```

---

### A.14. `PortfolioSerializer.get_transaction_count` — N+1 query per portfolio

**File**: `portfolio/serializers.py` — Dòng 80-81

```python
def get_transaction_count(self, obj):
    return Transaction.objects.filter(sub_account__portfolio=obj).count()
```

**Vấn đề**: `SerializerMethodField` chạy **1 COUNT query per portfolio** khi serialize list. Với 10 portfolios = 10 extra queries. Tương tự `get_subaccount_count` (dòng 83-84).

**Khuyến nghị**: Annotate count ở ViewSet queryset:
```python
queryset = Portfolio.objects.annotate(
    transaction_count=Count('sub_accounts__transactions'),
    subaccount_count=Count('sub_accounts'),
)
```

---

### A.15. `_whale_thresholds_for_user` — Unit conversion tiềm ẩn lỗi

**File**: `portfolio/tasks_realtime.py` — Dòng 16-26

```python
def _whale_thresholds_for_user(user_id: int | None) -> list[float]:
    default_threshold = float(getattr(settings, "REALTIME_DEFAULT_WHALE_THRESHOLD", 500_000_000))
    # ^^^ settings value đã là VND (500 triệu)
    
    config = UserConfig.objects.filter(user_id=user_id).values("whale_alert_threshold").first()
    threshold_vnd = float(config["whale_alert_threshold"]) * 1_000_000
    # ^^^ whale_alert_threshold trong DB là TRIỆU VND → nhân 1M để ra VND
    return [threshold_vnd]
```

**Vấn đề**: `REALTIME_DEFAULT_WHALE_THRESHOLD` ở settings = 500,000,000 (VND). Nhưng `whale_alert_threshold` trong `UserConfig` lưu theo triệu (default `500` → 500 triệu). Nếu ai đó set settings thành `500` (nhầm là triệu), default threshold = 500 VND thay vì 500 triệu → **whale alerts flood toàn bộ giao dịch**.

Unit convention không nhất quán: settings dùng VND, model dùng triệu VND. Cần document rõ hoặc normalize.

---

### A.16. `ResendVerificationEmailView` — Không rate-limit, có thể spam email

**File**: `portfolio/auth_views.py` — Dòng 246-271

```python
class ResendVerificationEmailView(APIView):
    permission_classes = [AllowAny]
    # ^^^ Không có throttle_classes!

    def post(self, request, *args, **kwargs):
        # ...
        send_verification_email(user)
```

So sánh với `PasswordResetRequestView` (dòng 278-280):
```python
class PasswordResetRequestView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_password_reset_request'
```

**Vấn đề**: Password reset view có throttle, nhưng resend verification view **không có**. Attacker có thể spam POST với identifier hợp lệ → hệ thống gửi hàng trăm email verification → email reputation bị hủy, bị đánh spam.

---

### A.17. `UserMeView` — Leak thông tin nhạy cảm

**File**: `portfolio/auth_views.py` — Dòng 64-79

```python
return Response({
    'id': user.id,
    'username': user.username,
    'email': user.email,
    # ...
    'oauth_provider': cfg.oauth_provider if cfg else '',
    # ^^^ Tiết lộ user dùng Google OAuth
    'whale_alert_threshold': float(cfg.whale_alert_threshold) if cfg else 500,
    # ^^^ Tiết lộ cấu hình giao dịch cá nhân
    'entitlements': entitlements,
    # ^^^ Toàn bộ abilities, quota caps, trial state
})
```

**Vấn đề**: `/api/auth/me/` trả về quá nhiều thông tin system-level cho frontend. Nếu attacker có access token, họ có thể biết:
- User dùng OAuth hay password → target tấn công phù hợp
- Quota limits → biết plan tier
- Trial state → biết user mới, có thể target social engineering

**Khuyến nghị**: Tách response thành `/api/auth/me/` (basic info) và `/api/auth/me/entitlements/` (abilities chỉ trả về fields cần thiết cho CASL).

---

## PHỤ LỤC B — CELERY BEAT SCHEDULE RISKS

### B.1. Task execution overlap — Không có distributed lock

Nhiều Celery beat tasks không có distributed lock mechanism:

| Task | Schedule | Risk |
|------|----------|------|
| `collect_and_publish_realtime` | 10s | Nếu task chạy > 10s, instance cũ chưa xong + instance mới start → duplicate publish |
| `prefetch_ticker_price_board` | 15s | Tương tự, vnstock timeout 8s = có thể chồng chéo |
| `auto_generate_advisories_for_all_tracked` | 5min | Có lock key nhưng lock ở Redis cache → eviction risk |
| `cleanup_old_intraday_ticks` | 1/ngày | Nếu chạy > 1 lần (worker restart) → double delete harmless nhưng wasteful |

**Khuyến nghị**: Sử dụng `celery-once` hoặc Redis-based distributed lock cho mỗi periodic task:
```python
@shared_task(bind=True)
def my_task(self):
    lock_key = f"lock:{self.name}"
    if not cache.add(lock_key, 1, timeout=300):
        return {"status": "skipped", "reason": "already_running"}
    try:
        # ... logic ...
    finally:
        cache.delete(lock_key)
```

---

## CẬP NHẬT TỔNG KẾT

| Hạng mục | Báo cáo gốc | Bổ sung | Tổng |
|----------|-------------|---------|------|
| Bug nghiêm trọng | 5 | 4 | **9** |
| Lỗ hổng bảo mật | 5 | 5 | **10** |
| Race conditions | 3 | 2 | **5** |
| Memory/Resource leak | 2 | 2 | **4** |
| Performance bottleneck | 4 | 3 | **7** |
| Architectural debt | 4 | 2 | **6** |
| Frontend bugs | 4 | 0 | **4** |
| Data integrity risks | 4 | 2 | **6** |
| **TỔNG** | **31** | **20** | **51** |

### TOP 5 VẤN ĐỀ KHẨN CẤP NHẤT (Must-Fix Before Production)

1. **🔴 Account Takeover via Google OAuth** (A.11 + §2.3) — Fix: validate `email_verified` + block auto-link existing accounts
2. **🔴 Quota bypass race condition** (A.6) — Fix: `cache.incr()` atomic
3. **🔴 Password reset token reuse** (A.9 + §8.2) — Fix: include password hash in token
4. **🔴 Resend verification email no rate-limit** (A.16) — Fix: add `ScopedRateThrottle`
5. **🔴 Redis connection leak in RealtimePublisher** (A.4) — Fix: connection pooling

---

## PHỤ LỤC C — REALTIME PIPELINE DEEP-DIVE (Round 3)

Phân tích chuyên sâu vào toàn bộ chuỗi realtime: `collector.py` → `tick_producer.py` → `stream_consumers.py` → `compute.py` → frontend `PortfolioContext.jsx`.

---

### C.1. `collector.collect_intraday_frame` — Catch `(Exception, SystemExit)` rồi `pass` — Silent data loss

**File**: `portfolio/realtime/collector.py` — Dòng 49-50

```python
except (Exception, SystemExit):
    pass
```

**Vấn đề**: Nếu vnstock API trả về lỗi (rate limit, timeout, network error), exception bị nuốt hoàn toàn — **không log, không metric**. Hệ thống chuyển sang fallback synthetic data (1 tick giả từ DB price) mà không ai biết realtime data đã mất.

Trong production với 50 symbols, nếu vnstock bị chặn → toàn bộ 50 symbols chuyển sang synthetic → dashboard hiển thị dữ liệu cũ giả vờ là realtime → **user ra quyết định giao dịch sai**.

**Khuyến nghị**:
```python
except (Exception, SystemExit) as exc:
    logger.warning("collect_intraday_frame(%s) vnstock failed, using fallback: %s", symbol, exc)
    # thêm metric counter cho monitoring
    record_collector_fallback_observation(symbol=symbol, reason=str(type(exc).__name__))
```

---

### C.2. `collector.collect_intraday_frame` — Fallback synthetic tick có `volume=0`, gây vô hiệu hóa whale detection

**File**: `portfolio/realtime/collector.py` — Dòng 53-56

```python
# Fallback: synthetic one-tick frame từ DB price
changes = get_price_changes([symbol]).get(symbol.upper(), {})
price = changes.get("current_price") or 0.0
return pd.DataFrame([{"ts": now, "price": float(price), "volume": 0.0, "side": "UNKNOWN"}])
```

**Vấn đề**: Fallback DataFrame có `volume=0`. Whale detection tính `matched_value = price * volume = 0` → **không bao giờ trigger whale alert**. Nhưng ticker payload vẫn publish price → frontend hiển thị price mới nhưng volume = 0 → user tưởng không có giao dịch.

Tệ hơn: `get_price_changes([symbol])` trong fallback lại gọi DB query per symbol (phát hiện §5.2), tạo performance hit ngay khi vnstock đã fail.

---

### C.3. `collector.collect_intraday_frame` — Gọi `vnstock` trực tiếp, bypass adapter layer

**File**: `portfolio/realtime/collector.py` — Dòng 23-25

```python
from vnstock import Vnstock
stock = Vnstock().stock(symbol=symbol, source='VCI')
df = stock.quote.intraday(symbol=symbol, page_size=100)
```

So sánh với phần còn lại của codebase sử dụng `portfolio/adapters/vnstock_adapter.py` (có timeout, retry, concurrency gate, rate-limit detection).

**Vấn đề**: `collector.py` gọi vnstock **trực tiếp** — không có:
- Timeout protection → nếu vnstock hang, Celery task hang
- Concurrency gate → bypass `max_concurrency` limit
- Rate limit detection → không trigger circuit breaker
- Retry logic → 1 fail = fallback ngay

---

### C.4. `_get_client()` / `_get_stream_client()` — Mỗi module tạo Redis connection riêng

Trong realtime pipeline, có **4 nơi khác nhau** tạo Redis connection:

| File | Function | Connection Type |
|------|----------|----------------|
| `tick_producer.py:31` | `_get_client()` | `redis.from_url()` |
| `stream_consumers.py:28` | `_get_stream_client()` | `redis.from_url()` |
| `publisher.py:20` | `__init__` | `redis.Redis.from_url()` |
| `stream_reader.py` | (tương tự) | `redis.from_url()` |

**Vấn đề**: 4 module × mỗi Celery worker = **16+ Redis connections** chỉ cho realtime pipeline. Không có connection pooling chung. Nếu Redis `maxclients` đạt limit, connection mới bị reject → pipeline ngừng hoạt động.

**Khuyến nghị**: Tạo shared connection pool module:
```python
# portfolio/realtime/redis_pool.py
import redis
_pool = None
def get_stream_pool():
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(settings.STREAM_REDIS_URL)
    return _pool

def get_stream_client():
    return redis.Redis(connection_pool=get_stream_pool())
```

---

### C.5. `DbWriterConsumer.process_batch` — Naive timestamp parsing, timezone-unaware

**File**: `portfolio/realtime/stream_consumers.py` — Dòng 127-135

```python
try:
    if " " in ts_str:
        dt = datetime.fromisoformat(ts_str)
    elif "T" in ts_str:
        dt = datetime.fromisoformat(ts_str.replace("Z", ""))
    else:
        dt = datetime.now()
except (ValueError, TypeError):
    dt = datetime.now()
```

**Vấn đề**:
1. `.replace("Z", "")` loại bỏ UTC timezone → datetime trở thành **timezone-naive** → Django lưu vào DB không biết offset → so sánh sai khi hệ thống ở UTC+7.
2. Fallback `datetime.now()` cũng timezone-naive → inconsistency với Django `USE_TZ=True`.
3. Không xử lý format `2026-04-13T14:30:00+07:00` (offset timezone).

**Khuyến nghị**:
```python
from django.utils import timezone as dj_tz
try:
    dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
except (ValueError, TypeError):
    dt = dj_tz.now()
```

---

### C.6. `AlertEngineConsumer` — Tạo `RealtimePublisher()` mới MỖI batch

**File**: `portfolio/realtime/stream_consumers.py` — Dòng 242

```python
publisher = RealtimePublisher()
```

**Vấn đề**: Mỗi `process_batch()` call tạo 1 `RealtimePublisher` mới = 1 Redis connection mới (§A.4). Với 50 symbols × batch mỗi 2s = **25 publisher instances/second**, mỗi cái mở TCP connection → exhaustion.

---

### C.7. `build_whale_payload` — Indentation inconsistency trong dict literal

**File**: `portfolio/realtime/compute.py` — Dòng 266-289

```python
return {
    "event_type": "whale_alert",
    "event_id": event_id,
    # ... normally indented ...
    "source": source,
        "source_layer": _derive_source_layer(source),  # ← 8 spaces indent
    "symbol": signal.symbol,
    "matched_value": signal.matched_value,
    "side": normalized_side,
    "threshold": signal.threshold,
        "threshold_source": str(threshold_source or "user_default"),  # ← 8 spaces
    "size_class": size_class,
    # ...
        "freshness_bucket": _derive_freshness_bucket(signal.ts),  # ← 8 spaces
        "recovered": recovered,  # ← 8 spaces
    "why_triggered": explainability["why_triggered"],
}
```

**Vấn đề**: 4 keys có **extra indentation** (8 spaces thay vì 4). Mặc dù Python chấp nhận (dict literal không phụ thuộc indent), đây là dấu hiệu copy-paste thiếu review — dễ gây merge conflict và khó đọc.

---

### C.8. `WsBroadcastConsumer` — Sequence generation dùng timestamp modulo → collision

**File**: `portfolio/realtime/stream_consumers.py` — Dòng 191

```python
seq = int(time.time() * 1000) % 2**31
```

**Vấn đề**: `time.time() * 1000` = millisecond timestamp. `% 2**31` = wraps mỗi ~25 ngày. Nhưng vấn đề thực sự: nếu 2 batches chạy trong cùng 1 millisecond (highly possible), chúng có **cùng seq number** → frontend không thể detect ordering.

So sánh với `RealtimePublisher.next_seq()` dùng in-memory counter (cũng vấn đề riêng, §A.5), nhưng ít nhất monotonically increasing.

---

### C.9. `TickProducer.push_intraday_ticks` — `df.iterrows()` cho 100 ticks mỗi 10s

**File**: `portfolio/realtime/tick_producer.py` — Dòng 94-106

```python
for _, row in df.iterrows():
    fields = {
        "symbol": symbol.upper(),
        "ts": str(row.get("ts", "")),
        # ...
    }
    pipe.xadd(key, fields, maxlen=self._max_len, approximate=True)
```

**Vấn đề**: `df.iterrows()` là **chậm nhất** trong pandas iteration (~1000x chậm hơn vectorized). Với 50 symbols × 100 rows = 5,000 iterations mỗi 10s. Mặc dù pipeline buffer nên network overhead thấp, CPU cycles cho row-by-row Python iteration là wasteful.

**Khuyến nghị**: Dùng `df.to_dict('records')`:
```python
for record in df.to_dict('records'):
    fields = {"symbol": symbol.upper(), "ts": str(record.get("ts", "")), ...}
    pipe.xadd(key, fields, ...)
```

---

### C.10. `PortfolioContext` — Infinite re-render loop tiềm ẩn

**File**: `frontend/src/context/PortfolioContext.jsx` — Dòng 211-232

```javascript
useEffect(() => {
    const bootstrap = async () => {
      if (!isAuthenticated || !accessToken) return;
      const ok = await syncAuthState();
      if (!ok || cancelled) return;
      await fetchPortfolios();
    };
    bootstrap();
    return () => { cancelled = true; };
}, [isAuthenticated, accessToken, syncAuthState, fetchPortfolios]);
//   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

**Vấn đề**: `fetchPortfolios` dependency là `useCallback` với `[activePortfolioId, logout]`. Khi `fetchPortfolios` gọi `setActivePortfolioId(res.data[0].id)` (dòng 158), nó thay đổi `activePortfolioId` → `fetchPortfolios` closure thay đổi → effect re-runs → `fetchPortfolios` gọi lại → cycle.

Mặc dù React's state batching và identity check prevent true infinite loop trong hầu hết cases, **khi initial data load lần đầu**, nó sẽ chạy `fetchPortfolios` **2 lần** (1 lần từ bootstrap, 1 lần từ closure change).

---

### C.11. `PortfolioContext.saveTokens` — Inline function, không `useCallback`

**File**: `frontend/src/context/PortfolioContext.jsx` — Dòng 56-65

```javascript
const saveTokens = (access, refresh) => {
    const nextRefresh = refresh || localStorage.getItem('refresh_token');
    localStorage.setItem('access_token', access);
    // ...
};
```

**Vấn đề**: `saveTokens` không có `useCallback` → recreated mỗi render. Nó được dùng bên trong `login` (line 110) và `refreshAccessToken` (line 138) callbacks, nhưng những callbacks đó không list `saveTokens` trong deps → stale closure.

Nếu `saveTokens` thay đổi behavior (sẽ không vì nó inline), `login`/`refreshAccessToken` sẽ dùng phiên bản cũ. Hiện tại harmless nhưng vi phạm React hooks lint rules.

---

### C.12. `PortfolioContext` — Context value không memoized → toàn bộ tree re-render

**File**: `frontend/src/context/PortfolioContext.jsx` — Dòng 236-259

```javascript
<PortfolioContext.Provider value={{
    portfolios,
    activePortfolioId,
    // ... 15 more values ...
}}>
```

**Vấn đề**: `value` là **inline object literal** — mỗi render tạo object reference mới → **tất cả consumers re-render** kể cả khi data không đổi (vì `value !== prevValue` by reference).

Với context cung cấp ~18 values, bất kỳ state change nào ở provider (kể cả typing trong login form) → re-render toàn bộ component tree.

**Khuyến nghị**: Wrap value trong `useMemo`:
```javascript
const contextValue = useMemo(() => ({
    portfolios, activePortfolioId, isAuthenticated, ...
}), [portfolios, activePortfolioId, isAuthenticated, ...]);

<PortfolioContext.Provider value={contextValue}>
```

---

## CẬP NHẬT TỔNG KẾT CUỐI CÙNG

| Hạng mục | Round 1 | Round 2 | Round 3 | **Tổng** |
|----------|---------|---------|---------|----------|
| Bug nghiêm trọng | 5 | 4 | 3 | **12** |
| Lỗ hổng bảo mật | 5 | 5 | 0 | **10** |
| Race conditions | 3 | 2 | 0 | **5** |
| Memory/Resource leak | 2 | 2 | 3 | **7** |
| Performance bottleneck | 4 | 3 | 2 | **9** |
| Architectural debt | 4 | 2 | 2 | **8** |
| Frontend bugs | 4 | 0 | 3 | **7** |
| Data integrity risks | 4 | 2 | 2 | **8** |
| **TỔNG** | **31** | **20** | **15** | **66** |

### MA TRẬN RISK-EFFORT CHO 10 VẤN ĐỀ QUAN TRỌNG NHẤT

```
HIGH RISK
│
│  [1] Account Takeover     [3] Password Reset Token
│  §2.3 + A.11              A.9
│  Effort: 4h               Effort: 2h
│
│  [2] Quota Race           [5] Collector Silent Fail
│  A.6                      C.1 + C.2
│  Effort: 2h               Effort: 3h
│
│  [4] Redis Conn Leak      [7] UserConfig God Object
│  A.4 + C.4 + C.6          §6.1
│  Effort: 4h               Effort: 3 sprints
│
│  [6] Email Spam            [9] DB Transaction Bug
│  A.16                      §1.4
│  Effort: 30min             Effort: 1h
│
│  [8] N+1 Whale Task       [10] Context Re-render
│  A.1                       C.12
│  Effort: 3h                Effort: 1h
│
LOW RISK ─────────────────────────────── HIGH EFFORT
         LOW EFFORT
```

### EXECUTION PLAN ĐỀ XUẤT

**Sprint hiện tại (Hotfix — 1 ngày)**:
- [x] A.16 — Thêm `ScopedRateThrottle` vào `ResendVerificationEmailView`
- [x] A.11 — Check `email_verified` flag trong `fetch_google_user_email`
- [x] §2.3 — Block auto-link Google OAuth vào existing accounts

**Sprint tới (1 tuần)**:
- [x] A.6 — Chuyển quota sang `cache.incr()` atomic
- [x] A.9 — Thêm password hash vào reset token
- [x] A.4 + C.4 — Centralize Redis connection pooling
- [x] C.1 + C.2 — Log fallback, thêm monitoring metric
- [x] §1.4 — Fix atomic transaction per-row savepoint

**Sprint+1 (2 tuần)**:
- A.1 — Batch prefetch UserConfig trong realtime task
- C.3 — Route collector qua vnstock_adapter
- C.12 — Memoize PortfolioContext value
- §5.1 + §5.2 — Batch DB queries

**Dài hạn (multi-sprint)**:
- §6.1 — Tách UserConfig God Object
- §6.2 + §6.3 — Refactor barrel imports

---

## PHỤ LỤC D — AI PROVIDER, CACHE & CODE DUPLICATION (Round 4 — Final)

Vòng cuối phân tích `ai_service.py` (586 dòng), `cache_adapter.py`, `middleware.py`, và mẫu code duplication xuyên suốt codebase.

---

### D.1. `_openai_compatible_completion` — `time.sleep()` block Celery worker thread

**File**: `portfolio/ai_service.py` — Dòng 178

```python
time.sleep(wait_seconds)  # wait_seconds có thể lên tới 60s
continue
```

**Vấn đề**: `time.sleep(60)` block **toàn bộ Celery worker thread** trong 60 giây. Với `CELERY_WORKER_CONCURRENCY=4`, nếu 4 requests đồng thời bị rate-limited → worker cluster **ngừng xử lý mọi task** trong 60s.

Tương tự trong `_claude_completion` (dòng 222).

**Khuyến nghị**: Thay bằng Celery task retry với countdown:
```python
if resp.status_code == 429:
    raise self.retry(countdown=wait_seconds, max_retries=3)
```
Hoặc ít nhất dùng `celery.utils.time.get_exponential_backoff_interval()`.

---

### D.2. `_openai_compatible_completion` — API key trong log khi debug

**File**: `portfolio/ai_service.py` — Dòng 135-139

```python
resp = httpx.post(
    target_url,
    headers=headers,  # headers chứa Authorization: Bearer <API_KEY>
    json=payload,
    timeout=_request_timeout,
)
```

**Vấn đề**: Nếu `httpx` logging hoặc Django DEBUG logging được bật (phổ biến ở dev), headers bao gồm `Authorization: Bearer sk-...` sẽ bị log vào console/file. API key rò rỉ trong log.

**Khuyến nghị**: Mask API key trước khi log:
```python
def _mask_key(key: str) -> str:
    return key[:8] + '...' + key[-4:] if len(key) > 12 else '***'
```

---

### D.3. `generate_whale_text` / `generate_advisory_concise` — Code duplication lớn

**File**: `portfolio/ai_service.py` — Dòng 254-326 vs 507-585

Hai functions `generate_whale_text` và `generate_advisory_concise` có **cấu trúc gần giống hệt nhau** (~80% overlap):

```python
# Pattern lặp lại trong CẢ HAI functions:
if provider_key == 'openclaw':    # ...
if provider_key == 'claude':     # _claude_completion(...)
if provider_key == 'openai':     # _openai_compatible_completion(base_url=...)
if provider_key == 'gemini':     # _openai_compatible_completion(base_url=...)
if provider_key == 'copilot':    # _openai_compatible_completion(base_url=..., extra_headers=...)
raise RuntimeError(f'Unsupported ...')
```

Tương tự, `generate_portfolio_digest` (dòng 329-417) cũng lặp cùng pattern **lần thứ 3**.

**Vấn đề**: 3 functions × ~70 dòng provider dispatch = ~210 dòng duplicate code. Thêm provider mới (ví dụ Mistral) phải sửa **3 chỗ**.

**Khuyến nghị**: Extract provider dispatch:
```python
def _dispatch_to_provider(provider: str, model: str, api_key: str, prompt: str, max_tokens: int) -> dict:
    """Central dispatcher — single place to add new providers."""
    # ... one if/elif chain ...
```

---

### D.4. `_split_digest_sections` — Fragile regex parsing AI output

**File**: `portfolio/ai_service.py` — Dòng 439-459

```python
def _split_digest_sections(raw: dict[str, Any]) -> dict[str, Any]:
    summary_match = _re.search(r'SUMMARY:\s*(.*?)(?=FULL:|$)', text, _re.DOTALL | _re.IGNORECASE)
    full_match = _re.search(r'FULL:\s*(.*)', text, _re.DOTALL | _re.IGNORECASE)
```

**Vấn đề**: AI model output là non-deterministic. Nếu model trả về `**SUMMARY:**` (markdown bold), `Summary:` (capitalization khác), hoặc không có section markers → regex match fail → `summary` fallback thành toàn bộ text truncated 500 chars, `full` trả về rỗng.

Không có fallback metric khi parsing fail — impossible biết bao nhiêu % digests có `full` text thực sự.

---

### D.5. `cache_adapter.set_cache` — Silent failure, mất dữ liệu không biết

**File**: `portfolio/adapters/cache_adapter.py` — Dòng 14-18

```python
def set_cache(key, value, timeout):
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass  # ← Redis down → cache set fail → không ai biết
```

**Vấn đề**: Nếu Redis down/reconnecting, `cache.set()` raise exception → bị nuốt → downstream code tưởng data đã cached:
- `mark_vnstock_rate_limited()` fail silently → rate limit không được enforce → flood vnstock API
- Whale dedup cache fail silently → duplicate alerts flood frontend
- Quota cache fail silently → quota bypass (tương tự A.6)

**Khuyến nghị**: Ít nhất log warning:
```python
except Exception as exc:
    logger.warning("cache.set(%s) failed: %s", key, exc)
```

---

### D.6. `is_rate_limited_error` — Substring match quá rộng

**File**: `portfolio/adapters/cache_adapter.py` — Dòng 21-28

```python
def is_rate_limited_error(exc_or_message) -> bool:
    message = str(exc_or_message or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'giới hạn api' in message
    )
```

**Vấn đề**: `'429' in message` match bất kỳ string nào chứa "429" — bao gồm:
- Port number: `"Connection refused on port 4290"` → false positive
- Error codes: `"Error code: E4291"` → false positive  
- IP addresses: `"Blocked by 10.42.9.1"` → false positive

**Khuyến nghị**: Match cụ thể hơn:
```python
return (
    'status 429' in message
    or 'http 429' in message
    or 'too many requests' in message
    # ...
)
```

---

### D.7. `MarketObservabilityMiddleware` — Log mọi request kể cả non-market

**File**: `portfolio/middleware.py` — Dòng 17-34

```python
def __call__(self, request):
    start = perf_counter()
    status_code = 500  # ← Default 500 — counted even for success paths
    try:
        response = self.get_response(request)
        status_code = int(getattr(response, 'status_code', 500) or 500)
        return response
    except Exception:
        status_code = 500
        raise
    finally:
        request_path = str(getattr(request, 'path', '') or '')
        if request_path.startswith(self.MARKET_PREFIXES):
            record_market_http_observation(...)
```

**Vấn đề nhỏ**: `status_code = 500` default. Nếu `response` object thiếu `status_code` attribute (edge case), hoặc `getattr` trả `None`, `int(None or 500)` = 500 → false alarm trong metrics. An toàn nhưng skews error rate metrics.

---

### D.8. Admin.py — 104KB, largest file in entire codebase

**File**: `portfolio/admin.py` — **104,282 bytes**

So sánh: `models.py` = 89KB, `market_data_service.py` = 142KB, `services.py` = 86KB.

**Vấn đề**: `admin.py` ở 104KB cho thấy Django Admin đã trở thành **pseudo-application** — business logic ngầm ẩn trong admin actions, filters, và inline validators. Nếu business rules thay đổi, phải sửa ở cả `services.py` VÀ `admin.py`.

---

### D.9. Codebase có ~30 file `tasks_whale_*.py` — Task fragmentation

Listing cho thấy **16 file** chỉ cho whale advisory pipeline:

```
tasks_whale_advisory.py        (3KB)
tasks_whale_ai_call.py         (1.7KB)
tasks_whale_auto_generation.py (2.7KB)
tasks_whale_bookkeeping.py     (2KB)
tasks_whale_broadcast.py       (1.3KB)
tasks_whale_execution.py       (3.2KB)
tasks_whale_finalize_phase.py  (3.7KB)
tasks_whale_generation.py      (5.6KB)
tasks_whale_metrics.py         (3.8KB)
tasks_whale_persist_phase.py   (4.6KB)
tasks_whale_persistence.py     (1.9KB)
tasks_whale_preflight.py       (6.5KB)
tasks_whale_preflight_ai.py    (2.9KB)
tasks_whale_preflight_cache.py (7KB)
tasks_whale_preflight_guards.py(3.4KB)
tasks_whale_preflight_language.py(4.6KB)
tasks_whale_provider_bookkeeping_phase.py (1.6KB)
tasks_whale_provider_generation.py (5.1KB)
tasks_whale_provider_phase.py  (1.5KB)
tasks_whale_quality.py         (3.9KB)
```

**Vấn đề**: Tổng ~65KB code chia thành 20 files nhỏ (trung bình 3.2KB/file). Quá nhiều files nhỏ tạo:
- Import graph phức tạp: mỗi file import từ 2-3 files khác → circular dependency risk
- Khó trace luồng logic: 1 advisory generation đi qua 8+ files
- `tasks.py` barrel phải re-export tất cả → §6.2

**Khuyến nghị**: Consolidate thành 4-5 files theo phase:
```
tasks_whale_preflight.py   (guards + cache + language + AI preflight)
tasks_whale_generation.py  (provider call + AI generation)
tasks_whale_postprocess.py (quality + persist + broadcast + metrics)
tasks_whale_lifecycle.py   (auto-generation + bookkeeping)
```

---

## TỔNG KẾT TOÀN BỘ AUDIT

| Hạng mục | R1 | R2 | R3 | R4 | **Tổng** |
|----------|----|----|----|----|----------|
| Bug nghiêm trọng | 5 | 4 | 3 | 1 | **13** |
| Lỗ hổng bảo mật | 5 | 5 | 0 | 1 | **11** |
| Race conditions | 3 | 2 | 0 | 0 | **5** |
| Memory/Resource leak | 2 | 2 | 3 | 1 | **8** |
| Performance bottleneck | 4 | 3 | 2 | 1 | **10** |
| Architectural debt | 4 | 2 | 2 | 3 | **11** |
| Frontend bugs | 4 | 0 | 3 | 0 | **7** |
| Data integrity risks | 4 | 2 | 2 | 2 | **10** |
| **TỔNG** | **31** | **20** | **15** | **9** | **75** |

### ĐÁNH GIÁ TỔNG THỂ

**Điểm mạnh** của codebase:
- Kiến trúc realtime pipeline (collector → stream → consumer → WS) bài bản, hiếm thấy ở dự án cá nhân
- Hệ thống scoring/explainability cho whale alerts rất chuyên nghiệp
- Observability layer (metrics, audit logs) đầu tư tốt
- Multi-provider AI abstraction cho phép switch giữa OpenAI/Claude/Gemini/Copilot

**Rủi ro cao nhất** cần xử lý ngay:
1. 🔴 **Account Takeover via Google OAuth** — attacker có thể chiếm account bất kỳ user nào qua Google login
2. 🔴 **Silent data pipeline failure** — vnstock fail → hệ thống phát synthetic data giả realtime
3. 🔴 **Redis connection exhaustion** — 16+ connections per worker, không pooling
4. 🔴 **Celery worker blocking** — `time.sleep(60s)` trong AI retry logic freeze toàn bộ worker pool

**Ước tính effort tổng**: ~12 sprints để fix toàn bộ 75 phát hiện, trong đó P0 (critical) cần ~2 sprints.

---

## NHẬN XÉT SƠ BỘ

**Codebase VNInvest ở mức "ambitious mid-stage product" — kiến trúc macro tốt, nhưng micro-level debt đang tích lũy nhanh hơn feature velocity.**

### Điểm tốt thực sự

- **Realtime pipeline** (vnstock → Redis Streams → Consumer Groups → WebSocket) là thiết kế cấp production, ít dự án cá nhân nào đạt được.
- **Whale scoring + explainability** (`why_triggered`, `next_checks`) cho thấy domain thinking rất sâu — mức institutional-grade.
- **Multi-provider AI abstraction** — switch OpenAI/Claude/Gemini/Copilot không cần đổi business logic.
- **Observability**: audit logs, metrics, health checks, admin dashboard — tư duy vận hành chắc chắn.

### 4 vấn đề cốt lõi

**1. Hệ thống đang "giả vờ realtime"**  
Khi vnstock fail (rất thường xuyên), collector nuốt exception rồi phát dữ liệu giả (`volume=0`) mà không ai biết. User nhìn dashboard tưởng live, thực chất là stale data. Đây là **rủi ro nghiệp vụ lớn nhất** cho một ứng dụng tài chính.

**2. Security chưa sẵn sàng cho production**  
Google OAuth Account Takeover, password reset token reuse, missing password validation khi register, WebSocket không re-auth. Nếu mở public bây giờ sẽ bị exploit.

**3. Scaling sẽ gặp tường**  
Redis connection không pooling (16+ conn/worker), N+1 queries khắp nơi, `time.sleep(60s)` block Celery workers, `IntradayTick` delete không batch. Với 100 users concurrent trở lên sẽ thấy vấn đề rõ.

**4. Technical debt đang ở điểm inflection**  
`UserConfig` 30+ fields, `admin.py` 104KB, 20 file `tasks_whale_*.py`, 3 lần duplicate provider dispatch code. Nếu không refactor sớm, mỗi feature mới sẽ tốn gấp đôi thời gian.

### Kết luận 1 câu

> **Codebase có nền tảng kiến trúc vững để scale, nhưng cần 2 sprints fix security + data reliability trước khi mở cho user thật, và cần refactor debt liên tục song song với feature development để tránh "big rewrite" sau này.**

---

*Kết thúc báo cáo — Ngày 13/04/2026*  
*Tổng cộng: **75 phát hiện** qua 4 vòng audit chuyên sâu*  
*Files đã phân tích: **~40 files** backend + frontend (~500KB source code)*

