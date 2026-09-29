# Technical Spec — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19
**Version**: 1.0
**Parent**: docs/DNSE_BACKFILL_WHALE_DARK_FLOW_HANDOFF_MASTER_20260519.md

---

## 1. Scope kỹ thuật

Spec này mô tả:
1. DNSE historical tape fetch adapter (SSOT).
2. UserDNSECredential model, encryption scheme, access control.
3. System backfill pipeline (admin/SOC mode).
4. User self-serve backfill pipeline (per-user mode).
5. Merge rule và idempotency design.
6. Extend detection task để nhận `session_date`.
7. API contract OpenAPI-compliant.
8. Security design cho credential at rest và in transit.

---

## 2. DNSE Tape API capabilities

### 2.1 API có sẵn (từ vnbroker library)

```python
from vnbroker.explorer.dnse.quote import DNSEQuote

q = DNSEQuote(symbol="ACB", api_key="KEY", api_secret="SECRET")

# Historical tape một ngày
df = q.intraday(date="2026-05-15", get_all=True, page_size=1000)
# df columns: time (str "YYYY-MM-DD HH:MM:SS" VN local), price (float64),
#             volume (Int64), side (str "BUY"/"SELL")

# Date range
df = q.intraday(start="2026-05-12", end="2026-05-16", get_all=True, page_size=1000)
```

Đặc điểm:
- `get_all=True` → tự paginate qua cursor `nextPageToken`
- `page_size` max 1000 (hard cap từ DNSE)
- ACB 1 ngày ≈ 8000–10000 lệnh → ~9 requests/ngày
- Liquid stock 1 ngày ≈ 5000–15000 lệnh
- `time` là VN local time (Asia/Ho_Chi_Minh = UTC+7)

### 2.2 Rate limiting

- DNSE không công bố rate limit chính thức
- Thực tế an toàn: 1 request/1.5s cho production
- System backfill nên dùng 1.2s/request (conservative)
- User backfill nên dùng 1s/request (user-triggered, nhỏ hơn volume)

---

## 3. SSOT adapter: `fetch_intraday_tape_history()`

### 3.1 Vị trí

`packages/core/backend/src/market_data/vnbroker_adapter.py`

### 3.2 Full signature

```python
def fetch_intraday_tape_history(
    symbol: str,
    trade_date: str,            # "YYYY-MM-DD", ngày giao dịch VN
    api_key: str | None = None,
    api_secret: str | None = None,
) -> list[dict]:
    """
    Fetch toàn bộ tape DNSE cho một ngày giao dịch lịch sử.

    Security:
    - api_key/api_secret không được log, không được serialize vào output
    - Nếu api_key=None → gọi DNSE không credentials (public mode)

    Return schema:
    [
        {
            'timestamp': datetime (UTC-aware, tzinfo=UTC),
            'price': Decimal,
            'volume': int,
            'side': 'BUY' | 'SELL' | 'UNKNOWN',
            'match_type': '',  # DNSE không có match_type → empty string
            'source': 'dnse_history',
        },
        ...
    ]

    Error handling:
    - Bất kỳ exception nào → log warning → return []
    - Không raise ngoại lệ tới caller
    """
```

### 3.3 VN→UTC conversion

```python
import pytz
from datetime import datetime

VN_TZ = pytz.timezone('Asia/Ho_Chi_Minh')

def _convert_dnse_time_to_utc(time_str: str) -> datetime:
    """"YYYY-MM-DD HH:MM:SS" VN local → UTC-aware datetime."""
    naive = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
    vn_aware = VN_TZ.localize(naive)
    return vn_aware.astimezone(pytz.UTC)
```

### 3.4 Mapping side

```python
_DNSE_SIDE_MAP = {
    'BUY': 'BUY',
    'B': 'BUY',
    'SELL': 'SELL',
    'S': 'SELL',
}

def _map_dnse_side(raw: str) -> str:
    return _DNSE_SIDE_MAP.get(str(raw).upper().strip(), 'UNKNOWN')
```

---

## 4. `UserDNSECredential` model

### 4.1 Full schema

```python
class UserDNSECredential(models.Model):
    user = models.OneToOneField(
        'auth.User', on_delete=models.CASCADE,
        related_name='dnse_credential',
        verbose_name='Người dùng',
    )
    api_key_encrypted = models.BinaryField(
        verbose_name='API Key (mã hóa Fernet)',
    )
    api_secret_encrypted = models.BinaryField(
        verbose_name='API Secret (mã hóa Fernet)',
    )
    is_system_provider = models.BooleanField(
        default=False, db_index=True,
        verbose_name='Dùng làm nguồn cấp hệ thống (admin only)',
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Đã xác minh thành công với DNSE',
    )
    last_verified_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Lần xác minh gần nhất',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'identity_access_user_dnse_credential'
        verbose_name = 'DNSE Credential của người dùng'
        verbose_name_plural = 'DNSE Credentials của người dùng'
        constraints = [
            models.UniqueConstraint(
                fields=['is_system_provider'],
                condition=models.Q(is_system_provider=True),
                name='unique_active_system_provider',
            ),
        ]
```

### 4.2 Encryption scheme

```python
# settings.py
DNSE_CREDENTIAL_FERNET_KEY = os.environ.get('DNSE_CREDENTIAL_FERNET_KEY', '')
# Nếu empty trong production → raise ImproperlyConfigured

# identity_access/models.py
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

def _get_fernet() -> Fernet:
    key = settings.DNSE_CREDENTIAL_FERNET_KEY
    if not key:
        raise ImproperlyConfigured('DNSE_CREDENTIAL_FERNET_KEY must be set')
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_dnse_credential(plain_text: str) -> bytes:
    return _get_fernet().encrypt(plain_text.encode('utf-8'))

def decrypt_dnse_credential(cipher_bytes: bytes) -> str:
    return _get_fernet().decrypt(bytes(cipher_bytes)).decode('utf-8')

def get_system_provider_credentials() -> tuple[str, str] | None:
    """Trả (api_key, api_secret) của system provider credential, hoặc None."""
    try:
        cred = UserDNSECredential.objects.select_related('user').get(
            is_system_provider=True,
            is_verified=True,
        )
        return (
            decrypt_dnse_credential(cred.api_key_encrypted),
            decrypt_dnse_credential(cred.api_secret_encrypted),
        )
    except UserDNSECredential.DoesNotExist:
        return None
```

### 4.3 Access control

```
is_system_provider=True:
  - Chỉ staff/superuser mới được set
  - View PATCH /set-system-provider/ kiểm tra request.user.is_staff
  - Thay đổi ghi vào ConfigChangeAudit (nếu có)

Credential data:
  - Chỉ trả is_verified, is_system_provider, last_verified_at — KHÔNG trả api_key/api_secret
  - Celery task dùng user_id để lookup, không nhận plain key qua args
```

---

## 5. System backfill pipeline

### 5.1 Flow

```
Admin → POST /core/v1/data-ingest/trigger/whale-backfill/
  → DataIngestAdminViewSet.trigger_whale_backfill()
    → Validate request (symbols, days_back, overwrite)
    → ServiceRunLog.create(status='queued')
    → backfill_intraday_tick_system.apply_async(kwargs={...})
    → Response 202 { task_id, service_run_log_id, status, message }

backfill_intraday_tick_system():
  1. get_system_provider_credentials() → (api_key, api_secret)
     Nếu None → return { status: 'aborted', reason: 'no_system_provider' }
  2. symbols = arg or GlobalSymbolRegistry hot+warm tiers
  3. trading_days = _get_trading_days_in_range(days_back)
  4. for symbol in symbols:
       for day in trading_days:
         if not overwrite and IntradayTick.objects.filter(
               symbol=symbol, timestamp__date=day).exists():
           dates_skipped_already_exists += 1
           continue
         rows = fetch_intraday_tape_history(symbol, day, api_key, api_secret)
         if rows:
           ticks = [IntradayTick(source='dnse_system', **r) for r in rows]
           IntradayTick.objects.bulk_create(ticks, batch_size=500)
           ticks_inserted += len(ticks)
           dates_inserted += 1
           # Trigger detection cho phiên này
           detect_and_store_global_whale_alerts.apply_async(
               kwargs={'symbol': symbol, 'session_date': str(day)},
               countdown=5,
           )
         time.sleep(1.2)  # rate limit
  5. Update ServiceRunLog(status='success', output_summary={...})
  6. return summary dict
```

### 5.2 Trading days helper

```python
def _get_trading_days_in_range(days_back: int) -> list[date]:
    """Trả list ngày giao dịch (thứ 2–6) trong days_back ngày gần nhất."""
    from datetime import date, timedelta
    today = date.today()
    result = []
    d = today - timedelta(days=1)  # bắt đầu từ hôm qua
    while len(result) < days_back:
        if d.weekday() < 5:  # 0=Mon, 4=Fri
            result.append(d)
        d -= timedelta(days=1)
    return sorted(result)  # ascending order
```

---

## 6. User self-serve backfill pipeline

### 6.1 Rate limiting

```python
class UserBackfillThrottle(UserRateThrottle):
    scope = 'user_whale_backfill'

# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        ...
        'user_whale_backfill': '5/day',
        'user_whale_backfill_burst': '1/120s',
    }
}
```

### 6.2 Flow

```
User → POST /core/v1/whale/backfill-symbol/ { symbol, days_back }
  → Throttle check (5/day + 1/2min)
  → Validate symbol (alphanumeric, max 10 chars)
  → Validate days_back (1..180)
  → UserDNSECredential.objects.filter(user=request.user, is_verified=True).exists()
     Nếu không có → Response 400 { detail: 'Bạn chưa kết nối DNSE', code: 'no_dnse_credential' }
  → backfill_intraday_tick_user.apply_async(kwargs={user_id, symbol, days_back})
  → Response 202 { task_id, symbol, status: 'queued', message }

backfill_intraday_tick_user():
  1. Lookup UserDNSECredential bằng user_id → decrypt credentials
     Nếu không có → return { status: 'no_credential' }
  2. trading_days = _get_trading_days_in_range(days_back)
  3. for day in trading_days:
       count = IntradayTick.objects.filter(symbol=symbol, timestamp__date=day).count()
       if count >= 100:
         dates_skipped_system_has_data += 1
         continue
       rows = fetch_intraday_tape_history(symbol, day, api_key, api_secret)
       if rows:
         # Nếu có partial data (0 < count < 100), xử lý như missing
         ticks = [IntradayTick(source='dnse_user', **r) for r in rows]
         IntradayTick.objects.bulk_create(ticks, batch_size=500,
             ignore_conflicts=False)  # OK vì đã check presence
         ticks_inserted += len(ticks)
         dates_inserted += 1
         detect_and_store_global_whale_alerts.apply_async(
             kwargs={'symbol': symbol, 'session_date': str(day)},
             countdown=5,
         )
       time.sleep(1.0)
  4. return summary dict
```

---

## 7. Extended detection task

### 7.1 `detect_and_store_global_whale_alerts` với `session_date`

```python
@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def detect_and_store_global_whale_alerts(
    self,
    symbol: str | None = None,
    session_date: str | None = None,  # "YYYY-MM-DD" hoặc None
):
    # session_date=None → behaviour cũ (dùng _get_latest_session_date())
    if session_date is not None:
        from datetime import date as date_type
        from django.utils.dateparse import parse_date
        _session_date = parse_date(session_date)
        if _session_date is None:
            logger.error('Invalid session_date: %s', session_date)
            return {'status': 'error', 'reason': 'invalid_session_date'}
    else:
        _session_date = _get_latest_session_date()

    if _session_date is None:
        return {'status': 'skipped', 'reason': 'no_tick_data'}

    # Phần còn lại giống hiện tại, thay session_date bằng _session_date
    ...
```

---

## 8. API contract (OpenAPI-compliant)

### 8.1 POST /core/v1/data-ingest/trigger/whale-backfill/

```yaml
operationId: triggerWhaleBackfill
tags: [data-ingest]
security: [{ BearerAuth: [] }]
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties:
          symbols:
            type: array
            items: { type: string }
            nullable: true
            description: "Danh sách mã. null = tất cả hot+warm tier"
          days_back:
            type: integer
            default: 90
            minimum: 1
            maximum: 365
          overwrite:
            type: boolean
            default: false
responses:
  '202':
    description: Task queued
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/IngestTriggerResponse'
  '401': { $ref: '#/components/responses/Unauthorized' }
  '403': { $ref: '#/components/responses/Forbidden' }
  '429': { $ref: '#/components/responses/RateLimited' }
```

### 8.2 POST /core/v1/whale/backfill-symbol/

```yaml
operationId: userWhaleBackfillSymbol
tags: [whale]
security: [{ BearerAuth: [] }]
requestBody:
  content:
    application/json:
      schema:
        type: object
        required: [symbol]
        properties:
          symbol:
            type: string
            maxLength: 10
            pattern: '^[A-Z0-9]{1,10}$'
          days_back:
            type: integer
            default: 90
            minimum: 1
            maximum: 180
responses:
  '202': { description: Task queued }
  '400': { description: No credential / Invalid input }
  '429': { description: Rate limit exceeded (5/day) }
```

### 8.3 Credential endpoints

```yaml
GET /core/v1/user/dnse-credential/:
  response: { has_credential, is_system_provider, is_verified, last_verified_at }
  # KHÔNG trả api_key, api_secret

POST /core/v1/user/dnse-credential/:
  request: { api_key: string, api_secret: string }
  response: { has_credential: true, is_verified: false }
  # api_key/api_secret được encrypt ngay tại view layer, không log

DELETE /core/v1/user/dnse-credential/:
  response: 204 No Content

POST /core/v1/user/dnse-credential/verify/:
  response: { is_verified: true|false, message: string }

PATCH /core/v1/user/dnse-credential/set-system-provider/:
  permission: IsAdminUser
  request: { is_system_provider: true|false }
  response: { is_system_provider: bool }
```

---

## 9. Security design

| Threat | Mitigation |
|---|---|
| Credential in plaintext at rest | Fernet encryption với `DNSE_CREDENTIAL_FERNET_KEY` env var |
| Credential leak qua API response | Serializer không expose `api_key_encrypted`/`api_secret_encrypted` |
| Credential in Celery task args | Task nhận `user_id` (int), không nhận plain key |
| Credential in logs | Adapter chỉ log `symbol + status`, không log key params |
| SSRF via DNSE API URL | Dùng vnbroker library, không hardcode URL, không user-controlled URL |
| Symbol injection vào Redis key | Validate `^[A-Z0-9]{1,10}$` trước khi dùng |
| Cross-user credential access | Task query `UserDNSECredential.objects.get(user_id=user_id)` — strict user-scoped |
| Privilege escalation is_system_provider | View check `request.user.is_staff` trước khi cho phép set |
| Rate limit bypass | DRF throttle class `UserBackfillThrottle` 5/day + burst |
| Credential key rotation | Fernet key rotation bằng cách update env var + re-encrypt (procedure manual) |

---

## 10. Reliability patterns

1. **Bounded retry**: `max_retries=1` cho system task, `max_retries=0` cho user task (user tự retry).
2. **Partial success**: Task vẫn trả về kết quả dù 1 số ngày/symbol fail.
3. **Idempotency**: Presence check đảm bảo duplicate-safe mà không cần DB unique constraint.
4. **DNSE throttle**: sleep giữa requests để tránh rate limit từ DNSE.
5. **Detection countdown**: `countdown=5` trước khi trigger detection để bulk_create hoàn tất trước.
6. **ServiceRunLog**: Audit trail cho admin — ghi input/output/errors.

---

## 11. Observability

| Metric | Source | Surface |
|---|---|---|
| `ticks_inserted` | Task return | ServiceRunLog.output_summary |
| `dates_inserted` / `dates_skipped` | Task return | ServiceRunLog.output_summary |
| `status: aborted / no_system_provider` | Task abort | ServiceRunLog.error_detail |
| User backfill requests/day | DRF throttle | Admin Django |
| `detect_and_store` historical sessions | Celery task logs | Celery flower / logs |
