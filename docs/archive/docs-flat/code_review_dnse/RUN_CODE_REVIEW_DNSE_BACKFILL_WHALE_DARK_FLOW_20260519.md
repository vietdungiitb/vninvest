# Run Code Review — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## Mục tiêu

Code review tập trung vào:
1. SSOT rule — không có DNSEQuote import ngoài adapter
2. Credential security — không log, không expose, không plain text qua Celery args
3. Idempotency — presence check trước mọi bulk_create
4. Access control — is_system_provider chỉ admin mới set
5. Rate limit — UserBackfillThrottle enforce đúng
6. Data isolation — không tạo per-user silo
7. Backwards compatibility — detection task không phá behavior cũ
8. i18n — text mới qua i18n

---

## Review checklist

### R-01: SSOT Adapter

```powershell
# Không có DNSEQuote import ngoài adapter
grep -rn "DNSEQuote\|from vnbroker.explorer.dnse\|from vnbroker import" `
  packages/core/backend/src --include="*.py" | `
  Where-Object { $_ -notmatch "vnbroker_adapter.py" }
```

Kỳ vọng: 0 dòng match.

---

### R-02: Credential không bị log

```powershell
# Kiểm tra log statement có api_key/api_secret
grep -rn "api_key\|api_secret" packages/core/backend/src --include="*.py" | `
  Where-Object { $_ -match "log\.|print\|logger" }
```

Kỳ vọng: 0 dòng match có logger/print kèm credential.

---

### R-03: API response không expose credential

```powershell
# Kiểm tra serializer không expose encrypted fields
grep -A 20 "class UserDNSECredentialSerializer\|class DNSECredentialSerializer" `
  packages/core/backend/src/identity_access/serializers.py
```

Kỳ vọng: `fields` list không chứa `api_key_encrypted` hay `api_secret_encrypted`.

---

### R-04: Celery task args không chứa plain credential

```powershell
# Kiểm tra task signature
grep -A 5 "def backfill_intraday_tick_user\|def backfill_intraday_tick_system" `
  packages/core/backend/src/data_ingest/tasks.py
```

Kỳ vọng: params chỉ là `user_id: int, symbol: str, days_back: int`. Không có `api_key`, `api_secret`.

---

### R-05: Presence check trước bulk_create

```powershell
# Xác nhận presence check pattern
grep -B 2 -A 2 "bulk_create\|dates_skipped" `
  packages/core/backend/src/data_ingest/tasks.py
```

Kỳ vọng: mọi `bulk_create` đều có `if IntradayTick.objects.filter(...)` guard.

---

### R-06: is_system_provider access control

```powershell
# Kiểm tra view set-system-provider có is_staff check
grep -A 15 "set.system.provider" `
  packages/core/backend/src/identity_access/views.py
```

Kỳ vọng: có `permission_classes = [IsAdminUser]` hoặc `if not request.user.is_staff: return 403`.

---

### R-07: Rate limit đăng ký đúng

```powershell
# Kiểm tra throttle class
grep -n "UserBackfillThrottle\|user_whale_backfill" `
  packages/core/backend/src/data_ingest/views.py `
  packages/core/backend/src/vninvest_core/settings.py
```

Kỳ vọng: throttle class được khai báo và đăng ký trong `DEFAULT_THROTTLE_RATES`.

---

### R-08: days_back clamp user

```powershell
# Kiểm tra clamp logic trong view
grep -n "days_back\|min.*180\|clamp" `
  packages/core/backend/src/data_ingest/views.py
```

Kỳ vọng: `days_back = min(days_back, 180)` hoặc serializer validation.

---

### R-09: Frontend không direct fetch

```powershell
# Kiểm tra không có direct fetch/axios trong new components
grep -rn "axios\.\|fetch(" `
  packages/web/src/components/soc/WhaleBackfillPanel.jsx `
  packages/web/src/components/settings/DNSECredentialTab.jsx `
  packages/web/src/components/whale/SymbolBackfillTrigger.jsx
```

Kỳ vọng: 0 match. Chỉ được dùng `coreApiAdapter`.

---

### R-10: i18n coverage

```powershell
# Kiểm tra không có hardcoded Vietnamese string trong JSX
grep -rn '"Kết nối\|"Bắt đầu\|"Xóa\|"Xác minh\|"Tải lịch sử' `
  packages/web/src/components/soc/WhaleBackfillPanel.jsx `
  packages/web/src/components/settings/DNSECredentialTab.jsx `
  packages/web/src/components/whale/SymbolBackfillTrigger.jsx
```

Kỳ vọng: 0 match. Tất cả qua `t('...')`.

---

### R-11: Backwards compatibility detection task

```powershell
# Kiểm tra signature detect task
grep -A 3 "def detect_and_store_global_whale_alerts" `
  packages/core/backend/src/signal_intelligence/tasks.py
```

Kỳ vọng: `session_date=None` là default param; call không có session_date vẫn hoạt động.

---

### R-12: except cấm

```powershell
# Kiểm tra không có bare except
grep -rn "except:\|except Exception: pass" `
  packages/core/backend/src/data_ingest/tasks.py `
  packages/core/backend/src/data_ingest/views.py `
  packages/core/backend/src/identity_access/views.py
```

Kỳ vọng: 0 match.

---

## Final gate

Mọi check phải PASS trước khi merge. Bất kỳ match nào không mong đợi → fix và re-run.

```powershell
# Chạy tests
Push-Location ./packages/core/backend
python manage.py test market_data.tests.test_vnbroker_adapter_history --keepdb
python manage.py test identity_access.tests.test_dnse_credential --keepdb
python manage.py test data_ingest.tests.test_backfill_tasks --keepdb
python manage.py test signal_intelligence.tests.test_detect_historical --keepdb
Pop-Location

# Build frontend
Push-Location ./packages/web
npm run build
Pop-Location
```
