# Code Quality Constitution — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## 1. Absolute rules (vi phạm → block merge)

1. **Tuyệt đối cấm import `DNSEQuote` hoặc bất kỳ module nội bộ vnbroker** bên ngoài `market_data/vnbroker_adapter.py`. Mọi caller phải dùng `fetch_intraday_tape_history()`.

2. **Tuyệt đối cấm log `api_key`, `api_secret`, hoặc bất kỳ credential plaintext** trong bất kỳ file nào. Logger chỉ được ghi `symbol`, `trade_date`, `status`.

3. **Tuyệt đối cấm trả `api_key_encrypted`/`api_secret_encrypted`** trong API response. Serializer phải explicit exclude.

4. **Tuyệt đối cấm `except: pass`** hay `except Exception: pass` trong API view path và Celery task main path.

5. **Celery task không được nhận plain text credential qua args** — chỉ nhận `user_id` (int), tự lookup từ DB.

6. **`is_system_provider=True` chỉ được set qua endpoint có `request.user.is_staff` check** — không được set trực tiếp từ code thường.

7. **Không tạo per-user data copy** — `IntradayTick` là shared table. User backfill chỉ fill khoảng trống trong shared table, không tạo bảng riêng.

8. **Không direct fetch tới DNSE từ frontend** — mọi request phải qua Django backend.

9. **`days_back` user phải bị clamp max 180** tại view layer trước khi đưa vào task.

10. **Text mới trong frontend phải qua i18n** — không hardcode string tiếng Việt hay tiếng Anh trong JSX.

---

## 2. Required implementation style

1. **Error response theo chuẩn**:
   ```python
   return Response({
       'detail': 'Bạn chưa kết nối tài khoản DNSE',
       'code': 'no_dnse_credential',
       'timestamp': now().isoformat(),
   }, status=400)
   ```

2. **Task return value phải có đủ counters**:
   ```python
   {
       'status': 'done' | 'partial' | 'aborted' | 'no_credential',
       'symbols_processed': int,
       'dates_inserted': int,
       'ticks_inserted': int,
       'dates_skipped_already_exists': int,
       'dates_skipped_system_has_data': int,
       'errors': list[str],
   }
   ```

3. **Fernet encrypt phải gọi `_get_fernet()` mỗi lần** — không cache Fernet instance dài hạn (key rotation).

4. **Throttle class phải inherit từ `UserRateThrottle`** — không tự implement rate counting.

5. **Presence check phải là `exists()`** — không `.count()` cho check binary (performance).

---

## 3. Required review questions (tự hỏi trước mỗi PR)

1. Thay đổi này có import vnbroker trực tiếp từ ngoài adapter không?
2. Có đường dẫn nào mà `api_key`/`api_secret` bị ghi vào log không?
3. Có serializer nào expose `api_key_encrypted`/`api_secret_encrypted` trong response không?
4. Task Celery có nhận plain credential qua kwargs không?
5. Presence check idempotency có hoạt động cho cả overwrite=True lẫn overwrite=False không?
6. i18n đã cover toàn bộ text mới chưa?
7. `days_back` đã được clamp đúng chưa?
8. Frontend có gọi DNSE API hay backend backfill API trực tiếp (không qua coreApiAdapter) không?
9. Rate limit test đã có chưa (test HTTP 429)?
10. Evidence template đã điền đủ cho slice này chưa?

---

## 4. Patterns cấm

```python
# CẤM
from vnbroker.explorer.dnse.quote import DNSEQuote  # anywhere outside adapter

# CẤM
logger.info(f"api_key={api_key}, api_secret={api_secret}")

# CẤM
class UserDNSECredentialSerializer(serializers.ModelSerializer):
    class Meta:
        fields = '__all__'  # expose api_key_encrypted!

# CẤM
@shared_task
def backfill_intraday_tick_user(user_id, symbol, api_key, api_secret):  # plain creds in args!
    ...

# CẤM
except Exception:
    pass

# CẤM — direct DNSE call từ view
def my_view(request):
    q = DNSEQuote(...)  # bypass adapter SSOT!
```

---

## 5. Patterns bắt buộc

```python
# ĐÚNG — dùng SSOT adapter
from market_data.vnbroker_adapter import fetch_intraday_tape_history

# ĐÚNG — không log credential
logger.info('Backfill symbol=%s date=%s', symbol, trade_date)

# ĐÚNG — serializer explicit exclude
class UserDNSECredentialResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDNSECredential
        fields = ['has_credential', 'is_system_provider', 'is_verified', 'last_verified_at']

# ĐÚNG — task nhận user_id
@shared_task
def backfill_intraday_tick_user(user_id: int, symbol: str, days_back: int = 90):
    cred = UserDNSECredential.objects.get(user_id=user_id)
    api_key = decrypt_dnse_credential(cred.api_key_encrypted)
    ...

# ĐÚNG — presence check
if IntradayTick.objects.filter(symbol=sym, timestamp__date=d).exists():
    dates_skipped += 1
    continue
```
